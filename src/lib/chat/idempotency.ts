/**
 * Kunci idempotensi permintaan tulis (SDD-4.7).
 *
 * Satu kunci hanya bermakna untuk satu (owner, operasi, chat, payload). Digest
 * memuat keempatnya, jadi kunci yang dipakai ulang pada chat atau operasi lain
 * ditolak 409 — bukan memutar ulang generasi milik chat lain.
 */

import { createHash } from "node:crypto";

/** Versi skema digest; ubah bila susunan field berubah agar kunci lama tidak cocok. */
const DIGEST_VERSION = 1;

/**
 * Digest kanonik dari identitas permintaan. Urutan field tetap dan `payload`
 * sudah dinormalkan pemanggil supaya dua permintaan yang sama menghasilkan
 * digest sama.
 */
export function idempotencyDigest(input: {
  owner: string;
  operation: string;
  chatId: string;
  payload: unknown;
}): string {
  const canonical = JSON.stringify([
    DIGEST_VERSION,
    input.owner,
    input.operation,
    input.chatId,
    input.payload,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Kode unik Prisma (P2002). Duck-typing: pemanggil tidak perlu tipe klien Prisma. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}
