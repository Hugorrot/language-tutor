"""Long-term memory of what the learner said. Owner: memory.

At the end of a session, every learner message and the session summary are embedded and stored.
Later the tutor gets the past memories most similar to the current scenario (at session start)
and to the learner's latest message (each turn), so it can refer back to them naturally.
"""
import config
from data import db
from memory import store
from tutor import llm

COLLECTION = "memories"
MIN_WORDS = 3   # "Sì", "Non lo so" ... are not worth remembering


def _where(learner_id: int, language: str | None = None, kind: str | None = None) -> dict:
    conds = [{"learner_id": learner_id}]
    if language:
        conds.append({"language": language})
    if kind:
        conds.append({"kind": kind})
    return conds[0] if len(conds) == 1 else {"$and": conds}


def index_session(learner_id: int, language: str, session_id: int, summary: str | None) -> int:
    """Store this session's learner messages and summary in the vector DB. Returns how many."""
    rows = db.query("SELECT id, text FROM messages WHERE session_id = ? AND role = 'user' ORDER BY id",
                    (session_id,))
    items = [(f"u{r['id']}", r["text"], "utterance") for r in rows if len(r["text"].split()) >= MIN_WORDS]
    if summary:
        items.append((f"s{session_id}", summary, "summary"))
    if not items:
        return 0
    vectors = llm.embed([text for _, text, _ in items])
    store.add(COLLECTION, [i for i, _, _ in items], vectors, [t for _, t, _ in items],
              [{"learner_id": learner_id, "language": language, "session_id": session_id, "kind": kind}
               for _, _, kind in items])
    return len(items)


def search(learner_id: int, query: str, k: int = config.MEMORY_TOP_K, kind: str | None = None,
           min_similarity: float = config.MEMORY_MIN_SIMILARITY, vector: list[float] | None = None,
           language: str | None = None) -> list[dict]:
    """Past memories most similar to `query`, most similar first (optionally in one language only)."""
    where = _where(learner_id, language, kind)
    vector = vector or llm.embed([query])[0]
    hits = store.search(COLLECTION, vector, where=where, k=k)
    return [h for h in hits if h["similarity"] >= min_similarity]


def format_block(title: str, hits: list[dict]) -> str:
    if not hits:
        return ""
    lines = []
    for h in hits:
        prefix = "Summary of an earlier session" if h["kind"] == "summary" else "The learner said"
        lines.append(f'- {prefix}: "{h["text"]}"')
    return (f"## {title}\n" + "\n".join(lines) +
            "\nUse these only if they fit naturally, for example to ask a follow-up question. "
            "Never invent details that are not written here.")


def session_memory_block(learner_id: int, language: str, scenario: str) -> str:
    """Memory for the start of a session: the last summary in this language plus what is related
    to the scenario. Only memories from the same language, so the tutor never drifts into another one."""
    last = db.query_one(
        """SELECT id, scenario, summary FROM sessions WHERE learner_id = ? AND language = ? AND summary IS NOT NULL
           ORDER BY id DESC LIMIT 1""",
        (learner_id, language))
    parts = []
    if last:
        parts.append(f"## Last session\nScenario: {last['scenario']}. Summary: {last['summary']}\n"
                     "You may briefly refer back to it when greeting.")
    hits = [h for h in search(learner_id, scenario, k=config.MEMORY_TOP_K + 1, language=language)
            if not (last and h["id"] == f"s{last['id']}")][: config.MEMORY_TOP_K]
    block = format_block("Things you remember about this learner", hits)
    if block:
        parts.append(block)
    return "\n\n".join(parts)


def turn_memory_block(learner_id: int, language: str, message: str) -> str:
    """Memory for one turn: earlier things the learner said that relate to their latest message."""
    if len(message.split()) < MIN_WORDS:
        return ""
    hits = search(learner_id, message, kind="utterance", language=language)
    return format_block("Related things the learner said in earlier sessions", hits)


def count_said(learner_id: int, phrase: str, language: str | None = None) -> dict:
    """How often the learner said something: exact matches (SQL) and similar sentences (vector DB).

    Exact counting is better for a precise word ("prenotare"); similarity finds the same idea
    said with different words ("ho prenotato un tavolo" ~ "volevo riservare per stasera").
    """
    needle = phrase.strip().lower()
    lang_filter = "AND s.language = ?" if language else ""
    rows = db.query(
        f"""SELECT m.text FROM messages m JOIN sessions s ON s.id = m.session_id
            WHERE s.learner_id = ? AND m.role = 'user' {lang_filter}""",
        (learner_id, language) if language else (learner_id,))
    exact = sum(r["text"].lower().count(needle) for r in rows) if needle else 0
    similar = search(learner_id, phrase, k=10, kind="utterance", language=language) if needle else []
    return {
        "query": phrase,
        "exact_count": exact,
        "similar": [{"text": h["text"], "similarity": round(h["similarity"], 3), "session_id": h["session_id"]}
                    for h in similar],
    }


def backfill_languages() -> None:
    """Vector entries saved before languages were tracked get the language of their session."""
    for name in (COLLECTION, "errors"):
        got = store.collection(name).get(include=["metadatas"])
        ids, metas = [], []
        for i, meta in zip(got["ids"], got["metadatas"]):
            if meta.get("language"):
                continue
            if name == "errors":
                row = db.query_one("SELECT language FROM errors WHERE id = ?", (int(i),))
            elif i.startswith("u"):
                row = db.query_one("""SELECT s.language FROM messages m JOIN sessions s ON s.id = m.session_id
                                      WHERE m.id = ?""", (int(i[1:]),))
            else:
                row = db.query_one("SELECT language FROM sessions WHERE id = ?", (int(i[1:]),))
            if row and row["language"]:
                ids.append(i)
                metas.append({**meta, "language": row["language"]})
        store.update_metadata(name, ids, metas)
