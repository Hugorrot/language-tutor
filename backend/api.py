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
from memory import concepts, retrieval
from schemas import LearnerCreate, LearnerUpdate, ReviewAnswer, SessionEnd, SessionStart
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
    retrieval.backfill_languages()


def _language_or_400(language: str) -> str:
    if language not in config.SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {language}")
    return language


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
            "explanation_language": l["explanation_language"], "goal": l["goal"],
            "level": db.get_level(l["id"], l["target_language"]),
            "languages": db.languages_of(l["id"]),
            "supported_languages": list(config.SUPPORTED_LANGUAGES)}


@api.patch("/learner/{learner_id}")
def update_learner(learner_id: int, body: LearnerUpdate):
    """Change profile settings, e.g. the explanation language. Affects new summaries, rules and cards;
    what was already generated stays in the old language."""
    _learner_or_404(learner_id)
    changes = body.model_dump(exclude_none=True)
    if "explanation_language" in changes:
        _language_or_400(changes["explanation_language"])
    for field, value in changes.items():          # field names come from the schema, not the user
        db.execute(f"UPDATE learners SET {field} = ? WHERE id = ?", (value, learner_id))
    return get_learner(learner_id)


# ---------------- Conversation ----------------

@api.post("/session/start")
def start_session(body: SessionStart):
    _learner_or_404(body.learner_id)
    language = _language_or_400(body.target_language) if body.target_language else None
    learner = db.learner_in(body.learner_id, language)
    language = learner["target_language"]
    # Remember the choice: next time the app opens on this language.
    db.execute("UPDATE learners SET target_language = ? WHERE id = ?", (language, learner["id"]))
    session_id = db.execute("INSERT INTO sessions (learner_id, scenario, language) VALUES (?, ?, ?)",
                            (learner["id"], body.scenario, language))
    plan = planner.plan(learner["id"], language)
    planner.save_plan(session_id, plan)
    # Memory is retrieved once here and stored, so later turns don't repeat the search.
    db.execute("UPDATE sessions SET memory = ? WHERE id = ?",
               (planner.memory_block(learner["id"], language, body.scenario), session_id))
    session = db.get_session(session_id)
    targets = [t["text"] for t in plan]

    tutor_text = conversation.opening_line(learner, session)
    db.add_message(session_id, "tutor", tutor_text)
    audio_b64 = tts.text_to_speech_b64(tutor_text, learner["target_language"])
    return {"session_id": session_id, "tutor_text": tutor_text, "audio_b64": audio_b64, "targets": targets,
            "target_language": language, "level": learner["level"]}


