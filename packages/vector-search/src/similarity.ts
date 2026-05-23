/**
 * Pure numeric similarity utilities — no dependencies.
 * All vectors are expected to be L2-normalised Float32Arrays.
 */

/** Cosine similarity of two normalised vectors (dot product). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

/** L2-normalise a vector in place. Returns the same array. */
export function normalizeVector(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += (v[i] ?? 0) ** 2;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  for (let i = 0; i < v.length; i++) v[i] = (v[i] ?? 0) / norm;
  return v;
}

export interface ScoredItem<T> {
  item: T;
  score: number;
}

/**
 * Brute-force top-k retrieval via cosine similarity.
 * Suitable for up to ~10 000 vectors at < 5 ms on modern CPUs.
 */
export function topK<T extends { vector: Float32Array }>(
  query: Float32Array,
  corpus: T[],
  k: number,
  threshold = 0,
): ScoredItem<T>[] {
  const scored: ScoredItem<T>[] = [];

  for (const item of corpus) {
    const score = cosineSimilarity(query, item.vector);
    if (score >= threshold) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
