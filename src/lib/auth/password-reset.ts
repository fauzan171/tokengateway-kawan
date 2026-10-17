/**
 * Reset kata sandi dengan token sekali pakai (REQ-NT-16, SDD-5.1).
 *
 * Bentuk yang dijaga modul ini:
 *   - Token acak kriptografis (256 bit, base64url) dikembalikan SEKALI dari
 *     `createResetToken`; yang masuk database hanya SHA-256-nya lewat
 *     `hashToken` — bentuk hash hanya punya satu definisi (session-store.ts).
 *   - Pemakaian kedua ditolak: klaim dilakukan dengan UPDATE bersyarat
 *     `usedAt IS NULL`, jadi dua permintaan bersamaan tidak bisa sama-sama
 *     menang.
 *   - Kedaluwarsa dihitung dari `expiresAt` di DATA dibanding `now`, bukan dari
 *     timer proses. Jam proses yang meleset tidak membuat token hidup lebih
 *     lama daripada yang tercatat.
 *   - Setelah reset berhasil, SEMUA sesi pengguna dicabut (kata sandi berganti
 *     → perangkat lama harus keluar), dalam transaksi yang sama dengan
 *     penggantian hash.
 *
 * `requestReset` selalu melaporkan `ok: true` tanpa membocorkan apakah email
 * terdaftar (REQ-NT-11); token hanya dikembalikan bila pengguna benar ada.
 */

import { randomBytes, randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { DEFAULT_PASSWORD_RESET_TTL_SECONDS } from "@/lib/config/env";
import { MIN_PASSWORD_LENGTH, hashPassword } from "./password";
import { hashToken } from "./session-store";
import { rateLimitKey } from "./rate-limit";
import { normalizeEmail } from "./users";

/** 32 byte = 256 bit. Jauh di atas kebutuhan ruang token sekali pakai. */
const TOKEN_BYTES = 32;

/** Token acak baru, di-encode base64url (aman di query string tanpa escaping). */
function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Kunci pembatas laju untuk permintaan reset.
 *
 * Sengaja DIBEDAKAN dari kunci login: bila keduanya memakai kunci yang sama,
 * beberapa permintaan reset yang sah (atau percobaan login gagal milik
 * penyerang) bisa saling mengunci — pengguna yang baru saja minta tautan
 * mendadak tidak bisa masuk, atau sebaliknya. Bentuk kuncinya tetap memakai
 * `rateLimitKey` supaya normalisasi email dan hash IP hanya punya satu
 * definisi; prefiks "reset:" yang memisahkan namespace.
 */
export function resetRateLimitKey(input: { email: string; ip?: string | null }): string {
  return `reset:${rateLimitKey(input)}`;
}

/** Kode hasil supaya pemanggil dapat memetakan pesan tanpa mencocokkan teks. */
export type ResetCode =
  | "OK"
  | "TOKEN_INVALID"
  | "TOKEN_USED"
  | "TOKEN_EXPIRED"
  | "PASSWORD_TOO_SHORT"
  | "USER_MISSING";

export type CreateResetTokenInput = {
  userId: string;
  /** Waktu acuan; default sekarang. Diberikan agar uji dapat menggeser jam. */
  now?: Date;
  /** Masa berlaku dalam detik. Nilai rusak jatuh ke bawaan aman. */
  ttlSeconds?: number;
};

export type CreateResetTokenResult = {
  /** Token mentah; TIDAK pernah disimpan, hanya dikembalikan sekali. */
  token: string;
  expiresAt: Date;
};

export type ConsumeResetTokenInput = {
  token: string;
  newPassword: string;
  now?: Date;
};

export type ConsumeResetTokenResult = {
  ok: boolean;
  /** Pesan bahasa Indonesia yang aman ditampilkan; `null` saat berhasil. */
  reason: string | null;
  /** Kode mesin untuk pemetaan di rute; `null` saat berhasil. */
  code: ResetCode | null;
  /** Pengguna pemilik token yang berhasil dipakai; `null` bila gagal. */
  userId: string | null;
};

/** Nilai TTL rusak (bukan angka, nol, negatif, pecahan) → bawaan aman, bukan
 *  token abadi atau token yang langsung mati. */
function ttlSecondsOr(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
}

/**
 * Membuat token reset baru untuk pengguna.
 *
 * Token lama milik pengguna yang sama dibatalkan lebih dulu: permintaan tautan
 * kedua tidak boleh meninggalkan tautan pertama tetap hidup. Pembatalan dan
 * pembuatan terjadi dalam satu transaksi, jadi tidak ada celah saat dua token
 * sama-sama berlaku.
 */
export async function createResetToken(
  db: Db,
  input: CreateResetTokenInput,
): Promise<CreateResetTokenResult> {
  const now = input.now ?? new Date();
  const ttlSeconds = ttlSecondsOr(input.ttlSeconds, DEFAULT_PASSWORD_RESET_TTL_SECONDS);
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  await db.$transaction(async (tx) => {
    await invalidateUserTokens(tx as unknown as Db, { userId: input.userId, now });
    await tx.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        tokenHash: hashToken(token),
        expiresAt,
        createdAt: now,
      },
    });
  });

  return { token, expiresAt };
}

