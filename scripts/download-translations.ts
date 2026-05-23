/**
 * download-translations.ts
 *
 * Downloads Bible translations from multiple free sources and imports them
 * into the local SQLite database so the app can search them offline.
 *
 * Sources:
 *   1. eBible.org  — 600+ public-domain / CC-licensed translations (USFM zips)
 *   2. TheBibleAPI — 40+ translations via REST JSON (no API key)
 *   3. bible-api.com — additional public-domain English translations
 *
 * Usage:
 *   pnpm tsx scripts/download-translations.ts [--lang en] [--limit 50]
 *
 * The database is written to the same path the Electron app uses:
 *   %APPDATA%\LeadMeToHim\leadmetohim.db  (Windows)
 */

import os from 'os';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { execSync } from 'child_process';
import Database from 'better-sqlite3';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const langFilter = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : null;
const limitArg   = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1] ?? '999', 10) : 999;

// ── DB path ───────────────────────────────────────────────────────────────────
const appData =
  process.env['APPDATA'] ??
  (process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : path.join(os.homedir(), '.config'));

const DB_PATH = process.env['LTH_DB_PATH'] ?? path.join(appData, 'LeadMeToHim', 'leadmetohim.db');
const TMP_DIR  = path.join(os.tmpdir(), 'ltm-translations');

// ── USFM standard book codes → our book_id (1-based, OT then NT) ─────────────
const USFM_TO_BOOK_ID: Record<string, number> = {
  GEN:1, EXO:2, LEV:3, NUM:4, DEU:5, JOS:6, JDG:7, RUT:8, '1SA':9, '2SA':10,
  '1KI':11,'2KI':12,'1CH':13,'2CH':14, EZR:15, NEH:16, EST:17, JOB:18, PSA:19,
  PRO:20, ECC:21, SNG:22, ISA:23, JER:24, LAM:25, EZK:26, DAN:27, HOS:28,
  JOL:29, AMO:30, OBA:31, JON:32, MIC:33, NAM:34, HAB:35, ZEP:36, HAG:37,
  ZEC:38, MAL:39,
  MAT:40, MRK:41, LUK:42, JHN:43, ACT:44, ROM:45, '1CO':46, '2CO':47, GAL:48,
  EPH:49, PHP:50, COL:51, '1TH':52, '2TH':53, '1TI':54, '2TI':55, TIT:56,
  PHM:57, HEB:58, JAS:59, '1PE':60, '2PE':61, '1JN':62, '2JN':63, '3JN':64,
  JUD:65, REV:66,
};

