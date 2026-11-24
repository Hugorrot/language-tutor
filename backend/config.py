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
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")   # memory / vector DB

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

# Memory (vector DB, see memory/)
# "vector": concept grouping + retrieved memories in the tutor prompt (the full system)
# "sql":    old behaviour, kept as an evaluation baseline: last-session summary only,
#           weak points grouped by the exact rule text
# "none":   no targets and no memory at all (lower baseline)
MEMORY_MODE = os.getenv("MEMORY_MODE", "vector")
# Two errors belong to the same "concept" (same recurring mistake), decided on the cosine similarity
# of their embeddings:  below LOW -> different;  LOW..HIGH -> doubtful, an LLM decides;  HIGH or more -> same.
# Similarity alone (one threshold, best F1 = 0.83 at 0.50) merged unrelated mistakes that share words
# ("sport games -> sports games" with "capitalize the names of games", 0.53). See eval/eval_concepts.py.
CONCEPT_SIMILARITY_LOW = float(os.getenv("CONCEPT_SIMILARITY_LOW", "0.45"))
CONCEPT_SIMILARITY_HIGH = float(os.getenv("CONCEPT_SIMILARITY_HIGH", "0.65"))
MEMORY_TOP_K = 3                 # past memories added to the tutor prompt
MEMORY_MIN_SIMILARITY = 0.50     # below this a memory is not related enough to show the tutor (tuned with eval_retrieval.py: 0 false memories)
MIN_TURNS_FOR_FIXED = 4          # a session needs this many learner turns before it can mark a mistake as fixed
RETRIEVE_EACH_TURN = True        # also retrieve with the learner's latest message (costs ~1 embedding call per turn)

# Paths
DB_PATH = BASE_DIR / "data" / "tutor.db"
CHROMA_DIR = BASE_DIR / "data" / "chroma"
PROMPTS_DIR = BASE_DIR / "prompts"
FRONTEND_DIR = BASE_DIR.parent / "frontend"
