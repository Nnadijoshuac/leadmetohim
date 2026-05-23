import type Database from 'better-sqlite3';
import type { QueryType } from '@leadmetohim/shared-types';

export interface HistoryEntry {
  id: number;
  query: string;
  queryType: QueryType;
  resultRef: string | null;
  inserted: boolean;
  createdAt: number;
}

export function addHistory(
  db: Database.Database,
  query: string,
  queryType: QueryType,
  resultRef?: string,
  inserted = false,
): void {
  db.prepare(
    `INSERT INTO search_history (query, query_type, result_ref, inserted)
     VALUES (?, ?, ?, ?)`,
  ).run(query, queryType, resultRef ?? null, inserted ? 1 : 0);
}

export function getRecentHistory(
  db: Database.Database,
  limit = 20,
): HistoryEntry[] {
  return db
    .prepare<
      [number],
      { id: number; query: string; query_type: string; result_ref: string | null; inserted: number; created_at: number }
    >(
      `SELECT * FROM search_history ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit)
    .map((r) => ({
      id: r.id,
      query: r.query,
      queryType: r.query_type as QueryType,
      resultRef: r.result_ref,
      inserted: r.inserted === 1,
      createdAt: r.created_at,
    }));
}

export function clearHistory(db: Database.Database): void {
  db.prepare('DELETE FROM search_history').run();
}
