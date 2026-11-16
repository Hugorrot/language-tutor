"""Precision / recall / F1 of the error extractor on the annotated Italian dataset.

Usage (from repo root):  python eval/eval_errors.py [--model MODEL] [--data eval/datasets/errors_it.jsonl]
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from analysis.error_extractor import extract_errors  # noqa: E402


def overlaps(a: str, b: str) -> bool:
    a, b = a.lower().strip(" .,!?"), b.lower().strip(" .,!?")
    return bool(a and b) and (a in b or b in a)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=config.LLM_MODEL)
    parser.add_argument("--data", default=str(ROOT / "eval" / "datasets" / "errors_it.jsonl"))
    args = parser.parse_args()

    tp = fp = fn = 0
    rows = [json.loads(line) for line in Path(args.data).read_text(encoding="utf-8").splitlines() if line.strip()]
    for row in rows:
        transcript = f"LEARNER: {row['learner_text']}"
        predicted = extract_errors(transcript, "Italian", "English", row.get("level", "A2"), model=args.model)
        gold = row["errors"]

        matched_gold = set()
        for p in predicted:
            hit = next((i for i, g in enumerate(gold) if i not in matched_gold and overlaps(p.original, g["original"])), None)
            if hit is None:
                fp += 1
            else:
                tp += 1
                matched_gold.add(hit)
        fn += len(gold) - len(matched_gold)

    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    print(f"model={args.model}  n={len(rows)}  TP={tp} FP={fp} FN={fn}")
    print(f"precision={precision:.3f}  recall={recall:.3f}  F1={f1:.3f}")


if __name__ == "__main__":
    main()
