"""Offline stand-in for the OpenAI API, used when FAKE_LLM=1 (see config.py). Owner: tutor & planner.

It lets anyone run the whole loop (session -> errors -> cards -> review -> progress) and the
evaluation scripts without an API key and without spending money. The answers are canned and
rule-based, so it tests the plumbing (endpoints, database, vector DB, scheduler, frontend),
NOT the quality of the tutor. Only tutor/llm.py imports this module.

How it works:
- Chat calls: the prompt is recognised by a sentence that only that prompt file contains, and a
  matching fake answer is built (valid JSON where JSON is expected).
- Mistakes: a few common Italian learner errors are found with regular expressions, so the
  error extractor, the tutor's recasts and the cards all agree with each other.
- Speech to text: returns sample learner sentences in turn, each with mistakes in it.
- Text to speech: returns no audio (the frontend skips empty audio).
- Embeddings: a deterministic bag of words and character trigrams, so similar texts get similar
  vectors and the concept grouping and memory search still behave sensibly.
"""
import hashlib
import itertools
import json
import math
import re

PREFIX = "[offline] "

# ---------------------------------------------------------------------------------------------
# Rule-based Italian mistakes
# ---------------------------------------------------------------------------------------------

_POSS_ARTICLE = {"mio": "il", "tuo": "il", "suo": "il", "nostro": "il", "vostro": "il",
                 "mia": "la", "tua": "la", "sua": "la", "nostra": "la", "vostra": "la",
                 "miei": "i", "tuoi": "i", "suoi": "i", "nostri": "i", "vostri": "i",
                 "mie": "le", "tue": "le", "sue": "le", "nostre": "le", "vostre": "le"}
_PREP_ARTICLE = {
    ("di", "il"): "del", ("di", "la"): "della", ("di", "i"): "dei", ("di", "le"): "delle",
    ("a", "il"): "al", ("a", "la"): "alla", ("a", "i"): "ai", ("a", "le"): "alle",
    ("da", "il"): "dal", ("da", "la"): "dalla", ("da", "i"): "dai", ("da", "le"): "dalle",
    ("su", "il"): "sul", ("su", "la"): "sulla", ("su", "i"): "sui", ("su", "le"): "sulle",
    ("in", "il"): "nel", ("in", "la"): "nella", ("in", "i"): "nei", ("in", "le"): "nelle",
}
# Singular family nouns take no article after a possessive ("mia madre" is correct).
_FAMILY = {"madre", "padre", "sorella", "fratello", "moglie", "marito", "figlio", "figlia",
           "nonno", "nonna", "zio", "zia", "cugino", "cugina", "mamma", "papà"}
_ESSERE = {"ho": "sono", "hai": "sei", "ha": "è", "abbiamo": "siamo", "avete": "siete", "hanno": "sono"}
_ACCENTS = {"perche": "perché", "perchè": "perché", "citta": "città", "piu": "più",
            "caffe": "caffè", "universita": "università", "puo": "può", "gia": "già"}


def _possessive(m: re.Match) -> dict | None:
    prep, poss, noun = m.group(1), m.group(2), m.group(3)
    art = _POSS_ARTICLE[poss.lower()]
    if art in ("il", "la") and noun.lower() in _FAMILY:
        return None
    joined = _PREP_ARTICLE.get((prep.lower(), art), f"{prep} {art}")
    if joined == f"{prep} {art}":
        correction = f"{prep} {art} {poss} {noun}"
    else:
        correction = f"{joined} {poss} {noun}"
    return {"type": "grammar", "correction": correction,
            "rule": "Possessives take an article in Italian.", "target_word": noun}


def _motion_avere(m: re.Match) -> dict:
    aux, stem = m.group(1), m.group(2)
    essere = _ESSERE[aux.lower()]
    ending = "i" if aux.lower() in ("abbiamo", "avete", "hanno") else "o"
    return {"type": "grammar", "correction": f"{essere} {stem}{ending}",
            "rule": "Verbs of movement take essere in the passato prossimo.", "target_word": essere}


def _age(m: re.Match) -> dict:
    return {"type": "grammar", "correction": f"{m.group(1) or ''}ho {m.group(2)} anni",
            "rule": "Age is said with avere: ho ... anni.", "target_word": "avere"}


