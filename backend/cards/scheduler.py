"""Spaced repetition with py-fsrs (the algorithm Anki uses). Owner: frontend, review & integration.

The card's whole FSRS state is stored as JSON in cards.fsrs_state; cards.due is a copy
of the due date so "what is due now?" is a simple SQL query.
"""
import json
from datetime import datetime, timezone

from fsrs import Card, Rating, Scheduler

_scheduler = Scheduler()


def new_card_state() -> tuple[str, str]:
    """State for a brand-new card: due immediately. Returns (fsrs_state_json, due_iso)."""
    card = Card()
    return json.dumps(card.to_dict()), card.due.isoformat()


def review(fsrs_state_json: str, rating: int) -> tuple[str, str]:
    """Apply one answer (1 Again, 2 Hard, 3 Good, 4 Easy). Returns the new (state_json, due_iso)."""
    card = Card.from_dict(json.loads(fsrs_state_json))
    card, _log = _scheduler.review_card(card, Rating(rating))
    return json.dumps(card.to_dict()), card.due.isoformat()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