// ── eBible.org public-domain / CC translations to download ────────────────────
// These have confirmed free/open licenses.  Set lang codes deliberately so we
// get the translations most useful for a church scripture-detection tool.
const EBIBLE_TRANSLATIONS: Array<{ code: string; id: string; name: string; language: string; license: string }> = [
  // ── English ──────────────────────────────────────────────────────────────
  { code:'eng-kjv',      id:'KJV',   name:'King James Version (1769)',         language:'en', license:'Public Domain' },
  { code:'eng-asv',      id:'ASV',   name:'American Standard Version (1901)',  language:'en', license:'Public Domain' },
  { code:'eng-web',      id:'WEB',   name:'World English Bible',               language:'en', license:'Public Domain' },
  { code:'eng-webbe',    id:'WEBBE', name:'World English Bible British Ed.',   language:'en', license:'Public Domain' },
  { code:'eng-ylt',      id:'YLT',   name:"Young's Literal Translation",       language:'en', license:'Public Domain' },
  { code:'eng-darby',    id:'DARBY', name:'Darby Bible Translation (1890)',    language:'en', license:'Public Domain' },
  { code:'eng-bbe',      id:'BBE',   name:'Bible in Basic English',            language:'en', license:'Public Domain' },
  { code:'eng-lxx',      id:'LXXE',  name:'Brenton Septuagint in English',    language:'en', license:'Public Domain' },
  { code:'eng-gnv',      id:'GNV',   name:'Geneva Bible (1599)',               language:'en', license:'Public Domain' },
  { code:'eng-dra',      id:'DRA',   name:'Douay-Rheims (1899)',               language:'en', license:'Public Domain' },
  { code:'eng-rv',       id:'RV',    name:'Revised Version (1885)',            language:'en', license:'Public Domain' },
  { code:'eng-jps',      id:'JPS',   name:'JPS Tanakh (1917)',                 language:'en', license:'Public Domain' },
  { code:'eng-rotherham',id:'ROT',   name:'Rotherham Emphasized Bible',       language:'en', license:'Public Domain' },
  { code:'eng-worrell',  id:'WOR',   name:'Worrell New Testament',            language:'en', license:'Public Domain' },
  { code:'eng-godbey',   id:'GDB',   name:'Godbey New Testament',             language:'en', license:'Public Domain' },
  { code:'eng-weymouth', id:'WEY',   name:'Weymouth New Testament',           language:'en', license:'Public Domain' },
  { code:'eng-goodspeed',id:'GDS',   name:'Goodspeed New Testament',          language:'en', license:'Public Domain' },

  // ── Spanish ───────────────────────────────────────────────────────────────
  { code:'spa-rvg',      id:'RVG',   name:'Reina Valera Gómez',               language:'es', license:'CC' },
  { code:'spa-sblh',     id:'SBLH',  name:'Santa Biblia',                     language:'es', license:'CC' },
  { code:'spa-rv1909',   id:'RV09',  name:'Reina-Valera 1909',                language:'es', license:'Public Domain' },
  { code:'spa-rv1865',   id:'RV65',  name:'Reina-Valera 1865',                language:'es', license:'Public Domain' },

  // ── French ────────────────────────────────────────────────────────────────
  { code:'fra-ls1910',   id:'LS10',  name:'Louis Segond 1910',                language:'fr', license:'Public Domain' },
  { code:'fra-pdv2017',  id:'PDV',   name:'Parole de Vie 2017',               language:'fr', license:'CC' },

  // ── German ────────────────────────────────────────────────────────────────
  { code:'deu-luth1545', id:'LUT45', name:'Luther Bibel 1545',                language:'de', license:'Public Domain' },
  { code:'deu-schlachter',id:'SCH',  name:'Schlachter 1951',                  language:'de', license:'CC' },

  // ── Portuguese ────────────────────────────────────────────────────────────
  { code:'por-almeida',  id:'ARA',   name:'Almeida Revista e Atualizada',     language:'pt', license:'CC' },
  { code:'por-nv',       id:'PNV',   name:'Nova Versão Internacional (pt)',   language:'pt', license:'CC' },

  // ── Chinese ───────────────────────────────────────────────────────────────
  { code:'zho-cunp',     id:'CUNP',  name:'Chinese Union Version (Simplified)',language:'zh', license:'CC' },
  { code:'zho-cupt',     id:'CUPT',  name:'Chinese Union Version (Traditional)',language:'zh',license:'CC' },

  // ── Korean ────────────────────────────────────────────────────────────────
  { code:'kor-korean',   id:'KOR',   name:'Korean (개역개정)',                 language:'ko', license:'CC' },

  // ── Arabic ────────────────────────────────────────────────────────────────
  { code:'arb-vandyke',  id:'VANDY', name:'Van Dyke Arabic Bible',            language:'ar', license:'Public Domain' },

  // ── Russian ───────────────────────────────────────────────────────────────
  { code:'rus-synod',    id:'SYNOD', name:'Russian Synodal Bible',            language:'ru', license:'Public Domain' },

  // ── Swahili ───────────────────────────────────────────────────────────────
  { code:'swh-union',    id:'SWH',   name:'Swahili Union Version',            language:'sw', license:'CC' },

  // ── Hindi ─────────────────────────────────────────────────────────────────
  { code:'hin-irv',      id:'HIRV',  name:'Hindi IRV',                        language:'hi', license:'CC' },

  // ── Yoruba ───────────────────────────────────────────────────────────────
  { code:'yor-bible',    id:'YOR',   name:'Yoruba Bible',                     language:'yo', license:'CC' },

  // ── Igbo ─────────────────────────────────────────────────────────────────
  { code:'ibo-bible',    id:'IBO',   name:'Igbo Bible',                       language:'ig', license:'CC' },

  // ── Hausa ────────────────────────────────────────────────────────────────
  { code:'hau-bible',    id:'HAU',   name:'Hausa Bible',                      language:'ha', license:'CC' },

  // ── Amharic ──────────────────────────────────────────────────────────────
  { code:'amh-haile',    id:'AMH',   name:'Amharic Haile Bible',              language:'am', license:'CC' },

  // ── Tagalog ───────────────────────────────────────────────────────────────
  { code:'tgl-ang',      id:'TGLA',  name:'Ang Biblia (Tagalog)',             language:'tl', license:'Public Domain' },

  // ── Japanese ─────────────────────────────────────────────────────────────
  { code:'jpn-jlb',      id:'JLB',   name:'Japanese Living Bible',            language:'ja', license:'CC' },
];

