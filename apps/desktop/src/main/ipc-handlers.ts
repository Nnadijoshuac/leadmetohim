import { ipcMain, clipboard } from 'electron';
import path from 'path';
import { app } from 'electron';
import type Database from 'better-sqlite3';
import { IPC } from '@leadmetohim/shared-types';
import type { AppSettings, InsertMode } from '@leadmetohim/shared-types';
import { getAllSettings, setAllSettings, addHistory } from '@leadmetohim/database';
import { parseReference, lookupExplicitReference } from '@leadmetohim/scripture-engine';
import { semanticSearch, loadVectorIndex, isIndexLoaded } from '@leadmetohim/vector-search';
import { transcribeBuffer } from '@leadmetohim/speech';
import { hideOverlay, createSettingsWindow, setOverlayHeight } from './window-manager.js';
import { updateHotkey } from './hotkey-manager.js';
import { insertText } from './text-inserter.js';
import { getModelsDir, getModelStatus } from './model-manager.js';
import { log } from './logger.js';

let _db: Database.Database;
let _onPTTStart: () => void = () => undefined;
let _onPTTStop: () => void = () => undefined;

export function setupIpcHandlers(
  db: Database.Database,
  onPTTStart: () => void,
  onPTTStop: () => void,
): void {
  _db = db;
  _onPTTStart = onPTTStart;
  _onPTTStop = onPTTStop;

  ipcMain.handle(IPC.OVERLAY_HIDE, () => hideOverlay());
  ipcMain.handle(IPC.OVERLAY_SET_HEIGHT, (_e, h: number) => setOverlayHeight(h));
  ipcMain.handle(IPC.OVERLAY_READY, () => loadIndexIfNeeded());

  ipcMain.handle(IPC.SCRIPTURE_SEARCH, handleScriptureSearch);
  ipcMain.handle(IPC.SCRIPTURE_INSERT, handleScriptureInsert);

  ipcMain.handle(IPC.SPEECH_START, () => _onPTTStart());
  ipcMain.handle(IPC.SPEECH_STOP, () => _onPTTStop());

  ipcMain.handle(IPC.SETTINGS_GET, () => getAllSettings(_db));
  ipcMain.handle(IPC.SETTINGS_SET, handleSettingsSet);

  ipcMain.handle(IPC.SYSTEM_OPEN_SETTINGS, () => createSettingsWindow());
  ipcMain.handle(IPC.SYSTEM_VERSION, () => app.getVersion());
  ipcMain.handle(IPC.SYSTEM_MODEL_STATUS, () => getModelStatus());
}

// ── Scripture search ──────────────────────────────────────────────────────────

async function handleScriptureSearch(
  _event: Electron.IpcMainInvokeEvent,
  query: string,
) {
  if (!query || query.trim().length < 2) return null;

  const settings = getAllSettings(_db);
  log.info(`Search: "${query}"`);

  try {
    // 1. Try explicit reference first
    const explicitRef = parseReference(query);
    if (explicitRef) {
      const result = lookupExplicitReference(_db, query, settings.translation);
      if (result) {
        addHistory(_db, query, 'explicit', result.reference.display);
        return result;
      }
    }

    // 2. Semantic fallback
    await loadIndexIfNeeded();
    const result = await semanticSearch(_db, query, {
      topK: settings.topK,
      threshold: settings.semanticThreshold,
      translation: settings.translation,
    });

    if (result) {
      addHistory(_db, query, 'semantic', result.reference.display);
    }
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

  // Re-register hotkeys if they changed
  if (partial.hotkey || partial.pushToTalkHotkey) {
    const s = getAllSettings(_db);
    updateHotkey(s.hotkey, s.pushToTalkHotkey, _onPTTStart, _onPTTStop);
  }
}

// ── Speech transcription ──────────────────────────────────────────────────────

export async function handleAudioBuffer(
  audioBuffer: Buffer,
  senderWebContents: Electron.WebContents,
): Promise<void> {
  const settings = getAllSettings(_db);
  log.info('Received audio buffer, transcribing…');

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
