import path from 'path';
import fs from 'fs';

export type WhisperModel = 'tiny.en' | 'base.en' | 'small.en';

const XENOVA_MODEL_IDS: Record<WhisperModel, string> = {
  'tiny.en': 'Xenova/whisper-tiny.en',
  'base.en': 'Xenova/whisper-base.en',
  'small.en': 'Xenova/whisper-small.en',
};

export interface TranscribeOptions {
  modelDir: string;
  model?: WhisperModel;
}

export interface TranscribeResult {
  text: string;
  durationMs: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XenovaPipeline = (input: Float32Array | string, options?: Record<string, unknown>) => Promise<{ text: string }>;

let _pipe: XenovaPipeline | null = null;
let _loadedModel: WhisperModel | null = null;

async function getPipeline(
  model: WhisperModel,
  cacheDir: string,
  onProgress?: (pct: number) => void,
): Promise<XenovaPipeline> {
  if (_pipe && _loadedModel === model) return _pipe;

  const { pipeline, env } = await import('@xenova/transformers');
  env.cacheDir = cacheDir;
  env.allowRemoteModels = true;
  env.allowLocalModels = true;

  const modelId = XENOVA_MODEL_IDS[model];

  const pipe = await pipeline('automatic-speech-recognition', modelId, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (info: any) => {
      if (info?.status === 'downloading' && typeof info.total === 'number' && info.total > 0) {
        onProgress?.(Math.round((info.loaded / info.total) * 100));
      }
    },
  });

  _pipe = pipe as unknown as XenovaPipeline;
  _loadedModel = model;
  return _pipe;
}

export function isWhisperModelPresent(model: WhisperModel, modelDir: string): boolean {
  const modelId = XENOVA_MODEL_IDS[model] ?? XENOVA_MODEL_IDS['tiny.en'];
  // Xenova caches models as: {cacheDir}/models--{org}--{name}/snapshots/
  const cacheKey = `models--${modelId.replace('/', '--')}`;
  return fs.existsSync(path.join(modelDir, cacheKey, 'snapshots'));
}

/** Download (or verify) the Whisper model. Returns when the model is ready. */
export async function downloadWhisperModel(
  model: WhisperModel,
  modelDir: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await getPipeline(model, modelDir, onProgress);
}

/** Transcribe a 16 kHz mono Float32Array. Zero-copy path from always-on audio. */
export async function transcribeFloat32(
  pcm: Float32Array,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  const model = opts.model ?? 'tiny.en';
  const pipe = await getPipeline(model, opts.modelDir);

  const t0 = Date.now();
  const result = await pipe(pcm, { sampling_rate: 16000, language: 'english', task: 'transcribe' });
  return { text: result.text?.trim() ?? '', durationMs: Date.now() - t0 };
}

/** Transcribe a standard 16 kHz 16-bit mono PCM WAV buffer (for PTT compatibility). */
export async function transcribeBuffer(
  audioBuffer: Buffer,
  opts: TranscribeOptions,
): Promise<TranscribeResult> {
  return transcribeFloat32(wavToFloat32(audioBuffer), opts);
}

function wavToFloat32(buf: Buffer): Float32Array {
  const dataStart = 44; // standard PCM WAV header
  const numSamples = (buf.length - dataStart) / 2;
  const out = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    out[i] = buf.readInt16LE(dataStart + i * 2) / 32768;
  }
  return out;
}
