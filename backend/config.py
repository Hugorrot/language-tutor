"""Central settings. Change models and defaults here, not in the code."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Models. Verify the current names in the OpenAI docs on day 1:
# audio model names change often, and some are scheduled for retirement.
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-6-luna")          # tutor, error extraction, cards
EVAL_COMPARISON_MODEL = os.getenv("EVAL_COMPARISON_MODEL", "gpt-6-sol")  # larger model, eval only
ASR_MODEL = os.getenv("ASR_MODEL", "gpt-4o-mini-transcribe")
TTS_MODEL = os.getenv("TTS_MODEL", "gpt-4o-mini-tts")
TTS_VOICE = os.getenv("TTS_VOICE", "alloy")

# Languages
DEFAULT_TARGET_LANGUAGE = "Italian"
DEFAULT_EXPLANATION_LANGUAGE = "English"
SUPPORTED_LANGUAGES = {
    # display name -> ISO 639-1 code (used as a hint for speech-to-text)
    "Italian": "it",
    "Spanish": "es",
    "French": "fr",
    "English": "en",
    "German": "de",
    "Portuguese": "pt",
}

# Tutor behaviour
MAX_TUTOR_SENTENCES = 3          # short replies = lower latency and cost
MAX_ERRORS_IN_SUMMARY = 5
MAX_PLANNER_TARGETS = 6

# Paths
DB_PATH = BASE_DIR / "data" / "tutor.db"
PROMPTS_DIR = BASE_DIR / "prompts"
FRONTEND_DIR = BASE_DIR.parent / "frontend"
