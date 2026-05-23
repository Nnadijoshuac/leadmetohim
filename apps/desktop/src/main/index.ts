import { app, session } from 'electron';
import path from 'path';
import { log } from './logger.js';
import { createOverlayWindow, createSettingsWindow } from './window-manager.js';
import { createTray, destroyTray } from './tray-manager.js';
import { registerHotkeys, unregisterAll } from './hotkey-manager.js';
import { setupIpcHandlers, handleAudioBuffer } from './ipc-handlers.js';
import { initModels } from './model-manager.js';
import { initDatabase, getAllSettings, loadVectorIndex } from '@leadmetohim/database';
import { ipcMain } from 'electron';
import { IPC } from '@leadmetohim/shared-types';

// ── Single instance lock ──────────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  log.info(`LeadMeToHim v${app.getVersion()} starting`);

  // ── Database ─────────────────────────────────────────────────────────────
  const dbPath = path.join(app.getPath('userData'), 'leadmetohim.db');
  const db = initDatabase(dbPath);
  log.info(`Database ready: ${dbPath}`);

  const settings = getAllSettings(db);

  // ── Microphone permission ────────────────────────────────────────────────
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'audioCapture'].includes(permission);
    callback(allowed);
  });

  // ── IPC ──────────────────────────────────────────────────────────────────
  let isRecording = false;

  function onPTTStart(): void {
    isRecording = true;
    overlayWin?.webContents.send('speech:startRecording');
  }

  function onPTTStop(): void {
    isRecording = false;
    overlayWin?.webContents.send('speech:stopRecording');
  }

  setupIpcHandlers(db, onPTTStart, onPTTStop);

  // Audio buffer from renderer
  ipcMain.handle('speech:audioBuffer', async (event, buffer: Buffer) => {
    await handleAudioBuffer(buffer, event.sender);
  });

  // ── Windows & Tray ───────────────────────────────────────────────────────
  const overlayWin = createOverlayWindow();
  createTray();

  // ── Hotkeys ──────────────────────────────────────────────────────────────
  registerHotkeys(settings.hotkey, settings.pushToTalkHotkey, onPTTStart, onPTTStop);

  // ── Local models (background init) ───────────────────────────────────────
  initModels(settings, overlayWin).catch((e) => {
    log.error('Model init error:', e);
  });

  // Pre-load vector index once models are ready
  setTimeout(() => {
    try {
      loadVectorIndex(db);
      log.info('Vector index pre-loaded');
    } catch (e) {
      log.warn('Vector index pre-load failed (will retry on first search):', e);
    }
  }, 3000);

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
