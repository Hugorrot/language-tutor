"""Simulated learners + ablation of the memory: none vs sql vs vector.

An LLM plays each learner in eval/datasets/sim_learners.json. Every learner has a fixed list of
recurring mistakes (the ground truth) and some facts about their life. For each memory mode the
script runs the same learners through several text sessions with the real backend code (no audio),
reviews due cards between sessions, and then measures:

- target elicitation: share of the planner's targets the learner actually had to use (LLM judge)
- memory references per session, and how many were invented (LLM judge, checked against the facts)
- fragmentation: distinct rule texts vs concepts vs true recurring mistakes (closer to 1x = better)
- latency of the memory step and of the LLM step per turn

Modes (config.MEMORY_MODE):
  none   = no targets, no memory          (lower baseline)
  sql    = old behaviour: last summary, weak points grouped by identical rule text
  vector = concept grouping + retrieved memories (the full system)

Usage (from repo root):
  python eval/simulate.py                         # 3 modes x all learners x 4 sessions x 6 turns
  python eval/simulate.py --sessions 2 --turns 4 --modes vector   # quick check
Each run costs roughly a cent per session (text only, small model). Results go to eval/results/.
"""
import argparse
import asyncio
import json
import random
import statistics
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import api  # noqa: E402
import config  # noqa: E402
from data import db  # noqa: E402
from memory import store  # noqa: E402
from schemas import LearnerCreate, ReviewAnswer, SessionEnd, SessionStart  # noqa: E402
from tutor import conversation, llm  # noqa: E402
from voice import tts  # noqa: E402

EVAL_DIR = ROOT / "eval"
SCENARIOS = ["telling a friend about your weekend", "ordering at a restaurant", "renting a flat",
             "free conversation", "asking for directions"]


def load_eval_prompt(name: str, /, **variables) -> str:
    return (EVAL_DIR / "prompts" / f"{name}.md").read_text(encoding="utf-8").format(**variables)


def learner_says(profile: dict, session_id: int) -> str:
    """The simulated learner's next message. The tutor's lines are the 'user' side for this LLM."""
    system = load_eval_prompt(
        "sim_learner", name=profile["name"], native_language=profile["native_language"], level=profile["level"],
        facts="\n".join(f"  - {f}" for f in profile["facts"]),
        mistakes="\n".join(f"  - {m['description']}" for m in profile["mistakes"]))
    swap = {"tutor": "user", "user": "assistant"}
    history = [{"role": swap[m["role"]], "content": m["text"]} for m in db.get_messages(session_id)]
    return llm.call_llm([{"role": "system", "content": system}] + history).strip()


def earlier_sessions(learner_id: int, before_session: int) -> str:
    """What the learner said and the summaries of earlier sessions, for the judge."""
    parts = []
    for s in db.query("SELECT id, scenario, summary FROM sessions WHERE learner_id = ? AND id < ? ORDER BY id",
                      (learner_id, before_session)):
        said = [m["text"] for m in db.get_messages(s["id"]) if m["role"] == "user"]
        parts.append(f"Session '{s['scenario']}': learner said: " + " / ".join(said) +
                     (f"\nSummary: {s['summary']}" if s["summary"] else ""))
    return "\n".join(parts) or "(none)"


def judge(targets: list[str], profile: dict, transcript: str, earlier: str, model: str) -> dict:
    prompt = load_eval_prompt(
        "judge_session",
        targets="\n".join(f"- {t}" for t in targets) or "(none)",
        facts="\n".join(f"- {f}" for f in profile["facts"]),
        earlier=earlier,
        transcript=transcript)
    try:
        return llm.call_llm_json([{"role": "user", "content": prompt}], model=model)
    except Exception as exc:  # one bad judge answer should not stop a long run
        print(f"      judge failed: {exc}")
        return {}


