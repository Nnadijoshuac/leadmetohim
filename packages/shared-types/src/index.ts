// ─── Scripture ────────────────────────────────────────────────────────────────

export type Testament = 'OT' | 'NT';

export interface BibleBook {
  id: number;
  name: string;
  shortName: string;
  aliases: string[];
  testament: Testament;
  chapters: number;
}

export interface BibleVerse {
  id: number;
  bookId: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}

export interface ScriptureReference {
  book: string;
  bookId: number;
  chapterStart: number;
  verseStart?: number;
  chapterEnd?: number;
  verseEnd?: number;
  /** Formatted display string, e.g. "John 3:16" or "Ezekiel 37:1–14" */
  display: string;
}

export interface SemanticChunk {
  id: string;
  /** Natural-language description of the biblical passage */
  text: string;
  reference: ScriptureReference;
  tags: string[];
  testament: Testament;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type QueryType = 'explicit' | 'semantic' | 'hybrid' | 'detected';

export interface SearchQuery {
  raw: string;
  type: QueryType;
  normalized?: string;
}

export interface SearchResult {
  reference: ScriptureReference;
  verseText?: string;
  confidence: number;
  queryType: QueryType;
  /** Top alternative matches */
  alternatives: AlternativeResult[];
}

export interface AlternativeResult {
  reference: ScriptureReference;
  confidence: number;
}

// ─── Insertion ────────────────────────────────────────────────────────────────

export type InsertMode =
  | 'reference'        // John 3:16
  | 'verse'            // "For God so loved the world…"
  | 'reference+verse'  // John 3:16 — "For God so loved the world…"
  | 'copy';            // copy to clipboard only

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  hotkey: string;
  pushToTalkHotkey: string;
  insertMode: InsertMode;
  translation: string;
  theme: 'dark' | 'light' | 'system';
  overlayOpacity: number;
  animations: boolean;
  startOnLogin: boolean;
  microphone: string;
  whisperModel: 'tiny.en' | 'base.en' | 'small.en';
  semanticThreshold: number;
  topK: number;
  showAlternatives: boolean;
  /** Continuously listen for scripture in ambient audio */
  alwaysListening: boolean;
  /** Confidence threshold (0-1) for auto-showing overlay on detection */
  detectionThreshold: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  hotkey: 'Ctrl+Shift+Space',
  pushToTalkHotkey: 'Alt+R',
  insertMode: 'reference+verse',
  translation: 'KJV',
  theme: 'dark',
  overlayOpacity: 0.92,
  animations: true,
  startOnLogin: false,
  microphone: 'default',
  whisperModel: 'tiny.en',
  semanticThreshold: 0.35,
  topK: 3,
  showAlternatives: true,
  alwaysListening: true,
  detectionThreshold: 0.4,
};

// ─── Overlay state ────────────────────────────────────────────────────────────

export type OverlayStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'searching'
  | 'result'
  | 'error';

export interface OverlayState {
  status: OverlayStatus;
  query: string;
  result: SearchResult | null;
  errorMessage: string | null;
}

// ─── IPC channels ─────────────────────────────────────────────────────────────

export const IPC = {
  OVERLAY_HIDE:   'overlay:hide',
  OVERLAY_SET_HEIGHT: 'overlay:setHeight',
  OVERLAY_READY:  'overlay:ready',

  SCRIPTURE_SEARCH: 'scripture:search',
  SCRIPTURE_INSERT: 'scripture:insert',

  SPEECH_START:      'speech:start',
  SPEECH_STOP:       'speech:stop',
  SPEECH_TRANSCRIPT: 'speech:transcript',
  SPEECH_ERROR:      'speech:error',

  // Always-on audio: renderer → main (one-way, fast)
  AUDIO_FRAME: 'audio:frame',
  // Main → renderer: scripture auto-detected from ambient audio
  AUDIO_DETECTION: 'audio:detection',

  SETTINGS_GET:     'settings:get',
  SETTINGS_SET:     'settings:set',
  SETTINGS_CHANGED: 'settings:changed',

  SYSTEM_OPEN_SETTINGS: 'system:openSettings',
  SYSTEM_VERSION:       'system:version',
  SYSTEM_MODEL_STATUS:  'system:modelStatus',

  HISTORY_ADD: 'history:add',
  HISTORY_GET: 'history:get',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

// ─── Model status ─────────────────────────────────────────────────────────────

export interface ModelStatus {
  whisper: 'missing' | 'downloading' | 'ready' | 'error';
  embedder: 'missing' | 'downloading' | 'ready' | 'error';
  whisperProgress?: number;
  embedderProgress?: number;
}
