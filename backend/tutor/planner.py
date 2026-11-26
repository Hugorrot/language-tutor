"""Chooses what the next session should practise. Owner: tutor & planner.

This is where the closed loop happens: cards and errors from past sessions shape the next one.
How much memory is used depends on config.MEMORY_MODE ("vector", "sql" or "none"), so the
evaluation can compare the full system with simpler baselines.
"""
import json
from datetime import datetime, timedelta, timezone

import config
from data import db
from memory import concepts, retrieval


def plan(learner_id: int, language: str) -> list[dict]:
    """Up to MAX_PLANNER_TARGETS targets in `language`, most important first: [{"text", "concept_id"}]."""
    if config.MEMORY_MODE == "none":
        return []
    now = datetime.now(timezone.utc)
    candidates: list[dict] = []

    # 1. Cards the learner failed recently (rated Again in the last 7 days)
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    failed = db.query(
        """SELECT DISTINCT c.back, e.target_word, e.concept_id FROM reviews r
           JOIN cards c ON c.id = r.card_id
           LEFT JOIN errors e ON e.id = c.error_id
           WHERE c.learner_id = ? AND c.language = ? AND r.rating = 1 AND r.reviewed_at >= ? AND c.deleted = 0
           LIMIT 3""",
        (learner_id, language, week_ago),
    )
    candidates += [{"text": r["target_word"] or r["back"], "concept_id": r["concept_id"]} for r in failed]

    # 2. Cards due today
    due = db.query(
        """SELECT c.back, e.target_word, e.concept_id FROM cards c LEFT JOIN errors e ON e.id = c.error_id
           WHERE c.learner_id = ? AND c.language = ? AND c.deleted = 0 AND c.due <= ? ORDER BY c.due LIMIT 4""",
        (learner_id, language, now.isoformat()),
    )
    candidates += [{"text": r["target_word"] or r["back"], "concept_id": r["concept_id"]} for r in due]

    # 3. Most frequent mistakes still not fixed. With the vector DB, reworded versions of the same
    #    mistake are counted together; the "sql" baseline groups identical rule text only.
    by = "concept" if config.MEMORY_MODE == "vector" else "rule"
    for m in concepts.top_mistakes(learner_id, language, limit=2, only_open=True, by=by):
        candidates.append({"text": m["rule"], "concept_id": m["concept_id"]})

    # Deduplicate by text, and (with the vector DB) by concept, keeping order
    seen_text, seen_concept, unique = set(), set(), []
    for c in candidates:
        text = (c["text"] or "").strip()
        cid = c["concept_id"] if config.MEMORY_MODE == "vector" else None
        if not text or text.lower() in seen_text or (cid is not None and cid in seen_concept):
            continue
        seen_text.add(text.lower())
        if cid is not None:
            seen_concept.add(cid)
        unique.append({"text": text, "concept_id": c["concept_id"]})
    return unique[: config.MAX_PLANNER_TARGETS]


def save_plan(session_id: int, targets: list[dict]) -> None:
    db.execute(
        "UPDATE sessions SET targets = ?, target_concepts = ? WHERE id = ?",
        (json.dumps([t["text"] for t in targets], ensure_ascii=False),
         json.dumps([t["concept_id"] for t in targets if t["concept_id"] is not None]),
         session_id),
    )


def targets_block(targets: list[str]) -> str:
    if not targets:
        return "No specific targets. Get to know the learner and notice their mistakes."
    return "\n".join(f"- {t}" for t in targets)


def memory_block(learner_id: int, language: str, scenario: str) -> str:
    """What the tutor remembers at the start of a session (stored in sessions.memory)."""
    if config.MEMORY_MODE == "none":
        return ""
    if config.MEMORY_MODE == "sql":
        last = db.query_one(
            """SELECT scenario, summary FROM sessions
               WHERE learner_id = ? AND language = ? AND summary IS NOT NULL ORDER BY id DESC LIMIT 1""",
            (learner_id, language),
        )
        if not last:
            return ""
        return (f"## Last session\nScenario: {last['scenario']}. Summary: {last['summary']}\n"
                "You may briefly refer back to it when greeting.")
    return retrieval.session_memory_block(learner_id, language, scenario)


def turn_memory(learner_id: int, language: str, latest_message: str) -> str:
    """Extra memory for one turn, retrieved with the learner's latest message (vector mode only)."""
    if config.MEMORY_MODE != "vector" or not config.RETRIEVE_EACH_TURN:
        return ""
    return retrieval.turn_memory_block(learner_id, language, latest_message)