/**
 * Menandai seluruh token pengguna yang belum terpakai sebagai terpakai.
 *
 * Dipakai `createResetToken` agar token lama mati saat token baru dibuat, dan
 * boleh dipanggil langsung (mis. saat akun dinonaktifkan). Baris tetap ada
 * sebagai jejak; `usedAt` yang menutupnya — pola yang sama dengan `Session`.
 *
 * @returns jumlah baris yang ditandai.
 */
export async function invalidateUserTokens(
  db: Db,
  input: { userId: string; now?: Date },
): Promise<number> {
  const now = input.now ?? new Date();
  const { count } = await db.passwordResetToken.updateMany({
    where: { userId: input.userId, usedAt: null },
    data: { usedAt: now },
  });
  return count;
}

/**
 * Menukar token dengan kata sandi baru.
 *
 * Urutan: baca token (murah) → tolak bila jelas tidak berlaku → baru hitung
 * Argon2 di luar transaksi (kerja CPU tidak perlu memegang kunci tulis, sama
 * seperti `changePassword`) → klaim + ganti hash + cabut sesi dalam satu
 * transaksi. Klaim memakai UPDATE bersyarat, jadi bila token sempat dipakai
 * pihak lain di sela itu, hasilnya `TOKEN_USED`, bukan tulisan ganda.
 *
 * Keadaan wajar (token kosong, tidak dikenal, sudah dipakai, kedaluwarsa,
 * pengguna/credential hilang) dikembalikan sebagai `ok: false`, bukan dilempar.
 */
export async function consumeResetToken(
  db: Db,
  input: ConsumeResetTokenInput,
): Promise<ConsumeResetTokenResult> {
  const now = input.now ?? new Date();
  const token = input.token?.trim() ?? "";

  if (!token) {
    return fail("TOKEN_INVALID", "Tautan reset tidak valid. Minta tautan baru.");
  }

  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!row) {
    return fail("TOKEN_INVALID", "Tautan reset tidak dikenal. Minta tautan baru.");
  }
  if (row.usedAt !== null) {
    return fail("TOKEN_USED", "Tautan reset sudah pernah dipakai. Minta tautan baru.");
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return fail("TOKEN_EXPIRED", "Tautan reset sudah kedaluwarsa. Minta tautan baru.");
  }

  // Panjang minimum memakai konstanta bersama; rute juga memvalidasi, tetapi
  // modul tidak boleh menulis hash untuk sandi yang tidak memenuhi kontrak.
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail("PASSWORD_TOO_SHORT", `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }

  const passwordHash = await hashPassword(input.newPassword);

  return db.$transaction(async (tx) => {
    // Klaim atomik: hanya satu pemanggil yang melihat `count === 1`.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) {
      return fail("TOKEN_USED", "Tautan reset sudah pernah dipakai. Minta tautan baru.");
    }

    const credential = await tx.credential.findUnique({
      where: { userId: row.userId },
      select: { userId: true },
    });
    if (!credential) {
      // Baris rusak: token diklaim, tetapi tidak ada kredensial untuk diubah.
      // Transaksi digagalkan agar klaim tidak tersisa tanpa efek.
      throw new ResetIncompleteError();
    }

    await tx.credential.update({ where: { userId: row.userId }, data: { passwordHash } });

    // Kata sandi berganti → semua perangkat lama keluar. `session-store.ts`
    // sengaja tidak diubah: ini operasi massal, sama seperti jalur ganti sandi.
    await tx.session.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: now },
    });

    return { ok: true, reason: null, code: null, userId: row.userId };
  }).catch((err) => {
    if (err instanceof ResetIncompleteError) {
      return fail("USER_MISSING", "Akun tidak ditemukan. Hubungi admin.");
    }
    throw err;
  });
}

/** Penanda internal untuk menggagalkan transaksi saat kredensial hilang. */
class ResetIncompleteError extends Error {
  constructor() {
    super("PasswordResetToken menunjuk pengguna tanpa credential");
    this.name = "ResetIncompleteError";
  }
}

function fail(code: ResetCode, reason: string): ConsumeResetTokenResult {
  return { ok: false, reason, code, userId: null };
}

export type RequestResetInput = {
  email: string;
  now?: Date;
  ttlSeconds?: number;
};

export type RequestResetResult = {
  /** Selalu `true`: memanggil tidak boleh membocorkan keberadaan akun. */
  ok: true;
  /** Terisi HANYA bila email terdaftar. Pemanggil memutuskan penyampaiannya. */
  token?: string;
  expiresAt?: Date;
};

/**
 * Meminta tautan reset untuk sebuah email.
 *
 * Selalu `{ ok: true }` (REQ-NT-11): perbedaan antara "email terdaftar" dan
 * "tidak terdaftar" hanya terlihat dari ada-tidaknya `token`, yang tidak pernah
 * dikirim ke klien. Email tidak terdaftar tidak melempar dan tidak menulis apa
 * pun.
 */
export async function requestReset(
  db: Db,
  input: RequestResetInput,
): Promise<RequestResetResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: true };

  const user = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { ok: true };

  const created = await createResetToken(db, {
    userId: user.id,
    now: input.now,
    ttlSeconds: input.ttlSeconds,
  });
  return { ok: true, token: created.token, expiresAt: created.expiresAt };
}
