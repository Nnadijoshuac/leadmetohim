import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES, SCHEMA_VERSION } from './schema.js';

let _db: Database.Database | null = null;

export function initDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath);
  db.exec(CREATE_TABLES);

  const row = db
    .prepare<[string], { value: string }>('SELECT value FROM schema_meta WHERE key = ?')
    .get('version');

  const current = row ? parseInt(row.value, 10) : 0;

  if (current < SCHEMA_VERSION) {
    runMigrations(db, current);
    db.prepare('INSERT OR REPLACE INTO schema_meta(key, value) VALUES (?, ?)').run(
      'version',
      String(SCHEMA_VERSION),
    );
  }

  _db = db;
  return db;
}

export function getDb(): Database.Database {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

export function closeDatabase(): void {
  _db?.close();
  _db = null;
}

function runMigrations(db: Database.Database, from: number): void {
  if (from < 1) {
    // v1 → baseline
  }
  if (from < 2) {
    try {
      db.exec(`ALTER TABLE semantic_chunks ADD COLUMN display_ref TEXT NOT NULL DEFAULT ''`);
    } catch { /* column may already exist */ }
  }
  if (from < 3) {
    try {
      db.exec(`ALTER TABLE search_history ADD COLUMN inserted INTEGER NOT NULL DEFAULT 0`);
    } catch { /* column may already exist */ }
  }
  if (from < 4) {
    // Add KJV as the seed translation
    try {
      db.exec(`
        INSERT OR IGNORE INTO translations(id, name, language, source)
        VALUES ('KJV', 'King James Version', 'en', 'bundled');
      `);
    } catch { /* ignore */ }

    // Populate FTS5 from any existing verses (for users upgrading from v3)
    try {
      db.exec(`INSERT INTO verses_fts(rowid, text) SELECT id, text FROM verses`);
    } catch { /* FTS table may already be populated */ }
  }
}
