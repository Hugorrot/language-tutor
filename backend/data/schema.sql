-- SQLite schema. Created automatically on first run by db.init_db().

CREATE TABLE IF NOT EXISTS learners (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT NOT NULL,
    target_language      TEXT NOT NULL DEFAULT 'Italian',
    explanation_language TEXT NOT NULL DEFAULT 'English',
    goal                 TEXT DEFAULT '',
    level                TEXT DEFAULT 'A2',           -- CEFR estimate
    created_at           TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id  INTEGER NOT NULL REFERENCES learners(id),
    scenario    TEXT DEFAULT '',
    targets     TEXT DEFAULT '[]',                     -- JSON list chosen by the planner
    summary     TEXT,
    started_at  TEXT DEFAULT (datetime('now')),
    ended_at    TEXT
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES sessions(id),
    role        TEXT NOT NULL CHECK (role IN ('user', 'tutor')),
    text        TEXT NOT NULL,
    audio_secs  REAL DEFAULT 0,                        -- for "minutes spoken"
    timings     TEXT DEFAULT '{}',                     -- JSON: asr/llm/tts ms, for the latency eval
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS errors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   INTEGER NOT NULL REFERENCES sessions(id),
    learner_id   INTEGER NOT NULL REFERENCES learners(id),
    type         TEXT NOT NULL,
    original     TEXT NOT NULL,
    correction   TEXT NOT NULL,
    rule         TEXT NOT NULL,
    target_word  TEXT,
    fixed        INTEGER DEFAULT 0,                    -- 1 once the learner gets it right later
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    learner_id   INTEGER NOT NULL REFERENCES learners(id),
    error_id     INTEGER REFERENCES errors(id),
    kind         TEXT NOT NULL CHECK (kind IN ('cloze', 'vocab', 'reverse')),
    front        TEXT NOT NULL,
    back         TEXT NOT NULL,
    explanation  TEXT DEFAULT '',
    audio_path   TEXT,                                 -- cached TTS file
    fsrs_state   TEXT NOT NULL,                        -- JSON from fsrs Card.to_dict()
    due          TEXT NOT NULL,                        -- ISO datetime, copied from fsrs_state for fast queries
    deleted      INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id      INTEGER NOT NULL REFERENCES cards(id),
    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
    reviewed_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(learner_id, due);
CREATE INDEX IF NOT EXISTS idx_errors_learner ON errors(learner_id);
