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
  "goal": "Erasmus", "level": "A2" }
```

---

## Conversation session

### `POST /api/session/start`
Starts a session. The planner picks today's targets (due cards, failed cards, weak points) and the tutor greets.

Request:
```json
{ "learner_id": 1, "scenario": "ordering at a restaurant" }
```
Response:
```json
{ "session_id": 12, "tutor_text": "Ciao Lucía! Bentornata...", "audio_b64": "<mp3 base64>",
  "targets": ["amica", "prenotare", "possessives with article"] }
```

### `POST /api/session/turn`
One learner turn. `multipart/form-data` with fields:
- `session_id` (int)
- `audio` (file, webm/ogg/mp3/wav) **or** `text` (string, for text mode and testing)

Response:
```json
{ "user_text": "Io sono andato al cinema con mia amica",
  "tutor_text": "Ah, sei andato al cinema con la tua amica! Che film avete visto?",
  "audio_b64": "<mp3 base64>",
  "timings_ms": { "asr": 420, "llm": 610, "tts": 380, "total": 1410 } }
```

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

### `GET /api/review/due?learner_id=1`
Response:
```json
{ "cards": [ { "card_id": 40, "kind": "cloze", "front": "...", "back": "...", "explanation": "..." } ],
  "due_count": 1 }
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

### `GET /api/progress?learner_id=1`
Response:
```json
{ "sessions": 4, "minutes_spoken": 38, "level": "A2",
  "cards_total": 52, "cards_due": 6, "review_accuracy": 0.78,
  "top_errors": [ { "rule": "Possessives take an article", "count": 5, "fixed": false } ] }
```
