"""CEFR level estimate. Owner: tutor & planner.

TODO (day 5-7): a placement session mode where the tutor asks gradually harder questions,
then calls estimate_level() on its transcript and saves the level on the learner.
"""
from tutor import llm

VALID_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


def estimate_level(transcript: str, target_language: str) -> str:
    prompt = llm.load_prompt("placement", transcript=transcript, target_language=target_language)
    data = llm.call_llm_json([{"role": "user", "content": prompt}])
    level = str(data.get("level", "")).upper()
    return level if level in VALID_LEVELS else "A2"
