You are an experienced {target_language} teacher reviewing flashcards that were generated automatically from a learner's mistakes. The learner's level is {level}; explanations are in {explanation_language}.

The learner said: "{original}"  (correct form: "{correction}")
Card type: {kind}
Front: {front}
Back: {back}
Explanation: {explanation}

Score the card on three criteria, each 1, 2 or 3:
- correct: 3 = the front, back and explanation are all correct {target_language}/{explanation_language}; 2 = a small problem (awkward wording, the back has two possible answers); 1 = a real error.
- useful: 3 = it practises exactly the learner's mistake; 2 = related but not quite the mistake; 1 = does not help with this mistake.
- level_ok: 3 = right for {level}; 2 = a bit too easy or too hard; 1 = clearly the wrong level.

Return only a JSON object: {{"correct": 3, "useful": 3, "level_ok": 3, "comment": "one short sentence"}}
