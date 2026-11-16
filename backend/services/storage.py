import json
import sqlite3
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from backend.config import DB_PATH

session_id = ContextVar("session_id", default="local")
_schema_lock = Lock()
_initialized_databases: set[Path] = set()


def _initialize(connection: sqlite3.Connection, database_path: Path) -> None:
    if database_path in _initialized_databases:
        return

    with _schema_lock:
        if database_path in _initialized_databases:
            return

        connection.execute("BEGIN IMMEDIATE")
        try:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS history (
                    id INTEGER PRIMARY KEY,
                    created TEXT,
                    kind TEXT,
                    inputs TEXT,
                    result TEXT,
                    session TEXT NOT NULL DEFAULT 'local'
                )"""
            )
            history_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(history)")
            }
            if "session" not in history_columns:
                connection.execute(
                    "ALTER TABLE history ADD COLUMN session TEXT NOT NULL DEFAULT 'local'"
                )

            saved_table = connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='saved'"
            ).fetchone()
            if saved_table is None:
                connection.execute(
                    """CREATE TABLE saved (
                        material_id TEXT,
                        created TEXT,
                        note TEXT,
                        session TEXT NOT NULL,
                        PRIMARY KEY(session, material_id)
                    )"""
                )
            else:
                saved_columns = {
                    row["name"] for row in connection.execute("PRAGMA table_info(saved)")
                }
                if "session" not in saved_columns:
                    connection.execute("ALTER TABLE saved RENAME TO saved_legacy")
                    connection.execute(
                        """CREATE TABLE saved (
                            material_id TEXT,
                            created TEXT,
                            note TEXT,
                            session TEXT NOT NULL,
                            PRIMARY KEY(session, material_id)
                        )"""
                    )
                    connection.execute(
                        """INSERT INTO saved (material_id, created, note, session)
                           SELECT material_id, created, note, 'local' FROM saved_legacy"""
                    )
                    connection.execute("DROP TABLE saved_legacy")

            connection.execute(
                "CREATE INDEX IF NOT EXISTS history_session_id_idx ON history(session, id DESC)"
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        _initialized_databases.add(database_path)


@contextmanager
def connect():
    database_path = Path(DB_PATH)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path, timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA busy_timeout=10000")
        _initialize(connection, database_path)
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def log(kind, inputs, result):
    with connect() as connection:
        row = connection.execute(
            "INSERT INTO history(created,kind,inputs,result,session) VALUES (?,?,?,?,?)",
            (
                datetime.now(timezone.utc).isoformat(),
                kind,
                json.dumps(inputs),
                json.dumps(result),
                session_id.get(),
            ),
        )
        return row.lastrowid


def history():
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM history WHERE session=? ORDER BY id DESC LIMIT 200",
            (session_id.get(),),
        ).fetchall()
    return [
        {
            **{key: row[key] for key in row.keys() if key != "session"},
            "inputs": json.loads(row["inputs"]),
            "result": json.loads(row["result"]),
        }
        for row in rows
    ]
