# API contract

Frontend and backend are built against this file in parallel. Change it only after telling the group.

- Base URL: `http://localhost:8000/api`
- All requests and responses are JSON, except audio uploads (`multipart/form-data`).
- Audio from the backend is returned as base64-encoded MP3 in `audio_b64`.
- For the prototype there is one learner per browser; the frontend stores `learner_id` in `localStorage`.

---

## Learner

### `POST /api/learner`
Create a learner (onboarding).

Request:
```json
{ "name": "Lucía", "target_language": "Italian", "explanation_language": "English", "goal": "Erasmus" }
```
Response:
```json
{ "learner_id": 1 }
```

### `GET /api/learner/{learner_id}`
Response:
```json
{ "learner_id": 1, "name": "Lucía", "target_language": "Italian", "explanation_language": "English",
  "goal": "Erasmus", "level": "A2", "languages": ["Italian", "French"],
  "supported_languages": ["Italian", "Spanish", "French", "English", "German", "Portuguese"] }
```
A learner can practise several languages. `target_language` is the language of their most recent
session (the app opens on it), `level` is their level in that language, `languages` are the ones
they have practised.

### `GET /api/learners`
Every profile on this computer (for switching profile; there are no passwords).
```json
{ "learners": [ { "learner_id": 1, "name": "Matteo", "languages": ["Italian", "English"] } ] }
```

### `PATCH /api/learner/{learner_id}`
Change profile settings (`name`, `goal`, `explanation_language`). Send only what changes.
Returns the learner like `GET`. An empty name is refused (400).
```json
{ "explanation_language": "Italian" }
```
A new explanation language is used for new summaries, rules and cards; older ones are not translated.

---

## Conversation session

### `POST /api/session/start`
Starts a session. The planner picks today's targets (due cards, failed cards, weak points) and the tutor greets.

Request (`target_language` optional: default = the learner's last language; 400 if not supported):
```json
{ "learner_id": 1, "scenario": "ordering at a restaurant", "target_language": "Italian" }
```
Response:
```json
{ "session_id": 12, "tutor_text": "Ciao Lucía! Bentornata...", "audio_b64": "<mp3 base64>",
  "targets": ["amica", "prenotare", "possessives with article"], "target_language": "Italian", "level": "A2" }
```
Everything in the session (errors, cards, memory, targets) belongs to that language.

### `POST /api/session/turn`
One learner turn. `multipart/form-data` with fields:
- `session_id` (int)
- `audio` (file, webm/ogg/mp3/wav) **or** `text` (string, for text mode and testing)

Response:
```json
{ "user_text": "Io sono andato al cinema con mia amica",
  "tutor_text": "Ah, sei andato al cinema con la tua amica! Che film avete visto?",
  "audio_b64": "<mp3 base64>",
  "timings_ms": { "asr": 420, "memory": 150, "llm": 610, "tts": 380, "total": 1560 } }
```
`memory` = time to retrieve related memories from the vector DB for this turn (0 when `MEMORY_MODE` is not `vector`).

### `POST /api/session/end`
Ends the session: extracts errors, updates the learner profile, generates cards.

Request:
```json
{ "session_id": 12 }
```
Response:
```json
{ "summary": "You handled ordering food well...",
  "errors": [ { "type": "grammar", "original": "con mia amica", "correction": "con la mia amica",
                "rule": "Possessives take an article in Italian", "target_word": "amica" } ],
  "cards": [ { "card_id": 40, "kind": "cloze", "front": "Sono andato al cinema con ___ mia amica",
               "back": "la", "explanation": "Possessives take an article" } ] }
```

### `DELETE /api/cards/{card_id}`
The learner removes a generated card they don't want. Response: `{ "ok": true }`

---

## Review tab

### `GET /api/review/due?learner_id=1[&language=Italian]`
Without `language`: due cards of all languages. `due_by_language` always counts all of them.
`mistake` is the learner's wrong words and `you_said` the whole sentence they said in the conversation
(context for the card; null for cards without an error).

Response:
```json
{ "cards": [ { "card_id": 40, "kind": "cloze", "front": "...", "back": "...", "explanation": "...",
               "language": "Italian", "mistake": "con mia amica",
               "you_said": "Sabato sono andato al cinema con mia amica" } ],
  "due_count": 1, "due_by_language": { "Italian": 1 } }
```

### `GET /api/cards/{card_id}/audio`
Audio of the card's target-language sentence, generated once and cached. Fetch it when the card is shown.

Response:
```json
{ "audio_b64": "<mp3 base64>" }
```

### `POST /api/review/answer`
Request (`rating`: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy):
```json
{ "card_id": 40, "rating": 3 }
```
Response:
```json
{ "next_due": "2026-11-19T10:00:00+00:00" }
```

---

## Progress tab

### `GET /api/progress?learner_id=1[&language=Italian]`
Stats for one language (default: the learner's last language).

Response:
```json
{ "language": "Italian", "languages": ["Italian", "French"],
  "sessions": 4, "minutes_spoken": 38, "level": "A2",
  "cards_total": 52, "cards_due": 6, "review_accuracy": 0.78,
  "top_errors": [ { "rule": "Possessives take an article", "count": 5, "sessions": 4, "fixed": false } ] }
```
Each entry is one recurring mistake ("concept"): reworded versions of the same mistake are grouped by
the vector DB. `rule` is the latest wording, `count` how many times it was found, `sessions` in how many sessions,
`concept_id` identifies it (null with `MEMORY_MODE=sql`).

### `GET /api/mistakes/{concept_id}?learner_id=1`
Every time the learner made that mistake, newest first, with the full sentence they said.
```json
{ "concept_id": 3, "count": 2, "occurrences": [
  { "original": "con mia amica", "correction": "con la mia amica", "rule": "Possessives take an article",
    "you_said": "Sabato sono andato al cinema con mia amica", "date": "2026-11-23 14:15:25" } ] }
```

---

## Memory

### `GET /api/memory/search?learner_id=1&q=amica[&language=Italian]`
How often the learner said something: an exact count (text search) plus the most similar things
they said (vector DB).

Response:
```json
{ "query": "amica", "exact_count": 3,
  "similar": [ { "text": "Sono andata al cinema con mia amica Giulia", "similarity": 0.71, "session_id": 1 } ] }
```
