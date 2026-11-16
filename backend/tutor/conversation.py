"""The tutor's side of the conversation. Owner: tutor & planner."""
import json

import config
from data import db
from tutor import llm, planner


def build_system_prompt(learner: dict, session: dict) -> str:
    targets = json.loads(session.get("targets") or "[]")
    return llm.load_prompt(
        "tutor_system",
        name=learner["name"],
        level=learner["level"],
        goal=learner["goal"] or "general conversation",
        target_language=learner["target_language"],
        explanation_language=learner["explanation_language"],
        scenario=session["scenario"],
        max_sentences=config.MAX_TUTOR_SENTENCES,
        targets_block=planner.targets_block(targets),
        memory_block=planner.memory_block(learner["id"]),
    )


def _history(session_id: int) -> list[dict]:
    role_map = {"user": "user", "tutor": "assistant"}
    return [{"role": role_map[m["role"]], "content": m["text"]} for m in db.get_messages(session_id)]


def opening_line(learner: dict, session: dict) -> str:
    """The tutor's greeting at the start of a session."""
    messages = [
        {"role": "system", "content": build_system_prompt(learner, session)},
        {"role": "user", "content": "(The learner has just joined. Greet them by name and open the scenario with a question.)"},
    ]
    return llm.call_llm(messages)


def tutor_reply(learner: dict, session: dict) -> str:
    """Reply to the latest learner message, using the whole session history."""
    messages = [{"role": "system", "content": build_system_prompt(learner, session)}] + _history(session["id"])
    return llm.call_llm(messages)


def transcript_text(session_id: int) -> str:
    """Plain transcript used by the error extractor and the evaluation."""
    lines = []
    for m in db.get_messages(session_id):
        who = "LEARNER" if m["role"] == "user" else "TUTOR"
        lines.append(f"{who}: {m['text']}")
    return "\n".join(lines)
