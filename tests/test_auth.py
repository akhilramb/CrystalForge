from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from backend.services import auth


def test_access_token_verified_against_jwks(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    url = "https://example.supabase.co"
    monkeypatch.setattr(auth, "supabase_url", lambda: url)
    monkeypatch.setattr(auth, "publishable_key", lambda: "sb_publishable_test")
    monkeypatch.setattr(
        auth,
        "jwks_client",
        lambda _url: SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=private.public_key())
        ),
    )
    token = jwt.encode(
        {
            "sub": "user-123",
            "aud": "authenticated",
            "iss": f"{url}/auth/v1",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        private,
        algorithm="RS256",
    )

    claims = auth.verify_access_token(token)
    assert claims["sub"] == "user-123"


def test_invalid_access_token_is_rejected_by_auth_service(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    url = "https://example.supabase.co"
    monkeypatch.setattr(auth, "supabase_url", lambda: url)
    monkeypatch.setattr(auth, "publishable_key", lambda: "sb_publishable_test")
    monkeypatch.setattr(
        auth,
        "jwks_client",
        lambda _url: SimpleNamespace(
            get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=private.public_key())
        ),
    )
    token = jwt.encode(
        {
            "sub": "user-123",
            "aud": "authenticated",
            "iss": f"{url}/auth/v1",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        other,
        algorithm="RS256",
    )

    class Response:
        status_code = 401

    monkeypatch.setattr(auth.httpx, "get", lambda *_args, **_kwargs: Response())
    with pytest.raises(HTTPException) as error:
        auth.verify_access_token(token)
    assert error.value.status_code == 401


def test_private_history_requires_verified_bearer_and_uses_callers_token(monkeypatch):
    from fastapi.testclient import TestClient

    from backend import main
    from backend.routes import accounts, dependencies

    calls = []

    def verify(token):
        if token != "valid-user-token":
            raise HTTPException(401, "Sign in again to continue.")
        return {"sub": "verified-user"}

    def rest(token, table, method="GET", **kwargs):
        calls.append((token, table, method, kwargs))
        return []

    monkeypatch.setattr(dependencies, "verify_access_token", verify)
    monkeypatch.setattr(accounts, "supabase_rest", rest)
    with TestClient(main.app) as client:
        assert client.get("/api/history").status_code == 401
        result = client.get(
            "/api/history?user_id=another-user",
            headers={"Authorization": "Bearer valid-user-token"},
        )
    assert result.status_code == 200 and result.json() == []
    assert calls[0][0] == "valid-user-token"
    assert calls[0][1:3] == ("prediction_history", "GET")
    assert "user_id" not in calls[0][3]["params"]