def _masc_a(m: re.Match) -> dict:
    art = {"la": "il", "una": "un"}[m.group(1).lower()]
    return {"type": "grammar", "correction": f"{art} {m.group(2)}",
            "rule": f"'{m.group(2)}' is masculine even though it ends in -a.", "target_word": m.group(2)}


def _piace_plural(m: re.Match) -> dict:
    return {"type": "grammar", "correction": f"mi piacciono {m.group(1)}",
            "rule": "Use piacciono when the thing you like is plural.", "target_word": "piacciono"}


def _accent(m: re.Match) -> dict:
    word = m.group(1)
    return {"type": "spelling", "correction": _ACCENTS[word.lower()],
            "rule": "This word is written with an accent.", "target_word": _ACCENTS[word.lower()]}


def _e_accent(m: re.Match) -> dict:
    return {"type": "spelling", "correction": f"{m.group(1)} è",
            "rule": "The verb 'is' is written è, with an accent.", "target_word": "è"}


_RULES = [
    (re.compile(r"\b(con|di|a|da|per|su|in)\s+(" + "|".join(_POSS_ARTICLE) + r")\s+(\w+)", re.I), _possessive),
    (re.compile(r"\b(ho|hai|ha|abbiamo|avete|hanno)\s+(andat|venut|partit|arrivat|uscit|tornat|stat)[oaie]\b", re.I), _motion_avere),
    (re.compile(r"\b(io\s+)?sono\s+(\d+|venti|trenta|diciotto|diciannove|ventuno|ventidue)\s+anni\b", re.I), _age),
    (re.compile(r"\b(la|una)\s+(problema|tema|sistema|programma|cinema|clima)\b", re.I), _masc_a),
    (re.compile(r"\bmi\s+piace\s+((?:i|gli|le)\s+\w+)", re.I), _piace_plural),
    (re.compile(r"\b(" + "|".join(_ACCENTS) + r")\b", re.I), _accent),
    (re.compile(r"\b(lui|lei|questo|questa|non|che)\s+e\b", re.I), _e_accent),
]


def find_mistakes(text: str) -> list[dict]:
    """Mistakes in one learner sentence, in the LearnerError format (schemas.py)."""
    found = []
    for pattern, make in _RULES:
        for m in pattern.finditer(text):
            err = make(m)
            if err:
                found.append({"original": m.group(0), **err})
    return found


def _correct(text: str) -> str:
    for err in find_mistakes(text):
        text = text.replace(err["original"], err["correction"], 1)
    return text


# ---------------------------------------------------------------------------------------------
# Canned conversation
# ---------------------------------------------------------------------------------------------

_LEARNER_SAMPLES = itertools.cycle([
    "Sabato sono andato al cinema con mia amica.",
    "Ieri ho andato al mare con miei amici.",
    "Io sono 22 anni e studio a Roma.",
    "Mi piace i film italiani perche sono divertenti.",
    "La problema è che non ho molto tempo.",
    "Domenica ho mangiato una pizza da mio zio, lei e molto brava a cucinare.",
])
_QUESTIONS = itertools.cycle([
    "E poi cosa hai fatto?",
    "Con chi esci di solito il fine settimana?",
    "Che cosa ti piace fare nel tempo libero?",
    "Com'era il tempo?",
    "Cosa vuoi fare la prossima settimana?",
])


def _tutor(messages: list[dict]) -> str:
    system = messages[0]["content"]
    last = messages[-1]["content"] if messages[-1]["role"] == "user" else ""
    if last.startswith("(The learner has just joined"):
        name = re.search(r"- Name: (.*)", system)
        scenario = re.search(r"- Scenario: (.*)", system)
        return (f"{PREFIX}Ciao {name.group(1).strip() if name else ''}! "
                f"Oggi parliamo di: {scenario.group(1).strip() if scenario else 'quello che vuoi'}. "
                "Cosa hai fatto di bello questa settimana?")
    corrected = _correct(last)
    opener = f"Ah, {corrected[0].lower() + corrected[1:]}" if corrected != last else "Che bello!"
    return f"{PREFIX}{opener} {next(_QUESTIONS)}"


