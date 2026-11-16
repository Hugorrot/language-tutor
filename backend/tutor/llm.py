"""The ONLY file that calls the OpenAI API.

Everything else imports these functions, so changing a model or provider is a one-line
change in config.py, and all API usage can be logged in one place.
"""
import json
import time
from pathlib import Path

from openai import OpenAI

import config

_client: OpenAI | None = None


def client() -> OpenAI:
    global _client
    if _client is None:
        if not config.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is missing. Copy backend/.env.example to backend/.env and add the key.")
        _client = OpenAI(api_key=config.OPENAI_API_KEY)
    return _client


def load_prompt(name: str, **variables) -> str:
    """Read prompts/<name>.md and fill {placeholders}. Use {{ and }} for literal braces."""
    text = (config.PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
    return text.format(**variables)


def call_llm(messages: list[dict], model: str | None = None, json_mode: bool = False) -> str:
    """Chat completion. `messages` = [{"role": "system"|"user"|"assistant", "content": "..."}]."""
    kwargs = {"model": model or config.LLM_MODEL, "messages": messages}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client().chat.completions.create(**kwargs)
    return resp.choices[0].message.content or ""


def call_llm_json(messages: list[dict], model: str | None = None) -> dict:
    """Chat completion that must return a JSON object. Retries once if the JSON is invalid."""
    for attempt in range(2):
        raw = call_llm(messages, model=model, json_mode=True)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            if attempt == 1:
                raise
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": "That was not valid JSON. Return only the JSON object."},
            ]
    return {}


def transcribe(audio_bytes: bytes, filename: str, language_code: str | None = None) -> str:
    """Speech to text."""
    kwargs = {"model": config.ASR_MODEL, "file": (filename, audio_bytes)}
    if language_code:
        kwargs["language"] = language_code
    resp = client().audio.transcriptions.create(**kwargs)
    return resp.text.strip()


def synthesize(text: str, instructions: str | None = None) -> bytes:
    """Text to speech. Returns MP3 bytes."""
    kwargs = {"model": config.TTS_MODEL, "voice": config.TTS_VOICE, "input": text, "response_format": "mp3"}
    if instructions:
        kwargs["instructions"] = instructions   # supported by the gpt-4o-mini-tts family
    resp = client().audio.speech.create(**kwargs)
    return resp.content


class Timer:
    """with Timer() as t: ...  then t.ms"""
    def __enter__(self):
        self._start = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.ms = int((time.perf_counter() - self._start) * 1000)
