/**
 * download-translations.ts
 *
 * Downloads Bible translations from multiple free sources and writes them as
 * NDJSON files into data/translations/.  The Electron app seeds from these
 * files on first launch (no Node.js ↔ Electron ABI conflict).
 *
 * Sources
 *   1. eBible.org  — 600+ public-domain / CC translations (USFM zips)
 *   2. TheBibleAPI — 40+ translations via REST JSON (no API key required)
 *
 * Output
 *   data/translations/index.json           — metadata for every translation
 *   data/translations/{ID}.ndjson          — one JSON line per verse
 *      {"b":1,"c":1,"v":1,"t":"In the beginning…"}
 *
 * Usage
 *   pnpm translations              # all languages
 *   pnpm translations:en           # English only
 *   pnpm translations -- --limit 5 # first 5 translations only
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
// Resolve relative to repo root regardless of where the script is invoked from
const REPO_ROOT    = path.resolve(__dirname, '..');
const DATA_DIR     = path.join(REPO_ROOT, 'data', 'translations');
const INDEX_FILE   = path.join(REPO_ROOT, 'data', 'translations', 'index.json');
const TMP_DIR      = path.join(os.tmpdir(), 'ltm-translations');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR,  { recursive: true });

// ── USFM book code → numeric book ID (1-based canonical order) ───────────────
const USFM_TO_ID: Record<string, number> = {
  GEN:1,EXO:2,LEV:3,NUM:4,DEU:5,JOS:6,JDG:7,RUT:8,'1SA':9,'2SA':10,
  '1KI':11,'2KI':12,'1CH':13,'2CH':14,EZR:15,NEH:16,EST:17,JOB:18,PSA:19,
  PRO:20,ECC:21,SNG:22,ISA:23,JER:24,LAM:25,EZK:26,DAN:27,HOS:28,
  JOL:29,AMO:30,OBA:31,JON:32,MIC:33,NAM:34,HAB:35,ZEP:36,HAG:37,
  ZEC:38,MAL:39,
  MAT:40,MRK:41,LUK:42,JHN:43,ACT:44,ROM:45,'1CO':46,'2CO':47,GAL:48,
  EPH:49,PHP:50,COL:51,'1TH':52,'2TH':53,'1TI':54,'2TI':55,TIT:56,
  PHM:57,HEB:58,JAS:59,'1PE':60,'2PE':61,'1JN':62,'2JN':63,'3JN':64,
  JUD:65,REV:66,
};

// ── Translation definitions ───────────────────────────────────────────────────

interface TransMeta {
  id: string;
  name: string;
  language: string;
  source: string;
  license: string;
}

const EBIBLE_LIST: (TransMeta & { code: string })[] = [
  // English — public domain / CC
  { code:'eng-kjv',       id:'KJV',   name:'King James Version (1769)',          language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-asv',       id:'ASV',   name:'American Standard Version (1901)',   language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-web',       id:'WEB',   name:'World English Bible',                language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-webbe',     id:'WEBBE', name:'World English Bible (British Ed.)',  language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-ylt',       id:'YLT',   name:"Young's Literal Translation",        language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-darby',     id:'DARBY', name:'Darby Bible Translation (1890)',     language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-bbe',       id:'BBE',   name:'Bible in Basic English',             language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-gnv',       id:'GNV',   name:'Geneva Bible (1599)',                language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-dra',       id:'DRA',   name:'Douay-Rheims (1899)',                language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-rv',        id:'RV',    name:'Revised Version (1885)',             language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-jps',       id:'JPS',   name:'JPS Tanakh (1917)',                  language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-rotherham', id:'ROT',   name:'Rotherham Emphasized Bible',        language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-weymouth',  id:'WEY',   name:'Weymouth New Testament',            language:'en', source:'ebible', license:'Public Domain' },
  { code:'eng-lxx',       id:'LXXE',  name:'Brenton Septuagint in English',    language:'en', source:'ebible', license:'Public Domain' },
  // Spanish
  { code:'spa-rv1909',    id:'RV09',  name:'Reina-Valera 1909',                  language:'es', source:'ebible', license:'Public Domain' },
  { code:'spa-rvg',       id:'RVG',   name:'Reina Valera Gómez',                language:'es', source:'ebible', license:'CC' },
  { code:'spa-sblh',      id:'SBLH',  name:'Santa Biblia',                       language:'es', source:'ebible', license:'CC' },
  // French
  { code:'fra-ls1910',    id:'LS10',  name:'Louis Segond 1910',                  language:'fr', source:'ebible', license:'Public Domain' },
  { code:'fra-pdv2017',   id:'PDV',   name:'Parole de Vie 2017',                language:'fr', source:'ebible', license:'CC' },
  // German
  { code:'deu-luth1545',  id:'LUT45', name:'Luther Bibel 1545',                  language:'de', source:'ebible', license:'Public Domain' },
  { code:'deu-schlachter',id:'SCH',   name:'Schlachter 1951',                   language:'de', source:'ebible', license:'CC' },
  // Portuguese
  { code:'por-almeida',   id:'ARA',   name:'Almeida Revista e Atualizada',       language:'pt', source:'ebible', license:'CC' },
  // Chinese
  { code:'zho-cunp',      id:'CUNP',  name:'Chinese Union Version (Simplified)', language:'zh', source:'ebible', license:'CC' },
  { code:'zho-cupt',      id:'CUPT',  name:'Chinese Union Version (Traditional)',language:'zh', source:'ebible', license:'CC' },
  // Korean
  { code:'kor-korean',    id:'KOR',   name:'Korean (개역개정)',                   language:'ko', source:'ebible', license:'CC' },
  // Arabic
  { code:'arb-vandyke',   id:'VANDY', name:'Van Dyke Arabic Bible',             language:'ar', source:'ebible', license:'Public Domain' },
  // Russian
  { code:'rus-synod',     id:'SYNOD', name:'Russian Synodal Bible',             language:'ru', source:'ebible', license:'Public Domain' },
  // Swahili
  { code:'swh-union',     id:'SWH',   name:'Swahili Union Version',             language:'sw', source:'ebible', license:'CC' },
  // Hindi
  { code:'hin-irv',       id:'HIRV',  name:'Hindi IRV',                         language:'hi', source:'ebible', license:'CC' },
  // Yoruba
  { code:'yor-bible',     id:'YOR',   name:'Yoruba Bible',                      language:'yo', source:'ebible', license:'CC' },
  // Igbo
  { code:'ibo-bible',     id:'IBO',   name:'Igbo Bible',                        language:'ig', source:'ebible', license:'CC' },
  // Hausa
  { code:'hau-bible',     id:'HAU',   name:'Hausa Bible',                       language:'ha', source:'ebible', license:'CC' },
  // Amharic
  { code:'amh-haile',     id:'AMH',   name:'Amharic Haile Bible',               language:'am', source:'ebible', license:'CC' },
  // Tagalog
  { code:'tgl-ang',       id:'TGLA',  name:'Ang Biblia (Tagalog)',              language:'tl', source:'ebible', license:'Public Domain' },
  // Japanese
  { code:'jpn-jlb',       id:'JLB',   name:'Japanese Living Bible',             language:'ja', source:'ebible', license:'CC' },
];

const THE_BIBLE_API_LIST: TransMeta[] = [
  { id:'NIV',   name:'New International Version',         language:'en', source:'thebibleapi', license:'see source' },
  { id:'NLT',   name:'New Living Translation',            language:'en', source:'thebibleapi', license:'see source' },
  { id:'ESV',   name:'English Standard Version',          language:'en', source:'thebibleapi', license:'see source' },
  { id:'NKJV',  name:'New King James Version',            language:'en', source:'thebibleapi', license:'see source' },
  { id:'NRSV',  name:'New Revised Standard Version',      language:'en', source:'thebibleapi', license:'see source' },
  { id:'MSG',   name:'The Message',                       language:'en', source:'thebibleapi', license:'see source' },
  { id:'AMP',   name:'Amplified Bible',                   language:'en', source:'thebibleapi', license:'see source' },
  { id:'NASB',  name:'New American Standard Bible',       language:'en', source:'thebibleapi', license:'see source' },
  { id:'CSB',   name:'Christian Standard Bible',          language:'en', source:'thebibleapi', license:'see source' },
  { id:'HCSB',  name:'Holman Christian Standard Bible',   language:'en', source:'thebibleapi', license:'see source' },
  { id:'CEV',   name:'Contemporary English Version',      language:'en', source:'thebibleapi', license:'see source' },
  { id:'CEB',   name:'Common English Bible',              language:'en', source:'thebibleapi', license:'see source' },
  { id:'GW',    name:"God's Word Translation",            language:'en', source:'thebibleapi', license:'see source' },
  { id:'NCV',   name:'New Century Version',               language:'en', source:'thebibleapi', license:'see source' },
  { id:'GNT',   name:'Good News Translation',             language:'en', source:'thebibleapi', license:'see source' },
  { id:'NET',   name:'New English Translation',           language:'en', source:'thebibleapi', license:'see source' },
  { id:'LSV',   name:'Literal Standard Version',          language:'en', source:'thebibleapi', license:'Public Domain' },
  { id:'BSB',   name:'Berean Standard Bible',             language:'en', source:'thebibleapi', license:'CC BY-SA' },
  { id:'TLV',   name:'Tree of Life Version',              language:'en', source:'thebibleapi', license:'see source' },
  { id:'OEB',   name:'Open English Bible',                language:'en', source:'thebibleapi', license:'Public Domain' },
];

// ── Book chapter counts (needed for chapter-by-chapter API download) ──────────
const CHAPTER_COUNTS: Record<number, number> = {
  1:50,2:40,3:27,4:36,5:34,6:24,7:21,8:4,9:31,10:24,11:22,12:25,
  13:29,14:36,15:10,16:13,17:10,18:42,19:150,20:31,21:12,22:8,
  23:66,24:52,25:5,26:48,27:12,28:14,29:3,30:9,31:1,32:4,33:7,
  34:3,35:3,36:3,37:2,38:14,39:4,40:28,41:16,42:24,43:21,44:28,
  45:16,46:16,47:13,48:6,49:6,50:4,51:4,52:5,53:5,54:6,55:4,
  56:3,57:1,58:13,59:5,60:5,61:3,62:5,63:1,64:1,65:1,66:22,
};

const API_BOOK_SLUGS: Record<number, string> = {
  1:'genesis',2:'exodus',3:'leviticus',4:'numbers',5:'deuteronomy',
  6:'joshua',7:'judges',8:'ruth',9:'1-samuel',10:'2-samuel',
  11:'1-kings',12:'2-kings',13:'1-chronicles',14:'2-chronicles',
  15:'ezra',16:'nehemiah',17:'esther',18:'job',19:'psalms',
  20:'proverbs',21:'ecclesiastes',22:'song-of-solomon',23:'isaiah',
  24:'jeremiah',25:'lamentations',26:'ezekiel',27:'daniel',28:'hosea',
  29:'joel',30:'amos',31:'obadiah',32:'jonah',33:'micah',34:'nahum',
  35:'habakkuk',36:'zephaniah',37:'haggai',38:'zechariah',39:'malachi',
  40:'matthew',41:'mark',42:'luke',43:'john',44:'acts',45:'romans',
  46:'1-corinthians',47:'2-corinthians',48:'galatians',49:'ephesians',
  50:'philippians',51:'colossians',52:'1-thessalonians',53:'2-thessalonians',
  54:'1-timothy',55:'2-timothy',56:'titus',57:'philemon',58:'hebrews',
  59:'james',60:'1-peter',61:'2-peter',62:'1-john',63:'2-john',
  64:'3-john',65:'jude',66:'revelation',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'LeadMeToHim/1.0 (+https://github.com/leadmetohim)' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (loc) { resolve(fetchText(loc)); return; }
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
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
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        const loc = res.headers.location;
        if (loc) { resolve(downloadFile(loc, dest)); return; }
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

// ── USFM parser → verse lines ─────────────────────────────────────────────────

interface VerseLine { b: number; c: number; v: number; t: string }

function parseUsfmDir(dir: string): VerseLine[] {
  const out: VerseLine[] = [];
  const files = fs.readdirSync(dir).filter((f) =>
    /\.(usfm|sfm|SFM)$/i.test(f),
  );

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    let bookId = 0;
    let chapter = 0;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();

      const idM = line.match(/^\\id\s+([A-Z0-9]+)/i);
      if (idM) { bookId = USFM_TO_ID[idM[1]!.toUpperCase()] ?? 0; continue; }

      const chapM = line.match(/^\\c\s+(\d+)/);
      if (chapM) { chapter = parseInt(chapM[1]!, 10); continue; }

      const vM = line.match(/^\\v\s+(\d+)\s+(.*)/);
      if (vM && bookId > 0 && chapter > 0) {
        const verseNum = parseInt(vM[1]!, 10);
        const text = (vM[2] ?? '').replace(/\\[a-z]+\*?/g, '').replace(/\|/g, '').trim();
        if (text.length > 1) out.push({ b: bookId, c: chapter, v: verseNum, t: text });
      }
    }
  }

  return out;
}

// ── Index helpers ─────────────────────────────────────────────────────────────

interface Index {
  translations: TransMeta[];
}

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

// ── eBible.org downloader ─────────────────────────────────────────────────────

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

    // USFM files may be in a subdirectory named after the translation code
    let usfmDir = outDir;
    const subdirs = fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (subdirs.length > 0) usfmDir = path.join(outDir, subdirs[0]!.name);

    console.log(`  [parse]    ${trans.code}`);
    const verses = parseUsfmDir(usfmDir);

    if (verses.length < 100) {
      console.warn(`  [warn]     ${trans.id}: only ${verses.length} verses — skipping`);
      return false;
    }

    console.log(`  [write]    ${verses.length.toLocaleString()} verses → data/translations/${trans.id}.ndjson`);
    writeNdjson(trans.id, verses);

    const meta: TransMeta = { id: trans.id, name: trans.name, language: trans.language, source: trans.source, license: trans.license };
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

// ── TheBibleAPI downloader ────────────────────────────────────────────────────

const THE_API_BASE = 'https://thebibleapi.netlify.app/api';
const BOOK_IDS = Array.from({ length: 66 }, (_, i) => i + 1);

async function downloadTheBibleApi(
  index: Index,
  trans: TransMeta,
): Promise<boolean> {
  if (isAlreadyDownloaded(index, trans.id)) {
    console.log(`  [skip]     ${trans.id} — already downloaded`);
    return true;
  }

  console.log(`  [api]      ${trans.id} — ${trans.name}`);
  const verses: VerseLine[] = [];
  let failures = 0;

  const slug = trans.id.toLowerCase();

  for (const bookId of BOOK_IDS) {
    const bookSlug  = API_BOOK_SLUGS[bookId]!;
    const chapCount = CHAPTER_COUNTS[bookId] ?? 0;

    for (let ch = 1; ch <= chapCount; ch++) {
      const url = `${THE_API_BASE}/bible/${slug}/${bookSlug}/${ch}`;
      try {
        const raw  = await fetchText(url);
        const data = JSON.parse(raw) as { verses?: Array<{ verse: number; text: string }> };
        for (const vv of data.verses ?? []) {
          if (vv.text) verses.push({ b: bookId, c: ch, v: vv.verse, t: vv.text.trim() });
        }
        await sleep(200);
      } catch {
        failures++;
        if (failures > 30) {
          console.warn(`  [abort]    ${trans.id}: too many failures`);
          return false;
        }
        await sleep(500);
      }
    }
  }

  if (verses.length < 1000) {
    console.warn(`  [warn]     ${trans.id}: only ${verses.length} verses — skipping`);
    return false;
  }

  console.log(`  [write]    ${verses.length.toLocaleString()} verses → data/translations/${trans.id}.ndjson`);
  writeNdjson(trans.id, verses);
  index.translations.push(trans);
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

  // Phase 1: eBible.org ────────────────────────────────────────────────────────
  const ebibleList = (langFilter ? EBIBLE_LIST.filter((t) => t.language === langFilter) : EBIBLE_LIST)
    .slice(0, limitArg);

  console.log(`Phase 1 — eBible.org (${ebibleList.length} translations)\n`);
  for (const trans of ebibleList) {
    const ok = await downloadEbible(index, trans);
    if (ok) downloaded++;
    else failed++;
    await sleep(300);
  }

  // Phase 2: TheBibleAPI ───────────────────────────────────────────────────────
  if (!langFilter || langFilter === 'en') {
    const apiList = THE_BIBLE_API_LIST.slice(0, Math.max(0, limitArg - EBIBLE_LIST.length));
    if (apiList.length > 0) {
      console.log(`\nPhase 2 — TheBibleAPI (${apiList.length} translations)\n`);
      for (const trans of apiList) {
        const ok = await downloadTheBibleApi(index, trans);
        if (ok) downloaded++;
        else failed++;
      }
    }
  }

  console.log(`
=== Done ===
  Translations downloaded : ${downloaded}
  Failed / skipped        : ${failed}
  Total in index          : ${index.translations.length}
  Output folder           : ${DATA_DIR}

Start the app with "pnpm dev" — it will automatically import any new
translation files into the local database on first launch.
`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