def run_mode(mode: str, profiles: list[dict], n_sessions: int, n_turns: int, judge_model: str,
             workdir: Path, seed: int) -> dict:
    config.MEMORY_MODE = mode
    db.DB_PATH = workdir / f"{mode}.db"
    store.use_path(workdir / f"chroma_{mode}")
    api.startup()
    rng = random.Random(seed)            # same review answers in every mode

    sessions_out, fragmentation = [], []
    for profile in profiles:
        learner_id = api.create_learner(LearnerCreate(
            name=profile["name"], explanation_language=profile["native_language"], goal=profile["goal"]))["learner_id"]
        db.execute("UPDATE learners SET level = ? WHERE id = ?", (profile["level"], learner_id))

        for k in range(n_sessions):
            scenario = SCENARIOS[k % len(SCENARIOS)]
            start = api.start_session(SessionStart(learner_id=learner_id, scenario=scenario))
            sid, timings = start["session_id"], []
            for _ in range(n_turns):
                text = learner_says(profile, sid)
                turn = asyncio.run(api.session_turn(session_id=sid, text=text, audio=None))
                timings.append(turn["timings_ms"])
            transcript = conversation.transcript_text(sid)
            end = api.end_session(SessionEnd(session_id=sid))

            # Review what is due, like a learner between sessions: ~30% "Again", the rest "Good".
            for card in api.review_due(learner_id)["cards"]:
                api.review_answer(ReviewAnswer(card_id=card["card_id"], rating=1 if rng.random() < 0.3 else 3))

            verdict = (judge(start["targets"], profile, transcript, earlier_sessions(learner_id, sid), judge_model)
                       if k > 0 else {})
            elicited = [t.get("elicited") is True for t in verdict.get("targets", [])]
            refs = verdict.get("memory_references", [])
            sessions_out.append({
                "learner": profile["name"], "session": k + 1, "scenario": scenario, "targets": start["targets"],
                "elicited": sum(elicited), "n_targets": len(start["targets"]),
                "memory_refs": len(refs), "invented": sum(r.get("verdict") == "invented" for r in refs),
                "errors_found": len(end["errors"]), "cards_new": len(end["cards"]),
                "memory_ms": [t.get("memory", 0) for t in timings], "llm_ms": [t["llm"] for t in timings],
                "judge": verdict,
            })
            print(f"   [{mode}] {profile['name']} session {k + 1}/{n_sessions}: targets={len(start['targets'])} "
                  f"elicited={sum(elicited)} memory refs={len(refs)} errors={len(end['errors'])}")

        rules = db.query_one("SELECT COUNT(DISTINCT LOWER(TRIM(rule))) AS n FROM errors WHERE learner_id = ?",
                             (learner_id,))["n"]
        concepts_n = db.query_one("SELECT COUNT(DISTINCT concept_id) AS n FROM errors WHERE learner_id = ?",
                                  (learner_id,))["n"]
        fragmentation.append({"learner": profile["name"], "true_mistakes": len(profile["mistakes"]),
                              "distinct_rule_texts": rules, "concepts": concepts_n})
    return {"sessions": sessions_out, "fragmentation": fragmentation}


def summarise(mode: str, res: dict) -> dict:
    later = [s for s in res["sessions"] if s["session"] > 1]          # session 1 has no memory yet
    targets = sum(s["n_targets"] for s in later)
    mem = [ms for s in res["sessions"] for ms in s["memory_ms"]]
    llm_ms = [ms for s in res["sessions"] for ms in s["llm_ms"]]
    frag = res["fragmentation"]
    true_n = sum(f["true_mistakes"] for f in frag)
    return {
        "mode": mode,
        "target_elicitation": (sum(s["elicited"] for s in later) / targets) if targets else None,
        "targets_per_session": targets / len(later) if later else 0,
        "memory_refs_per_session": statistics.mean(s["memory_refs"] for s in later) if later else 0,
        "invented_per_session": statistics.mean(s["invented"] for s in later) if later else 0,
        "rule_texts_per_true_mistake": sum(f["distinct_rule_texts"] for f in frag) / true_n,
        "concepts_per_true_mistake": sum(f["concepts"] for f in frag) / true_n,
        "errors_found_per_session": statistics.mean(s["errors_found"] for s in res["sessions"]),
        "memory_ms_mean": statistics.mean(mem) if mem else 0,
        "llm_ms_mean": statistics.mean(llm_ms) if llm_ms else 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--modes", default="none,sql,vector")
    parser.add_argument("--sessions", type=int, default=4)
    parser.add_argument("--turns", type=int, default=6)
    parser.add_argument("--learners", default="all", help="comma-separated names, or 'all'")
    parser.add_argument("--judge-model", default=config.EVAL_COMPARISON_MODEL)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    profiles = json.loads((EVAL_DIR / "datasets" / "sim_learners.json").read_text(encoding="utf-8"))["learners"]
    if args.learners != "all":
        wanted = {n.strip().lower() for n in args.learners.split(",")}
        profiles = [p for p in profiles if p["name"].lower() in wanted]

    # Text only: skip speech synthesis (saves time and money, does not change the conversation).
    tts.text_to_speech_b64 = lambda text, language: ""

    workdir = Path(tempfile.mkdtemp(prefix="tutor_sim_"))
    print(f"Working databases in {workdir}")
    results, table = {}, []
    for mode in [m.strip() for m in args.modes.split(",")]:
        print(f"\n=== MEMORY_MODE={mode}")
        results[mode] = run_mode(mode, profiles, args.sessions, args.turns, args.judge_model, workdir, args.seed)
        table.append(summarise(mode, results[mode]))

    print("\nRESULTS (sessions 2+ for the judge metrics)")
    print(f"{'mode':<7} {'elicited':>9} {'targets':>8} {'mem refs':>9} {'invented':>9} "
          f"{'rules/true':>11} {'concepts/true':>14} {'mem ms':>7} {'llm ms':>7}")
    for r in table:
        el = "-" if r["target_elicitation"] is None else f"{r['target_elicitation']:.0%}"
        print(f"{r['mode']:<7} {el:>9} {r['targets_per_session']:>8.1f} {r['memory_refs_per_session']:>9.2f} "
              f"{r['invented_per_session']:>9.2f} {r['rule_texts_per_true_mistake']:>11.2f} "
              f"{r['concepts_per_true_mistake']:>14.2f} {r['memory_ms_mean']:>7.0f} {r['llm_ms_mean']:>7.0f}")
    print("\nrules/true and concepts/true: how many groups each real recurring mistake was split into (1.00 = perfect).")

    out = EVAL_DIR / "results" / f"simulate_{time.strftime('%Y%m%d_%H%M%S')}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"args": vars(args), "summary": table, "details": results}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
