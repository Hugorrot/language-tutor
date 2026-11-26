"""The vector database (Chroma). Owner: memory.

SQLite stays the source of truth. Chroma only keeps an embedding for some rows, so we can ask
"what is *similar* to this?" instead of "what is *equal* to this?".

Two collections, both filtered by learner_id:
- "errors":   one entry per row of the errors table (id = error id)
- "memories": what the learner said (kind "utterance", id "u<message id>")
              and session summaries (kind "summary", id "s<session id>")
"""
from pathlib import Path

import chromadb
from chromadb.config import Settings

import config

_client = None
_path: Path | None = None


def use_path(path: Path | str) -> None:
    """Point the store at another folder (the evaluation uses a temporary one)."""
    global _client, _path
    _client, _path = None, Path(path)


def collection(name: str):
    global _client
    if _client is None:
        path = _path or config.CHROMA_DIR
        path.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(path), settings=Settings(anonymized_telemetry=False))
    # embedding_function=None: we always pass our own vectors (computed by tutor/llm.py).
    return _client.get_or_create_collection(
        name, configuration={"hnsw": {"space": "cosine"}}, embedding_function=None)


def add(name: str, ids: list[str], embeddings: list[list[float]], documents: list[str],
        metadatas: list[dict]) -> None:
    if ids:
        collection(name).upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def search(name: str, embedding: list[float], where: dict, k: int) -> list[dict]:
    """Nearest neighbours, most similar first. similarity = cosine similarity (1 = identical)."""
    res = collection(name).query(query_embeddings=[embedding], n_results=k, where=where)
    return [
        {"id": i, "text": doc, "similarity": 1.0 - dist, **meta}
        for i, doc, dist, meta in zip(res["ids"][0], res["documents"][0], res["distances"][0], res["metadatas"][0])
    ]


def update_metadata(name: str, ids: list[str], metadatas: list[dict]) -> None:
    if ids:
        collection(name).update(ids=ids, metadatas=metadatas)
