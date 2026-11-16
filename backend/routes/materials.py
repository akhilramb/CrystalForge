from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.routes.dependencies import run
from backend.services.catalog import catalog
from backend.services.structures import resolve_structure

router = APIRouter()


class IDs(BaseModel):
    ids: list[str] = Field(min_length=2, max_length=4)


@router.get("/api/materials")
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


@router.get("/api/materials/{id}")
def material(id: str):
    return run(catalog().record, id)


@router.get("/api/materials/{id}/similar")
def similar(id: str):
    c = catalog()
    i = run(c.index, id)
    if not c.bundle:
        raise HTTPException(503, "Model unavailable.")
    return c.similar(c.features[[i]], id)


@router.get("/api/materials/{id}/structure")
def structure(id: str):
    return resolve_structure(run(catalog().record, id, False))


@router.post("/api/compare")
def compare(p: IDs):
    return [run(catalog().record, id) for id in dict.fromkeys(p.ids)]
