import type { BibleBook } from '@leadmetohim/shared-types';

export const BIBLE_BOOKS: BibleBook[] = [
  // ── Old Testament ─────────────────────────────────────────────────────────
  { id: 1,  name: 'Genesis',          shortName: 'Gen',   aliases: ['gen','genesis','gn'],                               testament: 'OT', chapters: 50  },
  { id: 2,  name: 'Exodus',           shortName: 'Exo',   aliases: ['ex','exo','exod','exodus'],                         testament: 'OT', chapters: 40  },
  { id: 3,  name: 'Leviticus',        shortName: 'Lev',   aliases: ['lev','leviticus'],                                  testament: 'OT', chapters: 27  },
  { id: 4,  name: 'Numbers',          shortName: 'Num',   aliases: ['num','numbers','numb'],                             testament: 'OT', chapters: 36  },
  { id: 5,  name: 'Deuteronomy',      shortName: 'Deu',   aliases: ['deu','deut','deuteronomy','dt'],                    testament: 'OT', chapters: 34  },
  { id: 6,  name: 'Joshua',           shortName: 'Jos',   aliases: ['jos','josh','joshua'],                              testament: 'OT', chapters: 24  },
  { id: 7,  name: 'Judges',           shortName: 'Jdg',   aliases: ['jdg','judg','judges'],                              testament: 'OT', chapters: 21  },
  { id: 8,  name: 'Ruth',             shortName: 'Rut',   aliases: ['rut','ruth'],                                       testament: 'OT', chapters: 4   },
  { id: 9,  name: '1 Samuel',         shortName: '1Sa',   aliases: ['1sa','1sam','1samuel','first samuel','i samuel'],   testament: 'OT', chapters: 31  },
  { id: 10, name: '2 Samuel',         shortName: '2Sa',   aliases: ['2sa','2sam','2samuel','second samuel','ii samuel'], testament: 'OT', chapters: 24  },
  { id: 11, name: '1 Kings',          shortName: '1Ki',   aliases: ['1ki','1kings','first kings','i kings'],             testament: 'OT', chapters: 22  },
  { id: 12, name: '2 Kings',          shortName: '2Ki',   aliases: ['2ki','2kings','second kings','ii kings'],           testament: 'OT', chapters: 25  },
  { id: 13, name: '1 Chronicles',     shortName: '1Ch',   aliases: ['1ch','1chron','1chronicles','first chronicles'],    testament: 'OT', chapters: 29  },
  { id: 14, name: '2 Chronicles',     shortName: '2Ch',   aliases: ['2ch','2chron','2chronicles','second chronicles'],   testament: 'OT', chapters: 36  },
  { id: 15, name: 'Ezra',             shortName: 'Ezr',   aliases: ['ezr','ezra'],                                       testament: 'OT', chapters: 10  },
  { id: 16, name: 'Nehemiah',         shortName: 'Neh',   aliases: ['neh','nehemiah'],                                   testament: 'OT', chapters: 13  },
  { id: 17, name: 'Esther',           shortName: 'Est',   aliases: ['est','esth','esther'],                              testament: 'OT', chapters: 10  },
  { id: 18, name: 'Job',              shortName: 'Job',   aliases: ['job'],                                              testament: 'OT', chapters: 42  },
  { id: 19, name: 'Psalms',           shortName: 'Psa',   aliases: ['ps','psa','psalm','psalms'],                        testament: 'OT', chapters: 150 },
  { id: 20, name: 'Proverbs',         shortName: 'Pro',   aliases: ['pro','prov','proverbs'],                            testament: 'OT', chapters: 31  },
  { id: 21, name: 'Ecclesiastes',     shortName: 'Ecc',   aliases: ['ecc','eccl','ecclesiastes','qoheleth'],             testament: 'OT', chapters: 12  },
  { id: 22, name: 'Song of Solomon',  shortName: 'Son',   aliases: ['son','sos','song','songs','song of songs'],         testament: 'OT', chapters: 8   },
  { id: 23, name: 'Isaiah',           shortName: 'Isa',   aliases: ['isa','isaiah'],                                     testament: 'OT', chapters: 66  },
  { id: 24, name: 'Jeremiah',         shortName: 'Jer',   aliases: ['jer','jeremiah'],                                   testament: 'OT', chapters: 52  },
  { id: 25, name: 'Lamentations',     shortName: 'Lam',   aliases: ['lam','lamentations'],                               testament: 'OT', chapters: 5   },
  { id: 26, name: 'Ezekiel',          shortName: 'Eze',   aliases: ['eze','ezek','ezekiel'],                             testament: 'OT', chapters: 48  },
  { id: 27, name: 'Daniel',           shortName: 'Dan',   aliases: ['dan','daniel'],                                     testament: 'OT', chapters: 12  },
  { id: 28, name: 'Hosea',            shortName: 'Hos',   aliases: ['hos','hosea'],                                      testament: 'OT', chapters: 14  },
  { id: 29, name: 'Joel',             shortName: 'Joe',   aliases: ['joe','joel'],                                       testament: 'OT', chapters: 3   },
  { id: 30, name: 'Amos',             shortName: 'Amo',   aliases: ['amo','amos'],                                       testament: 'OT', chapters: 9   },
  { id: 31, name: 'Obadiah',          shortName: 'Oba',   aliases: ['oba','obad','obadiah'],                             testament: 'OT', chapters: 1   },
  { id: 32, name: 'Jonah',            shortName: 'Jon',   aliases: ['jon','jonah'],                                      testament: 'OT', chapters: 4   },
  { id: 33, name: 'Micah',            shortName: 'Mic',   aliases: ['mic','micah'],                                      testament: 'OT', chapters: 7   },
  { id: 34, name: 'Nahum',            shortName: 'Nah',   aliases: ['nah','nahum'],                                      testament: 'OT', chapters: 3   },
  { id: 35, name: 'Habakkuk',         shortName: 'Hab',   aliases: ['hab','habakkuk'],                                   testament: 'OT', chapters: 3   },
  { id: 36, name: 'Zephaniah',        shortName: 'Zep',   aliases: ['zep','zeph','zephaniah'],                           testament: 'OT', chapters: 3   },
  { id: 37, name: 'Haggai',           shortName: 'Hag',   aliases: ['hag','haggai'],                                     testament: 'OT', chapters: 2   },
  { id: 38, name: 'Zechariah',        shortName: 'Zec',   aliases: ['zec','zech','zechariah'],                           testament: 'OT', chapters: 14  },
  { id: 39, name: 'Malachi',          shortName: 'Mal',   aliases: ['mal','malachi'],                                    testament: 'OT', chapters: 4   },
  // ── New Testament ─────────────────────────────────────────────────────────
  { id: 40, name: 'Matthew',          shortName: 'Mat',   aliases: ['mat','matt','matthew','mt'],                        testament: 'NT', chapters: 28  },
  { id: 41, name: 'Mark',             shortName: 'Mar',   aliases: ['mar','mark','mk'],                                  testament: 'NT', chapters: 16  },
  { id: 42, name: 'Luke',             shortName: 'Luk',   aliases: ['luk','luke','lk'],                                  testament: 'NT', chapters: 24  },
  { id: 43, name: 'John',             shortName: 'Joh',   aliases: ['joh','john','jn'],                                  testament: 'NT', chapters: 21  },
  { id: 44, name: 'Acts',             shortName: 'Act',   aliases: ['act','acts'],                                       testament: 'NT', chapters: 28  },
  { id: 45, name: 'Romans',           shortName: 'Rom',   aliases: ['rom','romans','ro'],                                testament: 'NT', chapters: 16  },
  { id: 46, name: '1 Corinthians',    shortName: '1Co',   aliases: ['1co','1cor','1corinthians','first corinthians'],    testament: 'NT', chapters: 16  },
  { id: 47, name: '2 Corinthians',    shortName: '2Co',   aliases: ['2co','2cor','2corinthians','second corinthians'],   testament: 'NT', chapters: 13  },
  { id: 48, name: 'Galatians',        shortName: 'Gal',   aliases: ['gal','galatians'],                                  testament: 'NT', chapters: 6   },
  { id: 49, name: 'Ephesians',        shortName: 'Eph',   aliases: ['eph','ephesians'],                                  testament: 'NT', chapters: 6   },
  { id: 50, name: 'Philippians',      shortName: 'Phi',   aliases: ['phi','phil','philippians'],                         testament: 'NT', chapters: 4   },
  { id: 51, name: 'Colossians',       shortName: 'Col',   aliases: ['col','colossians'],                                 testament: 'NT', chapters: 4   },
  { id: 52, name: '1 Thessalonians',  shortName: '1Th',   aliases: ['1th','1thes','1thessalonians','first thessalonians'],testament: 'NT', chapters: 5   },
  { id: 53, name: '2 Thessalonians',  shortName: '2Th',   aliases: ['2th','2thes','2thessalonians','second thessalonians'],testament:'NT', chapters: 3   },
  { id: 54, name: '1 Timothy',        shortName: '1Ti',   aliases: ['1ti','1tim','1timothy','first timothy'],            testament: 'NT', chapters: 6   },
  { id: 55, name: '2 Timothy',        shortName: '2Ti',   aliases: ['2ti','2tim','2timothy','second timothy'],           testament: 'NT', chapters: 4   },
  { id: 56, name: 'Titus',            shortName: 'Tit',   aliases: ['tit','titus'],                                      testament: 'NT', chapters: 3   },
  { id: 57, name: 'Philemon',         shortName: 'Phm',   aliases: ['phm','philem','philemon'],                          testament: 'NT', chapters: 1   },
  { id: 58, name: 'Hebrews',          shortName: 'Heb',   aliases: ['heb','hebrews'],                                    testament: 'NT', chapters: 13  },
  { id: 59, name: 'James',            shortName: 'Jam',   aliases: ['jam','jas','james'],                                testament: 'NT', chapters: 5   },
  { id: 60, name: '1 Peter',          shortName: '1Pe',   aliases: ['1pe','1pet','1peter','first peter'],                testament: 'NT', chapters: 5   },
  { id: 61, name: '2 Peter',          shortName: '2Pe',   aliases: ['2pe','2pet','2peter','second peter'],               testament: 'NT', chapters: 3   },
  { id: 62, name: '1 John',           shortName: '1Jn',   aliases: ['1jn','1john','first john'],                         testament: 'NT', chapters: 5   },
  { id: 63, name: '2 John',           shortName: '2Jn',   aliases: ['2jn','2john','second john'],                        testament: 'NT', chapters: 1   },
  { id: 64, name: '3 John',           shortName: '3Jn',   aliases: ['3jn','3john','third john'],                         testament: 'NT', chapters: 1   },
  { id: 65, name: 'Jude',             shortName: 'Jud',   aliases: ['jud','jude'],                                       testament: 'NT', chapters: 1   },
  { id: 66, name: 'Revelation',       shortName: 'Rev',   aliases: ['rev','revelation','revelations','apoc'],            testament: 'NT', chapters: 22  },
];

/** Index by short name / alias for O(1) lookup */
export const BOOK_BY_ALIAS = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BOOK_BY_ALIAS.set(book.name.toLowerCase(), book);
  BOOK_BY_ALIAS.set(book.shortName.toLowerCase(), book);
  for (const alias of book.aliases) {
    BOOK_BY_ALIAS.set(alias.toLowerCase(), book);
  }
}

export const BOOK_BY_ID = new Map<number, BibleBook>(
  BIBLE_BOOKS.map((b) => [b.id, b]),
);
