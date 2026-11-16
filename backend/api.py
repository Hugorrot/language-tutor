"""FastAPI app: every endpoint in API.md. Owner: frontend, review & integration.

Run from the backend/ folder:  uvicorn api:app --reload
"""
import json

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from analysis.error_extractor import extract_errors
from analysis.summary import session_summary
from cards import scheduler
from cards.generator import generate_cards
from data import db
from schemas import LearnerCreate, ReviewAnswer, SessionEnd, SessionStart
from tutor import conversation, planner
from tutor.llm import Timer
from voice import asr, tts

app = FastAPI(title="Voice Language Tutor")
api = APIRouter(prefix="/api")

# Lets the frontend run on another local dev server (e.g. VS Code Live Server) during development.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    db.init_db()


def _learner_or_404(learner_id: int) -> dict:
    learner = db.get_learner(learner_id)
    if not learner:
        raise HTTPException(404, "Learner not found")
    return learner


def _session_or_404(session_id: int) -> dict:
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


# ---------------- Learner ----------------

@api.post("/learner")
def create_learner(body: LearnerCreate):
    learner_id = db.execute(
        "INSERT INTO learners (name, target_language, explanation_language, goal) VALUES (?, ?, ?, ?)",
        (body.name, body.target_language, body.explanation_language, body.goal),
    )
    return {"learner_id": learner_id}


@api.get("/learner/{learner_id}")
def get_learner(learner_id: int):
    l = _learner_or_404(learner_id)
    return {"learner_id": l["id"], "name": l["name"], "target_language": l["target_language"],
            "explanation_language": l["explanation_language"], "goal": l["goal"], "level": l["level"]}


# ---------------- Conversation ----------------

@api.post("/session/start")
def start_session(body: SessionStart):
    learner = _learner_or_404(body.learner_id)
    session_id = db.execute("INSERT INTO sessions (learner_id, scenario) VALUES (?, ?)",
                            (learner["id"], body.scenario))
    targets = planner.plan_targets(learner["id"])
    planner.save_targets(session_id, targets)
    session = db.get_session(session_id)

    tutor_text = conversation.opening_line(learner, session)
    db.add_message(session_id, "tutor", tutor_text)
    audio_b64 = tts.text_to_speech_b64(tutor_text, learner["target_language"])
    return {"session_id": session_id, "tutor_text": tutor_text, "audio_b64": audio_b64, "targets": targets}


@api.post("/session/turn")
async def session_turn(session_id: int = Form(...), text: str | None = Form(None),
                       audio: UploadFile | None = File(None)):
    session = _session_or_404(session_id)
    learner = db.get_learner(session["learner_id"])
    timings = {"asr": 0, "llm": 0, "tts": 0}

    with Timer() as total:
        if audio is not None:
            audio_bytes = await audio.read()
            with Timer() as t:
                user_text = asr.speech_to_text(audio_bytes, audio.filename or "speech.webm",
                                               learner["target_language"])
            timings["asr"] = t.ms
        elif text:
            user_text = text.strip()
        else:
            raise HTTPException(400, "Send either 'audio' or 'text'")

        db.add_message(session_id, "user", user_text)

        with Timer() as t:
            tutor_text = conversation.tutor_reply(learner, session)
        timings["llm"] = t.ms

        with Timer() as t:
            audio_b64 = tts.text_to_speech_b64(tutor_text, learner["target_language"])
        timings["tts"] = t.ms
    timings["total"] = total.ms

    db.add_message(session_id, "tutor", tutor_text, timings=timings)
    return {"user_text": user_text, "tutor_text": tutor_text, "audio_b64": audio_b64, "timings_ms": timings}


