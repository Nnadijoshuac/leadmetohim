#!/usr/bin/env tsx
/**
 * Pre-compute and store embeddings for all semantic chunks.
 *
 * Run: pnpm embeddings
 *
 * This populates the `embeddings` table in the seed database so the
 * vector index is ready immediately when the app launches — no
 * embedding generation needed at runtime for the seed data.
 *
 * The app ALSO generates embeddings at query time for user input,
 * but the seed chunks are pre-embedded here for performance.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const { initDatabase, getAllChunks, getChunksWithoutEmbeddings, upsertEmbedding } =
    await import('@leadmetohim/database');
  const { loadEmbedder, embed, getModelId } = await import('@leadmetohim/vector-search');

  const dbPath = path.join(ROOT, 'data', 'leadmetohim-seed.db');

  if (!fs.existsSync(dbPath)) {
    console.error('❌  Seed database not found. Run `pnpm seed` first.');
    process.exit(1);
  }

  const db = initDatabase(dbPath);
  const allChunks = getAllChunks(db);

  console.log(`\n🧠  Generating embeddings for ${allChunks.length} semantic chunks…\n`);
  console.log('    Loading all-MiniLM-L6-v2 model (first run downloads ~22MB)…');

  const cacheDir = path.join(ROOT, 'data', '.embedder-cache');
  await loadEmbedder({ cacheDir });

  const model = getModelId();
  const chunksToEmbed = getChunksWithoutEmbeddings(db);

  if (chunksToEmbed.length === 0) {
    console.log('✅  All chunks already have embeddings. Nothing to do.\n');
    db.close();
    return;
  }

  console.log(`    Embedding ${chunksToEmbed.length} chunks…\n`);

  let done = 0;
  const t0 = Date.now();

  for (const chunk of chunksToEmbed) {
    const vector = await embed(chunk.text);
    upsertEmbedding(db, chunk.id, vector, model);
    done++;

    if (done % 10 === 0 || done === chunksToEmbed.length) {
      const pct = Math.round((done / chunksToEmbed.length) * 100);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      process.stdout.write(`\r    [${pct}%] ${done}/${chunksToEmbed.length} chunks — ${elapsed}s`);
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n✅  Embeddings complete in ${total}s`);
  console.log(`    Model: ${model}`);
  console.log(`    Dimensions: 384`);
  console.log(`    Chunks embedded: ${done}\n`);

  db.close();
}

main().catch((e) => {
  console.error('\n❌  Embedding generation failed:', e);
  process.exit(1);
});
