from fastapi import Depends, Header, HTTPException

from backend.services.auth import verify_access_token


def optional_identity(
    authorization: str | None = Header(default=None),
) -> tuple[str, dict | None]:
    if not authorization:
        return "", None
    scheme, _, credential = authorization.partition(" ")
    if scheme.lower() != "bearer" or not credential:
        raise HTTPException(401, "Sign in again to continue.")
    claims = verify_access_token(credential)
    return credential, claims


def require_identity(
    identity: tuple[str, dict | None] = Depends(optional_identity),
) -> tuple[str, dict]:
    token, claims = identity
    if not token or claims is None:
        raise HTTPException(401, "Sign in to access your account data.")
    return token, claims


def run(fn, *args):
    try:
        return fn(*args)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
