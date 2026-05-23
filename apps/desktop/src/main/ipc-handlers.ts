import { ipcMain, clipboard } from 'electron';
import path from 'path';
import { app } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '@leadmetohim/shared-types';
import type { AppSettings, InsertMode, SearchResult } from '@leadmetohim/shared-types';
import {
  getAllSettings,
  setAllSettings,
  addHistory,
  searchVersesFTS5,
} from '@leadmetohim/database';
import { parseReference, lookupExplicitReference } from '@leadmetohim/scripture-engine';
import { semanticSearch, loadVectorIndex, isIndexLoaded } from '@leadmetohim/vector-search';
import { transcribeBuffer, transcribeFloat32 } from '@leadmetohim/speech';
import {
  hideOverlay,
  showOverlay,
  createSettingsWindow,
  setOverlayHeight,
  getOverlayWindow,
} from './window-manager.js';
import { updateHotkey } from './hotkey-manager.js';
import { insertText } from './text-inserter.js';
import { getModelsDir, getModelStatus, isWhisperReady } from './model-manager.js';
import { AudioListener } from './audio-listener.js';
import { log } from './logger.js';

let _db: Database.Database;
let _onPTTStart: () => void = () => undefined;
let _onPTTStop: () => void  = () => undefined;
let _listener: AudioListener | null = null;

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setupIpcHandlers(
  db: Database.Database,
  onPTTStart: () => void,
  onPTTStop: () => void,
): void {
  _db = db;
  _onPTTStart = onPTTStart;
  _onPTTStop  = onPTTStop;

  // Overlay
  ipcMain.handle(IPC.OVERLAY_HIDE,       () => hideOverlay());
  ipcMain.handle(IPC.OVERLAY_SET_HEIGHT, (_e, h: number) => setOverlayHeight(h));
  ipcMain.handle(IPC.OVERLAY_READY,      () => loadIndexIfNeeded());

  // Scripture
  ipcMain.handle(IPC.SCRIPTURE_SEARCH, handleScriptureSearch);
  ipcMain.handle(IPC.SCRIPTURE_INSERT, handleScriptureInsert);

  // Speech (PTT)
  ipcMain.handle(IPC.SPEECH_START, () => _onPTTStart());
  ipcMain.handle(IPC.SPEECH_STOP,  () => _onPTTStop());

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, () => getAllSettings(_db));
  ipcMain.handle(IPC.SETTINGS_SET, handleSettingsSet);

  // System
  ipcMain.handle(IPC.SYSTEM_OPEN_SETTINGS, () => createSettingsWindow());
  ipcMain.handle(IPC.SYSTEM_VERSION,        () => app.getVersion());
  ipcMain.handle(IPC.SYSTEM_MODEL_STATUS,   () => getModelStatus());

  // Always-on audio frames (one-way, high-frequency — use ipcMain.on, not handle)
  _listener = new AudioListener(handleUtterance);
  ipcMain.on(IPC.AUDIO_FRAME, (_e, data: ArrayBuffer | Buffer) => {
    if (!_listener) return;
    const float32 =
      data instanceof Buffer
        ? new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4)
        : new Float32Array(data);
    _listener.processFrame(float32);
  });
}

/** Enable or disable the always-on VAD (e.g. when settings change). */
export function setAlwaysListening(enabled: boolean): void {
  _listener?.setEnabled(enabled);
}

// ── Always-on utterance handling ──────────────────────────────────────────────

let _processingUtterance = false;

