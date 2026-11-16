import numpy as np

from fastapi.testclient import TestClient
from pymatgen.core import Lattice, Structure

from backend.main import app
from backend.services import structures

ROUTE = "/api/materials/cf-00001/structure"
MP_ID = "mp-1236215"


def setup_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(structures, "ROOT", tmp_path)
    monkeypatch.setenv("CRYSTALFORGE_STRUCTURE_CACHE", str(tmp_path / "cache"))
    monkeypatch.delenv("MP_API_KEY", raising=False)
    return tmp_path / "cache" / f"{MP_ID}.cif"


def test_missing_key_invalid_catalog_and_bad_mapping(monkeypatch, tmp_path):
    setup_cache(monkeypatch, tmp_path)
    with TestClient(app) as client:
        assert client.get(ROUTE).json()["reason"] == "missing_api_key"
        assert client.get("/api/materials/invalid/structure").status_code == 404
    assert structures.resolve_structure({"preferred_structure_mp_id": "../fake"})["reason"] == "invalid_mapping"


def test_upstream_structure_round_trip_and_cache(monkeypatch, tmp_path):
    path = setup_cache(monkeypatch, tmp_path)
    monkeypatch.setenv("MP_API_KEY", "test-key")
    calls = []

    def fetch(mp_id, key):
        calls.append((mp_id, key))
        # Synthetic structure tests serialization only. It ships neither in the app nor in the catalog.
        return Structure(Lattice.cubic(6), ["Cs", "Li", "Ac", "O", "O", "O"],
                         [[0, 0, 0], [.5, .5, .5], [.25, .25, .25],
                          [.5, .5, 0], [.5, 0, .5], [0, .5, .5]])

    monkeypatch.setattr(structures, "fetch_structure", fetch)
    with TestClient(app) as client:
        first = client.get(ROUTE).json()
        assert first["available"] and len(first["sites"]) == 6
        assert first["volume"] == 216
        assert first["provenance"]["method"] == "api"
        assert path.is_file()
        monkeypatch.delenv("MP_API_KEY")
        second = client.get(ROUTE).json()
        assert second["provenance"]["method"] == "cache"
        assert second["provenance"]["retrieved_at"] == first["provenance"]["retrieved_at"]
        np.testing.assert_allclose(second["lattice"], first["lattice"], atol=1e-12)
        assert calls == [(MP_ID, "test-key")]


def test_invalid_cache_and_upstream_error(monkeypatch, tmp_path):
    path = setup_cache(monkeypatch, tmp_path)
    path.parent.mkdir()
    path.write_text("invalid CIF")
    with TestClient(app) as client:
        assert client.get(ROUTE).json()["reason"] == "invalid_cif"
        monkeypatch.setenv("MP_API_KEY", "test-key")

        def fetch(*_):
            raise TimeoutError("private upstream details")

        monkeypatch.setattr(structures, "fetch_structure", fetch)
        response = client.get(ROUTE)
        assert response.json()["reason"] == "retrieval_failed"
        assert "private upstream details" not in response.text
