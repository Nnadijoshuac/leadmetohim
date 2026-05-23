import type Database from 'better-sqlite3';
import type { SearchResult, AlternativeResult, ScriptureReference } from '@leadmetohim/shared-types';
import { getVerse } from '@leadmetohim/database';
import { parseReference } from './reference-parser.js';

export interface ScoredChunk {
  chunkId: string;
  reference: ScriptureReference;
  score: number;
}

/**
 * Build a SearchResult from a ranked list of scored chunks.
 * Fetches verse text from the database for the top match.
 */
export function buildSearchResult(
  db: Database.Database,
  scored: ScoredChunk[],
  queryType: 'semantic' | 'explicit' | 'hybrid',
  translation = 'KJV',
): SearchResult | null {
  if (scored.length === 0) return null;

  const top = scored[0]!;
  const alternatives: AlternativeResult[] = scored
    .slice(1)
    .map((s) => ({ reference: s.reference, confidence: s.score }));

  // Fetch verse text: single verse or first verse of a range
  let verseText: string | undefined;
  const ref = top.reference;

  const verse = getVerse(
    db,
    ref.bookId,
    ref.chapterStart,
    ref.verseStart ?? 1,
    translation,
  );
  if (verse) verseText = verse.text;

  return {
    reference: ref,
    verseText,
    confidence: top.score,
    queryType,
    alternatives,
  };
}

/**
 * Handle explicit reference lookup: parse the query, fetch verse text.
 */
export function lookupExplicitReference(
  db: Database.Database,
  query: string,
  translation = 'KJV',
): SearchResult | null {
  const ref = parseReference(query);
  if (!ref) return null;

  const verse = getVerse(db, ref.bookId, ref.chapterStart, ref.verseStart ?? 1, translation);

  return {
    reference: ref,
    verseText: verse?.text,
    confidence: 1.0,
    queryType: 'explicit',
    alternatives: [],
  };
}
