/**
 * Pembatas laju login berbasis tabel (REQ-NT-15, SDD-5.1).
 *
 * Hitungan percobaan gagal disimpan sebagai baris di tabel `LoginAttempt`,
 * bukan di memori proses. Konsekuensinya: batas bertahan setelah restart dan
 * berlaku lintas proses — koneksi kedua ke database yang sama melihat angka
 * yang sama.
 *
 * Kedaluwarsa dihitung dari DATA: sebuah percobaan dianggap masih berlaku
 * selama `createdAt`-nya berada di dalam jendela yang dihitung mundur dari
 * `now`. Tidak ada timer proses yang terlibat, jadi jam proses yang meleset
 * tidak membuat hitungan basi.
 *
 * Fungsi di sini tidak membaca env sendiri; `limit` dan `windowSeconds`
 * diberikan pemanggil (mis. dari registry konfigurasi). Itu membuatnya mudah
 * diuji dengan jendela pendek.
 *
 * Tahan terhadap keadaan wajar: tabel kosong, baris hilang, dan nilai waktu
 * rusak tidak melempar — semuanya diperlakukan sebagai "tidak ada percobaan".
 */

import { createHash, randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import {
  DEFAULT_LOGIN_RATE_LIMIT_MAX,
  DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/config/env";
import { normalizeEmail } from "./users";

/** Pemisah antar bagian kunci. NUL tidak mungkin muncul di email maupun hash. */
const KEY_SEPARATOR = "\u0000";

/** Panjang hash IP dalam karakter hex. 32 hex = 128 bit: cukup untuk
 *  membandingkan, tidak cukup untuk membalik alamat asal. */
const IP_HASH_CHARS = 32;

/**
 * Menyandikan alamat IP menjadi hash pendek. Alamat mentah **tidak** pernah
 * disimpan, sesuai aturan kunci.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip.trim()).digest("hex").slice(0, IP_HASH_CHARS);
}

/**
 * Membentuk kunci pembatas: email ternormalisasi, ditambah hash IP bila ada.
 *
 * Normalisasi memakai `normalizeEmail` yang sama dengan jalur login, jadi
 * `Budi@Contoh.com` dan `budi@contoh.com` berbagi satu hitungan. Bila IP tidak
 * tersedia (mis. proxy tidak meneruskan header), kunci jatuh ke email saja —
 * pembatas tetap berlaku, hanya tidak dipecah per alamat.
 */
export function rateLimitKey(input: { email: string; ip?: string | null }): string {
  const email = normalizeEmail(input.email);
  const ip = input.ip?.trim();
  const suffix = ip ? hashIp(ip) : "-";
  return `${email}${KEY_SEPARATOR}${suffix}`;
}

export type RateLimitStatus = {
  limited: boolean;
  /** Detik sampai percobaan tertua keluar dari jendela; 0 bila tidak dibatasi. */
  retryAfterSeconds: number;
  /** Sisa percobaan yang masih diizinkan di jendela ini; 0 bila dibatasi. */
  remaining: number;
};

/**
 * Batas dan jendela dari konfigurasi. Nilai rusak (bukan angka, nol, negatif,
 * pecahan) jatuh ke bawaan aman alih-alih melempar: konfigurasi yang salah
 * tidak boleh mematikan pembatas laju diam-diam, dan juga tidak boleh membuat
 * login mustahil. Registry env sudah menolak nilai seperti ini saat start;
 * ini jaring pengaman untuk pemanggil yang meneruskan angka sendiri.
 */
function positiveIntOr(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
}

/**
 * Mencatat satu percobaan login gagal. `now` dapat diberikan supaya uji dan
 * pemanggil dapat memakai waktu yang sama dengan pemeriksaan.
 */
export async function recordAttempt(
  db: Db,
  input: { key: string; now?: Date },
): Promise<void> {
  await db.loginAttempt.create({
    data: { id: randomUUID(), key: input.key, createdAt: input.now ?? new Date() },
  });
}

/**
 * Menghitung status pembatasan untuk sebuah kunci.
 *
 * Percobaan dianggap berlaku bila `createdAt >= now - windowSeconds`. Bila
 * jumlahnya sudah mencapai `limit`, permintaan berikutnya ditolak sampai
 * percobaan tertua di jendela keluar — `retryAfterSeconds` selalu > 0 saat
 * `limited` benar, supaya pemanggil tidak pernah menyuruh klien mencoba ulang
 * tanpa jeda.
 */
export async function isRateLimited(
  db: Db,
  options: { key: string; now?: Date; limit: number; windowSeconds: number },
): Promise<RateLimitStatus> {
  const now = options.now ?? new Date();
  const limit = positiveIntOr(options.limit, DEFAULT_LOGIN_RATE_LIMIT_MAX);
  const windowSeconds = positiveIntOr(
    options.windowSeconds,
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  );
  const windowMs = windowSeconds * 1000;
  const since = new Date(now.getTime() - windowMs);

  const rows = await db.loginAttempt.findMany({
    where: { key: options.key, createdAt: { gte: since } },
    select: { createdAt: true },
  });

  // Waktu rusak (bukan tanggal sah) diabaikan, bukan melempar: baris seperti
  // itu tidak boleh melumpuhkan pemeriksaan login.
  const times = rows
    .map((row) => row.createdAt?.getTime())
    .filter((time): time is number => typeof time === "number" && Number.isFinite(time))
    .sort((a, b) => a - b);

  const used = times.length;
  if (used < limit) {
    return { limited: false, retryAfterSeconds: 0, remaining: limit - used };
  }

  // `limit` selalu >= 1 di sini (nilai rusak sudah jatuh ke bawaan), jadi
  // `used >= limit` menjamin setidaknya ada satu percobaan: `times[0]` ada.
  // Selalu > 0 agar pemanggil tidak pernah menyuruh klien mencoba ulang tanpa
  // jeda.
  const oldest = times[0]!;
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now.getTime()) / 1000));

  return { limited: true, retryAfterSeconds, remaining: 0 };
}

/**
 * Membuang hitungan sebuah kunci. Dipanggil setelah login berhasil supaya
 * percobaan gagal sebelumnya tidak terus membebani pengguna.
 *
 * @returns jumlah baris yang dihapus.
 */
export async function clearAttempts(db: Db, input: { key: string }): Promise<number> {
  const { count } = await db.loginAttempt.deleteMany({ where: { key: input.key } });
  return count;
}

/**
 * Membuang catatan yang sudah kedaluwarsa agar tabel tidak tumbuh tanpa batas.
 *
 * Ambang diambil dari `windowSeconds` yang sama dengan pemeriksaan: baris yang
 * lebih tua dari satu jendela tidak mungkin lagi memengaruhi keputusan, jadi
 * aman dibuang. Pemanggil dengan jendela khusus harus meneruskan nilai yang
 * sama; bawaan memakai jendela default konfigurasi.
 *
 * @returns jumlah baris yang dihapus.
 */
export async function pruneAttempts(
  db: Db,
  now: Date = new Date(),
  windowSeconds: number = DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
): Promise<number> {
  const effectiveWindow = positiveIntOr(windowSeconds, DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  const cutoff = new Date(now.getTime() - effectiveWindow * 1000);
  const { count } = await db.loginAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
