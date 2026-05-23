import type Database from 'better-sqlite3';
import type { BibleVerse } from '@leadmetohim/shared-types';

interface VerseRow {
  id: number;
  book_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}

// ── Single-verse lookups ──────────────────────────────────────────────────────

export function getVerse(
  db: Database.Database,
  bookId: number,
  chapter: number,
  verse: number,
  translation = 'KJV',
): BibleVerse | undefined {
  const row = db
    .prepare<[number, number, number, string], VerseRow>(
      `SELECT v.*, b.name as book_name
       FROM verses v
       JOIN books b ON b.id = v.book_id
       WHERE v.book_id = ? AND v.chapter = ? AND v.verse = ? AND v.translation = ?`,
    )
    .get(bookId, chapter, verse, translation);
  return row ? mapRow(row) : undefined;
}

export function getVerseRange(
  db: Database.Database,
  bookId: number,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  translation = 'KJV',
): BibleVerse[] {
  return db
    .prepare<[number, number, number, number, string], VerseRow>(
      `SELECT v.*, b.name as book_name
       FROM verses v
       JOIN books b ON b.id = v.book_id
       WHERE v.book_id = ? AND v.chapter = ? AND v.verse BETWEEN ? AND ?
         AND v.translation = ?
       ORDER BY v.verse`,
    )
    .all(bookId, chapter, verseStart, verseEnd, translation)
    .map(mapRow);
}

export function getChapter(
  db: Database.Database,
  bookId: number,
  chapter: number,
  translation = 'KJV',
): BibleVerse[] {
  return db
    .prepare<[number, number, string], VerseRow>(
      `SELECT v.*, b.name as book_name
       FROM verses v
       JOIN books b ON b.id = v.book_id
       WHERE v.book_id = ? AND v.chapter = ? AND v.translation = ?
       ORDER BY v.verse`,
    )
    .all(bookId, chapter, translation)
    .map(mapRow);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export function upsertVerse(db: Database.Database, verse: Omit<BibleVerse, 'id'>): void {
  db.prepare(
    `INSERT OR REPLACE INTO verses (book_id, chapter, verse, text, translation)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(verse.bookId, verse.chapter, verse.verse, verse.text, verse.translation);
}

export function bulkInsertVerses(
  db: Database.Database,
  verses: Omit<BibleVerse, 'id'>[],
): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO verses (book_id, chapter, verse, text, translation)
     VALUES (?, ?, ?, ?, ?)`,
  );
  db.transaction((rows: typeof verses) => {
    for (const v of rows) {
      insert.run(v.bookId, v.chapter, v.verse, v.text, v.translation);
    }
  })(verses);
}

// ── Full-text search across ALL translations ──────────────────────────────────

export interface VerseMatch {
  verse: BibleVerse;
  /** BM25 score — more negative = stronger match */
  score: number;
}

/**
 * Search verse text across every loaded translation using FTS5 BM25.
 * Ideal for detecting scripture quoted in speech (any translation, any phrasing).
 */
export function searchVersesFTS5(
  db: Database.Database,
  speechText: string,
  opts: { translation?: string; limit?: number } = {},
): VerseMatch[] {
  const limit = opts.limit ?? 8;
  const words = extractContentWords(speechText);
  if (words.length < 2) return []; // too few meaningful words to match

  // FTS5 OR query — highest BM25 match scores first
  const ftsQuery = words.join(' OR ');

  type Row = VerseRow & { score: number };
  let rows: Row[];

  if (opts.translation) {
    rows = db
      .prepare<[string, string, number], Row>(
        `SELECT v.id, v.book_id, v.chapter, v.verse, v.text, v.translation,
                b.name as book_name, verses_fts.rank as score
         FROM verses_fts
         JOIN verses v ON v.id = verses_fts.rowid
         JOIN books b ON b.id = v.book_id
         WHERE verses_fts MATCH ? AND v.translation = ?
         ORDER BY verses_fts.rank
         LIMIT ?`,
      )
      .all(ftsQuery, opts.translation, limit);
  } else {
    rows = db
      .prepare<[string, number], Row>(
        `SELECT v.id, v.book_id, v.chapter, v.verse, v.text, v.translation,
                b.name as book_name, verses_fts.rank as score
         FROM verses_fts
         JOIN verses v ON v.id = verses_fts.rowid
         JOIN books b ON b.id = v.book_id
         WHERE verses_fts MATCH ?
         ORDER BY verses_fts.rank
         LIMIT ?`,
      )
      .all(ftsQuery, limit);
  }

  return rows.map((r) => ({ verse: mapRow(r), score: r.score }));
}

/** Rebuild FTS5 index from scratch (useful after a bulk import). */
export function rebuildFTS5(db: Database.Database): void {
  db.exec(`INSERT INTO verses_fts(verses_fts) VALUES ('rebuild')`);
}

// ── Translation registry ──────────────────────────────────────────────────────

export interface Translation {
  id: string;
  name: string;
  language: string;
  source: string;
  license?: string | null;
}

export function getTranslations(db: Database.Database): Translation[] {
  return db
    .prepare<[], Translation>('SELECT * FROM translations ORDER BY language, name')
    .all();
}

export function upsertTranslation(db: Database.Database, t: Translation): void {
  db.prepare(
    `INSERT OR REPLACE INTO translations(id, name, language, source, license)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(t.id, t.name, t.language, t.source, t.license ?? null);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'shall', 'can', 'that', 'this', 'these', 'those', 'it', 'its',
  'he', 'she', 'they', 'we', 'you', 'i', 'my', 'your', 'his', 'her', 'their',
  'our', 'not', 'no', 'so', 'if', 'then', 'than', 'when', 'who', 'what', 'him',
  'them', 'me', 'us', 'into', 'upon', 'unto', 'also', 'like', 'up', 'down',
  'out', 'there', 'here', 'shall', 'thee', 'thou', 'thy', 'thine', 'ye',
]);

function extractContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function mapRow(row: VerseRow): BibleVerse {
  return {
    id: row.id,
    bookId: row.book_id,
    bookName: row.book_name,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    translation: row.translation,
  };
}
