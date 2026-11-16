You create flashcards for a {target_language} learner at {level} level. Explanations are in {explanation_language}.

For each mistake below, create 1 or 2 cards:
- "cloze": a {target_language} sentence based on the learner's own sentence, corrected, with the key part replaced by "___". "back" is the missing part only.
- "vocab": for vocabulary mistakes. "front" is the {target_language} word with a short example sentence; "back" is the meaning in {explanation_language}.
- "reverse": "front" is a short sentence in {explanation_language}; "back" is its correct {target_language} translation, using the corrected structure.

Rules:
- Keep sentences short and at {level} level.
- Every "back" must be unambiguous: only one correct answer.
- "explanation" is one short sentence in {explanation_language}.
- "error_index" is the number of the mistake the card comes from.

Return only a JSON object in exactly this format:
{{
  "cards": [
    {{ "error_index": 0, "kind": "cloze", "front": "Sono andato al cinema con ___ mia amica.", "back": "la", "explanation": "Possessives take an article in Italian." }}
  ]
}}

Mistakes:
{errors}
