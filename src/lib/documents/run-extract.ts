/**
 * Menjalankan job `document.extract` (WP-NT-P6-03, REQ-NT-54).
 *
 * Server-only: membaca berkas lewat adapter penyimpanan dan mengurai PDF.
 *
 * Hasil ekstraksi dipotong menjadi chunk 800–1200 karakter dengan overlap
 * (P6-04); tiap chunk membawa halaman asalnya dan ordinal lintas dokumen.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { chunkPages } from "./chunk";
import { embedChunks, readEmbeddingConfig } from "./embed";
import { ExtractError, extractText } from "./extract";
import { readDocument } from "./storage";

/**
 * Ekstrak satu dokumen dan perbarui statusnya.
 *
 * Kegagalan isi berkas (`ExtractError`) dicatat sebagai `failed` dan TIDAK
 * dilempar: isinya tidak akan berubah, jadi retry hanya membuang percobaan.
 * Galat lain (IO/DB) tetap dilempar agar job diulang; status juga ditandai
 * `failed` supaya pengguna melihat sebab bila percobaan habis, dan percobaan
 * berikutnya mengembalikannya ke `processing`.
 */
export async function runExtract(
  db: Db,
  documentId: string,
  signal?: AbortSignal,
): Promise<void> {
  const document = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, mime: true, storageKey: true },
  });
  if (!document) throw new Error(`Dokumen "${documentId}" tidak ditemukan.`);

  if (signal?.aborted) return;
  await db.document.update({ where: { id: documentId }, data: { status: "processing" } });

  let chunks: ReturnType<typeof chunkPages>;
  try {
    const data = await readDocument(document.storageKey);
    if (signal?.aborted) return;
    // Chunking ikut di dalam try: batas jumlah chunk juga kegagalan permanen.
    chunks = chunkPages((await extractText(document.mime, data)).pages);
  } catch (err) {
    if (signal?.aborted) return;
    const code = err instanceof ExtractError ? err.code : "EXTRACT_FAILED";
    await db.document.update({
      where: { id: documentId },
      data: { status: "failed", errorCode: code },
    });
    if (err instanceof ExtractError) return;
    throw err;
  }

  if (signal?.aborted) return;

  // Idempoten: job ini boleh diulang, jadi hasil percobaan sebelumnya dibuang
  // dulu. Status `ready` ditulis dalam transaksi yang sama dengan chunk.
  const rows = chunks.map((chunk) => ({
    id: randomUUID(),
    documentId,
    ordinal: chunk.ordinal,
    text: chunk.text,
    page: chunk.page,
    section: chunk.section,
  }));

  await db.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { documentId } });
    await tx.documentChunk.createMany({ data: rows });
    await tx.document.update({
      where: { id: documentId },
      data: { status: "ready", errorCode: null },
    });
  });

  // Vektor diisi SETELAH transaksi: panggilan jaringan tidak boleh menahan
  // kunci tulis, dan dokumen tetap `ready` walau provider embedding mati —
  // retrieval jatuh ke pencarian kata kunci.
  const embedding = readEmbeddingConfig();
  if (!embedding || signal?.aborted) return;

  let embedded: { ordinal: number; embedding: string }[];
  try {
    embedded = await embedChunks(chunks, embedding);
  } catch {
    return;
  }
  if (signal?.aborted) return;

  const byOrdinal = new Map(rows.map((row) => [row.ordinal, row.id]));
  await db.$transaction(
    embedded
      .filter((item) => item.embedding !== "")
      .map((item) =>
        db.documentChunk.update({
          where: { id: byOrdinal.get(item.ordinal) ?? "" },
          data: { embedding: item.embedding },
        }),
      ),
  );
}
