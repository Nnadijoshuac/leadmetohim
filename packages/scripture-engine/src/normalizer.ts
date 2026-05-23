/**
 * Converts spoken / informal number words to digits and normalises
 * common spoken-form Bible reference phrases before regex matching.
 */

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
};

function wordsToNumber(words: string[]): number | null {
  let result = 0;
  let current = 0;

  for (const word of words) {
    const w = word.toLowerCase();
    if (ORDINALS[w] !== undefined) { current += ORDINALS[w]!; break; }
    if (ONES[w] !== undefined)     { current += ONES[w]!; }
    else if (TENS[w] !== undefined){ current += TENS[w]!; }
    else if (w === 'hundred')      { current = current === 0 ? 100 : current * 100; }
    else break;
  }
  result += current;
  return result > 0 ? result : null;
}

/**
 * Convert spoken reference phrases into standard notation.
 *
 * Examples:
 *   "john three sixteen"           → "john 3:16"
 *   "first corinthians thirteen four" → "1 corinthians 13:4"
 *   "psalm twenty three"           → "psalm 23"
 *   "romans eight twenty eight"    → "romans 8:28"
 */
export function normalizeSpokenReference(input: string): string {
  let s = input.toLowerCase().trim();

  // Ordinal book prefixes: "first john" → "1 john", etc.
  s = s.replace(/\bfirst\b/g, '1').replace(/\bsecond\b/g, '2').replace(/\bthird\b/g, '3');

  // "verse" connector: "john 3 verse 16" → "john 3:16"
  s = s.replace(/(\d+)\s+verse\s+(\d+)/g, '$1:$2');

  // Replace number words with digits (greedy, longest first)
  const allWords = [...Object.keys(ORDINALS), ...Object.keys(ONES), ...Object.keys(TENS), 'hundred'];
  const numWordPattern = allWords
    .sort((a, b) => b.length - a.length)
    .join('|');
  const numRegex = new RegExp(`\\b((?:${numWordPattern})(?:\\s+(?:${numWordPattern}))*?)\\b`, 'gi');

  s = s.replace(numRegex, (match) => {
    const words = match.trim().split(/\s+/);
    const n = wordsToNumber(words);
    return n !== null ? String(n) : match;
  });

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ').trim();

  return s;
}

/**
 * Build a clean display string from parts, e.g. "John 3:16" or "Ezekiel 37:1–14"
 */
export function buildDisplayRef(
  bookName: string,
  chapterStart: number,
  verseStart?: number,
  chapterEnd?: number,
  verseEnd?: number,
): string {
  let ref = `${bookName} ${chapterStart}`;
  if (verseStart !== undefined) {
    ref += `:${verseStart}`;
    if (verseEnd !== undefined && verseEnd !== verseStart) {
      if (chapterEnd !== undefined && chapterEnd !== chapterStart) {
        ref += `–${chapterEnd}:${verseEnd}`;
      } else {
        ref += `–${verseEnd}`;
      }
    }
  } else if (chapterEnd !== undefined && chapterEnd !== chapterStart) {
    ref += `–${chapterEnd}`;
  }
  return ref;
}
