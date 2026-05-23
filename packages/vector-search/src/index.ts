import type Database from 'better-sqlite3';
import type { SearchResult } from '@leadmetohim/shared-types';
import { getAllEmbeddings, getChunkById } from '@leadmetohim/database';
import { buildSearchResult } from '@leadmetohim/scripture-engine';
import { embed, loadEmbedder, embedBatch, isEmbedderLoaded, getModelId } from './embedder.js';
import { topK, normalizeVector } from './similarity.js';

export { loadEmbedder, embed, embedBatch, isEmbedderLoaded, getModelId };
export { cosineSimilarity, normalizeVector, topK } from './similarity.js';

// ── In-memory vector index ─────────────────────────────────────────────────

interface IndexEntry {
  chunkId: string;
  vector: Float32Array;
}

let _index: IndexEntry[] = [];
let _indexLoaded = false;

/** Load all embeddings from SQLite into the in-memory index. */
export function loadVectorIndex(db: Database.Database): void {
  const rows = getAllEmbeddings(db);
  _index = rows.map((r) => ({ chunkId: r.chunkId, vector: r.vector }));
  _indexLoaded = true;
}

export function isIndexLoaded(): boolean {
  return _indexLoaded && _index.length > 0;
}

export function getIndexSize(): number {
  return _index.length;
}

// ── Semantic search ────────────────────────────────────────────────────────

export interface SemanticSearchOptions {
  topK?: number;
  threshold?: number;
  translation?: string;
}

/**
 * Perform semantic similarity search.
 * Returns null if no matches exceed the threshold.
 */
export async function semanticSearch(
  db: Database.Database,
  query: string,
  opts: SemanticSearchOptions = {},
): Promise<SearchResult | null> {
  const k = opts.topK ?? 3;
  const threshold = opts.threshold ?? 0.30;
  const translation = opts.translation ?? 'KJV';

  if (!isEmbedderLoaded()) throw new Error('Embedder not loaded.');
  if (!isIndexLoaded()) throw new Error('Vector index not loaded. Call loadVectorIndex() first.');

  const queryVec = await embed(query);
  const hits = topK(queryVec, _index, k, threshold);

  if (hits.length === 0) return null;

  const scored = hits
    .map((h) => {
      const chunk = getChunkById(db, h.item.chunkId);
      if (!chunk) return null;
      return { chunkId: chunk.id, reference: chunk.reference, score: h.score };
    })
    .filter(Boolean) as { chunkId: string; reference: import('@leadmetohim/shared-types').ScriptureReference; score: number }[];

  return buildSearchResult(db, scored, 'semantic', translation);
}

export { normalizeVector };
