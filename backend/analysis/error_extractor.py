"""Transcript -> structured errors. Owner: errors & cards.

The evaluation (eval/eval_errors.py) calls extract_errors() directly, so keep its signature stable.
"""
from pydantic import ValidationError

from schemas import LearnerError
from tutor import llm


def extract_errors(transcript: str, target_language: str, explanation_language: str,
                   level: str, model: str | None = None) -> list[LearnerError]:
    prompt = llm.load_prompt(
        "error_extraction",
        transcript=transcript,
        target_language=target_language,
        explanation_language=explanation_language,
        level=level,
    )
    data = llm.call_llm_json([{"role": "user", "content": prompt}], model=model)

    errors: list[LearnerError] = []
    for item in data.get("errors", []):
        try:
            errors.append(LearnerError(**item))
        except ValidationError:
            # Skip malformed items instead of failing the whole session.
            # TODO: log these so we can count them in the evaluation.
            continue
    return errors
