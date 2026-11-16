import os
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from backend.routes.dependencies import require_identity, run
from backend.routes.predictions import DiscoverInput, PredictInput, discovery, predict
from backend.services.auth import public_auth_config, supabase_rest, supabase_url
from backend.services.catalog import catalog
from backend.services.reports import generate
from backend.services.user_runs import get_user_run, map_user_run

router = APIRouter()


class Saved(BaseModel):
    material_id: str
    note: str = Field(default="", max_length=2000)


class Report(BaseModel):
    material_id: str | None = None
    history_id: int | None = None
    format: Literal["pdf", "csv"] = "pdf"


class HistoryRun(BaseModel):
    kind: Literal["prediction", "discovery"]
    inputs: dict


@router.get("/api/auth/config")
def auth_config():
    return public_auth_config()


@router.delete("/api/account")
def delete_account(identity: tuple[str, dict] = Depends(require_identity)):
    _, claims = identity
    project_url = supabase_url()
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    user_id = claims.get("sub")
    if not project_url or not service_key:
        raise HTTPException(
            503,
            "Account deletion is not configured. Ask the administrator to configure it.",
        )
    try:
        response = httpx.delete(
            f"{project_url}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
            },
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Account deletion is temporarily unavailable.")
    if response.status_code not in (200, 204):
        raise HTTPException(503, "Account deletion could not be completed.")
    return {"deleted": True}


@router.post("/api/history")
def create_history(
    p: HistoryRun,
    identity: tuple[str, dict] = Depends(require_identity),
):
    # Validate and actually execute the run; never accept fabricated result payloads.
    try:
        parsed = (
            PredictInput(**p.inputs)
            if p.kind == "prediction"
            else DiscoverInput(**p.inputs)
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    return (
        predict(parsed, identity)
        if p.kind == "prediction"
        else discovery(parsed, identity)
    )


@router.get("/api/history")
def history(identity: tuple[str, dict] = Depends(require_identity)):
    token, _ = identity
    rows = supabase_rest(
        token,
        "prediction_history",
        params={"select": "*", "order": "created_at.desc", "limit": "200"},
    )
    return [map_user_run(row) for row in rows]


@router.get("/api/history/{id}")
def history_one(
    id: int, identity: tuple[str, dict] = Depends(require_identity)
):
    token, _ = identity
    return get_user_run(token, id)


@router.post("/api/history/{id}/rerun")
def rerun(id: int, identity: tuple[str, dict] = Depends(require_identity)):
    h = history_one(id, identity)
    return (
        predict(PredictInput(**h["inputs"]), identity)
        if h["kind"] == "prediction"
        else discovery(DiscoverInput(**h["inputs"]), identity)
    )


@router.delete("/api/history/{id}")
def delete_history(
    id: int, identity: tuple[str, dict] = Depends(require_identity)
):
    token, _ = identity
    supabase_rest(
        token,
        "prediction_history",
        "DELETE",
        params={"id": f"eq.{id}"},
    )
    return {"deleted": True}


@router.get("/api/saved")
def saved(identity: tuple[str, dict] = Depends(require_identity)):
    token, _ = identity
    rows = supabase_rest(
        token,
        "saved_materials",
        params={"select": "*", "order": "saved_at.desc", "limit": "200"},
    )
    return [
        {
            "id": row["id"],
            "material_id": row["material_id"],
            "created": row["saved_at"],
            "note": row["notes"],
            "material": catalog().record(row["material_id"], False),
        }
        for row in rows
    ]


@router.post("/api/saved")
def save(
    p: Saved, identity: tuple[str, dict] = Depends(require_identity)
):
    token, _ = identity
    record = run(catalog().record, p.material_id, False)
    supabase_rest(
        token,
        "saved_materials",
        "POST",
        params={"on_conflict": "user_id,material_id"},
        payload={
            "material_id": p.material_id,
            "material_name": record["formula"],
            "notes": p.note,
        },
        prefer="resolution=merge-duplicates,return=representation",
    )
    supabase_rest(
        token,
        "user_activity",
        "POST",
        payload={
            "activity_type": "saved_material",
            "resource_type": "material",
            "resource_id": p.material_id,
        },
    )
    return {"saved": True}


@router.delete("/api/saved/{id}")
def unsave(id: str, identity: tuple[str, dict] = Depends(require_identity)):
    token, _ = identity
    supabase_rest(
        token,
        "saved_materials",
        "DELETE",
        params={"material_id": f"eq.{id}"},
    )
    return {"deleted": True}


@router.post("/api/reports")
def report(
    p: Report, identity: tuple[str, dict] = Depends(require_identity)
):
    token, _ = identity
    if p.material_id:
        r = run(catalog().record, p.material_id)
    elif p.history_id:
        h = history_one(p.history_id, identity)
        if h["kind"] != "prediction":
            raise HTTPException(
                422, "Choose a material from the discovery result to export."
            )
        r = h["result"]
    else:
        raise HTTPException(422, "Choose a material or prediction history entry.")
    supabase_rest(
        token,
        "user_activity",
        "POST",
        payload={
            "activity_type": "report_created",
            "resource_type": "material" if p.material_id else "prediction_history",
            "resource_id": p.material_id or str(p.history_id),
        },
    )
    return Response(
        generate(r, p.format),
        media_type="application/pdf" if p.format == "pdf" else "text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="crystalforge-report.{p.format}"'
        },
    )