async function handleUtterance(pcm: Float32Array): Promise<void> {
  if (_processingUtterance) return; // skip if already transcribing
  if (!isWhisperReady()) return;

  _processingUtterance = true;
  try {
    const settings = getAllSettings(_db);
    if (!settings.alwaysListening) return;

    const { text, durationMs } = await transcribeFloat32(pcm, {
      modelDir: getModelsDir(),
      model: settings.whisperModel,
    });

    log.info(`[Listen] Transcribed in ${durationMs}ms: "${text}"`);
    if (!text || text.length < 8) return;

    // Search across ALL loaded translations via FTS5
    const matches = searchVersesFTS5(_db, text, { limit: 5 });
    if (matches.length === 0) return;

    const best = matches[0]!;
    // Only surface if confidence is meaningful (BM25 rank is negative; stronger = more negative)
    const confidence = Math.min(1, Math.abs(best.score) / 8);
    if (confidence < settings.detectionThreshold) return;

    log.info(`[Listen] Scripture detected: ${best.verse.bookName} ${best.verse.chapter}:${best.verse.verse} (conf ${confidence.toFixed(2)})`);

    const result: SearchResult = {
      reference: {
        book:         best.verse.bookName,
        bookId:       best.verse.bookId,
        chapterStart: best.verse.chapter,
        verseStart:   best.verse.verse,
        display:      `${best.verse.bookName} ${best.verse.chapter}:${best.verse.verse}`,
      },
      verseText:  best.verse.text,
      confidence,
      queryType:  'detected',
      alternatives: matches.slice(1).map((m) => ({
        reference: {
          book:         m.verse.bookName,
          bookId:       m.verse.bookId,
          chapterStart: m.verse.chapter,
          verseStart:   m.verse.verse,
          display:      `${m.verse.bookName} ${m.verse.chapter}:${m.verse.verse}`,
        },
        confidence: Math.min(1, Math.abs(m.score) / 8),
      })),
    };

    // Show overlay and send detected result to renderer
    showOverlay();
    const win = getOverlayWindow();
    win?.webContents.send(IPC.AUDIO_DETECTION, result);

    addHistory(_db, text, 'semantic', result.reference.display);
  } catch (e) {
    log.error('[Listen] Utterance processing failed:', e);
  } finally {
    _processingUtterance = false;
  }
}

// ── Manual scripture search (PTT transcript or typed query) ───────────────────

async function handleScriptureSearch(
  _event: Electron.IpcMainInvokeEvent,
  query: string,
) {
  if (!query || query.trim().length < 2) return null;

  const settings = getAllSettings(_db);
  log.info(`Search: "${query}"`);

  try {
    const explicitRef = parseReference(query);
    if (explicitRef) {
      const result = lookupExplicitReference(_db, query, settings.translation);
      if (result) {
        addHistory(_db, query, 'explicit', result.reference.display);
        return result;
      }
    }

    await loadIndexIfNeeded();
    const result = await semanticSearch(_db, query, {
      topK: settings.topK,
      threshold: settings.semanticThreshold,
      translation: settings.translation,
    });

    if (result) addHistory(_db, query, 'semantic', result.reference.display);
    return result;
  } catch (e) {
    log.error('Search failed:', e);
    return null;
  }
}

// ── Text insertion ────────────────────────────────────────────────────────────

async function handleScriptureInsert(
  _event: Electron.IpcMainInvokeEvent,
  text: string,
  mode: InsertMode,
) {
  log.info(`Insert mode "${mode}": "${text.slice(0, 60)}…"`);

  if (mode === 'copy') {
    clipboard.writeText(text);
    hideOverlay();
    return { success: true };
  }

  try {
    hideOverlay();
    await insertText(text);
    return { success: true };
  } catch (e) {
    log.error('Insert failed:', e);
    return { success: false, error: String(e) };
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function handleSettingsSet(
  _event: Electron.IpcMainInvokeEvent,
  partial: Partial<AppSettings>,
) {
  setAllSettings(_db, partial);

  if (partial.hotkey || partial.pushToTalkHotkey) {
    const s = getAllSettings(_db);
    updateHotkey(s.hotkey, s.pushToTalkHotkey, _onPTTStart, _onPTTStop);
  }

  if (partial.alwaysListening !== undefined) {
    setAlwaysListening(partial.alwaysListening);
  }
}

// ── PTT audio buffer (legacy path) ────────────────────────────────────────────

export async function handleAudioBuffer(
  audioBuffer: Buffer,
  senderWebContents: Electron.WebContents,
): Promise<void> {
  const settings = getAllSettings(_db);
  log.info('PTT audio buffer received, transcribing…');

  try {
    const { text, durationMs } = await transcribeBuffer(audioBuffer, {
      modelDir: getModelsDir(),
      model: settings.whisperModel,
    });

    log.info(`Transcribed in ${durationMs}ms: "${text}"`);

    if (text.trim()) {
      senderWebContents.send(IPC.SPEECH_TRANSCRIPT, text);
    } else {
      senderWebContents.send(IPC.SPEECH_ERROR, 'No speech detected');
    }
  } catch (e) {
    log.error('Transcription failed:', e);
    senderWebContents.send(IPC.SPEECH_ERROR, String(e));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadIndexIfNeeded(): Promise<void> {
  if (!isIndexLoaded()) {
    const { loadVectorIndex: lvi } = await import('@leadmetohim/vector-search');
    lvi(_db);
    log.info('Vector index loaded');
  }
}
