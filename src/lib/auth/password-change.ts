/**
 * Ganti kata sandi dan ganti nama tampilan (REQ-NT-14, SDD-5.1).
 *
 * Inti REQ-NT-14 ada di `changePassword`: setelah kata sandi diganti, semua
 * sesi LAIN milik pengguna dicabut, sehingga perangkat yang mungkin dikuasai
 * pihak lain kehilangan izin. Sesi yang sedang dipakai (`keepSessionToken`)
 * dipertahankan supaya pengguna tidak ikut ter-logout.
 *
 * Pencabutan "semua kecuali satu" butuh operasi massal. `revokeSession` di
 * `session-store.ts` hanya bekerja atas SATU token (`tokenHash` tunggal),
 * sehingga di sini dipakai `db.session.updateMany` langsung atas klien
 * Prisma. `session-store.ts` sengaja tidak diubah: menambah fungsi di sana
 * akan memperluas kontrak modul bersama yang dipakai modul auth lain, padahal
 * kebutuhan ini hanya milik alur ganti sandi. Logika hash token tidak
 * diduplikasi — `hashToken` tetap diimpor dari `session-store` agar bentuk
 * penyimpanan hash hanya punya satu definisi.
 */

import type { Db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";
import { hashToken } from "./session-store";

export type ChangePasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** Token sesi yang sedang dipakai; `null`/`undefined` mencabut semua sesi. */
  keepSessionToken?: string | null;
};

export type ChangePasswordResult = {
  ok: boolean;
  /** Jumlah sesi lain yang benar-benar dicabut. */
  revokedSessions: number;
  /** Pesan bahasa Indonesia yang aman ditampilkan; `null` saat berhasil. */
  reason: string | null;
};

/**
 * Mengganti kata sandi pengguna dan mencabut sesi lain.
 *
 * Urutan penting: kata sandi saat ini diverifikasi LEBIH DULU. Bila salah,
 * tidak ada yang berubah — baik hash maupun sesi. Pembaruan hash dan
 * pencabutan sesi terjadi dalam satu transaksi, sehingga tidak ada keadaan
 * setengah jadi (hash berubah tetapi sesi lama masih hidup, atau sebaliknya).
 *
 * Kegagalan yang wajar (sandi lama salah, sandi baru terlalu pendek/sama,
 * pengguna tidak ada) dikembalikan sebagai `{ok:false}`, bukan dilempar.
 */
export async function changePassword(
  db: Db,
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const { userId, currentPassword, newPassword, keepSessionToken } = input;

  const credential = await db.credential.findUnique({
    where: { userId },
    select: { passwordHash: true },
  });
  if (!credential) {
    return { ok: false, revokedSessions: 0, reason: "Pengguna tidak ditemukan." };
  }

  // 1. Verifikasi kata sandi saat ini lebih dulu; salah → tidak ada perubahan.
  if (!(await verifyPassword(credential.passwordHash, currentPassword))) {
    return { ok: false, revokedSessions: 0, reason: "Kata sandi saat ini salah." };
  }

  // 2. Panjang minimum memakai konstanta bersama, bukan angka keras.
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      revokedSessions: 0,
      reason: `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    };
  }

  // 3. Kata sandi baru tidak boleh sama dengan yang lama: dibandingkan lewat
  //    hash lama, bukan teks polos, supaya tetap benar walau hash ber-salt.
  if (await verifyPassword(credential.passwordHash, newPassword)) {
    return {
      ok: false,
      revokedSessions: 0,
      reason: "Kata sandi baru harus berbeda dari yang lama.",
    };
  }

  // Hash di luar transaksi: kerja CPU Argon2 tidak perlu memegang kunci tulis.
  const passwordHash = await hashPassword(newPassword);

  const revokedSessions = await db.$transaction(async (tx) => {
    await tx.credential.update({ where: { userId }, data: { passwordHash } });

    const now = new Date();
    const { count } = await tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        // Sesi sekarang dipertahankan; tanpa token, semua sesi dicabut.
        ...(keepSessionToken ? { tokenHash: { not: hashToken(keepSessionToken) } } : {}),
      },
      data: { revokedAt: now },
    });
    return count;
  });

  return { ok: true, revokedSessions, reason: null };
}
