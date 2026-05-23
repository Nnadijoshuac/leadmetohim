import path from 'path';
import { app } from 'electron';
import { BrowserWindow } from 'electron';
import { IPC } from '@leadmetohim/shared-types';
import type { ModelStatus, AppSettings } from '@leadmetohim/shared-types';
import { loadEmbedder, isEmbedderLoaded } from '@leadmetohim/vector-search';
import { isWhisperModelPresent, downloadWhisperModel } from '@leadmetohim/speech';
import { log } from './logger.js';

export function getModelsDir(): string {
  return path.join(app.getPath('userData'), 'models');
}

export function getEmbedderCacheDir(): string {
  return path.join(app.getPath('userData'), 'embedder-cache');
}

let _status: ModelStatus = {
  whisper:  'missing',
  embedder: 'missing',
};

export function getModelStatus(): ModelStatus {
  return { ..._status };
}

export function isWhisperReady(): boolean {
  return _status.whisper === 'ready';
}

function broadcast(win: BrowserWindow | null | undefined): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.SYSTEM_MODEL_STATUS, _status);
  }
}

export async function initModels(
  settings: AppSettings,
  statusWindow?: BrowserWindow | null,
): Promise<void> {
  const modelsDir    = getModelsDir();
  const embedderCache = getEmbedderCacheDir();

  // ── Embedder ────────────────────────────────────────────────────────────
  if (!isEmbedderLoaded()) {
    _status.embedder = 'downloading';
    broadcast(statusWindow);

    try {
      await loadEmbedder({
        cacheDir: embedderCache,
        onProgress: (pct) => {
          _status.embedderProgress = pct;
          broadcast(statusWindow);
        },
      });
      _status.embedder = 'ready';
      _status.embedderProgress = undefined;
      log.info('Embedder ready');
    } catch (e) {
      _status.embedder = 'error';
      log.error('Failed to load embedder:', e);
    }

    broadcast(statusWindow);
  } else {
    _status.embedder = 'ready';
  }

  // ── Whisper (via @xenova/transformers ONNX — no binary path issues) ─────
  const model = settings.whisperModel;

  _status.whisper = 'downloading';
  broadcast(statusWindow);

  try {
    await downloadWhisperModel(model, modelsDir, (pct) => {
      _status.whisperProgress = pct;
      broadcast(statusWindow);
    });
    _status.whisper = 'ready';
    _status.whisperProgress = undefined;
    log.info(`Whisper model "${model}" ready`);
  } catch (e) {
    _status.whisper = 'error';
    log.error('Failed to load Whisper model:', e);
  }

  broadcast(statusWindow);
}
