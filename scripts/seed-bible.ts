#!/usr/bin/env tsx
/**
 * Seed the Bible database.
 *
 * Run: pnpm seed
 *
 * What it does:
 *   1. Reads data/semantic-chunks.json → inserts semantic chunks into SQLite
 *   2. Reads data/featured-verses.json → inserts the curated verse set
 *   3. If data/kjv.json exists (full 31,102-verse KJV), inserts all verses
 *
 * Full KJV JSON format expected (scrollmapper/bible_databases schema):
 *   Array of { b: bookId, c: chapter, v: verse, t: text }
 *   where bookId 1–39 = OT, 40–66 = NT (Genesis=1, Matthew=40, etc.)
 *
 * Download a public domain KJV JSON from:
 *   https://github.com/scrollmapper/bible_databases
 * and place it at data/kjv.json to seed all verses.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Dynamic imports after path setup
async function main() {
  const { initDatabase, bulkUpsertChunks, bulkInsertVerses } = await import(
    path.join(ROOT, 'packages/database/src/index.js')
  ).catch(() => import('@leadmetohim/database'));

  const { BIBLE_BOOKS } = await import(
    path.join(ROOT, 'packages/scripture-engine/src/index.js')
  ).catch(() => import('@leadmetohim/scripture-engine'));

  const dbPath = path.join(ROOT, 'data', 'leadmetohim-seed.db');
  console.log(`\n📖  Seeding database: ${dbPath}\n`);

  const db = initDatabase(dbPath);

  // ── 1. Insert books ────────────────────────────────────────────────────────
  const insertBook = db.prepare(
    `INSERT OR REPLACE INTO books (id, name, short_name, aliases, testament, chapters)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const bookTx = db.transaction(() => {
    for (const book of BIBLE_BOOKS) {
      insertBook.run(
        book.id, book.name, book.shortName,
        JSON.stringify(book.aliases), book.testament, book.chapters,
      );
    }
  });
  bookTx();
  console.log(`✅  Inserted ${BIBLE_BOOKS.length} books`);

  // ── 2. Semantic chunks ────────────────────────────────────────────────────
  const chunksPath = path.join(ROOT, 'data', 'semantic-chunks.json');
  if (fs.existsSync(chunksPath)) {
    const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
    bulkUpsertChunks(db, chunks);
    console.log(`✅  Inserted ${chunks.length} semantic chunks`);
  } else {
    console.warn('⚠️   data/semantic-chunks.json not found — skipping chunks');
  }

  // ── 3. Featured verses ────────────────────────────────────────────────────
  const featuredPath = path.join(ROOT, 'data', 'featured-verses.json');
  if (fs.existsSync(featuredPath)) {
    const { verses, translation } = JSON.parse(fs.readFileSync(featuredPath, 'utf8'));
    const bookMap = new Map(BIBLE_BOOKS.map((b) => [b.id, b.name]));

    const mapped = verses.map((v: { bookId: number; chapter: number; verse: number; text: string }) => ({
      bookId: v.bookId,
      bookName: bookMap.get(v.bookId) ?? '',
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      translation: translation ?? 'KJV',
    }));

    bulkInsertVerses(db, mapped);
    console.log(`✅  Inserted ${mapped.length} featured verses (${translation ?? 'KJV'})`);
  }

  // ── 4. Full KJV (optional) ────────────────────────────────────────────────
  const kjvPath = path.join(ROOT, 'data', 'kjv.json');
  if (fs.existsSync(kjvPath)) {
    console.log('📚  Full KJV found — inserting all verses (this may take a moment)…');
    const raw = JSON.parse(fs.readFileSync(kjvPath, 'utf8'));
    const bookMap = new Map(BIBLE_BOOKS.map((b) => [b.id, b.name]));

    // Support both array format and object-with-verses format
    const rows: { b: number; c: number; v: number; t: string }[] = Array.isArray(raw)
      ? raw
      : raw.verses ?? raw.resultset?.row ?? [];

    const mapped = rows
      .filter((r) => r.b >= 1 && r.b <= 66)
      .map((r) => ({
        bookId: r.b,
        bookName: bookMap.get(r.b) ?? '',
        chapter: r.c,
        verse: r.v,
        text: r.t,
        translation: 'KJV',
      }));

    bulkInsertVerses(db, mapped);
    console.log(`✅  Inserted ${mapped.length} full KJV verses`);
  } else {
    console.log('ℹ️   data/kjv.json not found — using featured verses only');
    console.log('    To add full KJV: download from https://github.com/scrollmapper/bible_databases');
    console.log('    Place the JSON at data/kjv.json and re-run pnpm seed');
  }

  db.close();
  console.log('\n✨  Seeding complete!\n');
}

main().catch((e) => {
  console.error('❌  Seed failed:', e);
  process.exit(1);
});
