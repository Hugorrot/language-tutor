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


# Columns added after the first version. init_db() adds them to databases created earlier,
# so nobody has to delete their tutor.db.
_MIGRATIONS = [
    ("sessions", "target_concepts", "TEXT DEFAULT '[]'"),
    ("sessions", "memory", "TEXT DEFAULT ''"),
    ("errors", "concept_id", "INTEGER"),
    ("sessions", "language", "TEXT"),
    ("errors", "language", "TEXT"),
    ("cards", "language", "TEXT"),
]

# Rows created before languages were tracked per session belong to the learner's language.
_BACKFILL = [
    "UPDATE sessions SET language = (SELECT target_language FROM learners l WHERE l.id = sessions.learner_id) WHERE language IS NULL",
    "UPDATE errors SET language = (SELECT language FROM sessions s WHERE s.id = errors.session_id) WHERE language IS NULL",
    """UPDATE cards SET language = COALESCE((SELECT e.language FROM errors e WHERE e.id = cards.error_id),
                                         (SELECT target_language FROM learners l WHERE l.id = cards.learner_id))
       WHERE language IS NULL""",
]


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        for table, column, decl in _MIGRATIONS:
            exists = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
            cols = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")} if exists else set()
            if exists and column not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
        conn.executescript(SCHEMA.read_text())
        for sql in _BACKFILL:
            conn.execute(sql)


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


# ---- languages: one learner can practise several languages ----

DEFAULT_LEVEL = "A2"


def get_level(learner_id: int, language: str) -> str:
    row = query_one("SELECT level FROM learner_levels WHERE learner_id = ? AND language = ?", (learner_id, language))
    return row["level"] if row else DEFAULT_LEVEL


def set_level(learner_id: int, language: str, level: str) -> None:
    execute("""INSERT INTO learner_levels (learner_id, language, level) VALUES (?, ?, ?)
               ON CONFLICT(learner_id, language) DO UPDATE SET level = excluded.level""",
            (learner_id, language, level))


def learner_in(learner_id: int, language: str | None = None) -> dict | None:
    """The learner as seen in one language: target_language and level are those of `language`
    (default: the language of their most recent session)."""
    learner = get_learner(learner_id)
    if not learner:
        return None
    language = language or learner["target_language"]
    return {**learner, "target_language": language, "level": get_level(learner_id, language)}


def learner_for_session(session: dict) -> dict:
    return learner_in(session["learner_id"], session.get("language"))


def languages_of(learner_id: int) -> list[str]:
    """Languages the learner has practised, most recent first (always includes the current one)."""
    learner = get_learner(learner_id)
    rows = query("""SELECT language, MAX(id) AS last FROM sessions WHERE learner_id = ? AND language IS NOT NULL
                    GROUP BY language ORDER BY last DESC""", (learner_id,))
    langs = [r["language"] for r in rows]
    if learner and learner["target_language"] not in langs:
        langs.insert(0, learner["target_language"])
    return langs
