/**
 * download-translations.ts
 *
 * Downloads Bible translations from multiple free sources and writes them as
 * NDJSON files into data/translations/.  The Electron app seeds from these
 * files on first launch (no Node.js ↔ Electron ABI conflict).
 *
 * Sources
 *   1. eBible.org    — 600+ public-domain / CC translations (USFM zips)
 *   2. getbible.net  — 40+ translations via free REST API (no key required)
 *
 * Output
 *   data/translations/index.json           — metadata for every translation
 *   data/translations/{ID}.ndjson          — one JSON line per verse
 *      {"b":1,"c":1,"v":1,"t":"In the beginning…"}
 *
 * Usage
 *   pnpm translations              # all translations
 *   pnpm translations:en           # English only
 *   pnpm translations -- --limit 5 # first N eBible translations only
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const langFilter = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const limitArg   = args.includes('--limit')
  ? parseInt(args[args.indexOf('--limit') + 1] ?? '999', 10)
  : 999;

// ── Paths ─────────────────────────────────────────────────────────────────────
const REPO_ROOT  = path.resolve(__dirname, '..');
const DATA_DIR   = path.join(REPO_ROOT, 'data', 'translations');
const INDEX_FILE = path.join(REPO_ROOT, 'data', 'translations', 'index.json');
const TMP_DIR    = path.join(os.tmpdir(), 'ltm-translations');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR,  { recursive: true });

// ── USFM book code → numeric book ID ─────────────────────────────────────────
const USFM_TO_ID: Record<string, number> = {
  // Standard USFM codes
  GEN:1,EXO:2,LEV:3,NUM:4,DEU:5,JOS:6,JDG:7,RUT:8,'1SA':9,'2SA':10,
  '1KI':11,'2KI':12,'1CH':13,'2CH':14,EZR:15,NEH:16,EST:17,JOB:18,PSA:19,
  PRO:20,ECC:21,SNG:22,ISA:23,JER:24,LAM:25,EZK:26,DAN:27,HOS:28,
  JOL:29,AMO:30,OBA:31,JON:32,MIC:33,NAM:34,HAB:35,ZEP:36,HAG:37,
  ZEC:38,MAL:39,
  MAT:40,MRK:41,LUK:42,JHN:43,ACT:44,ROM:45,'1CO':46,'2CO':47,GAL:48,
  EPH:49,PHP:50,COL:51,'1TH':52,'2TH':53,'1TI':54,'2TI':55,TIT:56,
  PHM:57,HEB:58,JAS:59,'1PE':60,'2PE':61,'1JN':62,'2JN':63,'3JN':64,
  JUD:65,REV:66,
  // Common variant codes used by older USFM projects
  EZE:26,JOE:29,JOH:43,SON:22,SOL:22,PHI:50,
  SNG:22,NAH:34,OBD:31,HBK:35,ZPH:36,ZCH:38,MLK:39,
  MRK2:41,MKR:41,LKE:42,JHN2:43,ACT2:44,
};

// ── Translation definitions ───────────────────────────────────────────────────

interface TransMeta {
  id: string;
  name: string;
  language: string;
  source: string;
  license: string;
}

// Phase 1: eBible.org (USFM zips, public domain / CC)
const EBIBLE_LIST: (TransMeta & { code: string })[] = [
  // English — public domain / CC (codes verified against ebible.org/Scriptures/{code}_usfm.zip)
  { code:'eng-kjv',      id:'KJV',   name:'King James Version (1769)',           language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-asv',      id:'ASV',   name:'American Standard Version (1901)',    language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-web',      id:'WEB',   name:'World English Bible',                 language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-webbe',    id:'WEBBE', name:'World English Bible (British Ed.)',   language:'en', source:'ebible', license:'Public Domain' },
  { code:'engylt',       id:'YLT',   name:"Young's Literal Translation",         language:'en', source:'ebible', license:'Public Domain' },
  { code:'engBBE',       id:'BBE',   name:'Bible in Basic English',              language:'en', source:'ebible', license:'Public Domain' },
  { code:'enggnv',       id:'GNV',   name:'Geneva Bible (1599)',                 language:'en', source:'ebible', license:'Public Domain' },
  { code:'engDRA',       id:'DRA',   name:'Douay-Rheims (1899)',                 language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-rv',       id:'RV',    name:'Revised Version (1885)',              language:'en', source:'ebible', license:'Public Domain' },
  { code:'engjps',       id:'JPS',   name:'JPS Tanakh (1917)',                   language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-lxx2012',  id:'LXXE',  name:'Brenton Septuagint in English',      language:'en', source:'ebible', license:'Public Domain' },
  // Spanish
  { code:'spaRV1909',    id:'RV09',  name:'Reina-Valera 1909',                   language:'es', source:'ebible', license:'Public Domain' },
  { code:'sparvg',       id:'RVG',   name:'Reina Valera Gómez',                 language:'es', source:'ebible', license:'CC' },
  { code:'spanblh',      id:'SBLH',  name:'Nueva Biblia Latinoamericana',        language:'es', source:'ebible', license:'CC' },
  // French
  { code:'fraLSG',       id:'LS10',  name:'Louis Segond (1910)',                 language:'fr', source:'ebible', license:'Public Domain' },
  // German
  { code:'deu1951',      id:'SCH51', name:'Schlachter Bibel (1951)',             language:'de', source:'ebible', license:'CC' },
  { code:'deuelbbk',     id:'ELB',   name:'Elberfelder Bibel (1905)',            language:'de', source:'ebible', license:'Public Domain' },
  // Portuguese
  { code:'porblt',       id:'BLT',   name:'Bíblia Livre (Portuguese)',           language:'pt', source:'ebible', license:'CC' },
  // Chinese
  { code:'cmn-cu89s',    id:'CUNP',  name:'Chinese Union Version (Simplified)',  language:'zh', source:'ebible', license:'CC' },
  { code:'cmn-cu89t',    id:'CUPT',  name:'Chinese Union Version (Traditional)', language:'zh', source:'ebible', license:'CC' },
  // Korean
  { code:'kor',          id:'KOR',   name:'Korean (개역한글)',                    language:'ko', source:'ebible', license:'Public Domain' },
  // Arabic
  { code:'arb-vd',       id:'VANDY', name:'Van Dyke Arabic Bible',              language:'ar', source:'ebible', license:'Public Domain' },
  // Russian
  { code:'russyn',       id:'SYNOD', name:'Russian Synodal Bible',              language:'ru', source:'ebible', license:'Public Domain' },
  // Swahili
  { code:'swhulb',       id:'SWH',   name:'Swahili Union Version',              language:'sw', source:'ebible', license:'CC' },
  // Hindi
  { code:'hin2017',      id:'HIRV',  name:'Hindi IRV (2017)',                   language:'hi', source:'ebible', license:'CC' },
  // Yoruba
  { code:'yor',          id:'YOR',   name:'Yoruba Bible',                        language:'yo', source:'ebible', license:'CC' },
  // Igbo
  { code:'ibo',          id:'IBO',   name:'Igbo Bible',                          language:'ig', source:'ebible', license:'CC' },
  // Hausa
  { code:'hausa',        id:'HAU',   name:'Hausa Bible',                         language:'ha', source:'ebible', license:'CC' },
  // Amharic
  { code:'amh',          id:'AMH',   name:'Amharic Bible',                       language:'am', source:'ebible', license:'CC' },
  // Tagalog
  { code:'tglulb',       id:'TGLA',  name:'Tagalog (Ang Biblia)',               language:'tl', source:'ebible', license:'Public Domain' },
  // Japanese
  { code:'jpn1965',      id:'JLB',   name:'Japanese Bible (1965)',              language:'ja', source:'ebible', license:'Public Domain' },
];

// Phase 2: getbible.net v2 (free REST API, no key required)
// Covers translations not available on eBible.org + fallbacks for eBible failures
interface GetBibleTrans extends TransMeta { slug: string }

const GETBIBLE_LIST: GetBibleTrans[] = [
  // English — public domain / free license
  { slug:'bbe',       id:'BBE',   name:'Bible in Basic English',            language:'en', source:'getbible', license:'Public Domain' },
  { slug:'ylt',       id:'YLT',   name:"Young's Literal Translation",        language:'en', source:'getbible', license:'Public Domain' },
  { slug:'darby',     id:'DARBY', name:'Darby Bible (1890)',                 language:'en', source:'getbible', license:'Public Domain' },
  { slug:'geneva1599',id:'GNV',   name:'Geneva Bible (1599)',                language:'en', source:'getbible', license:'Public Domain' },
  { slug:'drc',       id:'DRC',   name:'Douay-Rheims Challoner (1752)',      language:'en', source:'getbible', license:'Public Domain' },
  { slug:'jps',       id:'JPS',   name:'JPS Tanakh (1917)',                  language:'en', source:'getbible', license:'Public Domain' },
  { slug:'emphbbl',   id:'ROT',   name:"Rotherham's Emphasized Bible",       language:'en', source:'getbible', license:'Public Domain' },
  { slug:'lxxe',      id:'LXXE',  name:'Brenton LXX English',               language:'en', source:'getbible', license:'Public Domain' },
  { slug:'net',       id:'NET',   name:'New English Translation (NET)',      language:'en', source:'getbible', license:'CC BY' },
  { slug:'nheb',      id:'NHEB',  name:'New Heart English Bible',            language:'en', source:'getbible', license:'Public Domain' },
  { slug:'oeb',       id:'OEB',   name:'Open English Bible',                 language:'en', source:'getbible', license:'CC' },
  { slug:'cpdv',      id:'CPDV',  name:'Catholic Public Domain Version',     language:'en', source:'getbible', license:'Public Domain' },
  { slug:'ts2009',    id:'TS09',  name:'The Scriptures 2009',                language:'en', source:'getbible', license:'CC' },
  { slug:'ukjv',      id:'UKJV',  name:'Updated King James Version',         language:'en', source:'getbible', license:'Public Domain' },
  { slug:'kjv21',     id:'KJV21', name:'King James Version (21st Century)',  language:'en', source:'getbible', license:'Public Domain' },
  { slug:'akjv',      id:'AKJV',  name:'American King James Version',        language:'en', source:'getbible', license:'Public Domain' },
  // International
  { slug:'aov',       id:'AFRIKAANS', name:'Afrikaans Ou Vertaling (1933)',  language:'af', source:'getbible', license:'Public Domain' },
  { slug:'fi',        id:'FIN',   name:'Finnish Bible (1776)',               language:'fi', source:'getbible', license:'Public Domain' },
  { slug:'bkr',       id:'CZE',   name:'Czech Bible Kralicka',               language:'cs', source:'getbible', license:'Public Domain' },
  { slug:'hvd',       id:'HUN',   name:'Hungarian Károli Bible',             language:'hu', source:'getbible', license:'Public Domain' },
  { slug:'lith',      id:'LIT',   name:'Lithuanian Bible',                   language:'lt', source:'getbible', license:'Public Domain' },
  { slug:'nor',       id:'NOR',   name:'Norwegian Bible (1930)',             language:'no', source:'getbible', license:'Public Domain' },
  { slug:'rom',       id:'ROM',   name:'Romanian Cornilescu Bible',          language:'ro', source:'getbible', license:'CC' },
  { slug:'swe1917',   id:'SWE',   name:'Swedish Bible (1917)',               language:'sv', source:'getbible', license:'Public Domain' },
  { slug:'tagalog',   id:'TAG',   name:'Tagalog Bible (Ang Biblia)',         language:'tl', source:'getbible', license:'Public Domain' },
];

// ── Utilities ─────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'LeadMeToHim/1.0' } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        resolve(fetchText(res.headers.location));
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = mod.get(url, { headers: { 'User-Agent': 'LeadMeToHim/1.0' } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        file.close();
        resolve(downloadFile(res.headers.location, dest));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    });
    req.on('error', reject);
  });
}

function extractZip(zipPath: string, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force"`,
      { stdio: 'pipe' },
    );
  } else {
    execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'pipe' });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── USFM parser ───────────────────────────────────────────────────────────────

interface VerseLine { b: number; c: number; v: number; t: string }

/** Resolve a USFM book identifier to a canonical 1-66 book number.
 *  Handles standard codes ("GEN") and eBible's embedded codes ("GENengYLT"). */
