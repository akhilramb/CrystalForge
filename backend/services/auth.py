"""Verify Supabase access tokens without using a privileged key for user data."""
from functools import lru_cache
import os
from typing import Any

import httpx
import jwt
from fastapi import HTTPException
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError, PyJWTError


def supabase_url() -> str | None:
    value = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    return value or None


def publishable_key() -> str | None:
    value = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    return value or None


def public_auth_config() -> dict[str, str | bool]:
    url = supabase_url()
    key = publishable_key()
    return {
        "configured": bool(url and key),
        "supabase_url": url or "",
        "publishable_key": key or "",
    }


@lru_cache(maxsize=4)
def jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(
        f"{url}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
        cache_jwk_set=True,
        lifespan=300,
        timeout=5,
    )


def verify_access_token(token: str) -> dict[str, Any]:
    url = supabase_url()
    key = publishable_key()
    if not url or not key:
        raise HTTPException(503, "Authentication is not configured on this server.")

    try:
        signing_key = jwks_client(url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "EdDSA"],
            audience="authenticated",
            issuer=f"{url}/auth/v1",
            options={"require": ["exp", "iss", "sub", "aud"]},
        )
        return claims
    except PyJWTError:
        # Legacy Supabase projects using HS256 do not publish a verification key.
        # Ask Auth to validate the token rather than handling the shared secret.
        try:
            response = httpx.get(
                f"{url}/auth/v1/user",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {token}",
                },
                timeout=5,
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Authentication verification is temporarily unavailable.")
        if response.status_code != 200:
            raise HTTPException(401, "Sign in again to continue.")
        user = response.json()
        user_id = user.get("id")
        if not user_id:
            raise HTTPException(401, "Sign in again to continue.")
        return {
            "sub": user_id,
            "aud": "authenticated",
            "iss": f"{url}/auth/v1",
            "email": user.get("email"),
            "app_metadata": user.get("app_metadata") or {},
        }
    except (PyJWKClientError, httpx.HTTPError):
        raise HTTPException(401, "Sign in again to continue.")


def supabase_rest(
    token: str,
    table: str,
    method: str = "GET",
    *,
    params: dict[str, str] | None = None,
    payload: dict[str, Any] | list[dict[str, Any]] | None = None,
    prefer: str | None = None,
) -> Any:
    url = supabase_url()
    key = publishable_key()
    if not url or not key:
        raise HTTPException(503, "Authentication is not configured on this server.")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    try:
        response = httpx.request(
            method,
            f"{url}/rest/v1/{table}",
            params=params,
            json=payload,
            headers=headers,
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Account data is temporarily unavailable.")
    if response.status_code in (401, 403):
        raise HTTPException(401, "You are not authorized to access this account data.")
    if response.status_code >= 400:
        raise HTTPException(503, "Account data could not be saved.")
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        raise HTTPException(503, "Account data response was invalid.")
