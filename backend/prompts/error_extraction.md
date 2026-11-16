You are an expert {target_language} teacher. Below is a transcript of a conversation between a tutor and a learner at {level} level.

Find the learner's real mistakes in {target_language}. Only look at LEARNER lines.

Rules:
- Only report clear errors: grammar, vocabulary (wrong or non-existent word), word order, or spelling. Do not report stylistic preferences or things that are correct but unusual.
- If the learner switched to another language because they did not know a word, report it as type "vocabulary" with the {target_language} word as the correction.
- Merge repeated instances of the same mistake into one entry.
- "original" must be the exact words the learner said (the smallest span that contains the error).
- "rule" is one short sentence in {explanation_language}.
- "target_word" is the key {target_language} word to practise, or null.
- If there are no errors, return an empty list.

Return only a JSON object in exactly this format:
{{
  "errors": [
    {{
      "type": "grammar | vocabulary | spelling | word_order | other",
      "original": "con mia amica",
      "correction": "con la mia amica",
      "rule": "Possessives take an article in Italian",
      "target_word": "amica"
    }}
  ]
}}

Transcript:
{transcript}
