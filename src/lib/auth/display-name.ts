/**
 * Ganti nama tampilan (REQ-NT-14, SDD-5.1).
 *
 * Dipisah dari `password-change.ts` karena hanya menyentuh kolom `User.name`
 * dan tidak punya urusan dengan kredensial/sesi. Batas panjang diimpor dari
 * `validation.ts` (dipakai juga oleh form masuk/daftar) supaya nilainya hanya
 * punya satu definisi di seluruh aplikasi.
 *
 * Nama kosong (setelah dipangkas) disimpan sebagai `null` — kolomnya memang
 * opsional, jadi "tidak punya nama" diwakili `null`, bukan string kosong.
 */

import type { Db } from "@/lib/db";
import { NAME_MAX_LENGTH } from "./validation";

export type ChangeDisplayNameInput = {
  userId: string;
  name: string;
};

export type ChangeDisplayNameResult = {
  ok: boolean;
  /** Nilai yang tersimpan; `null` bila nama dikosongkan. */
  name: string | null;
  /** Pesan bahasa Indonesia yang aman ditampilkan; `null` saat berhasil. */
  reason: string | null;
};

/**
 * Menyimpan nama tampilan baru untuk pengguna.
 *
 * Kegagalan wajar (bukan string, terlalu panjang, pengguna tidak ada)
 * dikembalikan sebagai `{ok:false}`, bukan dilempar. Pengguna yang tidak ada
 * terdeteksi dari `count === 0` hasil `updateMany`, sehingga tidak ada
 * pembacaan tambahan sekaligus tidak melempar galat Prisma `P2025`.
 */
export async function changeDisplayName(
  db: Db,
  input: ChangeDisplayNameInput,
): Promise<ChangeDisplayNameResult> {
  const { userId, name } = input;

  if (typeof name !== "string") {
    return { ok: false, name: null, reason: "Nama tidak valid." };
  }

  const trimmed = name.trim();
  if (trimmed.length > NAME_MAX_LENGTH) {
    return { ok: false, name: null, reason: `Nama maksimal ${NAME_MAX_LENGTH} karakter.` };
  }

  const value = trimmed === "" ? null : trimmed;
  const { count } = await db.user.updateMany({ where: { id: userId }, data: { name: value } });
  if (count === 0) {
    return { ok: false, name: null, reason: "Pengguna tidak ditemukan." };
  }

  return { ok: true, name: value, reason: null };
}
