import numpy as np
from backend.services.catalog import catalog


def discover(p):
    c = catalog()
    if not c.bundle:
        raise RuntimeError("Model unavailable. Train the model first.")
    d = c.df
    d = d[d.working_ion == p["working_ion"]]
    if p.get("crystal_system"):
        d = d[d.crystal_system == p["crystal_system"]]
    if p.get("space_group_number"):
        d = d[d.space_group_number == p["space_group_number"]]
    d = d[(d.prediction >= p["voltage_min"]) & (d.prediction <= p["voltage_max"])]
    if p.get("cost_max") is not None:
        d = d[d.cost <= p["cost_max"]]
    if p["cost_priority"] > 0:
        d = d[d.cost.notna()]
    if p["sustainability_priority"] > 0:
        d = d[d.sustainability.notna()]
    target = (p["voltage_min"] + p["voltage_max"]) / 2
    width = max(0.25, (p["voltage_max"] - p["voltage_min"]) / 2)
    weights = {
        "voltage_match": 1,
        "performance": p["performance_priority"] / 100,
        "cost": p["cost_priority"] / 100,
        "sustainability": p["sustainability_priority"] / 100,
        "stability": p["performance_priority"] / 100,
    }
    total = sum(weights.values())
    items = []
    for r in d.itertuples():
        scores = {
            "voltage_match": max(0, 1 - abs(r.prediction - target) / (2 * width)),
            "performance": min(1, max(0, r.capacity_grav / 300))
            if np.isfinite(r.capacity_grav)
            else 0,
            "cost": 1 / (1 + r.cost / 25) if np.isfinite(r.cost) else 0,
            "sustainability": r.sustainability / 100
            if np.isfinite(r.sustainability)
            else 0,
            "stability": max(0, 1 - max(0, r.e_above_hull) / 0.2)
            if np.isfinite(r.e_above_hull)
            else 0,
        }
        contributions = {
            k: round(v * weights[k] / total * 100, 2) for k, v in scores.items()
        }
        items.append(
            dict(
                c.record(r.record_id, False),
                score=round(sum(contributions.values()), 1),
                contributions=contributions,
            )
        )
    items.sort(key=lambda x: x["score"], reverse=True)
    return {
        "total": len(items),
        "items": items[:10],
        "weights": weights,
        "target_voltage": target,
        "method": "Weighted screening score, not a probability. Voltage match uses distance to target midpoint; capacity saturates at 300 mAh/g, cost uses 1/(1+USD/kg /25), stability declines to zero at 0.2 eV/atom. Missing performance/stability contributes zero. Candidates missing requested cost/sustainability are excluded.",
    }