function resolveBookId(raw: string): number {
  const upper = raw.toUpperCase();
  // Exact match first (standard USFM)
  if (USFM_TO_ID[upper]) return USFM_TO_ID[upper]!;
  // eBible appends translation code to the book code (e.g. GENengYLT → GEN)
  // Try decreasing prefix lengths: 4, 3, 2
  for (const len of [4, 3, 2]) {
    const prefix = upper.substring(0, len);
    if (USFM_TO_ID[prefix]) return USFM_TO_ID[prefix]!;
  }
  return 0;
}

/** Recursively find all USFM/SFM files under a directory. */
function findUsfmFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findUsfmFiles(full));
      } else if (/\.(usfm|sfm)$/i.test(entry.name)) {
        results.push(full);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

/** Parse USFM text for a known bookId, returning verse lines.
 *  Handles multi-line verse content, footnotes, cross-refs, and inline markers. */
function parseUsfmContent(content: string, bookId: number): VerseLine[] {
  const out: VerseLine[] = [];
  let chapter = 0;
  let verseNum = 0;
  const verseAccum: string[] = [];

  function flushVerse() {
    if (verseNum > 0 && chapter > 0 && verseAccum.length > 0) {
      let t = verseAccum.join(' ')
        // Remove footnote blocks \f ... \f*
        .replace(/\\f\b.*?\\f\*/g, '')
        // Remove cross-ref blocks \x ... \x*
        .replace(/\\x\b.*?\\x\*/g, '')
        // Remove all remaining USFM markers (\word or \word*)
        .replace(/\\[a-zA-Z0-9]+\*?/g, '')
        // Remove attribute separators
        .replace(/\|[^\s]*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (t.length > 1) out.push({ b: bookId, c: chapter, v: verseNum, t });
    }
    verseNum = 0;
    verseAccum.length = 0;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Chapter marker
    const chapM = line.match(/^\\c\s+(\d+)/);
    if (chapM) { flushVerse(); chapter = parseInt(chapM[1]!, 10); continue; }

    // Verse marker — flush previous verse then start new one
    const vM = line.match(/^\\v\s+(\d+)(.*)/);
    if (vM) {
      flushVerse();
      verseNum = parseInt(vM[1]!, 10);
      const tail = (vM[2] ?? '').trim();
      if (tail) verseAccum.push(tail);
      continue;
    }

    // Inside a verse: accumulate continuation lines
    // Skip section/heading markers (they're not verse text)
    if (verseNum > 0) {
      if (line.match(/^\\(ms|s[12]?|mr|r|d|h|toc|ide?|rem)\b/)) continue;
      // Poetry/paragraph markers: strip the marker, keep any trailing text
      if (line.match(/^\\[qpmi][1-9]?\b(.*)/)) {
        const m = line.match(/^\\[qpmi][1-9]?\b(.*)/);
        const tail = (m?.[1] ?? '').trim();
        if (tail) verseAccum.push(tail);
        continue;
      }
      // Any other line (inline markers, continuation text) — accumulate as-is
      verseAccum.push(line);
    }
  }
  flushVerse();
  return out;
}

/** Parse all USFM files found under a directory (recursive). */
function parseUsfmDir(dir: string): VerseLine[] {
  const files = findUsfmFiles(dir);
  const out: VerseLine[] = [];

  for (const file of files) {
    let content: string;
    try { content = fs.readFileSync(file, 'utf8'); }
    catch { continue; }

    // Determine book ID from \id marker
    const idM = content.match(/\\id\s+([A-Za-z0-9]+)/);
    if (!idM) continue;
    const bookId = resolveBookId(idM[1]!);
    if (!bookId) continue;

    out.push(...parseUsfmContent(content, bookId));
  }

  return out;
}

// ── Index helpers ─────────────────────────────────────────────────────────────

interface Index { translations: TransMeta[] }

function loadIndex(): Index {
  if (fs.existsSync(INDEX_FILE)) {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) as Index;
  }
  return { translations: [] };
}

function saveIndex(index: Index): void {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
}

function isAlreadyDownloaded(index: Index, id: string): boolean {
  return index.translations.some((t) => t.id === id);
}

function writeNdjson(id: string, lines: VerseLine[]): void {
  const out = fs.createWriteStream(path.join(DATA_DIR, `${id}.ndjson`));
  for (const l of lines) out.write(JSON.stringify(l) + '\n');
  out.end();
}

// ── Phase 1: eBible.org downloader ───────────────────────────────────────────

async function downloadEbible(
  index: Index,
  trans: (typeof EBIBLE_LIST)[0],
): Promise<boolean> {
  if (isAlreadyDownloaded(index, trans.id)) {
    console.log(`  [skip]     ${trans.id} — already downloaded`);
    return true;
  }

  const zipUrl  = `https://ebible.org/Scriptures/${trans.code}_usfm.zip`;
  const zipPath = path.join(TMP_DIR, `${trans.code}.zip`);
  const outDir  = path.join(TMP_DIR, trans.code);

  try {
    console.log(`  [download] ${trans.id} — ${trans.name}`);
    await downloadFile(zipUrl, zipPath);

    console.log(`  [unzip]    ${trans.code}`);
    extractZip(zipPath, outDir);

    console.log(`  [parse]    ${trans.code}`);
    const verses = parseUsfmDir(outDir);

    if (verses.length < 100) {
      console.warn(`  [warn]     ${trans.id}: only ${verses.length} verses — skipping`);
      return false;
    }

    console.log(`  [write]    ${verses.length.toLocaleString()} verses → data/translations/${trans.id}.ndjson`);
    writeNdjson(trans.id, verses);

    const meta: TransMeta = {
      id: trans.id, name: trans.name,
      language: trans.language, source: trans.source, license: trans.license,
    };
    index.translations.push(meta);
    saveIndex(index);
    return true;
  } catch (err) {
    console.warn(`  [fail]     ${trans.id}: ${(err as Error).message}`);
    return false;
  } finally {
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch { /* ignore */ }
    try { if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ── Phase 2: getbible.net v2 downloader ──────────────────────────────────────

const GETBIBLE_BASE = 'https://api.getbible.net/v2';

const BOOK_CHAPTER_COUNTS: Record<number, number> = {
  1:50,2:40,3:27,4:36,5:34,6:24,7:21,8:4,9:31,10:24,11:22,12:25,
  13:29,14:36,15:10,16:13,17:10,18:42,19:150,20:31,21:12,22:8,
  23:66,24:52,25:5,26:48,27:12,28:14,29:3,30:9,31:1,32:4,33:7,
  34:3,35:3,36:3,37:2,38:14,39:4,40:28,41:16,42:24,43:21,44:28,
  45:16,46:16,47:13,48:6,49:6,50:4,51:4,52:5,53:5,54:6,55:4,
  56:3,57:1,58:13,59:5,60:5,61:3,62:5,63:1,64:1,65:1,66:22,
};

async function downloadGetBible(
  index: Index,
  trans: GetBibleTrans,
): Promise<boolean> {
  if (isAlreadyDownloaded(index, trans.id)) {
    console.log(`  [skip]     ${trans.id} — already downloaded`);
    return true;
  }

  console.log(`  [api]      ${trans.id} — ${trans.name}`);
  const verses: VerseLine[] = [];
  let failures = 0;

  for (let bookId = 1; bookId <= 66; bookId++) {
    const chapCount = BOOK_CHAPTER_COUNTS[bookId] ?? 0;
    for (let ch = 1; ch <= chapCount; ch++) {
      const url = `${GETBIBLE_BASE}/${trans.slug}/${bookId}/${ch}.json`;
      try {
        const raw  = await fetchText(url);
        const data = JSON.parse(raw) as {
          verses?: Array<{ verse: number; text: string }>;
        };
        for (const vv of data.verses ?? []) {
          if (vv.text) verses.push({ b: bookId, c: ch, v: vv.verse, t: vv.text.trim() });
        }
        await sleep(100);
      } catch {
        failures++;
        if (failures > 20) {
          console.warn(`  [abort]    ${trans.id}: too many failures`);
          return false;
        }
        await sleep(400);
      }
    }
  }

  if (verses.length < 500) {
    console.warn(`  [warn]     ${trans.id}: only ${verses.length} verses — skipping`);
    return false;
  }

  console.log(`  [write]    ${verses.length.toLocaleString()} verses → data/translations/${trans.id}.ndjson`);
  writeNdjson(trans.id, verses);
  const meta: TransMeta = {
    id: trans.id, name: trans.name,
    language: trans.language, source: trans.source, license: trans.license,
  };
  index.translations.push(meta);
  saveIndex(index);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== LeadMeToHim: Translation Downloader ===');
  console.log(`Output: ${DATA_DIR}\n`);

  const index = loadIndex();
  let downloaded = 0;
  let failed = 0;

  // ── Phase 1: eBible.org (USFM) ────────────────────────────────────────────
  const ebibleList = (langFilter ? EBIBLE_LIST.filter((t) => t.language === langFilter) : EBIBLE_LIST)
    .slice(0, limitArg);

  console.log(`Phase 1 — eBible.org (${ebibleList.length} translations)\n`);
  for (const trans of ebibleList) {
    const ok = await downloadEbible(index, trans);
    if (ok) downloaded++;
    else failed++;
    await sleep(300);
  }

  // ── Phase 2: getbible.net v2 ───────────────────────────────────────────────
  const apiList = (langFilter
    ? GETBIBLE_LIST.filter((t) => t.language === langFilter)
    : GETBIBLE_LIST
  ).slice(0, Math.max(0, limitArg - EBIBLE_LIST.length));

  if (apiList.length > 0) {
    console.log(`\nPhase 2 — getbible.net (${apiList.length} translations)\n`);
    for (const trans of apiList) {
      const ok = await downloadGetBible(index, trans);
      if (ok) downloaded++;
      else failed++;
    }
  }

  console.log(`
=== Done ===
  Downloaded this run : ${downloaded}
  Failed / skipped    : ${failed}
  Total in index      : ${index.translations.length}
  Output folder       : ${DATA_DIR}

Start the app with "pnpm dev" — it will automatically import any new
translation files into the local database on first launch.

Note: Copyrighted translations (NIV, ESV, NLT, NKJV, MSG, AMP, NASB, CSB)
require a licensed API. Register a free key at https://scripture.api.bible
and use it with a separate download step.
`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
