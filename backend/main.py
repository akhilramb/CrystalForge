import os
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from backend.config import ROOT
from backend.routes import accounts, insights, materials, predictions
from backend.services import storage

app = FastAPI(title="CrystalForge", version="1.0.0")

@app.middleware("http")
async def browser_session(request, call_next):
    raw = request.cookies.get("cf_session")
    try:
        current = str(UUID(raw))
    except (ValueError, TypeError, AttributeError):
        current = str(uuid4())
    token = storage.session_id.set(current)
    try:
        response = await call_next(request)
        if raw != current:
            response.set_cookie(
                "cf_session",
                current,
                httponly=True,
                samesite="lax",
                secure=os.environ.get("CRYSTALFORGE_SECURE_COOKIE") == "1",
                max_age=2592000,
            )
        return response
    finally:
        storage.session_id.reset(token)


for module in (materials, predictions, accounts, insights):
    app.include_router(module.router)


# Register the frontend fallback after the API routes.
@app.get("/{path:path}")
def frontend(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "Endpoint not found.")
    root = (ROOT / "frontend/dist").resolve()
    f = (root / path).resolve()
    if not f.is_relative_to(root):
        raise HTTPException(404)
    if f.is_file():
        return FileResponse(f)
    if (root / "index.html").exists():
        return FileResponse(root / "index.html")
    return {
        "message": "Build the frontend with npm install and npm run build inside frontend, or use its Vite dev server."
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000)
