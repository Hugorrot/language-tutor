# Voice Language Tutor (AI Frontiers group project)

A voice-based language tutor that remembers each learner's mistakes, turns them into flashcards
reviewed inside the app, and reuses them in the next conversation.

- **Backend:** Python + FastAPI (`backend/`)
- **Frontend:** HTML + JavaScript + CSS with React visual components, built with Vite (`frontend/`)
- **AI:** one OpenAI API key (GPT Luna for text, OpenAI speech-to-text, TTS and embeddings)
- **Memory:** SQLite for all data + a local vector DB (Chroma, `backend/data/chroma/`) so the tutor can
  find *similar* past mistakes and conversations, not only identical ones
- **Primary target language:** Italian (others work through settings)

The full project plan lives in the shared doc "AI Frontiers – Voice Language Tutor: Project Overview".

## Setup (once)

```bash
git clone <repo-url>
cd language-tutor/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then paste the shared OpenAI key into .env
```

**Never commit `.env`.** It is already in `.gitignore`.

From the repository root, `python -m pip install -r requirements.txt` installs the same
Python dependencies through `backend/requirements.txt`. React dependencies are installed
separately using the committed npm lockfile, as shown below.

## Run

Build the frontend once before starting FastAPI (requires Node.js 22+):

```bash
cd frontend
npm ci
npm run build
cd ..
```

The build writes `frontend/generated/app.js` and `app.css`, which the existing FastAPI static mount serves. Rebuild after frontend changes when using port 8000. Generated files and `doc/` are git-ignored.


```bash
cd backend
uvicorn api:app --reload
```

Then open <http://localhost:8000> in the browser. The backend also serves the frontend.

Interactive API docs (try every endpoint by hand): <http://localhost:8000/docs>

### Frontend development and design preview

```bash
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite provides hot reload and proxies `/api` to FastAPI on port 8000.

For an explicitly labeled preview using sample data, open <http://localhost:5173/?preview=1>.
Preview onboarding uses session storage, separately from the real learner profile. Sample responses
have no real tutor audio or persistence; the complete voice loop requires the backend and its API key.
On a phone, the preview can be opened through the dev server's network URL. Real microphone input
on a phone requires HTTPS (localhost is the browser's local development exception).

React Bits visual components live in `frontend/src/components/`; provenance and integration notes are in its README.
`src/main.jsx` mounts the subdued cursor, SplitText headings, CurvedLoop, and staged page reveals.
`src/Navigation.jsx` provides the bottom Dock, which shrinks when idle and expands on hover, keyboard focus, or touch. `src/enhancements.jsx` applies Magnet,
SpotlightCard, CountUp, and one StarBorder primary action per view. `src/orbBridge.jsx` connects the Orb
to conversation state and audio levels. Cursor effects are limited to fine pointers with no reduced-motion preference.
The original API contract remains unchanged; database implementation belongs to the backend team.

VoicePill, WakeSlider, SquishSwitch, StatusMark, SwipeRow, and SwipeToast provide the functional
voice, preference, status, and feedback controls. Audio preferences are available under
"Make yourself comfortable" during an active conversation. Language and topic choices live
under "Settings" before a session. Run `npm test` from `frontend/`
for the microphone resource-cleanup and playback-rate tests.


## Who owns what

| Role | Folders |
| --- | --- |
| Voice pipeline | `backend/voice/`, `frontend/js/audio.js` |
| Tutor & planner | `backend/tutor/`, `backend/prompts/tutor_system.md` |
| Errors & cards | `backend/analysis/`, `backend/cards/generator.py`, error + card prompts |
| Memory (vector DB) | `backend/memory/` |
| Frontend, review & integration | `frontend/`, `backend/api.py`, `backend/cards/scheduler.py`, `backend/data/` |
| Evaluation & report | `eval/`, `report/` |

## Memory (vector DB)

`backend/memory/` adds long-term memory on top of SQLite:

- **Concepts** (`concepts.py`): every new mistake is compared with the learner's past mistakes. If it is
  similar enough (`CONCEPT_SIMILARITY_LOW`/`_HIGH` in `config.py`; in between an LLM decides) it joins the same concept, so "Possessives take an
  article" and "Use the article before possessive adjectives" count as one recurring mistake. Used by the
  Progress tab, the planner, card de-duplication and "fixed" detection.
- **Retrieval** (`retrieval.py`): what the learner said and the session summaries are embedded at the end
  of each session. The tutor gets the most related memories at session start (by scenario) and at each
  turn (by the learner's latest message).
- **Search** (`GET /api/memory/search`, Progress tab): "how many times did I say X?"

`MEMORY_MODE` (`vector`, `sql` or `none`) switches memory off for the evaluation baselines. If you delete
`backend/data/tutor.db`, also delete `backend/data/chroma/` so the two stay in sync.

## Offline mode (no API key, no cost)

Set `FAKE_LLM=1` in `backend/.env` (or in the shell) and start the backend as usual. Every call in
`backend/tutor/llm.py` then goes to `backend/tutor/fake_llm.py` instead of OpenAI:

- **Tutor and summary:** canned Italian replies marked `[offline]`; the tutor recasts the learner's mistakes.
- **Errors and cards:** a few common Italian mistakes (missing article with possessives, *avere* instead of
  *essere*, *sono 22 anni*, *mi piace* + plural, *la problema*, missing accents) are found with regular
  expressions, and cloze/reverse cards are built from them.
- **Speech to text:** returns sample learner sentences with mistakes, one per turn. **Text to speech:** no audio.
- **Embeddings:** deterministic bag of words, so concept grouping and memory search still work.

It tests the plumbing (endpoints, database, vector DB, FSRS, frontend), not the quality of the tutor.
Offline data goes to `backend/data/fake/`, separate from the real `tutor.db` and `chroma/`; delete that
folder to start over. Other target languages work, but no mistakes are found in them.

## Team rules

1. The contracts are `API.md` (endpoints) and `backend/schemas.py` (error and card format).
   Change them only after telling the group.
2. All OpenAI calls go through `backend/tutor/llm.py`. No other file imports `openai`.
3. Work on a branch, open a pull request, merge to `main` every evening.
4. Feature freeze on day 8.

### Selection and visual controls

GlideSelect provides the language and topic options, including onboarding and language
filters. Scanner provides the subtle teal/sage/peach background. The Dock uses larger,
always-readable labels inside its tiles, and VoicePill reserves its full capsule width so
its expansion stays centered. Builds version their generated script and stylesheet links
by content hash to avoid stale browser assets.