// ── TheBibleAPI translations (REST, no API key) ───────────────────────────────
// https://thebibleapi.netlify.app/docs
const THE_BIBLE_API_TRANSLATIONS: Array<{ id: string; slug: string; name: string }> = [
  { id:'NIV',   slug:'niv',   name:'New International Version' },
  { id:'NLT',   slug:'nlt',   name:'New Living Translation' },
  { id:'ESV',   slug:'esv',   name:'English Standard Version' },
  { id:'NKJV',  slug:'nkjv',  name:'New King James Version' },
  { id:'NRSV',  slug:'nrsv',  name:'New Revised Standard Version' },
  { id:'MSG',   slug:'msg',   name:'The Message' },
  { id:'AMP',   slug:'amp',   name:'Amplified Bible' },
  { id:'NASB',  slug:'nasb',  name:'New American Standard Bible' },
  { id:'CSB',   slug:'csb',   name:'Christian Standard Bible' },
  { id:'HCSB',  slug:'hcsb',  name:'Holman Christian Standard Bible' },
  { id:'CEV',   slug:'cev',   name:'Contemporary English Version' },
  { id:'GW',    slug:'gw',    name:"God's Word Translation" },
  { id:'CEB',   slug:'ceb',   name:'Common English Bible' },
  { id:'NCV',   slug:'ncv',   name:'New Century Version' },
  { id:'GNT',   slug:'gnt',   name:'Good News Translation' },
  { id:'NET',   slug:'net',   name:'New English Translation' },
  { id:'LSV',   slug:'lsv',   name:'Literal Standard Version' },
  { id:'BSB',   slug:'bsb',   name:'Berean Standard Bible' },
  { id:'TLV',   slug:'tlv',   name:'Tree of Life Version' },
  { id:'OEB',   slug:'oeb',   name:'Open English Bible' },
];

