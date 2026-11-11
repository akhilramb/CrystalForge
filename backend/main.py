from typing import Literal
from datetime import datetime, timezone
import json
import os
from uuid import uuid4, UUID
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, model_validator
from pymatgen.core import Structure
from backend.config import ROOT
from backend.services.catalog import catalog
from backend.services.discovery import discover
from backend.services import storage
from backend.services.reports import generate
from ml.feature_builder import IONS, SYSTEMS

app = FastAPI(title="CrystalForge", version="1.0.0")


@app.middleware("http")
async def browser_session(request, call_next):
    raw = request.cookies.get("cf_session")
    try:
        current = str(UUID(raw))
    except (ValueError, TypeError, AttributeError):
        current = str(uuid4())
    token = storage.session_id.set(current)
    try:
        response = await call_next(request)
        if raw != current:
            response.set_cookie(
                "cf_session",
                current,
                httponly=True,
                samesite="lax",
                secure=os.environ.get("CRYSTALFORGE_SECURE_COOKIE") == "1",
                max_age=2592000,
            )
        return response
    finally:
        storage.session_id.reset(token)


Ion = Literal["Li", "Mg", "Ca", "Zn", "Y", "Al"]


class PredictInput(BaseModel):
    material_id: str | None = None
    formula: str = Field(default="", max_length=150)
    working_ion: Ion = "Li"
    crystal_system: str | None = None
    space_group_number: int | None = Field(default=None, ge=1, le=230)
    frac_discharge: float | None = Field(default=None, gt=0, lt=1)

    @model_validator(mode="after")
    def validate_science(self):
        if not self.material_id and not self.formula.strip():
            raise ValueError("Formula or catalog material is required.")
        if self.crystal_system and self.crystal_system not in SYSTEMS:
            raise ValueError("Unsupported crystal system.")
        if self.space_group_number and self.crystal_system:
            n = self.space_group_number
            expected = (
                "Triclinic"
                if n <= 2
                else "Monoclinic"
                if n <= 15
                else "Orthorhombic"
                if n <= 74
                else "Tetragonal"
                if n <= 142
                else "Trigonal"
                if n <= 167
                else "Hexagonal"
                if n <= 194
                else "Cubic"
            )
            if expected != self.crystal_system:
                raise ValueError(
                    "Space group does not match the selected crystal system."
                )
        return self


class DiscoverInput(BaseModel):
    working_ion: Ion = "Li"
    voltage_min: float = Field(default=2.5, ge=-10, le=15)
    voltage_max: float = Field(default=4.5, ge=-10, le=15)
    crystal_system: str | None = None
    space_group_number: int | None = Field(default=None, ge=1, le=230)
    cost_max: float | None = Field(default=None, ge=0)
    cost_priority: int = Field(default=50, ge=0, le=100)
    sustainability_priority: int = Field(default=50, ge=0, le=100)
    performance_priority: int = Field(default=70, ge=0, le=100)

    @model_validator(mode="after")
    def ordered(self):
        if self.voltage_min > self.voltage_max:
            raise ValueError("Minimum voltage must not exceed maximum voltage.")
        if self.crystal_system and self.crystal_system not in SYSTEMS:
            raise ValueError("Unsupported crystal system.")
        return self


class IDs(BaseModel):
    ids: list[str] = Field(min_length=2, max_length=4)


class Saved(BaseModel):
    material_id: str
    note: str = Field(default="", max_length=2000)


class Report(BaseModel):
    material_id: str | None = None
    history_id: int | None = None
    format: Literal["pdf", "csv"] = "pdf"


def run(fn, *args):
    try:
        return fn(*args)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_ready": catalog().bundle is not None,
        "model_error": catalog().error,
    }


@app.get("/api/options")
def options():
    return {"ions": IONS, "systems": SYSTEMS}


@app.get("/api/materials")
def materials(
    q: str = "",
    ion: str = "",
    system: str = "",
    voltage_min: float | None = None,
    voltage_max: float | None = None,
    cost_max: float | None = None,
    stable: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    sort: str = "formula",
):
    return catalog().search(
        q,
        ion,
        system,
        voltage_min,
        voltage_max,
        cost_max,
        stable,
        page,
        page_size,
        sort,
    )


@app.get("/api/materials/{id}")
def material(id: str):
    return run(catalog().record, id)


@app.get("/api/materials/{id}/similar")
def similar(id: str):
    c = catalog()
    i = run(c.index, id)
    if not c.bundle:
        raise HTTPException(503, "Model unavailable.")
    return c.similar(c.features[[i]], id)


@app.get("/api/materials/{id}/structure")
def structure(id: str):
    r = run(catalog().record, id)
    mp = r.get("preferred_structure_mp_id")
    # Only a fixed local path derived from a verified catalog ID; never arbitrary URL fetching.
    f = ROOT / "data/structures" / f"{mp}.cif"
    if not f.exists():
        return {
            "available": False,
            "message": "Full atomic structure is not available for this material.",
            "source_url": r.get("materials_project_structure_url"),
        }
    try:
        s = Structure.from_file(f)
        return {
            "available": True,
            "source_url": r.get("materials_project_structure_url"),
            "lattice": s.lattice.matrix.tolist(),
            "sites": [
                {"element": str(x.specie), "position": x.coords.tolist()} for x in s
            ],
        }
    except Exception:
        raise HTTPException(422, "The stored CIF could not be parsed.")


