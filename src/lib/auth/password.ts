/**
 * Hash dan verifikasi kata sandi (SDD-5.1, REQ-NT-11).
 *
 * Parameter Argon2id di bawah adalah kontrak keamanan: nilai ini ikut
 * tersimpan di dalam string hash, jadi mengubahnya tidak merusak hash lama —
 * verifikasi tetap memakai parameter yang tertanam di hash masing-masing.
 * Menaikkan `memoryCost`/`timeCost` cukup dilakukan di sini.
 */

import { hash, verify } from "@node-rs/argon2";

/** OWASP minimum: 19 MiB, 2 iterasi, paralelisme 1. */
export const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Panjang minimum kata sandi; berlaku juga saat daftar/ganti sandi. */
export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { ...ARGON2 });
}

/** `false` untuk hash yang rusak/asing, bukan lempar — pemanggil cukup tahu
 *  kredensial tidak cocok. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
