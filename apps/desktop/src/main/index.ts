import path from 'path';
import fs from 'fs';
import { app, session, ipcMain } from 'electron';
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

// Add global error handlers BEFORE everything else
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection:', reason, promise);
  process.exit(1);
});


// ── Helpers ───────────────────────────────────────────────────────────────────

function getDataDir(application: any): string {
  if (application.isPackaged) {
    return path.join(process.resourcesPath, 'data');
  }
  // Dev: apps/desktop → ../../data
  return path.resolve(application.getAppPath(), '../../data');
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

// ── Single instance lock ──────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

console.log('[STARTUP] app.whenReady() called, setting up promise handler');

app.whenReady().then(async () => {
  console.log('[APP] whenReady promise resolved');
  log.info(`LeadMeToHim v${app.getVersion()} starting`);

  try {
    // ── Database ─────────────────────────────────────────────────────────────
    console.log('[APP] Initializing database...');
    const dbPath = path.join(app.getPath('userData'), 'leadmetohim.db');
    console.log(`[APP] Database path: ${dbPath}`);
    const db = initDatabase(dbPath);
    log.info(`Database ready: ${dbPath}`);
    console.log('[APP] Database initialized successfully');

    // ── First-run seed ────────────────────────────────────────────────────────
    console.log('[APP] Seeding database if needed...');
    seedIfNeeded(db, getDataDir(app));
    console.log('[APP] Seed complete');

    const settings = getAllSettings(db);
    console.log('[APP] Settings loaded');

    // ── Microphone permission ────────────────────────────────────────────────
    console.log('[APP] Setting up microphone permissions...');
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowed = ['media', 'audioCapture'].includes(permission);
      callback(allowed);
    });

    // ── IPC ──────────────────────────────────────────────────────────────────
    console.log('[APP] Setting up IPC handlers...');
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
    console.log('[APP] Creating overlay window...');
    const overlayWin = createOverlayWindow();
    console.log('[APP] Creating tray...');
    createTray((enabled) => setAlwaysListening(enabled));
    console.log('[APP] Windows created');

    // ── Hotkeys ──────────────────────────────────────────────────────────────
    console.log('[APP] Registering hotkeys...');
    registerHotkeys(settings.hotkey, settings.pushToTalkHotkey, onPTTStart, onPTTStop);

    // ── Local models → embeddings → vector index (background) ────────────────
    console.log('[APP] Initializing models...');
    initModels(settings, overlayWin)
      .then(async () => {
        console.log('[APP] Models ready, generating embeddings...');
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
    console.log('[APP] Startup complete');
  } catch (e) {
    console.error('[APP] Initialization error:', e);
    log.error('Initialization error:', e);
    process.exit(1);
  }
}).catch((e) => {
  console.error('[STARTUP] app.whenReady() rejected:', e);
  process.exit(1);
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
