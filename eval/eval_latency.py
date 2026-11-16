"""Latency per tutor turn, from timings stored in the database by real sessions.

Usage (from repo root):  python eval/eval_latency.py
"""
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from data import db  # noqa: E402


def p90(values: list[int]) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(round(0.9 * (len(s) - 1))))]


def main() -> None:
    rows = db.query("SELECT timings FROM messages WHERE role = 'tutor' AND timings != '{}'")
    timings = [json.loads(r["timings"]) for r in rows]
    timings = [t for t in timings if t.get("total")]
    if not timings:
        print("No timed turns yet. Have a few voice conversations first.")
        return
    print(f"turns={len(timings)}")
    for key in ("asr", "llm", "tts", "total"):
        vals = [t.get(key, 0) for t in timings]
        print(f"{key:>5}: mean={statistics.mean(vals):7.0f} ms   p90={p90(vals):7.0f} ms")


if __name__ == "__main__":
    main()
