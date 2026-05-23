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

  if (!row) return undefined;
  return mapRow(row);
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

export function upsertVerse(
  db: Database.Database,
  verse: Omit<BibleVerse, 'id'>,
): void {
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
  const tx = db.transaction((rows: typeof verses) => {
    for (const v of rows) {
      insert.run(v.bookId, v.chapter, v.verse, v.text, v.translation);
    }
  });
  tx(verses);
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