@api.post("/session/turn")
async def session_turn(session_id: int = Form(...), text: str | None = Form(None),
                       audio: UploadFile | None = File(None)):
    session = _session_or_404(session_id)
    learner = db.learner_for_session(session)
    timings = {"asr": 0, "memory": 0, "llm": 0, "tts": 0}

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
        if not user_text:
            raise HTTPException(422, "I couldn't hear anything. Hold the button while you speak, a bit closer to the mic.")

        db.add_message(session_id, "user", user_text)

        with Timer() as t:
            extra_memory = planner.turn_memory(learner["id"], learner["target_language"], user_text)
        timings["memory"] = t.ms

        with Timer() as t:
            tutor_text = conversation.tutor_reply(learner, session, extra_memory)
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
    learner = db.learner_for_session(session)
    lang, expl, level = learner["target_language"], learner["explanation_language"], learner["level"]

    transcript = conversation.transcript_text(session["id"])
    if "LEARNER:" not in transcript:
        db.execute("UPDATE sessions SET ended_at = datetime('now') WHERE id = ?", (session["id"],))
        return {"summary": "", "errors": [], "cards": []}

    # 1. Errors -> database
    errors = extract_errors(transcript, lang, expl, level)
    error_ids = [
        db.execute(
            """INSERT INTO errors (session_id, learner_id, language, type, original, correction, rule, target_word)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (session["id"], learner["id"], lang, e.type, e.original, e.correction, e.rule, e.target_word),
        )
        for e in errors
    ]

    # 2. Same mistake as before? Group it with past errors (vector DB), so it is counted once.
    concept_ids = concepts.assign_concepts(learner["id"], lang, session["id"], errors, error_ids)

    # 3. Cards. With the vector DB, a mistake that already has cards gets those cards back
    #    for review instead of near-duplicate new ones.
    to_card = list(zip(errors, error_ids))
    if config.MEMORY_MODE == "vector":
        known = concepts.concepts_with_cards(learner["id"], lang, session["id"])
        concepts.refresh_cards(learner["id"], known & set(concept_ids), scheduler.now_iso())
        to_card = [(e, i) for e, i, c in zip(errors, error_ids, concept_ids) if c not in known]
    drafts = generate_cards([e for e, _ in to_card], [i for _, i in to_card], lang, expl, level)
    cards_out = []
    for c in drafts:
        state, due = scheduler.new_card_state()
        card_id = db.execute(
            """INSERT INTO cards (learner_id, error_id, language, kind, front, back, explanation, fsrs_state, due)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (learner["id"], c.error_id, lang, c.kind, c.front, c.back, c.explanation, state, due),
        )
        cards_out.append({"card_id": card_id, "kind": c.kind, "front": c.front,
                          "back": c.back, "explanation": c.explanation})

    # 4. Summary
    summary = session_summary(transcript, lang, expl)
    db.execute("UPDATE sessions SET summary = ?, ended_at = datetime('now') WHERE id = ?",
               (summary, session["id"]))

    # 5. Fixed mistakes: a targeted concept that did not come back is marked fixed, but only
    #    if the session was long enough and, for single-word targets, the learner used the word.
    learner_turns = [m["text"].lower() for m in db.get_messages(session["id"]) if m["role"] == "user"]
    if config.MEMORY_MODE == "vector" and len(learner_turns) >= config.MIN_TURNS_FOR_FIXED:
        targeted = set(json.loads(session.get("target_concepts") or "[]"))
        practised = set()
        for cid in targeted:
            word = db.query_one("SELECT target_word FROM errors WHERE id = ?", (cid,))
            word = (word or {}).get("target_word")
            if not word or len(word.split()) > 2 or any(word.lower() in t for t in learner_turns):
                practised.add(cid)
        concepts.update_fixed(learner["id"], targeted, set(concept_ids), practised)

    # 6. Long-term memory: what the learner said and the summary go into the vector DB.
    retrieval.index_session(learner["id"], lang, session["id"], summary)

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


def _you_said(session_id: int | None, mistake: str | None) -> str | None:
    """The learner's full sentence that contained the mistake, so a card has its context."""
    if not session_id or not mistake:
        return mistake
    row = db.query_one(
        """SELECT text FROM messages WHERE session_id = ? AND role = 'user' AND INSTR(LOWER(text), LOWER(?)) > 0
           ORDER BY id LIMIT 1""", (session_id, mistake))
    return row["text"] if row else mistake


@api.get("/review/due")
def review_due(learner_id: int, language: str | None = None):
    """Due cards. Without `language`: all languages; due_by_language tells how many per language."""
    _learner_or_404(learner_id)
    now = scheduler.now_iso()
    lang_filter = "AND language = ?" if language else ""
    params = (learner_id, now, language) if language else (learner_id, now)
    rows = db.query(
        f"""SELECT c.id, c.kind, c.front, c.back, c.explanation, c.language,
                   e.original AS mistake, e.session_id AS error_session
            FROM cards c LEFT JOIN errors e ON e.id = c.error_id
            WHERE c.learner_id = ? AND c.deleted = 0 AND c.due <= ? {lang_filter.replace("language", "c.language")}
            ORDER BY c.due LIMIT 20""", params)
    by_lang = db.query("""SELECT language, COUNT(*) AS n FROM cards WHERE learner_id = ? AND deleted = 0 AND due <= ?
                          GROUP BY language""", (learner_id, now))
    cards = [{"card_id": r["id"], "kind": r["kind"], "front": r["front"], "back": r["back"],
              "explanation": r["explanation"], "language": r["language"],
              "mistake": r["mistake"], "you_said": _you_said(r["error_session"], r["mistake"])} for r in rows]
    return {"cards": cards, "due_count": sum(r["n"] for r in by_lang) if not language else len(cards),
            "due_by_language": {r["language"]: r["n"] for r in by_lang}}


@api.get("/cards/{card_id}/audio")
def card_audio(card_id: int):
    card = db.query_one(
        """SELECT c.*, COALESCE(c.language, l.target_language) AS target_language
           FROM cards c JOIN learners l ON l.id = c.learner_id WHERE c.id = ?""",
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
def progress(learner_id: int, language: str | None = None):
    """Stats for one language (default: the language of the learner's last session)."""
    _learner_or_404(learner_id)
    learner = db.learner_in(learner_id, language)
    lang = learner["target_language"]
    sessions = db.query_one(
        "SELECT COUNT(*) AS n FROM sessions WHERE learner_id = ? AND language = ? AND ended_at IS NOT NULL",
        (learner_id, lang))["n"]
    words = db.query_one(
        """SELECT COALESCE(SUM(LENGTH(m.text) - LENGTH(REPLACE(m.text, ' ', '')) + 1), 0) AS w
           FROM messages m JOIN sessions s ON s.id = m.session_id
           WHERE s.learner_id = ? AND s.language = ? AND m.role = 'user'""", (learner_id, lang))["w"]
    cards_total = db.query_one(
        "SELECT COUNT(*) AS n FROM cards WHERE learner_id = ? AND language = ? AND deleted = 0",
        (learner_id, lang))["n"]
    cards_due = db.query_one(
        "SELECT COUNT(*) AS n FROM cards WHERE learner_id = ? AND language = ? AND deleted = 0 AND due <= ?",
        (learner_id, lang, scheduler.now_iso()))["n"]
    acc = db.query_one(
        """SELECT AVG(CASE WHEN r.rating >= 3 THEN 1.0 ELSE 0.0 END) AS a FROM reviews r
           JOIN cards c ON c.id = r.card_id WHERE c.learner_id = ? AND c.language = ?""", (learner_id, lang))["a"]
    by = "concept" if config.MEMORY_MODE == "vector" else "rule"
    top_errors = concepts.top_mistakes(learner_id, lang, limit=5, by=by)
    return {
        "language": lang,
        "languages": db.languages_of(learner_id),
        "sessions": sessions,
        "minutes_spoken": round(words / 100),  # rough estimate: ~100 spoken words per minute
        "level": learner["level"],
        "cards_total": cards_total,
        "cards_due": cards_due,
        "review_accuracy": round(acc, 2) if acc is not None else None,
        "top_errors": [{"rule": e["rule"], "count": e["count"], "sessions": e["sessions"],
                        "fixed": bool(e["fixed"]), "concept_id": e["concept_id"]} for e in top_errors],
    }


@api.get("/mistakes/{concept_id}")
def mistake_occurrences(concept_id: int, learner_id: int):
    """Every time the learner made one recurring mistake (one concept), with the sentence they said.
    The concept groups reworded versions of the same mistake (vector DB), so this is
    "how many times, and where, did I get this wrong?"."""
    _learner_or_404(learner_id)
    rows = db.query(
        """SELECT e.original, e.correction, e.rule, e.session_id, s.started_at
           FROM errors e JOIN sessions s ON s.id = e.session_id
           WHERE e.learner_id = ? AND e.concept_id = ? ORDER BY e.id DESC""",
        (learner_id, concept_id))
    if not rows:
        raise HTTPException(404, "Mistake not found")
    return {"concept_id": concept_id, "count": len(rows), "occurrences": [
        {"original": r["original"], "correction": r["correction"], "rule": r["rule"],
         "you_said": _you_said(r["session_id"], r["original"]), "date": r["started_at"]} for r in rows]}


# ---------------- Memory ----------------

@api.get("/memory/search")
def memory_search(learner_id: int, q: str, language: str | None = None):
    """How often the learner said something: exact count + similar sentences from the vector DB."""
    _learner_or_404(learner_id)
    if not q.strip():
        raise HTTPException(400, "Empty query")
    return retrieval.count_said(learner_id, q, language)


app.include_router(api)

# Serve the frontend at http://localhost:8000 (must come after the API routes)
app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
