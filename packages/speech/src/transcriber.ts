import path from 'path';
import fs from 'fs';
import os from 'os';

export type WhisperModel = 'tiny.en' | 'base.en' | 'small.en';

export interface TranscribeOptions {
  modelDir: string;
  model?: WhisperModel;
  language?: string;
}

export interface TranscribeResult {
  text: string;
  durationMs: number;
}

/**
 * Transcribe a WAV audio buffer using nodejs-whisper (whisper.cpp wrapper).
 * The audio must be 16kHz, 16-bit, mono PCM WAV.
 */
export async function transcribeBuffer(
  audioBuffer: Buffer,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  const model = opts.model ?? 'tiny.en';
  const t0 = Date.now();

  // Write buffer to a temp WAV file — whisper.cpp requires a file path
  const tmpFile = path.join(os.tmpdir(), `ltm-audio-${Date.now()}.wav`);
  fs.writeFileSync(tmpFile, audioBuffer);

  try {
    const text = await runWhisper(tmpFile, model, opts.modelDir);
    return { text: text.trim(), durationMs: Date.now() - t0 };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

async function runWhisper(
  audioPath: string,
  model: WhisperModel,
  modelDir: string,
): Promise<string> {
  // Dynamic import so electron-builder can handle native module
  const { nodewhisper } = await import('nodejs-whisper');

  const result = await nodewhisper(audioPath, {
    modelName: model,
    autoDownloadModelName: model,
    modelPath: modelDir,
    whisperOptions: {
      outputInText: true,
      outputInVtt: false,
      outputInSrt: false,
      outputInCsv: false,
      translateToEnglish: false,
      language: 'en',
      wordTimestamps: false,
      timestamps_length: 60,
      splitOnWord: true,
    },
  });

  if (typeof result === 'string') return result;
  if (Array.isArray(result)) return (result as string[]).join(' ');
  return '';
}

/**
 * Download a Whisper model to modelDir.
 * Progress callback receives 0–100.
 */
export async function downloadWhisperModel(
  model: WhisperModel,
  modelDir: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });

  const { nodewhisper } = await import('nodejs-whisper');

  // Trigger a silent transcription of an empty file to force model download
  const emptyWav = createSilentWav(0.1);
  const tmpFile = path.join(os.tmpdir(), `ltm-init-${Date.now()}.wav`);
  fs.writeFileSync(tmpFile, emptyWav);

  onProgress?.(5);
  try {
    await nodewhisper(tmpFile, {
      modelName: model,
      autoDownloadModelName: model,
      modelPath: modelDir,
      whisperOptions: { outputInText: true },
    });
  } catch {
    // Model might not exist yet — that's expected on first run
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
  onProgress?.(100);
}

export function isWhisperModelPresent(model: WhisperModel, modelDir: string): boolean {
  const candidates = [
    path.join(modelDir, `ggml-${model}.bin`),
    path.join(modelDir, `ggml-model-whisper-${model}.bin`),
  ];
  return candidates.some((p) => fs.existsSync(p));
}

/** Create a minimal silent WAV buffer (16kHz, 16-bit, mono). */
function createSilentWav(durationSeconds: number): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataBytes = numSamples * 2;
  const buf = Buffer.alloc(44 + dataBytes, 0);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);   // PCM
  buf.writeUInt16LE(1, 22);   // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);   // block align
  buf.writeUInt16LE(16, 34);  // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);

  return buf;
}
