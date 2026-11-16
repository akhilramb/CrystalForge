import json

import numpy as np
from fastapi import APIRouter, HTTPException

from backend.config import ROOT
from backend.services.catalog import catalog
from ml.feature_builder import IONS, SYSTEMS

router = APIRouter()


@router.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_ready": catalog().bundle is not None,
        "model_error": catalog().error,
    }


@router.get("/api/ready")
def ready():
    if catalog().bundle is None:
        raise HTTPException(503, "Model unavailable.")
    return {"status": "ready"}


@router.get("/api/options")
def options():
    return {"ions": IONS, "systems": SYSTEMS}


@router.get("/api/model/metrics")
def model():
    if not catalog().bundle:
        raise HTTPException(503, "Model unavailable. Run python -m ml.train.")
    return catalog().bundle["metadata"]


@router.get("/api/model/framework-disjoint")
def framework_disjoint_metrics():
    path = ROOT / "models/framework_disjoint_evaluation.json"
    if not path.is_file():
        raise HTTPException(404, "Framework-disjoint evaluation is unavailable.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise HTTPException(503, "Framework-disjoint evaluation could not be read.")


@router.get("/api/analytics")
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
