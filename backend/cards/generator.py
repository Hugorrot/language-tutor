"""Errors -> flashcards. Owner: errors & cards."""
import json

from pydantic import ValidationError

from schemas import CardDraft, LearnerError
from tutor import llm


def generate_cards(errors: list[LearnerError], error_ids: list[int], target_language: str,
                   explanation_language: str, level: str) -> list[CardDraft]:
    """error_ids[i] is the database id of errors[i], so each card can point to its error."""
    if not errors:
        return []
    numbered = "\n".join(f"{i}. {json.dumps(e.model_dump(), ensure_ascii=False)}" for i, e in enumerate(errors))
    prompt = llm.load_prompt(
        "card_generation",
        errors=numbered,
        target_language=target_language,
        explanation_language=explanation_language,
        level=level,
    )
    data = llm.call_llm_json([{"role": "user", "content": prompt}])

    cards: list[CardDraft] = []
    for item in data.get("cards", []):
        idx = item.pop("error_index", None)
        try:
            card = CardDraft(**item)
        except ValidationError:
            continue
        if isinstance(idx, int) and 0 <= idx < len(error_ids):
            card.error_id = error_ids[idx]
        cards.append(card)
    return cards
