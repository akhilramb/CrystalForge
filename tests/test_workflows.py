import os
from pathlib import Path
import tempfile

os.environ["CRYSTALFORGE_DB"] = str(Path(tempfile.mkdtemp()) / "test.db")
import numpy as np
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.catalog import catalog
from backend.services.economics import economics

client = TestClient(app)


def test_health_and_pagination():
    assert client.get("/api/health").json()["model_ready"]
    d = client.get("/api/materials?page_size=3").json()
    assert d["total"] == 6185 and len(d["items"]) == 3
    assert client.get("/api/materials?page_size=10000").status_code == 422


def test_prediction_is_real_and_uncertainty_is_calibrated():
    d = client.post(
        "/api/predict",
        json={
            "formula": "LiFePO4",
            "working_ion": "Li",
            "crystal_system": "Orthorhombic",
            "space_group_number": 62,
        },
    ).json()
    assert np.isfinite(d["predicted_voltage"])
    assert d["interval"][0] < d["predicted_voltage"] < d["interval"][1]
    assert len(d["similar"]) == 5
    saved = client.get("/api/history/" + str(d["history_id"])).json()
    assert saved["result"]["predicted_voltage"] == d["predicted_voltage"]
    rerun = client.post("/api/history/" + str(d["history_id"]) + "/rerun").json()
    assert rerun["predicted_voltage"] == d["predicted_voltage"]
    for fmt, magic in [("pdf", b"%PDF"), ("csv", b"Property")]:
        r = client.post(
            "/api/reports", json={"history_id": d["history_id"], "format": fmt}
        )
        assert r.status_code == 200 and r.content.startswith(magic)


def test_scientific_validation():
    for payload in [
        {"formula": "invalid", "working_ion": "Li"},
        {"formula": "LiFePO4", "working_ion": "Na"},
        {"formula": "FePO4", "working_ion": "Li"},
        {
            "formula": "LiFePO4",
            "working_ion": "Li",
            "crystal_system": "Cubic",
            "space_group_number": 62,
        },
    ]:
        assert client.post("/api/predict", json=payload).status_code == 422
    assert (
        client.post(
            "/api/discover", json={"voltage_min": 5, "voltage_max": 2}
        ).status_code
        == 422
    )
    assert client.get("/api/materials/not-real").status_code == 404


def test_cost_conserves_mass_and_missing_prices():
    e = economics("LiFePO4")
    assert sum(r["mass_fraction"] for r in e["breakdown"]) == pytest.approx(1)
    assert e["cost"] == pytest.approx(
        sum(r["contribution"] for r in e["breakdown"]), abs=0.001
    )
    assert economics("CsLiAcO3")["cost"] is None
    assert economics("CsLiAcO3")["sustainability"] is None


def test_discovery_constraints_and_ranking():
    d = client.post(
        "/api/discover",
        json={"working_ion": "Li", "voltage_min": 3, "voltage_max": 4, "cost_max": 30},
    ).json()
    assert d["total"] > 0
    assert d["items"] == sorted(d["items"], key=lambda x: x["score"], reverse=True)
    for m in d["items"]:
        assert (
            m["working_ion"] == "Li"
            and 3 <= m["predicted_voltage"] <= 4
            and m["cost"] <= 30
        )
        assert m["score"] == pytest.approx(sum(m["contributions"].values()), abs=0.11)


def test_saved_compare_structure_and_delete():
    id = "cf-00001"
    assert (
        client.post(
            "/api/saved", json={"material_id": id, "note": "Check source"}
        ).status_code
        == 200
    )
    assert client.get("/api/saved").json()[0]["note"] == "Check source"
    assert len(client.post("/api/compare", json={"ids": [id, "cf-00002"]}).json()) == 2
    assert (
        client.get("/api/materials/" + id + "/structure").json()["available"] is False
    )
    assert client.delete("/api/saved/" + id).status_code == 200
    assert client.get("/api/saved").json() == []


def test_no_target_features_or_split_overlap():
    c = catalog()
    features = c.bundle["metadata"]["features"]
    assert not any(
        "voltage" in f or f in ["good_electrode", "data_split", "cv_fold_5"]
        for f in features
    )
    assert c.df.groupby("split_group_id").data_split.nunique().max() == 1
    meta = c.bundle["metadata"]
    assert (
        meta["selected_model"]
        == min(meta["models"], key=lambda m: m["validation"]["mae"])["name"]
    )


def test_analytics_and_api_404():
    d = client.get("/api/analytics").json()
    assert sum(x["value"] for x in d["ions"]) == 6185
    assert client.get("/api/unknown-endpoint").status_code == 404


def test_browser_sessions_cannot_read_or_delete_other_history():
    a = TestClient(app)
    b = TestClient(app)
    row = a.post(
        "/api/predict", json={"formula": "LiFePO4", "working_ion": "Li"}
    ).json()
    assert b.get("/api/history/" + str(row["history_id"])).status_code == 404
    b.delete("/api/history/" + str(row["history_id"]))
    assert a.get("/api/history/" + str(row["history_id"])).status_code == 200
    a.post("/api/saved", json={"material_id": "cf-00002", "note": "Private note"})
    assert b.get("/api/saved").json() == []
