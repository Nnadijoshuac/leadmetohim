/**
 * Thin wrapper around @xenova/transformers for generating sentence embeddings.
 * Runs all-MiniLM-L6-v2 (384-dim) via ONNX Runtime — no Python required.
 */

import type { FeatureExtractionPipeline } from '@xenova/transformers';
import { normalizeVector } from './similarity.js';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let _pipeline: FeatureExtractionPipeline | null = null;
let _loading: Promise<FeatureExtractionPipeline> | null = null;

export interface EmbedderOptions {
  /** Directory to cache downloaded model files */
  cacheDir?: string;
  /** Callback for download progress */
  onProgress?: (pct: number) => void;
}

/**
 * Load (or return cached) embedding pipeline.
 * First call downloads the model (~22 MB quantized) to cacheDir.
 */
export async function loadEmbedder(opts: EmbedderOptions = {}): Promise<void> {
  if (_pipeline) return;
  if (_loading) { await _loading; return; }

  // Dynamic import to allow electron to bundle correctly
  const { pipeline, env } = await import('@xenova/transformers');

  if (opts.cacheDir) {
    env.cacheDir = opts.cacheDir;
    env.localModelPath = opts.cacheDir;
  }
  // Don't require a remote host for local models
  env.allowRemoteModels = true;
  env.allowLocalModels = true;

  _loading = pipeline('feature-extraction', MODEL_ID, {
    quantized: true,
    progress_callback: opts.onProgress
      ? (info: { progress?: number }) => {
          const pct = info.progress ?? 0;
          opts.onProgress!(Math.round(pct));
        }
      : undefined,
  }) as Promise<FeatureExtractionPipeline>;

  _pipeline = await _loading;
  _loading = null;
}

/**
 * Generate a normalised embedding for a single text string.
 * Throws if loadEmbedder() has not been called yet.
 */
export async function embed(text: string): Promise<Float32Array> {
  if (!_pipeline) throw new Error('Embedder not loaded. Call loadEmbedder() first.');

  const output = await _pipeline(text, { pooling: 'mean', normalize: true });
  const raw = output.data as Float32Array;
  return normalizeVector(new Float32Array(raw));
}

/**
 * Batch-embed an array of strings. More efficient than calling embed() individually.
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (!_pipeline) throw new Error('Embedder not loaded. Call loadEmbedder() first.');

  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

export function isEmbedderLoaded(): boolean {
  return _pipeline !== null;
}

export function getModelId(): string {
  return MODEL_ID;
}
