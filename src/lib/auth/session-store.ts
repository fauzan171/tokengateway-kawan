/**
 * Buku besar sesi untuk pencabutan (SDD-5.1).
 *
 * Auth.js memegang klaim di JWT; tabel `Session` memegang *izin* — barisnya
 * bisa dicabut, dan pemeriksaan sesi menolak token yang tidak lagi punya
 * baris aktif. Token mentah tidak pernah disimpan: yang masuk tabel hanya
 * SHA-256 dari id sesi acak yang dipegang JWT.
 *
 * Karena id sesi dibuat sendiri (bukan `token.exp` milik Auth.js), masa
 * berlakunya diambil dari umur token (`session.maxAge`).
 */

import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Diisi dari header `User-Agent`; `null` bila tidak ada. Dipakai untuk
 *  menandai sesi pada daftar sesi (WP-NT-P1-05). */
export function hashUserAgent(userAgent: string | null | undefined): string | null {
  const value = userAgent?.trim();
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Mencatat sesi baru. `token` adalah id sesi acak yang disimpan di JWT;
 * yang ditulis ke database hanya hash-nya.
 */
export async function createSession(
  db: Db,
  input: { userId: string; token: string; expiresAt: Date; userAgent?: string | null },
): Promise<string> {
  const id = randomUUID();
  await db.session.create({
    data: {
      id,
      userId: input.userId,
      tokenHash: hashToken(input.token),
      expiresAt: input.expiresAt,
      userAgentHash: hashUserAgent(input.userAgent),
    },
  });
  return id;
}

/**
 * `true` bila token masih terdaftar, belum dicabut, belum kedaluwarsa, dan
 * penggunanya masih `active` (REQ-NT-74).
 *
 * `userId` dicocokkan supaya token milik pengguna lain tidak pernah lolos.
 * Status pengguna dibaca di kueri yang sama: menonaktifkan akun langsung
 * membatalkan sesinya walau baris `Session` belum sempat terhapus.
 */
export async function isSessionValid(
  db: Db,
  input: { userId: string; token: string; now?: Date },
): Promise<boolean> {
  const row = await db.session.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: { userId: true, expiresAt: true, revokedAt: true, user: { select: { status: true } } },
  });
  if (!row) return false;
  if (row.userId !== input.userId) return false;
  if (row.revokedAt !== null) return false;
  if (row.user.status !== "active") return false;
  return row.expiresAt.getTime() > (input.now ?? new Date()).getTime();
}

/** Dipakai logout. Baris tetap ada sebagai jejak; `revokedAt` yang menutup. */
export async function revokeSession(db: Db, token: string): Promise<number> {
  const { count } = await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

/** Sesi yang sudah tidak berguna dibuang; dipanggil dari sapuan berkala
 *  (worker), bukan dari jalur permintaan. */
export async function pruneSessions(db: Db, now = new Date()): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] },
  });
  return count;
}
