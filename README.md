# Voice Language Tutor (AI Frontiers group project)

A voice-based language tutor that remembers each learner's mistakes, turns them into flashcards
reviewed inside the app, and reuses them in the next conversation.

- **Backend:** Python + FastAPI (`backend/`)
- **Frontend:** plain HTML + JavaScript + CSS (`frontend/`), no build step
- **AI:** one OpenAI API key (GPT Luna for text, OpenAI speech-to-text and TTS)
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

## Run

```bash
cd backend
uvicorn api:app --reload
```

Then open <http://localhost:8000> in the browser. The backend also serves the frontend.

Interactive API docs (try every endpoint by hand): <http://localhost:8000/docs>

### Frontend without the backend

In `frontend/js/api.js` set `USE_MOCK = true`. The UI then works with fake responses,
so frontend work never waits on the backend. Open `frontend/index.html` with any static
server (for example the VS Code "Live Server" extension).

## Who owns what

| Role | Folders |
| --- | --- |
| Voice pipeline | `backend/voice/`, `frontend/js/audio.js` |
| Tutor & planner | `backend/tutor/`, `backend/prompts/tutor_system.md` |
| Errors & cards | `backend/analysis/`, `backend/cards/generator.py`, error + card prompts |
| Frontend, review & integration | `frontend/`, `backend/api.py`, `backend/cards/scheduler.py`, `backend/data/` |
| Evaluation & report | `eval/`, `report/` |

## Team rules

1. The contracts are `API.md` (endpoints) and `backend/schemas.py` (error and card format).
   Change them only after telling the group.
2. All OpenAI calls go through `backend/tutor/llm.py`. No other file imports `openai`.
3. Work on a branch, open a pull request, merge to `main` every evening.
4. Feature freeze on day 8.
