#!/usr/bin/env tsx
/**
 * Download local models needed for offline operation.
 *
 * Run: pnpm models
 *
 * Downloads:
 *   - Whisper tiny.en (~75 MB) for speech-to-text
 *   - all-MiniLM-L6-v2 is auto-downloaded by @xenova/transformers on first embed
 *
 * This script is optional — models are also downloaded automatically on first
 * app launch via the model-manager. Run this beforehand for a faster first
 * launch experience or for offline deployment.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('\n📦  LeadMeToHim — Model Downloader\n');

  const modelsDir = path.join(ROOT, 'data', 'models');
  const embedderCache = path.join(ROOT, 'data', '.embedder-cache');

  if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
  if (!fs.existsSync(embedderCache)) fs.mkdirSync(embedderCache, { recursive: true });

  // ── Whisper model ─────────────────────────────────────────────────────────
  console.log('🎤  Whisper tiny.en (~75 MB)');
  const { downloadWhisperModel, isWhisperModelPresent } = await import('@leadmetohim/speech');

  const model = 'tiny.en';
  if (isWhisperModelPresent(model, modelsDir)) {
    console.log('    ✅  Already present — skipping\n');
  } else {
    console.log('    Downloading…');
    let lastPct = -1;
    await downloadWhisperModel(model, modelsDir, (pct) => {
      if (pct !== lastPct) {
        process.stdout.write(`\r    [${pct}%]`);
        lastPct = pct;
      }
    });
    console.log('\n    ✅  Done\n');
  }

  // ── Embedding model ────────────────────────────────────────────────────────
  console.log('🧠  all-MiniLM-L6-v2 (ONNX, ~22 MB)');
  const { loadEmbedder, embed } = await import('@leadmetohim/vector-search');

  await loadEmbedder({
    cacheDir: embedderCache,
    onProgress: (pct) => process.stdout.write(`\r    [${pct}%]`),
  });

  // Warm up
  await embed('test sentence for model warmup');
  console.log('\n    ✅  Done\n');

  console.log('✨  All models ready!\n');
}

main().catch((e) => {
  console.error('❌  Download failed:', e);
  process.exit(1);
});
