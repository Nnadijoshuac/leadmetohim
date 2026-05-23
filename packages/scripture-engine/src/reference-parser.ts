import type { ScriptureReference } from '@leadmetohim/shared-types';
import { BOOK_BY_ALIAS } from './books.js';
import { normalizeSpokenReference, buildDisplayRef } from './normalizer.js';

/**
 * Tries to parse an explicit scripture reference from raw text.
 * Returns null if the text doesn't look like a reference.
 *
 * Handles:
 *   - "John 3:16"
 *   - "John 3:16-18"
 *   - "1 Corinthians 13:4-7"
 *   - "Psalm 23"
 *   - Spoken: "john three sixteen", "first corinthians thirteen four"
 */
export function parseReference(raw: string): ScriptureReference | null {
  // Try normalizing spoken form first
  const normalized = normalizeSpokenReference(raw);
  return tryParseNormalized(normalized) ?? tryParseNormalized(raw.trim());
}

function tryParseNormalized(s: string): ScriptureReference | null {
  // Pattern: [optional number prefix] BookName [Chapter][:Verse[-EndVerse]]
  const pattern =
    /^((?:\d\s+)?[a-z\s]+?)\s+(\d{1,3})(?::(\d{1,3})(?:[–\-](\d{1,3})(?::(\d{1,3}))?)?)?$/i;

  const m = pattern.exec(s.trim());
  if (!m) return null;

  const [, rawBook, chStr, vsStr, veOrChStr, ve2Str] = m;
  const bookKey = rawBook?.replace(/\s+/g, ' ').trim().toLowerCase() ?? '';
  const book = BOOK_BY_ALIAS.get(bookKey);
  if (!book) return null;

  const chapterStart = parseInt(chStr ?? '1', 10);
  const verseStart = vsStr ? parseInt(vsStr, 10) : undefined;

  // Handle range formats: "3:16-18" or "3:16-4:1"
  let chapterEnd: number | undefined;
  let verseEnd: number | undefined;

  if (veOrChStr) {
    const veOrCh = parseInt(veOrChStr, 10);
    if (ve2Str) {
      // Format: chapter:verse-chapter:verse
      chapterEnd = veOrCh;
      verseEnd = parseInt(ve2Str, 10);
    } else {
      // Format: chapter:verse-verse
      verseEnd = veOrCh;
    }
  }

  if (chapterStart < 1 || chapterStart > book.chapters) return null;

  return {
    book: book.name,
    bookId: book.id,
    chapterStart,
    verseStart,
    chapterEnd,
    verseEnd,
    display: buildDisplayRef(book.name, chapterStart, verseStart, chapterEnd, verseEnd),
  };
}

/**
 * Scan arbitrary text for embedded scripture references.
 * Returns all found references in order of appearance.
 */
export function extractReferencesFromText(text: string): ScriptureReference[] {
  const results: ScriptureReference[] = [];
  // Match book names followed by chapter/verse patterns
  const bookPattern = Array.from(BOOK_BY_ALIAS.keys())
    .filter((k) => k.length > 2)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  const re = new RegExp(
    `((?:\\d\\s+)?(?:${bookPattern}))\\s+(\\d{1,3})(?::(\\d{1,3})(?:[–\\-](\\d{1,3}))?)?`,
    'gi',
  );

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const ref = tryParseNormalized(match[0]);
    if (ref) results.push(ref);
  }
  return results;
}
