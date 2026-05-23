import { app, session, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { log } from './logger.js';
import { createOverlayWindow } from './window-manager.js';
import { createTray, destroyTray } from './tray-manager.js';
import { registerHotkeys, unregisterAll } from './hotkey-manager.js';
import { setupIpcHandlers, handleAudioBuffer, setAlwaysListening } from './ipc-handlers.js';
import { initModels } from './model-manager.js';
import {
  initDatabase,
  getAllSettings,
  bulkUpsertChunks,
  bulkInsertVerses,
  getChunksWithoutEmbeddings,
  upsertEmbedding,
  upsertTranslation,
  rebuildFTS5,
} from '@leadmetohim/database';
import { BIBLE_BOOKS } from '@leadmetohim/scripture-engine';
import { embed, getModelId, loadVectorIndex } from '@leadmetohim/vector-search';

// ── Single instance lock ──────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDataDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data');
  }
  // Dev: apps/desktop → ../../data
  return path.resolve(app.getAppPath(), '../../data');
}

type Db = ReturnType<typeof initDatabase>;

function seedIfNeeded(db: Db, dataDir: string): void {
  const { n } = db.prepare('SELECT COUNT(*) as n FROM books').get() as { n: number };
  const isFirstRun = n === 0;

  if (isFirstRun) {
    log.info('First run — seeding database from bundled data files');

    const insertBook = db.prepare(
      `INSERT OR REPLACE INTO books (id, name, short_name, aliases, testament, chapters)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    db.transaction(() => {
      for (const book of BIBLE_BOOKS) {
        insertBook.run(book.id, book.name, book.shortName, JSON.stringify(book.aliases), book.testament, book.chapters);
      }
    })();
    log.info(`Seeded ${BIBLE_BOOKS.length} books`);

    const chunksPath = path.join(dataDir, 'semantic-chunks.json');
    if (fs.existsSync(chunksPath)) {
      const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));
      bulkUpsertChunks(db, chunks);
      log.info(`Seeded ${chunks.length} semantic chunks`);
    } else {
      log.warn('semantic-chunks.json not found — skipping chunks');
    }

    const featuredPath = path.join(dataDir, 'featured-verses.json');
    if (fs.existsSync(featuredPath)) {
      const { verses, translation } = JSON.parse(fs.readFileSync(featuredPath, 'utf8'));
      const bookMap = new Map(BIBLE_BOOKS.map((b) => [b.id, b.name]));
      const mapped = (verses as { bookId: number; chapter: number; verse: number; text: string }[]).map((v) => ({
        bookId: v.bookId,
        bookName: bookMap.get(v.bookId) ?? '',
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
        translation: (translation as string) ?? 'KJV',
      }));
      bulkInsertVerses(db, mapped);
      log.info(`Seeded ${mapped.length} featured verses`);
    }
  }

  // Import any downloaded translation NDJSON files (runs every launch, skips already-imported)
  importTranslationFiles(db, dataDir);
}

function importTranslationFiles(db: Db, dataDir: string): void {
  const transDir = path.join(dataDir, 'translations');
  const indexFile = path.join(transDir, 'index.json');
  if (!fs.existsSync(indexFile)) return;

  type IndexEntry = { id: string; name: string; language: string; source: string; license: string };
  const { translations } = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { translations: IndexEntry[] };
  const bookMap = new Map(BIBLE_BOOKS.map((b) => [b.id, b.name]));

  let totalImported = 0;
  let newTranslations = 0;

  const existing = db
    .prepare<[], { translation: string }>('SELECT DISTINCT translation FROM verses')
    .all()
    .map((r) => r.translation);
  const existingSet = new Set(existing);

  for (const meta of translations) {
    if (existingSet.has(meta.id)) continue; // already imported

    const ndjsonPath = path.join(transDir, `${meta.id}.ndjson`);
    if (!fs.existsSync(ndjsonPath)) continue;

    upsertTranslation(db, meta);

    const lines = fs.readFileSync(ndjsonPath, 'utf8').split('\n').filter(Boolean);
    const rows = lines.map((line) => {
      const { b, c, v, t } = JSON.parse(line) as { b: number; c: number; v: number; t: string };
      return { bookId: b, bookName: bookMap.get(b) ?? '', chapter: c, verse: v, text: t, translation: meta.id };
    });

    bulkInsertVerses(db, rows);
    totalImported += rows.length;
    newTranslations++;
    log.info(`Imported ${rows.length.toLocaleString()} verses for ${meta.id} (${meta.name})`);
    try { fs.unlinkSync(ndjsonPath); } catch { /* not critical */ }
  }

  if (newTranslations > 0) {
    log.info(`Rebuilding FTS5 index after importing ${newTranslations} new translations…`);
    rebuildFTS5(db);
    log.info('FTS5 rebuild complete');
  }
}

async function generateEmbeddingsIfNeeded(db: Db): Promise<void> {
  const chunks = getChunksWithoutEmbeddings(db);
  if (chunks.length === 0) return;

  log.info(`Generating embeddings for ${chunks.length} chunks…`);
  const model = getModelId();
  for (const chunk of chunks) {
    try {
      const vector = await embed(chunk.text);
      upsertEmbedding(db, chunk.id, vector, model);
    } catch (e) {
      log.warn(`Embed failed for chunk ${chunk.id}:`, e);
    }
  }
  log.info('Embeddings complete');
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info(`LeadMeToHim v${app.getVersion()} starting`);

  // ── Database ─────────────────────────────────────────────────────────────
  const dbPath = path.join(app.getPath('userData'), 'leadmetohim.db');
  const db = initDatabase(dbPath);
  log.info(`Database ready: ${dbPath}`);

  // ── First-run seed ────────────────────────────────────────────────────────
  seedIfNeeded(db, getDataDir());

  const settings = getAllSettings(db);

  // ── Microphone permission ────────────────────────────────────────────────
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture'].includes(permission);
    callback(allowed);
  });

  // ── IPC ──────────────────────────────────────────────────────────────────
  function onPTTStart(): void {
    overlayWin?.webContents.send('speech:startRecording');
  }

  function onPTTStop(): void {
    overlayWin?.webContents.send('speech:stopRecording');
  }

  setupIpcHandlers(db, onPTTStart, onPTTStop);

  ipcMain.handle('speech:audioBuffer', async (event, buffer: Buffer) => {
    await handleAudioBuffer(buffer, event.sender);
  });

  // ── Windows & Tray ───────────────────────────────────────────────────────
  const overlayWin = createOverlayWindow();
  createTray((enabled) => setAlwaysListening(enabled));

  // ── Hotkeys ──────────────────────────────────────────────────────────────
  registerHotkeys(settings.hotkey, settings.pushToTalkHotkey, onPTTStart, onPTTStop);

  // ── Local models → embeddings → vector index (background) ────────────────
  initModels(settings, overlayWin)
    .then(async () => {
      await generateEmbeddingsIfNeeded(db);
      try {
        loadVectorIndex(db);
        log.info('Vector index ready');
      } catch (e) {
        log.warn('Vector index load failed:', e);
      }
    })
    .catch((e) => {
      log.error('Model init error:', e);
    });

  log.info('App ready');
});

// ── macOS re-activate ─────────────────────────────────────────────────────────

app.on('activate', () => {
  // macOS: re-create window if dock icon clicked
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

app.on('before-quit', () => {
  unregisterAll();
  destroyTray();
  log.info('App quitting');
});

app.on('will-quit', () => {
  unregisterAll();
});

// Prevent quitting when all windows are closed — we live in the tray
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