@api.post("/session/end")
def end_session(body: SessionEnd):
    session = _session_or_404(body.session_id)
    learner = db.get_learner(session["learner_id"])
    lang, expl, level = learner["target_language"], learner["explanation_language"], learner["level"]

    transcript = conversation.transcript_text(session["id"])
    if "LEARNER:" not in transcript:
        db.execute("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?", (session["id"],))
        return {"summary": "", "errors": [], "cards": []}

    # 1. Errors -> database
    errors = extract_errors(transcript, lang, expl, level)
    error_ids = [
        db.execute(
            """INSERT INTO errors (session_id, learner_id, type, original, correction, rule, target_word)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (session["id"], learner["id"], e.type, e.original, e.correction, e.rule, e.target_word),
        )
        for e in errors
    ]

    # 2. Cards -> database, each with a fresh FSRS state (due now)
    drafts = generate_cards(errors, error_ids, lang, expl, level)
    cards_out = []
    for c in drafts:
        state, due = scheduler.new_card_state()
        card_id = db.execute(
            """INSERT INTO cards (learner_id, error_id, kind, front, back, explanation, fsrs_state, due)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (learner["id"], c.error_id, c.kind, c.front, c.back, c.explanation, state, due),
        )
        cards_out.append({"card_id": card_id, "kind": c.kind, "front": c.front,
                          "back": c.back, "explanation": c.explanation})

    # 3. Summary
    summary = session_summary(transcript, lang, expl)
    db.execute("UPDATE sessions SET summary = ?, ended_at = datetime('now') WHERE id = ?",
               (summary, session["id"]))

    # TODO (tutor & planner): mark old errors as fixed if the learner used the structure
    # correctly in this session (compare this session's targets with the new errors).

    return {"summary": summary,
            "errors": [e.model_dump() for e in errors[: config.MAX_ERRORS_IN_SUMMARY]],
            "cards": cards_out}


@api.delete("/cards/{card_id}")
def delete_card(card_id: int):
    db.execute("UPDATE cards SET deleted = 1 WHERE id = ?", (card_id,))
    return {"ok": True}


# ---------------- Review ----------------

def _card_audio_text(card: dict) -> str:
    """The target-language sentence to read aloud for a card."""
    if card["kind"] == "cloze":
        return card["front"].replace("___", card["back"])
    if card["kind"] == "reverse":
        return card["back"]
    return card["front"]


@api.get("/review/due")
def review_due(learner_id: int):
    _learner_or_404(learner_id)
    rows = db.query(
        """SELECT id, kind, front, back, explanation FROM cards
           WHERE learner_id = ? AND deleted = 0 AND due <= ? ORDER BY due LIMIT 20""",
        (learner_id, scheduler.now_iso()),
    )
    cards = [{"card_id": r["id"], "kind": r["kind"], "front": r["front"], "back": r["back"],
              "explanation": r["explanation"]} for r in rows]
    return {"cards": cards, "due_count": len(cards)}


@api.get("/cards/{card_id}/audio")
def card_audio(card_id: int):
    card = db.query_one(
        "SELECT c.*, l.target_language FROM cards c JOIN learners l ON l.id = c.learner_id WHERE c.id = ?",
        (card_id,),
    )
    if not card:
        raise HTTPException(404, "Card not found")
    return {"audio_b64": tts.cached_tts_b64(_card_audio_text(card), card["target_language"])}


@api.post("/review/answer")
def review_answer(body: ReviewAnswer):
    card = db.query_one("SELECT fsrs_state FROM cards WHERE id = ?", (body.card_id,))
    if not card:
        raise HTTPException(404, "Card not found")
    state, due = scheduler.review(card["fsrs_state"], body.rating)
    db.execute("UPDATE cards SET fsrs_state = ?, due = ? WHERE id = ?", (state, due, body.card_id))
    db.execute("INSERT INTO reviews (card_id, rating) VALUES (?, ?)", (body.card_id, body.rating))
    return {"next_due": due}


# ---------------- Progress ----------------

@api.get("/progress")
def progress(learner_id: int):
    learner = _learner_or_404(learner_id)
    sessions = db.query_one(
        "SELECT COUNT(*) AS n FROM sessions WHERE learner_id = ? AND ended_at IS NOT NULL", (learner_id,))["n"]
    words = db.query_one(
        """SELECT COALESCE(SUM(LENGTH(m.text) - LENGTH(REPLACE(m.text, ' ', '')) + 1), 0) AS w
           FROM messages m JOIN sessions s ON s.id = m.session_id
           WHERE s.learner_id = ? AND m.role = 'user'""", (learner_id,))["w"]
    cards_total = db.query_one(
        "SELECT COUNT(*) AS n FROM cards WHERE learner_id = ? AND deleted = 0", (learner_id,))["n"]
    cards_due = db.query_one(
        "SELECT COUNT(*) AS n FROM cards WHERE learner_id = ? AND deleted = 0 AND due <= ?",
        (learner_id, scheduler.now_iso()))["n"]
    acc = db.query_one(
        """SELECT AVG(CASE WHEN r.rating >= 3 THEN 1.0 ELSE 0.0 END) AS a FROM reviews r
           JOIN cards c ON c.id = r.card_id WHERE c.learner_id = ?""", (learner_id,))["a"]
    top_errors = db.query(
        """SELECT rule, COUNT(*) AS count, MIN(fixed) AS fixed FROM errors
           WHERE learner_id = ? GROUP BY rule ORDER BY count DESC LIMIT 5""", (learner_id,))
    return {
        "sessions": sessions,
        "minutes_spoken": round(words / 100),  # rough estimate: ~100 spoken words per minute
        "level": learner["level"],
        "cards_total": cards_total,
        "cards_due": cards_due,
        "review_accuracy": round(acc, 2) if acc is not None else None,
        "top_errors": [{"rule": e["rule"], "count": e["count"], "fixed": bool(e["fixed"])} for e in top_errors],
    }


app.include_router(api)

# Serve the frontend at http://localhost:8000 (must come after the API routes)
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
