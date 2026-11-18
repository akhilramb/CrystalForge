from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator

from backend.routes.dependencies import optional_identity, run
from backend.services.catalog import catalog
from backend.services.discovery import discover
from backend.services.user_runs import save_user_run
from ml.feature_builder import SYSTEMS

Ion = Literal["Li", "Mg", "Ca", "Zn", "Y", "Al"]

router = APIRouter()


class PredictInput(BaseModel):
    material_id: str | None = None
    formula: str = Field(default="", max_length=150)
    working_ion: Ion | Literal["Na"] = "Li"
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


@router.post("/api/predict")
def predict(
    p: PredictInput,
    identity: tuple[str, dict | None] = Depends(optional_identity),
):
    inputs = p.model_dump()
    result = run(catalog().predict, inputs)
    token, _ = identity
    result["history_id"] = (
        save_user_run(token, inputs, result, "prediction") if token else None
    )
    return result


@router.post("/api/discover")
def discovery(
    p: DiscoverInput,
    identity: tuple[str, dict | None] = Depends(optional_identity),
):
    inputs = p.model_dump()
    result = run(discover, inputs)
    token, _ = identity
    result["history_id"] = (
        save_user_run(token, inputs, result, "discovery") if token else None
    )
    return result
