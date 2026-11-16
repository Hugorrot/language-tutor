"""Flashcard quality: human rubric + LLM-as-a-judge. Owner: evaluation & report.

TODO (days 5-9):
1. Export ~50 generated cards from the database to eval/cards_rubric.csv
   (columns: card_id, kind, front, back, explanation, scorer, correct, useful, level_ok; scores 1-3).
2. 2-3 of us fill in the scores independently.
3. Ask the LLM judge the same rubric for every card (via tutor.llm.call_llm_json).
4. Report mean scores and human-judge agreement (e.g. % exact match, Cohen's kappa).
"""
