"""Speech to text. Owner: voice pipeline."""
import config
from tutor import llm


def speech_to_text(audio_bytes: bytes, filename: str, target_language: str) -> str:
    """Transcribe the learner's audio.

    We pass the target language as a hint. Learners sometimes switch to their own language
    when stuck; if that transcribes badly, try calling without the hint.
    """
    code = config.SUPPORTED_LANGUAGES.get(target_language)
    return llm.transcribe(audio_bytes, filename, language_code=code)
