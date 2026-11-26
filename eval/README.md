# Evaluation (owner: evaluation & report)

All evaluation is in Italian. Run every script from the repo root with the backend's virtualenv active
(`source backend/.venv/bin/activate`) and the API key in `backend/.env`.

## Method

Each part of the system answers one question, with a metric, a dataset and a **baseline** to compare with.

| # | Question | Metric | Data | Baseline | Script |
|---|---|---|---|---|---|
| 1 | Does it find the learner's mistakes? | Precision / recall / F1 (span overlap) | `datasets/errors_it.jsonl` | Larger model (`gpt-6-sol`) | `eval_errors.py` |
| 2 | Does the vector DB recognise the same mistake when it is reworded? | Pair precision / recall / F1, best threshold | `datasets/error_pairs_it.jsonl`, `error_pairs_en.jsonl` | Identical rule text (old `GROUP BY rule`) | `eval_concepts.py` |
| 3 | Does it bring back the right memory? | Recall@3, MRR, false-memory rate | `datasets/retrieval_it.json` | Recency (last 3 things said) | `eval_retrieval.py` |
| 4 | Does memory make the tutor better? (ablation) | Target elicitation, correct vs invented memory references, fragmentation | Simulated learners `datasets/sim_learners.json` | `MEMORY_MODE=none` and `sql` | `simulate.py` |
| 5 | Are the cards good? | Human rubric 1–3, human–judge agreement (Cohen's kappa) | ~50 generated cards | Agreement between humans | `eval_cards.py` |
| 6 | Is it fast enough to talk? | Mean and p90 ms per turn, split asr / memory / llm / tts | Stored timings | Before/after memory | `eval_latency.py` |

Experiments 2 and 3 also **tune** the two thresholds in `backend/config.py`
(`CONCEPT_SIMILARITY_LOW`/`_HIGH`, `MEMORY_MIN_SIMILARITY`). Tune them first, then run experiment 4.

## Commands

```bash
python eval/eval_errors.py                     # 1, uses LLM_MODEL from config
python eval/eval_errors.py --model gpt-6-sol   # 1, comparison model
python eval/eval_concepts.py                   # 2
python eval/eval_retrieval.py                  # 3
python eval/simulate.py                        # 4, ~15 min; text only, well under $1 with gpt-6-luna (the judge runs on gpt-6-sol: check its price)
python eval/simulate.py --sessions 2 --turns 4 --modes vector   # 4, quick check
python eval/eval_cards.py export --db <path>   # 5, path printed by simulate.py, or omit for the app DB
python eval/eval_cards.py judge                # 5
python eval/eval_cards.py report               # 5
python eval/eval_latency.py                    # 6, reads timings stored by real sessions
```

`simulate.py` saves everything to `results/simulate_<date>.json` (per-session details, the judge's
answers, and the summary table) so the numbers in the report can be traced back.

## Datasets

### `datasets/errors_it.jsonl` (experiment 1)
One JSON object per line. Target: ~100 lines, including ~20% with **no errors** (to measure false positives).

```json
{"id": 1, "learner_text": "...", "level": "A2", "errors": [{"original": "...", "correction": "...", "type": "grammar"}]}
```

- `original` = the smallest span containing the error, exactly as written in `learner_text`.
- Mix error types: articles, gender/number agreement, prepositions, verb tenses (passato prossimo with essere/avere), vocabulary, word order.
- Ideally two people annotate independently and disagreements are discussed.

Current version: 101 sentences (A1 20, A2 63, B1 17, B2 1), 20 without errors, 85 errors
(grammar 61: articles, agreement, prepositions, essere/avere, participles, subjunctive, pronouns;
vocabulary 12: false friends, calques, English words; spelling 8; word order 4). Several sentences
have more than one error. The correct sentences are hard negatives that look like typical mistakes
(*mia madre*, *il problema*, *gli ho dato* to a man). **Draft: a second annotator should check it.**
Row 3 (*Mi piace molto la pizza e la pasta*) is debatable: strictly *piacciono*, but common usage accepts *piace*.

`FAKE_LLM=1 python eval/eval_errors.py` runs the script offline as a smoke test; its numbers only
measure the offline regex rules, not the model.

### `datasets/error_pairs_it.jsonl` (experiment 2)
52 pairs of errors over 13 typical A2 mistakes: 26 "same mistake, different wording", 14 **hard
negatives** (different mistakes that look alike, e.g. *la mia amica* needs the article but *mia madre*
does not), 12 easy negatives. **Draft: check the labels and the Italian, and add more pairs.**

### `datasets/retrieval_it.json` (experiment 3)
28 things a fictional learner said over 4 sessions, and 23 queries (new messages or scenarios)
labelled with the related memories. 5 queries have **no** related memory: anything retrieved for them
above the threshold is a false memory. **Draft: check and extend.**

### `datasets/sim_learners.json` (experiment 4)
Three simulated learners (A2–B1), each with facts about their life and a fixed list of recurring
mistakes. The facts let the judge tell correct memories from invented ones; the mistakes are the
ground truth for fragmentation.

## Metrics in detail

- **Error detection:** a predicted error matches a gold error if their `original` spans overlap.
- **Concept grouping:** a pair counts as "same" if the cosine similarity of the two embedded errors is at
  least the threshold. Compared across three ways of writing an error as text (`rule`, `pair`, `full`).
  Then the app's system: below `CONCEPT_SIMILARITY_LOW` different, from `_HIGH` same, in between an LLM
  decides (`prompts/same_mistake.md`); several bands are compared, with the number of LLM calls.
- **Retrieval:** Recall@k = relevant memories in the top k / min(k, number of relevant memories).
- **Target elicitation:** of the targets the planner chose, the share the learner actually had to use
  (LLM judge reads the transcript). Only sessions 2+ count, since session 1 has nothing to remember.
- **Memory references:** the judge lists every time the tutor mentions something not said earlier in the
  session, and checks it against the learner's true facts: *correct* or *invented*.
- **Fragmentation:** distinct rule texts per true mistake vs concepts per true mistake (1.00 = each real
  mistake is exactly one group). The extractor can also find mistakes outside the learner's profile, so
  read it as a comparison between the two numbers, not as an absolute score.
- **Card quality:** 2–3 of us score ~50 cards (correct / useful / right level, 1–3 each) independently;
  the LLM judge scores the same cards; we report means and Cohen's kappa for every pair of scorers.
- **Latency:** mean and p90 of `total` ms per turn, with the asr / memory / llm / tts breakdown.

## Limits to mention in the report

- Simulated learners do not learn, so we measure whether the tutor *practises* the right things, not
  whether a real learner improves. A few real sessions are the sanity check.
- The LLM judge can be wrong; part of experiment 5 measures how much it agrees with humans.
- The pair and retrieval datasets are small and written by us; report them as such.
