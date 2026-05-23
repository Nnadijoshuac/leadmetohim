import type Database from 'better-sqlite3';
import type { AppSettings } from '@leadmetohim/shared-types';
import { DEFAULT_SETTINGS } from '@leadmetohim/shared-types';

export function getSetting<K extends keyof AppSettings>(
  db: Database.Database,
  key: K,
): AppSettings[K] {
  const row = db
    .prepare<[string], { value: string }>('SELECT value FROM app_settings WHERE key = ?')
    .get(key);

  if (!row) return DEFAULT_SETTINGS[key];

  try {
    return JSON.parse(row.value) as AppSettings[K];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export function setSetting<K extends keyof AppSettings>(
  db: Database.Database,
  key: K,
  value: AppSettings[K],
): void {
  db.prepare(
    `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
     VALUES (?, ?, unixepoch())`,
  ).run(key, JSON.stringify(value));
}

export function getAllSettings(db: Database.Database): AppSettings {
  const rows = db
    .prepare<[], { key: string; value: string }>('SELECT key, value FROM app_settings')
    .all();

  const overrides: Partial<AppSettings> = {};
  for (const row of rows) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (overrides as any)[row.key] = JSON.parse(row.value);
    } catch {
      // skip malformed entries
    }
  }

  return { ...DEFAULT_SETTINGS, ...overrides };
}

export function setAllSettings(
  db: Database.Database,
  settings: Partial<AppSettings>,
): void {
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(settings)) {
      db.prepare(
        `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
         VALUES (?, ?, unixepoch())`,
      ).run(k, JSON.stringify(v));
    }
  });
  tx();
}
