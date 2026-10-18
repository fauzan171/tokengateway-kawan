/**
 * Unggah dokumen: validasi, simpan berkas, catat baris `Document`, antrekan
 * ekstraksi (SDD-3.6, SDD-6.1 butir 1–3).
 *
 * Server-only: memakai adapter penyimpanan berbasis `node:fs`, jadi tidak
 * boleh diimpor komponen klien.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { deleteDocument, saveDocument } from "./storage";

/** Tipe yang diterima (SDD-6.1 butir 1). */
export const ALLOWED_MIME = ["application/pdf", "text/plain", "text/markdown"] as const;

const FILENAME_MAX = 200;
const FILENAME_FALLBACK = "dokumen";

export type PublicDocument = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  createdAt: string;
};

const DOCUMENT_FIELDS = {
  id: true,
  filename: true,
  mime: true,
  sizeBytes: true,
  status: true,
  errorCode: true,
  createdAt: true,
} as const;

type DocumentRow = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  createdAt: Date;
};

function toPublicDocument(row: DocumentRow): PublicDocument {
  return {
    id: row.id,
    filename: row.filename,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    status: row.status,
    errorCode: row.errorCode,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Nama untuk tampilan saja. Path penyimpanan selalu nama acak dari
 * `saveDocument`; yang dibuang di sini adalah komponen path, karakter
 * kontrol, dan panjang berlebih supaya nama tidak menyesatkan di UI/log.
 */
export function sanitizeFilename(raw: unknown): string {
  if (typeof raw !== "string") return FILENAME_FALLBACK;
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned === "") return FILENAME_FALLBACK;
  return cleaned.slice(0, FILENAME_MAX);
}

function checkedMime(mime: unknown): string {
  if (typeof mime !== "string" || !(ALLOWED_MIME as readonly string[]).includes(mime)) {
    throw new ApiError({
      status: STATUS.UNSUPPORTED_MEDIA_TYPE,
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: `Jenis berkas tidak didukung. Yang diterima: ${ALLOWED_MIME.join(", ")}.`,
    });
  }
  return mime;
}

/** Ukuran dihitung dari isi berkas, bukan `Content-Length` (REQ-NT-60). */
function assertSize(data: Buffer, maxUploadBytes: number): void {
  const size = Buffer.byteLength(data);
  if (size > maxUploadBytes) {
    const limitMb = maxUploadBytes / (1024 * 1024);
    throw new ApiError({
      status: STATUS.PAYLOAD_TOO_LARGE,
      code: "FILE_TOO_LARGE",
      message: `Berkas melebihi batas ${limitMb} MB.`,
      details: { maxUploadBytes },
    });
  }
}

export type UploadInput = {
  userId: string;
  filename: unknown;
  mime: unknown;
  data: Buffer;
};

/**
 * Validasi → simpan berkas → catat `Document` → antrekan `document.extract`.
 *
 * Bila penulisan database gagal setelah berkas tersimpan, berkas dihapus
 * sebelum galat dilempar supaya tidak ada berkas yatim.
 */
export async function uploadDocument(
  db: Db,
  config: Config,
  input: UploadInput,
): Promise<PublicDocument> {
  const mime = checkedMime(input.mime);
  assertSize(input.data, config.maxUploadBytes);

  const filename = sanitizeFilename(input.filename);
  const storageKey = await saveDocument(input.data);
  const id = `doc_${randomUUID()}`;

  try {
    const row = await db.document.create({
      data: {
        id,
        userId: input.userId,
        filename,
        mime,
        sizeBytes: Buffer.byteLength(input.data),
        storageKey,
        status: "queued",
      },
      select: DOCUMENT_FIELDS,
    });

    await enqueue(db, { kind: "document.extract", payload: { documentId: id } });

    return toPublicDocument(row);
  } catch (err) {
    await deleteDocument(storageKey);
    throw err;
  }
}

/** Dokumen milik satu pengguna, terbaru dulu (REQ-NT-58). */
export async function listDocuments(db: Db, userId: string): Promise<PublicDocument[]> {
  const rows = await db.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_FIELDS,
  });
  return rows.map(toPublicDocument);
}
