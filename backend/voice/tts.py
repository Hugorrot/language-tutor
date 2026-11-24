"""Text to speech. Owner: voice pipeline.

TODO (day 5-7): streaming. First version returns the whole MP3 at once. To cut latency,
split the tutor reply into sentences and synthesize/send the first sentence immediately.
"""
import base64
import hashlib

import config
from tutor import llm

CACHE_DIR = config.AUDIO_CACHE_DIR


def text_to_speech(text: str, language: str) -> bytes:
    instructions = f"Speak clear, natural {language} at a slightly slow pace for a language learner."
    return llm.synthesize(text, instructions=instructions)


def text_to_speech_b64(text: str, language: str) -> str:
    return base64.b64encode(text_to_speech(text, language)).decode("ascii")


def cached_tts_b64(text: str, language: str) -> str:
    """Same as text_to_speech_b64 but cached on disk. Use it for flashcards, which are replayed."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{language}|{config.TTS_VOICE}|{text}".encode()).hexdigest()
    path = CACHE_DIR / f"{key}.mp3"
    if not path.exists():
        path.write_bytes(text_to_speech(text, language))
    return base64.b64encode(path.read_bytes()).decode("ascii")
