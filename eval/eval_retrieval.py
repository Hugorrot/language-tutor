"""Does the vector DB bring back the right memory?

Loads the memories of a fictional learner into a temporary vector DB (same code path as the app:
memory/retrieval.py), then asks each query and checks which memories come back.

Metrics
- Recall@k: share of the relevant memories found in the top k (divided by min(k, #relevant)).
- MRR: 1 / rank of the first relevant memory, averaged.
- With the similarity threshold (config.MEMORY_MIN_SIMILARITY), which is what the tutor actually sees:
  hit rate on queries that have a related memory, and false-memory rate on queries that have none.
Baseline: recency (always the k most recent memories), like a tutor that only remembers last time.

Usage (from repo root):  python eval/eval_retrieval.py [--k 3]
"""
import argparse
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from memory import retrieval, store  # noqa: E402
from tutor import llm  # noqa: E402

LEARNER = 1


def recall_at(ranked: list[str], relevant: list[str], k: int) -> float:
    return len(set(ranked[:k]) & set(relevant)) / min(k, len(relevant))


def mrr(ranked: list[str], relevant: list[str]) -> float:
    return next((1 / (i + 1) for i, m in enumerate(ranked) if m in relevant), 0.0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(ROOT / "eval" / "datasets" / "retrieval_it.json"))
    parser.add_argument("--k", type=int, default=config.MEMORY_TOP_K)
    args = parser.parse_args()
    data = json.loads(Path(args.data).read_text(encoding="utf-8"))
    memories, queries = data["memories"], data["queries"]

    store.use_path(tempfile.mkdtemp())
    vectors = llm.embed([m["text"] for m in memories])
    store.add(retrieval.COLLECTION, [m["id"] for m in memories], vectors, [m["text"] for m in memories],
              [{"learner_id": LEARNER, "session_id": m["session_id"], "kind": "utterance"} for m in memories])

    query_vectors = llm.embed([q["query"] for q in queries])
    recency = [m["id"] for m in sorted(memories, key=lambda m: (m["session_id"], m["id"]), reverse=True)]
    with_rel = [q for q in queries if q["relevant"]]
    without = [q for q in queries if not q["relevant"]]

    results = {}   # query id -> list of hits (id, similarity), most similar first
    for q, vec in zip(queries, query_vectors):
        hits = retrieval.search(LEARNER, q["query"], k=len(memories), min_similarity=-1.0, vector=vec)
        results[q["id"]] = [(h["id"], h["similarity"]) for h in hits]

    k = args.k
    print(f"memories={len(memories)}  queries={len(queries)} ({len(with_rel)} with a related memory, "
          f"{len(without)} without)  k={k}  embedding model={config.EMBEDDING_MODEL}\n")
    for name, ranked_of in (("vector DB", lambda q: [i for i, _ in results[q["id"]]]),
                            ("recency baseline", lambda q: recency)):
        r = sum(recall_at(ranked_of(q), q["relevant"], k) for q in with_rel) / len(with_rel)
        m = sum(mrr(ranked_of(q), q["relevant"]) for q in with_rel) / len(with_rel)
        print(f"{name:<17} Recall@{k}={r:.2f}  MRR={m:.2f}")
    for t in ("message", "scenario"):
        qs = [q for q in with_rel if q["type"] == t]
        if qs:
            r = sum(recall_at([i for i, _ in results[q["id"]]], q["relevant"], k) for q in qs) / len(qs)
            print(f"   vector DB, {t} queries only ({len(qs)}): Recall@{k}={r:.2f}")

    print("\nThreshold sweep (what the tutor sees = top k above the threshold)")
    for t in [round(0.20 + 0.05 * i, 2) for i in range(11)]:
        hit = sum(any(i in q["relevant"] for i, s in results[q["id"]][:k] if s >= t) for q in with_rel) / len(with_rel)
        false_mem = sum(any(s >= t for _, s in results[q["id"]][:k]) for q in without) / max(1, len(without))
        shown = sum(sum(s >= t for _, s in results[q["id"]][:k]) for q in queries) / len(queries)
        mark = "  <- config" if abs(t - config.MEMORY_MIN_SIMILARITY) < 1e-9 else ""
        print(f"   {t:.2f}: hit rate={hit:.2f}  false-memory rate={false_mem:.2f}  memories shown/query={shown:.1f}{mark}")

    print("\nMisses (no relevant memory in the top k):")
    for q in with_rel:
        top = results[q["id"]][:k]
        if not any(i in q["relevant"] for i, _ in top):
            print(f"   {q['query']!r}: got {[i for i, _ in top]}, wanted {q['relevant']}")


if __name__ == "__main__":
    main()
