# Evaluation (owner: evaluation & report)

All evaluation is in Italian. Run every script from the repo root with the backend's virtualenv active:

```bash
python eval/eval_errors.py                 # uses LLM_MODEL from config
python eval/eval_errors.py --model gpt-6-sol   # comparison model
python eval/eval_latency.py                # reads timings stored by real sessions
```

## Dataset: `datasets/errors_it.jsonl`

One JSON object per line. Target: ~100 lines, including ~20% with **no errors** (to measure false positives).

```json
{"id": 1, "learner_text": "...", "level": "A2", "errors": [{"original": "...", "correction": "...", "type": "grammar"}]}
```

- `original` = the smallest span containing the error, exactly as written in `learner_text`.
- Mix error types: articles, gender/number agreement, prepositions, verb tenses (passato prossimo with essere/avere), vocabulary, word order.
- Ideally two people annotate independently and disagreements are discussed.

## Metrics

- **Error detection:** precision, recall and F1. A predicted error matches a gold error if their `original` spans overlap.
- **Card quality:** 2–3 of us score ~50 generated cards (correct / useful / right level, 1–3 each) in `cards_rubric.csv`; then the same rubric is given to an LLM judge and we report agreement.
- **Latency:** mean and p90 of `total` ms per turn, with the asr/llm/tts breakdown.
