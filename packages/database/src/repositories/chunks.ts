import type Database from 'better-sqlite3';
import type { SemanticChunk, ScriptureReference, Testament } from '@leadmetohim/shared-types';

interface ChunkRow {
  id: string;
  description: string;
  book_id: number | null;
  chapter_start: number;
  verse_start: number | null;
  chapter_end: number | null;
  verse_end: number | null;
  book_name: string;
  display_ref: string;
  tags: string;
  testament: string;
}

interface EmbeddingRow {
  chunk_id: string;
  vector: Buffer;
  dimensions: number;
  model: string;
}

export function getAllChunks(db: Database.Database): SemanticChunk[] {
  return db
    .prepare<[], ChunkRow>('SELECT * FROM semantic_chunks')
    .all()
    .map(mapChunk);
}

export function getChunksWithoutEmbeddings(db: Database.Database): SemanticChunk[] {
  return db
    .prepare<[], ChunkRow>(
      `SELECT sc.* FROM semantic_chunks sc
       LEFT JOIN embeddings e ON e.chunk_id = sc.id
       WHERE e.chunk_id IS NULL`,
    )
    .all()
    .map(mapChunk);
}

export function upsertChunk(db: Database.Database, chunk: SemanticChunk): void {
  db.prepare(
    `INSERT OR REPLACE INTO semantic_chunks
       (id, description, book_id, chapter_start, verse_start, chapter_end, verse_end,
        book_name, display_ref, tags, testament)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    chunk.id,
    chunk.text,
    chunk.reference.bookId || null,
    chunk.reference.chapterStart,
    chunk.reference.verseStart ?? null,
    chunk.reference.chapterEnd ?? null,
    chunk.reference.verseEnd ?? null,
    chunk.reference.book,
    chunk.reference.display,
    JSON.stringify(chunk.tags),
    chunk.testament,
  );
}

export function bulkUpsertChunks(db: Database.Database, chunks: SemanticChunk[]): void {
  const tx = db.transaction(() => {
    for (const chunk of chunks) upsertChunk(db, chunk);
  });
  tx();
}

export function upsertEmbedding(
  db: Database.Database,
  chunkId: string,
  vector: Float32Array,
  model: string,
): void {
  const buf = Buffer.from(vector.buffer);
  db.prepare(
    `INSERT OR REPLACE INTO embeddings (chunk_id, model, vector, dimensions, created_at)
     VALUES (?, ?, ?, ?, unixepoch())`,
  ).run(chunkId, model, buf, vector.length);
}

export function getAllEmbeddings(
  db: Database.Database,
): Array<{ chunkId: string; vector: Float32Array; model: string }> {
  return db
    .prepare<[], EmbeddingRow>('SELECT chunk_id, vector, dimensions, model FROM embeddings')
    .all()
    .map((row) => ({
      chunkId: row.chunk_id,
      model: row.model,
      vector: new Float32Array(
        row.vector.buffer,
        row.vector.byteOffset,
        row.vector.length / Float32Array.BYTES_PER_ELEMENT,
      ),
    }));
}

export function getChunkById(
  db: Database.Database,
  id: string,
): SemanticChunk | undefined {
  const row = db
    .prepare<[string], ChunkRow>('SELECT * FROM semantic_chunks WHERE id = ?')
    .get(id);
  return row ? mapChunk(row) : undefined;
}

export function countEmbeddings(db: Database.Database): number {
  const row = db
    .prepare<[], { n: number }>('SELECT COUNT(*) as n FROM embeddings')
    .get();
  return row?.n ?? 0;
}

function mapChunk(row: ChunkRow): SemanticChunk {
  const ref: ScriptureReference = {
    book: row.book_name,
    bookId: row.book_id ?? 0,
    chapterStart: row.chapter_start,
    verseStart: row.verse_start ?? undefined,
    chapterEnd: row.chapter_end ?? undefined,
    verseEnd: row.verse_end ?? undefined,
    display: row.display_ref,
  };
  return {
    id: row.id,
    text: row.description,
    reference: ref,
    tags: JSON.parse(row.tags) as string[],
    testament: row.testament as Testament,
  };
}
