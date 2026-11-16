"""Chooses what the next session should practise. Owner: tutor & planner.

This is where the closed loop happens: cards and errors from past sessions shape the next one.
"""
import json
from datetime import datetime, timedelta, timezone

import config
from data import db


def plan_targets(learner_id: int) -> list[str]:
    """Return up to MAX_PLANNER_TARGETS short targets, most important first."""
    now = datetime.now(timezone.utc)
    targets: list[str] = []

    # 1. Cards the learner failed recently (rated Again in the last 7 days)
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
    failed = db.query(
        """SELECT DISTINCT c.back, c.front, e.target_word FROM reviews r
           JOIN cards c ON c.id = r.card_id
           LEFT JOIN errors e ON e.id = c.error_id
           WHERE c.learner_id = ? AND r.rating = 1 AND r.reviewed_at >= ? AND c.deleted = 0
           LIMIT 3""",
        (learner_id, week_ago),
    )
    targets += [row["target_word"] or row["back"] for row in failed]

    # 2. Cards due today
    due = db.query(
        """SELECT c.back, e.target_word FROM cards c LEFT JOIN errors e ON e.id = c.error_id
           WHERE c.learner_id = ? AND c.deleted = 0 AND c.due <= ? ORDER BY c.due LIMIT 4""",
        (learner_id, now.isoformat()),
    )
    targets += [row["target_word"] or row["back"] for row in due]

    # 3. Most frequent grammar rules still not fixed
    rules = db.query(
        """SELECT rule, COUNT(*) AS n FROM errors
           WHERE learner_id = ? AND fixed = 0 GROUP BY rule ORDER BY n DESC LIMIT 2""",
        (learner_id,),
    )
    targets += [row["rule"] for row in rules]

    # Deduplicate, keep order
    seen, unique = set(), []
    for t in targets:
        if t and t.lower() not in seen:
            seen.add(t.lower())
            unique.append(t)
    return unique[: config.MAX_PLANNER_TARGETS]


def targets_block(targets: list[str]) -> str:
    if not targets:
        return "No specific targets yet (first session). Get to know the learner and notice their mistakes."
    return "\n".join(f"- {t}" for t in targets)


def memory_block(learner_id: int) -> str:
    """One line about the previous session so the tutor can refer back to it."""
    last = db.query_one(
        """SELECT scenario, summary FROM sessions
           WHERE learner_id = ? AND summary IS NOT NULL ORDER BY id DESC LIMIT 1""",
        (learner_id,),
    )
    if not last:
        return ""
    return f"## Last session\nScenario: {last['scenario']}. Summary: {last['summary']}\nYou may briefly refer back to it when greeting."


def save_targets(session_id: int, targets: list[str]) -> None:
    db.execute("UPDATE sessions SET targets = ? WHERE id = ?", (json.dumps(targets), session_id))
