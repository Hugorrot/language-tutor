"""Recurring mistakes ("concepts"). Owner: memory.

The error extractor writes a new free-text rule every session, so the same mistake comes back as
"Possessives take an article", "Use the article before possessive adjectives", ... Grouping by the
exact text would count those as different mistakes. Here each new error is compared with the
learner's past errors in the vector DB: if it is similar enough, it joins that concept, otherwise it
starts a new one. A concept's id is the id of its first error.

Similarity alone is not enough: unrelated mistakes that share words ("sport games -> sports games" and
"Capitalize the names of games") can score above a single threshold. So there are two:
below CONCEPT_SIMILARITY_LOW it is a new concept, from CONCEPT_SIMILARITY_HIGH it joins without asking,
and in between (doubtful) an LLM decides whether it is the same mistake.
"""
import config
from data import db
from memory import store
from schemas import LearnerError
from tutor import llm

COLLECTION = "errors"

# Ways to turn an error into text before embedding it. eval/eval_concepts.py compares them.
REPRESENTATIONS = {
    "rule": lambda e: e.rule,
    "pair": lambda e: f"{e.original} -> {e.correction}",
    "full": lambda e: f"{e.rule} | {e.original} -> {e.correction}",
}
DEFAULT_REPRESENTATION = "full"


def error_text(error: LearnerError, representation: str = DEFAULT_REPRESENTATION) -> str:
    return REPRESENTATIONS[representation](error)


NEIGHBOURS = 3   # past errors to compare with; in the doubtful band each distinct concept costs one LLM call


def same_mistake(a: str, b: str, language: str) -> bool:
    """LLM check for the doubtful band: are these two errors (as error_text) the same recurring mistake?"""
    prompt = llm.load_prompt("same_mistake", language=language, a=a, b=b)
    answer = llm.call_llm_json([{"role": "user", "content": prompt}])
    return answer.get("same") is True


def decide(similarity: float, a: str, b: str, language: str) -> bool:
    """Same concept? Sure from the similarity at the two ends, the LLM decides in between."""
    if similarity >= config.CONCEPT_SIMILARITY_HIGH:
        return True
    if similarity < config.CONCEPT_SIMILARITY_LOW:
        return False
    return same_mistake(a, b, language)


def _matching_concept(text: str, nearest: list[dict], language: str) -> int | None:
    """Concept of the most similar past error that is the same mistake, or None (new concept)."""
    checked = set()
    for hit in nearest:                                   # most similar first
        concept_id = int(hit["concept_id"])
        if concept_id in checked:
            continue
        checked.add(concept_id)
        if hit["similarity"] < config.CONCEPT_SIMILARITY_LOW:
            break                                         # the rest are even less similar
        if decide(hit["similarity"], text, hit["text"], language):
            return concept_id
    return None


def assign_concepts(learner_id: int, language: str, session_id: int, errors: list[LearnerError],
                    error_ids: list[int]) -> list[int]:
    """Give every new error a concept id, save it in SQLite and in the vector DB."""
    if not errors:
        return []
    texts = [error_text(e) for e in errors]
    vectors = llm.embed(texts)
    concept_ids = []
    for error, error_id, text, vector in zip(errors, error_ids, texts, vectors):
        # Only compare with the same learner's mistakes in the same language
        where = {"$and": [{"learner_id": learner_id}, {"language": language}]}
        nearest = store.search(COLLECTION, vector, where=where, k=NEIGHBOURS)
        concept_id = _matching_concept(text, nearest, language) or error_id
        concept_ids.append(concept_id)
        db.execute("UPDATE errors SET concept_id = ? WHERE id = ?", (concept_id, error_id))
        # Added one by one, so two errors of the same new concept in one session also match.
        store.add(COLLECTION, [str(error_id)], [vector], [text],
                  [{"learner_id": learner_id, "language": language, "session_id": session_id,
                    "concept_id": concept_id}])
    return concept_ids


def top_mistakes(learner_id: int, language: str, limit: int, only_open: bool = False,
                 by: str = "concept") -> list[dict]:
    """Most frequent mistakes. by="concept" groups similar errors (vector DB);
    by="rule" groups identical rule text (the old behaviour, kept as an evaluation baseline).

    Returns [{"concept_id", "rule", "count", "sessions", "fixed"}]; rule is the latest wording.
    """
    # Errors saved before concepts existed have no concept_id: each one counts as its own group.
    key = "COALESCE(concept_id, -id)" if by == "concept" else "rule"
    open_filter = "HAVING MIN(fixed) = 0" if only_open else ""
    return db.query(
        f"""WITH g AS (SELECT id, session_id, fixed, rule, concept_id, {key} AS grp
                       FROM errors WHERE learner_id = ? AND language = ?)
            SELECT grp, MAX(concept_id) AS concept_id, COUNT(*) AS count,
                   COUNT(DISTINCT session_id) AS sessions, MIN(fixed) AS fixed,
                   (SELECT g2.rule FROM g AS g2 WHERE g2.grp = g.grp ORDER BY g2.id DESC LIMIT 1) AS rule
            FROM g GROUP BY grp {open_filter}
            ORDER BY count DESC, MAX(id) DESC LIMIT ?""",
        (learner_id, language, limit),
    )


def concepts_with_cards(learner_id: int, language: str, before_session: int) -> set[int]:
    """Concepts that already have an active card from an earlier session."""
    rows = db.query(
        """SELECT DISTINCT e.concept_id FROM cards c JOIN errors e ON e.id = c.error_id
           WHERE c.learner_id = ? AND e.language = ? AND c.deleted = 0 AND e.session_id < ?
             AND e.concept_id IS NOT NULL""",
        (learner_id, language, before_session),
    )
    return {r["concept_id"] for r in rows}


def refresh_cards(learner_id: int, concept_ids: set[int], due_iso: str) -> int:
    """The mistake came back: make the existing cards of these concepts due now instead of
    creating duplicates. Returns how many cards were moved."""
    moved = 0
    for cid in concept_ids:
        rows = db.query(
            """SELECT c.id FROM cards c JOIN errors e ON e.id = c.error_id
               WHERE c.learner_id = ? AND c.deleted = 0 AND e.concept_id = ?""", (learner_id, cid))
        for r in rows:
            db.execute("UPDATE cards SET due = ? WHERE id = ? AND due > ?", (due_iso, r["id"], due_iso))
            moved += 1
    return moved


def update_fixed(learner_id: int, targeted: set[int], new_concepts: set[int], practised: set[int]) -> None:
    """After a session: a targeted concept the learner practised without repeating the mistake
    becomes fixed; a concept that came back is open again."""
    for cid in (targeted & practised) - new_concepts:
        db.execute("UPDATE errors SET fixed = 1 WHERE learner_id = ? AND concept_id = ?", (learner_id, cid))
    for cid in new_concepts:
        db.execute("UPDATE errors SET fixed = 0 WHERE learner_id = ? AND concept_id = ?", (learner_id, cid))
