"""Opt-in ownership check for two disposable users in a Supabase test project."""

import os

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.auth import supabase_rest, verify_access_token


def test_saved_material_is_private_through_database_and_api(monkeypatch):
    keys = (
        "CF_RLS_TEST_URL",
        "CF_RLS_TEST_PUBLISHABLE_KEY",
        "CF_RLS_TEST_OWNER_TOKEN",
        "CF_RLS_TEST_OTHER_TOKEN",
    )
    url, key, owner, other = (os.getenv(name) for name in keys)
    if not all((url, key, owner, other)):
        pytest.skip("Configure two users in a separate Supabase test project.")

    monkeypatch.setenv("SUPABASE_URL", url)
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", key)
    assert verify_access_token(owner)["sub"] != verify_access_token(other)["sub"]
    material = "cf-00001"
    material_filter = {"material_id": f"eq.{material}"}
    for token in (owner, other):
        if supabase_rest(token, "saved_materials", params=material_filter):
            pytest.skip("Remove the existing test bookmark before running this check.")

    owner_headers = {"Authorization": f"Bearer {owner}"}
    other_headers = {"Authorization": f"Bearer {other}"}
    note = "CrystalForge ownership integration test"
    with TestClient(app) as client:
        try:
            assert client.post(
                "/api/saved", headers=owner_headers,
                json={"material_id": material, "note": note},
            ).status_code == 200

            rows = supabase_rest(owner, "saved_materials", params=material_filter)
            assert len(rows) == 1 and rows[0]["notes"] == note
            row_filter = {"id": f"eq.{rows[0]['id']}"}
            assert supabase_rest(other, "saved_materials", params=row_filter) == []
            assert supabase_rest(
                other, "saved_materials", "PATCH", params=row_filter,
                payload={"notes": "Unauthorized update"},
                prefer="return=representation",
            ) == []
            assert supabase_rest(
                other, "saved_materials", "DELETE", params=row_filter,
                prefer="return=representation",
            ) == []
            other_list = client.get("/api/saved", headers=other_headers)
            assert other_list.status_code == 200
            assert all(row["material_id"] != material for row in other_list.json())
            assert client.delete(f"/api/saved/{material}", headers=other_headers).status_code == 200

            owner_list = client.get("/api/saved", headers=owner_headers)
            assert owner_list.status_code == 200
            assert any(row["material_id"] == material and row["note"] == note
                       for row in owner_list.json())
        finally:
            supabase_rest(
                owner, "saved_materials", "DELETE",
                params={**material_filter, "notes": f"eq.{note}"},
            )
