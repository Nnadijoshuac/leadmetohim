export const SCHEMA_VERSION = 4;

export const CREATE_TABLES = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -32000;

-- ── Books ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  short_name  TEXT    NOT NULL,
  aliases     TEXT    NOT NULL DEFAULT '[]',
  testament   TEXT    NOT NULL CHECK(testament IN ('OT','NT')),
  chapters    INTEGER NOT NULL
);

-- ── Translations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translations (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  source   TEXT NOT NULL DEFAULT 'bundled',
  license  TEXT
);

-- ── Verses ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  chapter     INTEGER NOT NULL,
  verse       INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  translation TEXT    NOT NULL DEFAULT 'KJV',
  UNIQUE(book_id, chapter, verse, translation)
);

CREATE INDEX IF NOT EXISTS idx_verses_lookup
  ON verses(book_id, chapter, verse, translation);

-- ── Full-text search (FTS5) over all translations ────────────────────────────
-- content=verses means FTS5 stores only the index; joins back to verses for text
CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
  text,
  content=verses,
  content_rowid=id
);

-- Keep FTS5 in sync with verses
CREATE TRIGGER IF NOT EXISTS verses_ai AFTER INSERT ON verses BEGIN
  INSERT INTO verses_fts(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER IF NOT EXISTS verses_ad AFTER DELETE ON verses BEGIN
  INSERT INTO verses_fts(verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
END;

CREATE TRIGGER IF NOT EXISTS verses_au AFTER UPDATE ON verses BEGIN
  INSERT INTO verses_fts(verses_fts, rowid, text) VALUES ('delete', old.id, old.text);
  INSERT INTO verses_fts(rowid, text) VALUES (new.id, new.text);
END;

-- ── Semantic chunks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semantic_chunks (
  id              TEXT    PRIMARY KEY,
  description     TEXT    NOT NULL,
  book_id         INTEGER REFERENCES books(id),
  chapter_start   INTEGER NOT NULL,
  verse_start     INTEGER,
  chapter_end     INTEGER,
  verse_end       INTEGER,
  book_name       TEXT    NOT NULL,
  display_ref     TEXT    NOT NULL,
  tags            TEXT    NOT NULL DEFAULT '[]',
  testament       TEXT    NOT NULL CHECK(testament IN ('OT','NT'))
);

-- ── Embeddings ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embeddings (
  chunk_id    TEXT    PRIMARY KEY REFERENCES semantic_chunks(id) ON DELETE CASCADE,
  model       TEXT    NOT NULL,
  vector      BLOB    NOT NULL,
  dimensions  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT    PRIMARY KEY,
  value       TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ── History ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  query       TEXT    NOT NULL,
  query_type  TEXT    NOT NULL,
  result_ref  TEXT,
  inserted    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_history_date
  ON search_history(created_at DESC);

-- ── Schema version ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
