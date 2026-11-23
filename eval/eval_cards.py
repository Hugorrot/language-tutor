"""Flashcard quality: human rubric + LLM-as-a-judge, and how much they agree.

Steps (from repo root):
1. python eval/eval_cards.py export [--db PATH] [--n 50]
     writes eval/cards_rubric_TEMPLATE.csv. Each scorer copies it to cards_rubric_<name>.csv
     and fills correct / useful / level_ok with 1-3, without looking at the others' scores.
2. python eval/eval_cards.py judge
     the LLM judge (EVAL_COMPARISON_MODEL) scores the same cards -> eval/cards_rubric_judge.csv
3. python eval/eval_cards.py report
     mean score per criterion per scorer, and agreement (exact match %, Cohen's kappa)
     for every pair of scorers, including human vs judge.

--db can point to a database made by eval/simulate.py (path printed at the start of a run),
so there are enough cards even before real users.
"""
import argparse
import csv
import itertools
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import config  # noqa: E402
from data import db  # noqa: E402
from tutor import llm  # noqa: E402

EVAL_DIR = ROOT / "eval"
TEMPLATE = EVAL_DIR / "cards_rubric_TEMPLATE.csv"
JUDGE = EVAL_DIR / "cards_rubric_judge.csv"
CRITERIA = ["correct", "useful", "level_ok"]
CARD_COLUMNS = ["card_id", "kind", "front", "back", "explanation", "original", "correction",
                "level", "target_language", "explanation_language"]


def export(db_path: str | None, n: int, seed: int) -> None:
    if db_path:
        db.DB_PATH = Path(db_path)
    rows = db.query(
        """SELECT c.id AS card_id, c.kind, c.front, c.back, c.explanation, e.original, e.correction,
                  l.level, l.target_language, l.explanation_language
           FROM cards c JOIN learners l ON l.id = c.learner_id LEFT JOIN errors e ON e.id = c.error_id
           WHERE c.deleted = 0""")
    random.Random(seed).shuffle(rows)
    rows = sorted(rows[:n], key=lambda r: r["card_id"])
    with TEMPLATE.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CARD_COLUMNS + CRITERIA)
        w.writeheader()
        for r in rows:
            w.writerow({**{k: r[k] for k in CARD_COLUMNS}, **{c: "" for c in CRITERIA}})
    print(f"Wrote {len(rows)} cards to {TEMPLATE}. Copy it to cards_rubric_<yourname>.csv and fill the scores.")


def judge(model: str) -> None:
    rows = list(csv.DictReader(TEMPLATE.open(encoding="utf-8")))
    prompt_template = (EVAL_DIR / "prompts" / "judge_card.md").read_text(encoding="utf-8")
    out = []
    for r in rows:
        prompt = prompt_template.format(**{k: r.get(k) or "" for k in CARD_COLUMNS})
        data = llm.call_llm_json([{"role": "user", "content": prompt}], model=model)
        scores = {c: data.get(c, "") for c in CRITERIA}
        out.append({**{k: r[k] for k in CARD_COLUMNS}, **scores, "comment": data.get("comment", "")})
        print(f"card {r['card_id']}: {scores}")
    with JUDGE.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CARD_COLUMNS + CRITERIA + ["comment"])
        w.writeheader()
        w.writerows(out)
    print(f"Wrote {JUDGE}")


def cohen_kappa(a: list[int], b: list[int]) -> float:
    n = len(a)
    observed = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    expected = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return 1.0 if expected == 1 else (observed - expected) / (1 - expected)


def report() -> None:
    files = sorted(p for p in EVAL_DIR.glob("cards_rubric_*.csv") if p != TEMPLATE)
    if not files:
        print("No scored files yet (cards_rubric_<name>.csv).")
        return
    scores = {}   # scorer -> {card_id -> {criterion: int}}
    for p in files:
        name = p.stem.removeprefix("cards_rubric_")
        scores[name] = {}
        for r in csv.DictReader(p.open(encoding="utf-8")):
            try:
                scores[name][r["card_id"]] = {c: int(r[c]) for c in CRITERIA}
            except (ValueError, TypeError):
                continue   # not scored yet

    print("Mean score (1-3) per scorer")
    print(f"{'scorer':<12} {'cards':>6} " + " ".join(f"{c:>9}" for c in CRITERIA))
    for name, s in scores.items():
        means = [sum(v[c] for v in s.values()) / len(s) if s else 0 for c in CRITERIA]
        print(f"{name:<12} {len(s):>6} " + " ".join(f"{m:>9.2f}" for m in means))

    print("\nAgreement per pair of scorers (exact match % / Cohen's kappa)")
    for x, y in itertools.combinations(scores, 2):
        common = sorted(set(scores[x]) & set(scores[y]))
        if not common:
            continue
        parts = []
        for c in CRITERIA:
            a = [scores[x][i][c] for i in common]
            b = [scores[y][i][c] for i in common]
            exact = sum(p == q for p, q in zip(a, b)) / len(common)
            parts.append(f"{c}: {exact:.0%} / {cohen_kappa(a, b):.2f}")
        print(f"{x} vs {y} ({len(common)} cards): " + "   ".join(parts))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("--db")
    e.add_argument("--n", type=int, default=50)
    e.add_argument("--seed", type=int, default=0)
    j = sub.add_parser("judge")
    j.add_argument("--model", default=config.EVAL_COMPARISON_MODEL)
    sub.add_parser("report")
    args = parser.parse_args()
    if args.cmd == "export":
        export(args.db, args.n, args.seed)
    elif args.cmd == "judge":
        judge(args.model)
    else:
        report()


if __name__ == "__main__":
    main()
