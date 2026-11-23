"""Shared data formats. This file is a contract: every module depends on it.
Change it only after telling the group."""
from typing import Literal, Optional

from pydantic import BaseModel

ErrorType = Literal["grammar", "vocabulary", "spelling", "word_order", "other"]
CardKind = Literal["cloze", "vocab", "reverse"]


class LearnerError(BaseModel):
    """One mistake found in a session transcript."""
    type: ErrorType
    original: str            # what the learner said, e.g. "con mia amica"
    correction: str          # e.g. "con la mia amica"
    rule: str                # short rule in the explanation language
    target_word: Optional[str] = None


class CardDraft(BaseModel):
    """A flashcard before it is saved to the database."""
    kind: CardKind
    front: str
    back: str
    explanation: str = ""
    error_id: Optional[int] = None


# ---- API request bodies (see API.md) ----

class LearnerCreate(BaseModel):
    name: str
    target_language: str = "Italian"
    explanation_language: str = "English"
    goal: str = ""


class SessionStart(BaseModel):
    learner_id: int
    scenario: str = "free conversation"
    target_language: Optional[str] = None   # None = the language of the learner's last session


class SessionEnd(BaseModel):
    session_id: int


class ReviewAnswer(BaseModel):
    card_id: int
    rating: Literal[1, 2, 3, 4]   # 1 Again, 2 Hard, 3 Good, 4 Easy
