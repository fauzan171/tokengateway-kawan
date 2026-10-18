/**
 * Retrieval potongan dokumen (WP-NT-P6-06, REQ-NT-56, REQ-NT-58, SDD-6.2).
 *
 * Isolasi pengguna dijaga di level query: `document.userId` selalu ada di
 * `where`, sehingga baris milik pengguna lain tidak pernah keluar dari
 * database. Tidak ada penyaringan kepemilikan di JavaScript.
 *
 * Mode vektor dipakai bila `embedding` diberikan; bila tidak, jatuh ke
 * pencarian kata kunci (REQ-NT-61). Modul ini tidak menulis ke database dan
 * tidak memanggil model chat.
 */

import type { Db } from "@/lib/db";
import { decodeVector, embedChunks, type EmbeddingConfig } from "./embed";

const DEFAULT_LIMIT = 6;
/** SDD-6.2: 5–8 potongan untuk konteks. Batas atas 8; batas bawah 1 supaya
 *  pemanggil yang sengaja minta sedikit tetap dihormati (uji gate). */
const MAX_LIMIT = 8;

export type RetrieveInput = {
  userId: string;
  query: string;
  limit?: number;
  documentIds?: string[];
  embedding?: EmbeddingConfig;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  filename: string;
  page: number | null;
  ordinal: number;
  text: string;
  score: number;
};

const SELECT = {
  id: true,
  documentId: true,
  page: true,
  ordinal: true,
  text: true,
  embedding: true,
  document: { select: { filename: true } },
} as const;

type Row = {
  id: string;
  documentId: string;
  page: number | null;
  ordinal: number;
  text: string;
  embedding: string | null;
  document: { filename: string };
};

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.trunc(limit)), MAX_LIMIT);
}

/** Kata query: huruf/angka, minimal 2 karakter, lowercase, tanpa duplikat. */
export function queryTerms(query: string): string[] {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(terms.filter((term) => term.length >= 2))];
}

function cosine(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return normA === 0 || normB === 0 ? 0 : dot / Math.sqrt(normA * normB);
}

function toResult(row: Row, score: number): RetrievedChunk {
  return {
    chunkId: row.id,
    documentId: row.documentId,
    filename: row.document.filename,
    page: row.page,
    ordinal: row.ordinal,
    text: row.text,
    score,
  };
}

export async function retrieveChunks(db: Db, input: RetrieveInput): Promise<RetrievedChunk[]> {
  const query = input.query.trim();
  if (query === "") return [];

  const limit = clampLimit(input.limit);

  // WAJIB: kepemilikan ikut di `where`, bukan disaring setelah data terambil.
  const where = {
    document: {
      userId: input.userId,
      ...(input.documentIds ? { id: { in: input.documentIds } } : {}),
    },
  };

  if (input.embedding) {
    const [embedded] = await embedChunks(
      [{ ordinal: 0, text: query, page: 1, section: null }],
      input.embedding,
    );
    const queryVector = decodeVector(embedded?.embedding ?? "");

    const rows = (await db.documentChunk.findMany({
      where: { ...where, embedding: { not: null } },
      select: SELECT,
    })) as Row[];

    return rows
      .map((row) => toResult(row, cosine(queryVector, decodeVector(row.embedding ?? ""))))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const rows = (await db.documentChunk.findMany({ where, select: SELECT })) as Row[];

  return rows
    .map((row) => {
      const haystack = row.text.toLowerCase();
      const matched = terms.filter((term) => haystack.includes(term)).length;
      return toResult(row, matched / terms.length);
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