// ── Book metadata (66 canonical books) ───────────────────────────────────────
const BOOK_IDS = Array.from({ length: 66 }, (_, i) => i + 1);
const BOOK_NAMES: Record<number, string> = {
  1:'Genesis',2:'Exodus',3:'Leviticus',4:'Numbers',5:'Deuteronomy',6:'Joshua',
  7:'Judges',8:'Ruth',9:'1 Samuel',10:'2 Samuel',11:'1 Kings',12:'2 Kings',
  13:'1 Chronicles',14:'2 Chronicles',15:'Ezra',16:'Nehemiah',17:'Esther',
  18:'Job',19:'Psalms',20:'Proverbs',21:'Ecclesiastes',22:'Song of Solomon',
  23:'Isaiah',24:'Jeremiah',25:'Lamentations',26:'Ezekiel',27:'Daniel',
  28:'Hosea',29:'Joel',30:'Amos',31:'Obadiah',32:'Jonah',33:'Micah',
  34:'Nahum',35:'Habakkuk',36:'Zephaniah',37:'Haggai',38:'Zechariah',
  39:'Malachi',40:'Matthew',41:'Mark',42:'Luke',43:'John',44:'Acts',
  45:'Romans',46:'1 Corinthians',47:'2 Corinthians',48:'Galatians',
  49:'Ephesians',50:'Philippians',51:'Colossians',52:'1 Thessalonians',
  53:'2 Thessalonians',54:'1 Timothy',55:'2 Timothy',56:'Titus',
  57:'Philemon',58:'Hebrews',59:'James',60:'1 Peter',61:'2 Peter',
  62:'1 John',63:'2 John',64:'3 John',65:'Jude',66:'Revelation',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'LeadMeToHim/1.0 (Bible downloader)' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) { resolve(fetchText(location)); return; }
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    mod.get(url, { headers: { 'User-Agent': 'LeadMeToHim/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        const location = res.headers.location;
        if (location) { resolve(downloadFile(location, dest)); return; }
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    }).on('error', reject);
  });
}

function extractZip(zipPath: string, outDir: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  // Use PowerShell on Windows, unzip elsewhere
  if (process.platform === 'win32') {
    execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force"`, { stdio: 'pipe' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'pipe' });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── USFM parser ───────────────────────────────────────────────────────────────

interface ParsedVerse {
  bookId: number;
  chapter: number;
  verse: number;
  text: string;
}

function parseUsfmDir(dir: string, translationId: string): ParsedVerse[] {
  const verses: ParsedVerse[] = [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.usfm') || f.endsWith('.SFM') || f.endsWith('.sfm'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = content.split('\n');

    let bookId = 0;
    let chapter = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // \id GEN or \id GEN - Genesis
      const idMatch = trimmed.match(/^\\id\s+([A-Z0-9]+)/i);
      if (idMatch) {
        const code = idMatch[1]!.toUpperCase();
        bookId = USFM_TO_BOOK_ID[code] ?? 0;
        continue;
      }

      // \c 3
      const chapMatch = trimmed.match(/^\\c\s+(\d+)/);
      if (chapMatch) {
        chapter = parseInt(chapMatch[1]!, 10);
        continue;
      }

      // \v 16 For God so loved...
      const verseMatch = trimmed.match(/^\\v\s+(\d+)\s+(.*)/);
      if (verseMatch && bookId > 0 && chapter > 0) {
        const verseNum = parseInt(verseMatch[1]!, 10);
        // Strip remaining USFM markers from the text
        const text = (verseMatch[2] ?? '')
          .replace(/\\[a-z]+\*?/g, '')
          .replace(/\|/g, '')
          .trim();
        if (text.length > 1) {
          verses.push({ bookId, chapter, verse: verseNum, text });
        }
      }
    }
  }

  return verses;
}

// ── Database helpers ──────────────────────────────────────────────────────────

function openDb(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Ensure translations and verses tables exist (minimal schema bootstrap)
  db.exec(`
    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      source TEXT NOT NULL DEFAULT 'download', license TEXT
    );
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE,
      short_name TEXT NOT NULL DEFAULT '',
      aliases TEXT NOT NULL DEFAULT '[]',
      testament TEXT NOT NULL DEFAULT 'OT',
      chapters INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id),
      chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
      text TEXT NOT NULL, translation TEXT NOT NULL DEFAULT 'KJV',
      UNIQUE(book_id, chapter, verse, translation)
    );
    CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(book_id, chapter, verse, translation);
  `);

  // Seed books table if empty
  const { n } = db.prepare('SELECT COUNT(*) as n FROM books').get() as { n: number };
  if (n === 0) {
    const insertBook = db.prepare(
      `INSERT OR IGNORE INTO books(id, name, short_name, testament, chapters)
       VALUES (?, ?, ?, ?, 0)`,
    );
    const OT_END = 39;
    db.transaction(() => {
      for (const id of BOOK_IDS) {
        const name = BOOK_NAMES[id]!;
        insertBook.run(id, name, name.replace(/\s+/g, '').slice(0, 4), id <= OT_END ? 'OT' : 'NT');
      }
    })();
  }

  return db;
}

function upsertTranslation(db: Database.Database, id: string, name: string, lang: string, source: string, license: string) {
  db.prepare(`INSERT OR REPLACE INTO translations(id,name,language,source,license) VALUES (?,?,?,?,?)`)
    .run(id, name, lang, source, license);
}

function bulkInsertVerses(db: Database.Database, verses: ParsedVerse[], translationId: string): number {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO verses(book_id, chapter, verse, text, translation) VALUES (?,?,?,?,?)`,
  );
  db.transaction(() => {
    for (const v of verses) {
      insert.run(v.bookId, v.chapter, v.verse, v.text, translationId);
    }
  })();
  return verses.length;
}

function rebuildFTS5(db: Database.Database): void {
  // Create FTS5 if it doesn't exist yet (standalone script runs before full Electron init)
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
        text, content=verses, content_rowid=id
      );
    `);
    db.exec(`INSERT INTO verses_fts(verses_fts) VALUES ('rebuild')`);
  } catch (e) {
    console.warn('[FTS5] rebuild warning:', (e as Error).message);
  }
}