def _errors_json(prompt: str) -> dict:
    transcript = prompt.split("Transcript:", 1)[-1]
    errors, seen = [], set()
    for line in transcript.splitlines():
        if not line.startswith("LEARNER:"):
            continue
        for err in find_mistakes(line[len("LEARNER:"):]):
            key = err["original"].lower()
            if key not in seen:
                seen.add(key)
                errors.append(err)
    return {"errors": errors}


def _cards_json(prompt: str) -> dict:
    cards = []
    for line in prompt.split("Mistakes:", 1)[-1].splitlines():
        m = re.match(r"(\d+)\. (\{.*\})$", line.strip())
        if not m:
            continue
        idx, err = int(m.group(1)), json.loads(m.group(2))
        original, correction = err["original"], err["correction"]
        missing = [w for w in correction.split() if w.lower() not in original.lower().split()]
        if missing:
            front = correction
            for w in missing:
                front = front.replace(w, "___", 1)
            cards.append({"error_index": idx, "kind": "cloze", "front": front,
                          "back": " ".join(missing), "explanation": err["rule"]})
        cards.append({"error_index": idx, "kind": "reverse", "front": f"Correct this: {original}",
                      "back": correction, "explanation": err["rule"]})
    return {"cards": cards}


def _summary(prompt: str) -> str:
    turns = prompt.count("\nLEARNER:") + prompt.startswith("LEARNER:")
    found = _errors_json(prompt)["errors"]
    focus = found[0]["rule"] if found else "keep speaking in full sentences"
    return (f"{PREFIX}You spoke {turns} times and kept the conversation going. "
            f"Next time, focus on this: {focus}")


def _same_mistake(prompt: str) -> dict:
    a = re.search(r"Mistake A: (.*)", prompt)
    b = re.search(r"Mistake B: (.*)", prompt)
    rule = lambda m: (m.group(1).split(" | ")[0] if m else "").strip().lower()
    return {"same": bool(a and b) and rule(a) == rule(b)}


def chat(messages: list[dict], json_mode: bool = False) -> str:
    """Fake chat completion. Returns text, or a JSON string when json_mode is on."""
    system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
    prompt = messages[-1]["content"] if messages else ""

    if "tutor having a spoken conversation" in system:
        return _tutor(messages)
    if "role-playing a language learner" in system:
        return next(_LEARNER_SAMPLES)

    if "Find the learner's real mistakes" in prompt:
        data = _errors_json(prompt)
    elif "You create flashcards" in prompt:
        data = _cards_json(prompt)
    elif "SAME recurring mistake" in prompt:
        data = _same_mistake(prompt)
    elif "Estimate the learner's CEFR level" in prompt:
        data = {"level": "A2", "reason": "Offline mode: fixed answer."}
    elif "reviewing flashcards" in prompt:
        data = {"correct": 3, "useful": 3, "level_ok": 3, "comment": "Offline mode: fixed score."}
    elif "evaluating one session" in prompt:
        data = {"targets": [], "memory_references": []}
    elif "encouraging summary" in prompt:
        return _summary(prompt)
    else:
        data = {}
    return json.dumps(data, ensure_ascii=False) if json_mode else f"{PREFIX}{json.dumps(data)}"


def transcribe() -> str:
    """Fake speech to text: the next sample learner sentence (with mistakes)."""
    return next(_LEARNER_SAMPLES)


# ---------------------------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------------------------

DIM = 256


def _bucket(token: str) -> int:
    return int.from_bytes(hashlib.md5(token.encode("utf-8")).digest()[:4], "little") % DIM


def embed(texts: list[str]) -> list[list[float]]:
    """Deterministic hashed bag of words + character trigrams, L2-normalised."""
    vectors = []
    for text in texts:
        v = [0.0] * DIM
        for word in re.findall(r"\w+", text.lower()):
            v[_bucket("w:" + word)] += 1.0
            padded = f"#{word}#"
            for i in range(len(padded) - 2):
                v[_bucket("c:" + padded[i:i + 3])] += 0.5
        norm = math.sqrt(sum(x * x for x in v)) or 1.0
        vectors.append([x / norm for x in v])
    return vectors
