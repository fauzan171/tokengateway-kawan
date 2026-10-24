/**
 * Pemetaan penanda kutipan `[n]` pada jawaban ke metadata potongan dokumen
 * (WP-NT-P6-08, REQ-NT-57, SDD-6.2).
 *
 * Murni: tidak menyentuh database maupun jaringan. Hanya penanda yang
 * benar-benar ada di teks jawaban dan cocok dengan chunk yang dikirim yang
 * menghasilkan sitasi — SDD-6.2: jangan tampilkan sitasi palsu.
 */

import type { RetrievedChunk } from "./retrieve";

export type Citation = {
  index: number;
  chunkId: string;
  documentId: string;
  filename: string;
  page: number | null;
};

const MARKER = /\[(\d+)\]/g;

export function extractCitations(
  answer: string,
  chunks: readonly RetrievedChunk[],
): Citation[] {
  const found = new Map<number, Citation>();
  for (const match of answer.matchAll(MARKER)) {
    const index = Number(match[1]);
    if (found.has(index)) continue;
    const chunk = chunks[index - 1];
    if (!chunk) continue; // di luar jangkauan: model mengarang, abaikan
    found.set(index, {
      index,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      filename: chunk.filename,
      page: chunk.page,
    });
  }
  return [...found.values()].sort((a, b) => a.index - b.index);
}
