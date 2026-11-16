"""End-of-session summary text for the learner. Owner: errors & cards."""
from tutor import llm


def session_summary(transcript: str, target_language: str, explanation_language: str) -> str:
    prompt = llm.load_prompt(
        "session_summary",
        transcript=transcript,
        target_language=target_language,
        explanation_language=explanation_language,
    )
    return llm.call_llm([{"role": "user", "content": prompt}]).strip()
