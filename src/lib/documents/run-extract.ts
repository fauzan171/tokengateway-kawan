/**
 * Menjalankan job `document.extract` (WP-NT-P6-03, REQ-NT-54).
 *
 * Server-only: membaca berkas lewat adapter penyimpanan dan mengurai PDF.
 *
 * Keputusan penyimpanan hasil: satu baris `DocumentChunk` PER HALAMAN
 * (`ordinal` = indeks halaman 0-based, `page` = nomor halaman). Baris ini
 * adalah hasil ekstraksi mentah, bukan chunk berukuran; P6-04 akan
 * menggantinya dengan chunk 800–1200 karakter. Dipilih per halaman, bukan
 * satu baris `ordinal: 0` berisi teks penuh, supaya metadata halaman
 * (REQ-NT-55/57) tidak hilang dan tidak perlu mengekstrak ulang.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
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

  let result: { text: string; pages: { page: number; text: string }[] };
  try {
    const data = await readDocument(document.storageKey);
    if (signal?.aborted) return;
    result = await extractText(document.mime, data);
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
  await db.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { documentId } });
    await tx.documentChunk.createMany({
      data: result.pages.map((page, index) => ({
        id: randomUUID(),
        documentId,
        ordinal: index,
        text: page.text,
        page: page.page,
      })),
    });
    await tx.document.update({
      where: { id: documentId },
      data: { status: "ready", errorCode: null },
    });
  });
}