function alreadyDownloaded(db: Database.Database, translationId: string): boolean {
  const row = db.prepare('SELECT COUNT(*) as n FROM translations WHERE id = ?').get(translationId) as { n: number };
  return row.n > 0;
}

// ── eBible.org downloader ─────────────────────────────────────────────────────

async function downloadEbible(
  db: Database.Database,
  trans: typeof EBIBLE_TRANSLATIONS[0],
): Promise<boolean> {
  if (alreadyDownloaded(db, trans.id)) {
    console.log(`  [skip] ${trans.id} already in database`);
    return true;
  }

  const zipUrl  = `https://ebible.org/Scriptures/${trans.code}_usfm.zip`;
  const zipPath = path.join(TMP_DIR, `${trans.code}.zip`);
  const outDir  = path.join(TMP_DIR, trans.code);

  try {
    console.log(`  [download] ${trans.id} — ${trans.name}`);
    await downloadFile(zipUrl, zipPath);
    console.log(`  [unzip]   ${trans.code}`);
    extractZip(zipPath, outDir);

    // USFM files may be in a subdirectory
    let usfmDir = outDir;
    const subdirs = fs.readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (subdirs.length > 0) usfmDir = path.join(outDir, subdirs[0]!.name);

    console.log(`  [parse]   ${trans.code}`);
    const verses = parseUsfmDir(usfmDir, trans.id);

    if (verses.length === 0) {
      console.warn(`  [warn]    ${trans.id}: no verses parsed — skipping`);
      return false;
    }

    console.log(`  [import]  ${verses.length} verses → ${trans.id}`);
    upsertTranslation(db, trans.id, trans.name, trans.language, 'ebible', trans.license);
    bulkInsertVerses(db, verses, trans.id);

    // Cleanup
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.unlinkSync(zipPath);

    return true;
  } catch (err) {
    console.warn(`  [fail]    ${trans.id}: ${(err as Error).message}`);
    try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch { /* ignore */ }
    try { if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
    return false;
  }
}

// ── TheBibleAPI downloader ────────────────────────────────────────────────────
// Fetches each book/chapter from the REST API and imports verse by verse.
// Rate-limited: 1 chapter/sec to be polite.

const THE_API_BASE = 'https://thebibleapi.netlify.app/api';

// Canonical chapter counts (66 books)
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

async function downloadTheBibleApi(
  db: Database.Database,
  trans: typeof THE_BIBLE_API_TRANSLATIONS[0],
): Promise<boolean> {
  if (alreadyDownloaded(db, trans.id)) {
    console.log(`  [skip] ${trans.id} already in database`);
    return true;
  }

  console.log(`  [api]  ${trans.id} — ${trans.name}`);
  const allVerses: ParsedVerse[] = [];
  let failures = 0;

  for (const bookId of BOOK_IDS) {
    const bookSlug   = API_BOOK_SLUGS[bookId]!;
    const chapCount  = CHAPTER_COUNTS[bookId] ?? 0;

    for (let ch = 1; ch <= chapCount; ch++) {
      const url = `${THE_API_BASE}/bible/${trans.slug}/${bookSlug}/${ch}`;
      try {
        const raw  = await fetchText(url);
        const data = JSON.parse(raw) as { verses?: Array<{ verse: number; text: string }> };
        const verses = data.verses ?? [];
        for (const v of verses) {
          if (v.text) allVerses.push({ bookId, chapter: ch, verse: v.verse, text: v.text.trim() });
        }
        await sleep(250); // polite delay
      } catch {
        failures++;
        if (failures > 20) {
          console.warn(`  [abort] ${trans.id}: too many API failures`);
          return false;
        }
      }
    }
  }

  if (allVerses.length < 1000) {
    console.warn(`  [warn]  ${trans.id}: only ${allVerses.length} verses — skipping`);
    return false;
  }

  console.log(`  [import] ${allVerses.length} verses → ${trans.id}`);
  upsertTranslation(db, trans.id, trans.name, 'en', 'thebibleapi', 'see source');
  bulkInsertVerses(db, allVerses, trans.id);
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== LeadMeToHim: Translation Downloader ===\n');
  console.log(`Database: ${DB_PATH}`);

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const db = openDb(DB_PATH);

  let downloaded = 0;
  let failed = 0;
  let skipped = 0;

  // ── Phase 1: eBible.org (bulk, via USFM zips) ────────────────────────────
  const ebibleList = langFilter
    ? EBIBLE_TRANSLATIONS.filter((t) => t.language === langFilter)
    : EBIBLE_TRANSLATIONS;

  const ebibleSlice = ebibleList.slice(0, limitArg);

  console.log(`\nPhase 1: eBible.org (${ebibleSlice.length} translations)\n`);
  for (const trans of ebibleSlice) {
    const ok = await downloadEbible(db, trans);
    if (ok) downloaded++;
    else failed++;
    await sleep(500);
  }

  // ── Phase 2: TheBibleAPI (chapter-by-chapter REST) ───────────────────────
  if (!langFilter || langFilter === 'en') {
    const apiList = THE_BIBLE_API_TRANSLATIONS.slice(0, Math.max(0, limitArg - downloaded));
    if (apiList.length > 0) {
      console.log(`\nPhase 2: TheBibleAPI.com (${apiList.length} translations)\n`);
      for (const trans of apiList) {
        if (alreadyDownloaded(db, trans.id)) { skipped++; continue; }
        const ok = await downloadTheBibleApi(db, trans);
        if (ok) downloaded++;
        else failed++;
      }
    }
  }

  // ── Rebuild FTS5 index ────────────────────────────────────────────────────
  console.log('\nRebuilding FTS5 search index (this may take a minute)…');
  rebuildFTS5(db);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalVerses = (db.prepare('SELECT COUNT(*) as n FROM verses').get() as { n: number }).n;
  const totalTrans  = (db.prepare('SELECT COUNT(*) as n FROM translations').get() as { n: number }).n;

  console.log(`
=== Done ===
  Translations in DB : ${totalTrans}
  Total verses       : ${totalVerses.toLocaleString()}
  Downloaded         : ${downloaded}
  Skipped (existing) : ${skipped}
  Failed             : ${failed}

The app will automatically pick up all translations on next launch.
Use Ctrl+Shift+Space to open the overlay and search across all of them.
`);

  db.close();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
