import sqlite3
import json
from contextvars import ContextVar
from datetime import datetime, timezone
from backend.config import DB_PATH

session_id = ContextVar("session_id", default="local")


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.execute(
        'CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, created TEXT, kind TEXT, inputs TEXT, result TEXT, session TEXT NOT NULL DEFAULT "local")'
    )
    if "session" not in [r[1] for r in c.execute("PRAGMA table_info(history)")]:
        c.execute(
            'ALTER TABLE history ADD COLUMN session TEXT NOT NULL DEFAULT "local"'
        )
    existing = c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='saved'"
    ).fetchone()
    if existing and "session" not in [
        r[1] for r in c.execute("PRAGMA table_info(saved)")
    ]:
        c.execute("ALTER TABLE saved RENAME TO saved_legacy")
        c.execute(
            "CREATE TABLE saved (material_id TEXT, created TEXT, note TEXT, session TEXT NOT NULL, PRIMARY KEY(session, material_id))"
        )
        c.execute(
            'INSERT INTO saved SELECT material_id, created, note, "local" FROM saved_legacy'
        )
        c.execute("DROP TABLE saved_legacy")
    else:
        c.execute(
            "CREATE TABLE IF NOT EXISTS saved (material_id TEXT, created TEXT, note TEXT, session TEXT NOT NULL, PRIMARY KEY(session, material_id))"
        )
    c.commit()
    return c


def log(kind, inputs, result):
    with connect() as c:
        x = c.execute(
            "INSERT INTO history(created,kind,inputs,result,session) VALUES (?,?,?,?,?)",
            (
                datetime.now(timezone.utc).isoformat(),
                kind,
                json.dumps(inputs),
                json.dumps(result),
                session_id.get(),
            ),
        )
        return x.lastrowid


def history():
    with connect() as c:
        return [
            {
                **{k: r[k] for k in r.keys() if k != "session"},
                "inputs": json.loads(r["inputs"]),
                "result": json.loads(r["result"]),
            }
            for r in c.execute(
                "SELECT * FROM history WHERE session=? ORDER BY id DESC LIMIT 200",
                (session_id.get(),),
            )
        ]
