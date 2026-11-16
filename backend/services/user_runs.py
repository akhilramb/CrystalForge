from fastapi import HTTPException

from backend.services.auth import supabase_rest
from backend.services.catalog import catalog


def save_user_run(token: str, inputs: dict, result: dict, kind: str) -> int:
    metadata = catalog().bundle["metadata"] if catalog().bundle else {}
    rows = supabase_rest(
        token,
        "prediction_history",
        "POST",
        payload={
            "prediction_inputs": inputs,
            "prediction_results": result,
            "material_id": result.get("id"),
            "model_name": metadata.get("selected_model", "Unavailable"),
            "model_version": result.get("model_version") or metadata.get("version"),
            "kind": kind,
        },
        prefer="return=representation",
    )
    if not rows:
        raise HTTPException(503, "The run could not be saved to your account.")
    row_id = int(rows[0]["id"])
    supabase_rest(
        token,
        "user_activity",
        "POST",
        payload={
            "activity_type": "prediction" if kind == "prediction" else "discovery",
            "resource_type": "prediction_history",
            "resource_id": str(row_id),
        },
    )
    return row_id


def map_user_run(row: dict) -> dict:
    return {
        "id": row["id"],
        "created": row["created_at"],
        "kind": row["kind"],
        "inputs": row["prediction_inputs"],
        "result": row["prediction_results"],
    }


def get_user_run(token: str, run_id: int) -> dict:
    rows = supabase_rest(
        token,
        "prediction_history",
        params={
            "id": f"eq.{run_id}",
            "select": "*",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(404, "History entry not found.")
    return map_user_run(rows[0])