@app.post("/api/predict")
def predict(p: PredictInput):
    inputs = p.model_dump()
    result = run(catalog().predict, inputs)
    result["history_id"] = storage.log("prediction", inputs, result)
    return result


@app.post("/api/discover")
def discovery(p: DiscoverInput):
    inputs = p.model_dump()
    result = run(discover, inputs)
    result["history_id"] = storage.log("discovery", inputs, result)
    return result


@app.post("/api/compare")
def compare(p: IDs):
    return [run(catalog().record, id) for id in dict.fromkeys(p.ids)]


@app.get("/api/model/metrics")
def model():
    if not catalog().bundle:
        raise HTTPException(503, "Model unavailable. Run python -m ml.train.")
    return catalog().bundle["metadata"]


@app.get("/api/analytics")
def analytics():
    c = catalog()
    d = c.df

    def hist(col):
        v = d[col].dropna().to_numpy()
        h, edges = np.histogram(v, bins=16)
        return [
            {"name": f"{a:.2f}–{b:.2f}", "value": int(n)}
            for a, b, n in zip(edges[:-1], edges[1:], h)
        ]

    def counts(col):
        return [
            {"name": str(k), "value": int(v)} for k, v in d[col].value_counts().items()
        ]

    return {
        "total": len(d),
        "ions": counts("working_ion"),
        "systems": counts("crystal_system"),
        "voltage": hist("target_voltage"),
        "capacity": hist("capacity_grav"),
        "cost": hist("cost"),
        "sustainability": hist("sustainability"),
        "stability": hist("e_above_hull"),
        "cost_available": int(d.cost.notna().sum()),
        "sustainability_available": int(d.sustainability.notna().sum()),
    }


class HistoryRun(BaseModel):
    kind: Literal["prediction", "discovery"]
    inputs: dict


@app.post("/api/history")
def create_history(p: HistoryRun):
    # Validate and actually execute the run; never accept fabricated result payloads.
    try:
        parsed = (
            PredictInput(**p.inputs)
            if p.kind == "prediction"
            else DiscoverInput(**p.inputs)
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    return predict(parsed) if p.kind == "prediction" else discovery(parsed)


@app.get("/api/history")
def history():
    return storage.history()


@app.get("/api/history/{id}")
def history_one(id: int):
    with storage.connect() as c:
        r = c.execute(
            "SELECT * FROM history WHERE id=? AND session=?",
            (id, storage.session_id.get()),
        ).fetchone()
    if r is None:
        raise HTTPException(404, "History entry not found.")
    return {
        **{k: r[k] for k in r.keys() if k != "session"},
        "inputs": json.loads(r["inputs"]),
        "result": json.loads(r["result"]),
    }


@app.post("/api/history/{id}/rerun")
def rerun(id: int):
    h = history_one(id)
    return (
        predict(PredictInput(**h["inputs"]))
        if h["kind"] == "prediction"
        else discovery(DiscoverInput(**h["inputs"]))
    )


@app.delete("/api/history/{id}")
def delete_history(id: int):
    with storage.connect() as c:
        c.execute(
            "DELETE FROM history WHERE id=? AND session=?",
            (id, storage.session_id.get()),
        )
    return {"deleted": True}


@app.get("/api/saved")
def saved():
    with storage.connect() as c:
        rows = c.execute(
            "SELECT * FROM saved WHERE session=? ORDER BY created DESC",
            (storage.session_id.get(),),
        ).fetchall()
    return [
        {
            **{k: r[k] for k in r.keys() if k != "session"},
            "material": catalog().record(r["material_id"], False),
        }
        for r in rows
    ]


@app.post("/api/saved")
def save(p: Saved):
    run(catalog().index, p.material_id)
    with storage.connect() as c:
        c.execute(
            "INSERT INTO saved VALUES (?,?,?,?) ON CONFLICT(session,material_id) DO UPDATE SET note=excluded.note",
            (
                p.material_id,
                datetime.now(timezone.utc).isoformat(),
                p.note,
                storage.session_id.get(),
            ),
        )
    return {"saved": True}


@app.delete("/api/saved/{id}")
def unsave(id: str):
    with storage.connect() as c:
        c.execute(
            "DELETE FROM saved WHERE material_id=? AND session=?",
            (id, storage.session_id.get()),
        )
    return {"deleted": True}


@app.post("/api/reports")
def report(p: Report):
    if p.material_id:
        r = run(catalog().record, p.material_id)
    elif p.history_id:
        h = history_one(p.history_id)
        if h["kind"] != "prediction":
            raise HTTPException(
                422, "Choose a material from the discovery result to export."
            )
        r = h["result"]
    else:
        raise HTTPException(422, "Choose a material or prediction history entry.")
    return Response(
        generate(r, p.format),
        media_type="application/pdf" if p.format == "pdf" else "text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="crystalforge-report.{p.format}"'
        },
    )


# A production Vite build is served by FastAPI; API paths never return HTML.
@app.get("/{path:path}")
def frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "Endpoint not found.")
    root = (ROOT / "frontend/dist").resolve()
    f = (root / path).resolve()
    if not f.is_relative_to(root):
        raise HTTPException(404)
    if f.is_file():
        return FileResponse(f)
    if (root / "index.html").exists():
        return FileResponse(root / "index.html")
    return {
        "message": "Build the frontend with npm install and npm run build inside frontend, or use its Vite dev server."
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000)
