"""Does the vector DB recognise the same mistake when it is worded differently?

Each line of the dataset is a pair of errors labelled "same concept" or "different concept".
For every way of turning an error into text (memory/concepts.py REPRESENTATIONS) we embed both
errors, compute the cosine similarity and sweep the threshold. The baseline is the old behaviour:
two errors are the same only if their rule text is identical.

Then the system the app uses (DEFAULT_REPRESENTATION): two thresholds, with an LLM deciding the
doubtful pairs in between (memory/concepts.py decide). The LLM is asked once per pair in the widest
band, then several bands are compared without new calls.

Usage (from repo root):  python eval/eval_concepts.py [--data eval/datasets/error_pairs_it.jsonl ...]
                         python eval/eval_concepts.py --no-llm     # similarity only, no chat calls
Output: precision / recall / F1 per threshold and per band, and the baseline.
Put the chosen band in backend/config.py (CONCEPT_SIMILARITY_LOW / _HIGH).
"""
import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from memory.concepts import DEFAULT_REPRESENTATION, REPRESENTATIONS, same_mistake  # noqa: E402
from schemas import LearnerError  # noqa: E402
from tutor import llm  # noqa: E402


def prf(pred: list[bool], gold: list[bool]) -> tuple[float, float, float]:
    tp = sum(p and g for p, g in zip(pred, gold))
    fp = sum(p and not g for p, g in zip(pred, gold))
    fn = sum(g and not p for p, g in zip(pred, gold))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def to_error(d: dict) -> LearnerError:
    return LearnerError(type="grammar", original=d["original"], correction=d["correction"], rule=d["rule"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", nargs="+", default=[str(ROOT / "eval" / "datasets" / "error_pairs_it.jsonl"),
                                                       str(ROOT / "eval" / "datasets" / "error_pairs_en.jsonl")])
    parser.add_argument("--no-llm", action="store_true", help="skip the LLM check of the doubtful band")
    args = parser.parse_args()

    rows = [json.loads(line) for path in args.data
            for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()]
    gold = [r["same"] for r in rows]
    print(f"pairs={len(rows)}  same={sum(gold)}  different={len(gold) - sum(gold)}  "
          f"embedding model={config.EMBEDDING_MODEL}\n")

    # Baseline: identical rule text (what GROUP BY rule did)
    base = [r["a"]["rule"].strip(" .").lower() == r["b"]["rule"].strip(" .").lower() for r in rows]
    p, r_, f = prf(base, gold)
    print(f"BASELINE exact rule text      precision={p:.2f} recall={r_:.2f} F1={f:.2f}\n")

    thresholds = [round(0.30 + 0.05 * i, 2) for i in range(14)]   # 0.30 ... 0.95
    summary = []
    for name, to_text in REPRESENTATIONS.items():
        texts_a = [to_text(to_error(r["a"])) for r in rows]
        texts_b = [to_text(to_error(r["b"])) for r in rows]
        vectors = llm.embed(texts_a + texts_b)
        sims = [cosine(vectors[i], vectors[len(rows) + i]) for i in range(len(rows))]

        same_sims = [s for s, g in zip(sims, gold) if g]
        diff_sims = [s for s, g in zip(sims, gold) if not g]
        hard_sims = [s for s, r in zip(sims, rows) if r["kind"].startswith("hard")]
        print(f"== representation '{name}'   mean similarity: same={sum(same_sims)/len(same_sims):.2f}  "
              f"different={sum(diff_sims)/len(diff_sims):.2f}  hard different={sum(hard_sims)/max(1, len(hard_sims)):.2f}")
        best = (0.0, 0.0)
        for t in thresholds:
            p, r_, f = prf([s >= t for s in sims], gold)
            print(f"   threshold {t:.2f}: precision={p:.2f} recall={r_:.2f} F1={f:.2f}")
            if f > best[1]:
                best = (t, f)
        print(f"   best: threshold {best[0]:.2f}  F1={best[1]:.2f}\n")
        summary.append((name, *best))
        if name == DEFAULT_REPRESENTATION:
            app_sims, app_a, app_b = sims, texts_a, texts_b

        # The pairs it gets wrong at its best threshold, useful for the report
        wrong = [(r, s) for r, s, g in zip(rows, sims, gold) if (s >= best[0]) != g]
        for r, s in wrong[:6]:
            print(f"   wrong ({r['kind']}, sim={s:.2f}): {r['a']['rule']!r} vs {r['b']['rule']!r}")
        print()

    llm_summary = None if args.no_llm else eval_llm_band(rows, gold, app_sims, app_a, app_b)

    print("SUMMARY")
    print(f"   baseline (exact text)   F1={prf(base, gold)[2]:.2f}")
    for name, t, f in summary:
        print(f"   {name:<6} best threshold={t:.2f}  F1={f:.2f}")
    if llm_summary:
        print(f"   {DEFAULT_REPRESENTATION:<6} + LLM band {llm_summary[0]:.2f}-{llm_summary[1]:.2f} (config)  "
              f"precision={llm_summary[2]:.2f} recall={llm_summary[3]:.2f} F1={llm_summary[4]:.2f}  "
              f"LLM calls on {llm_summary[5]}/{len(rows)} pairs")


def eval_llm_band(rows, gold, sims, texts_a, texts_b):
    """Two thresholds + LLM in between, as memory/concepts.py decide() does."""
    widest = (0.35, 0.75)
    asked = {}
    for i, s in enumerate(sims):
        if widest[0] <= s < widest[1]:
            asked[i] = same_mistake(texts_a[i], texts_b[i], rows[i]["language"])

    def predict(low, high):
        return [True if s >= high else False if s < low else asked[i] for i, s in enumerate(sims)]

    print(f"== '{DEFAULT_REPRESENTATION}' + LLM for the doubtful band  (model={config.LLM_MODEL})")
    p, r_, f = prf(list(asked.values()), [gold[i] for i in asked])
    print(f"   LLM alone on the {len(asked)} pairs in {widest[0]:.2f}-{widest[1]:.2f}: "
          f"precision={p:.2f} recall={r_:.2f} F1={f:.2f}")
    config_band = (config.CONCEPT_SIMILARITY_LOW, config.CONCEPT_SIMILARITY_HIGH)
    bands = sorted({(0.40, 0.60), (0.40, 0.65), (0.45, 0.60), (0.45, 0.65), (0.45, 0.70), (0.50, 0.65),
                    (0.35, 0.75), config_band})
    result = None
    for low, high in bands:
        pred = predict(low, high)
        p, r_, f = prf(pred, gold)
        calls = sum(low <= s < high for s in sims)
        mark = "  <- config" if (low, high) == config_band else ""
        print(f"   band {low:.2f}-{high:.2f}: precision={p:.2f} recall={r_:.2f} F1={f:.2f}  LLM calls={calls}{mark}")
        if (low, high) == config_band:
            result = (low, high, p, r_, f, calls)
            wrong = [(r, s) for r, s, pr, g in zip(rows, sims, pred, gold) if pr != g]
    for r, s in wrong:
        print(f"   wrong at config ({r['kind']}, sim={s:.2f}): {r['a']['rule']!r} vs {r['b']['rule']!r}")
    print()
    return result


if __name__ == "__main__":
    main()
