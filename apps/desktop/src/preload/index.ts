import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@leadmetohim/shared-types';
import type {
  SearchResult,
  AppSettings,
  InsertMode,
  ModelStatus,
} from '@leadmetohim/shared-types';

// ── Typed IPC bridge exposed to renderer ─────────────────────────────────────

const api = {
  // ── Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    hide:      (): Promise<void> => ipcRenderer.invoke(IPC.OVERLAY_HIDE),
    setHeight: (h: number): Promise<void> => ipcRenderer.invoke(IPC.OVERLAY_SET_HEIGHT, h),
    ready:     (): Promise<void> => ipcRenderer.invoke(IPC.OVERLAY_READY),
    onShow:    (cb: () => void) => ipcRenderer.on('overlay:show', cb),
    onHide:    (cb: () => void) => ipcRenderer.on('overlay:hide', cb),
  },

  // ── Scripture ─────────────────────────────────────────────────────────────
  scripture: {
    search: (query: string): Promise<SearchResult | null> =>
      ipcRenderer.invoke(IPC.SCRIPTURE_SEARCH, query),
    insert: (text: string, mode: InsertMode): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC.SCRIPTURE_INSERT, text, mode),
  },

  // ── Speech (PTT) ──────────────────────────────────────────────────────────
  speech: {
    startPTT:        (): Promise<void> => ipcRenderer.invoke(IPC.SPEECH_START),
    stopPTT:         (): Promise<void> => ipcRenderer.invoke(IPC.SPEECH_STOP),
    sendAudioBuffer: (buffer: Buffer): Promise<void> =>
      ipcRenderer.invoke('speech:audioBuffer', buffer),
    onTranscript:    (cb: (text: string) => void) =>
      ipcRenderer.on(IPC.SPEECH_TRANSCRIPT, (_e, text: string) => cb(text)),
    onStartRecording:(cb: () => void) => ipcRenderer.on('speech:startRecording', cb),
    onStopRecording: (cb: () => void) => ipcRenderer.on('speech:stopRecording', cb),
    onError:         (cb: (msg: string) => void) =>
      ipcRenderer.on(IPC.SPEECH_ERROR, (_e, msg: string) => cb(msg)),
  },

  // ── Always-on audio ───────────────────────────────────────────────────────
  audio: {
    /** Send a 100ms PCM frame (Float32Array @ 16 kHz mono) to the main process VAD. */
    sendFrame: (pcm: Float32Array): void =>
      ipcRenderer.send(IPC.AUDIO_FRAME, pcm.buffer),
    /** Called when the VAD + Whisper pipeline auto-detects a scripture. */
    onDetection: (cb: (result: SearchResult) => void): void => {
      ipcRenderer.on(IPC.AUDIO_DETECTION, (_e, result: SearchResult) => cb(result));
    },
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    get:      (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set:      (partial: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
    onChange: (cb: (s: AppSettings) => void) =>
      ipcRenderer.on(IPC.SETTINGS_CHANGED, (_e, s: AppSettings) => cb(s)),
  },

  // ── System ────────────────────────────────────────────────────────────────
  system: {
    openSettings:   (): Promise<void> => ipcRenderer.invoke(IPC.SYSTEM_OPEN_SETTINGS),
    getVersion:     (): Promise<string> => ipcRenderer.invoke(IPC.SYSTEM_VERSION),
    getModelStatus: (): Promise<ModelStatus> => ipcRenderer.invoke(IPC.SYSTEM_MODEL_STATUS),
    onModelStatus:  (cb: (s: ModelStatus) => void) =>
      ipcRenderer.on(IPC.SYSTEM_MODEL_STATUS, (_e, s: ModelStatus) => cb(s)),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

// ── Type declaration for renderer ─────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: typeof api;
  }
}
