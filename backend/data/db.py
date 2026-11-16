"""Tiny SQLite helper. Everything else talks to the database through these functions."""
import json
import sqlite3
from pathlib import Path

from config import DB_PATH

SCHEMA = Path(__file__).with_name("schema.sql")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA.read_text())


def query(sql: str, params: tuple = ()) -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> int:
    """Run an INSERT/UPDATE/DELETE. Returns the new row id for inserts."""
    with connect() as conn:
        cur = conn.execute(sql, params)
        return cur.lastrowid


# ---- convenience functions used by api.py ----

def get_learner(learner_id: int) -> dict | None:
    return query_one("SELECT * FROM learners WHERE id = ?", (learner_id,))


def get_session(session_id: int) -> dict | None:
    return query_one("SELECT * FROM sessions WHERE id = ?", (session_id,))


def get_messages(session_id: int) -> list[dict]:
    return query("SELECT role, text FROM messages WHERE session_id = ? ORDER BY id", (session_id,))


def add_message(session_id: int, role: str, text: str, audio_secs: float = 0, timings: dict | None = None) -> int:
    return execute(
        "INSERT INTO messages (session_id, role, text, audio_secs, timings) VALUES (?, ?, ?, ?, ?)",
        (session_id, role, text, audio_secs, json.dumps(timings or {})),
    )
