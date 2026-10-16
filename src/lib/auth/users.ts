/**
 * Pembuatan akun dan muat ulang identitas (SDD-5.1, REQ-NT-11, REQ-NT-12).
 *
 * Pengguna pertama menjadi admin secara atomik: penentuan role dan penulisan
 * baris terjadi di satu transaksi interaktif, sehingga dua registrasi
 * bersamaan tidak dapat sama-sama melihat tabel kosong. Bila salah satu
 * kalah balapan, `P2002` (email unik) atau kegagalan serialisasi dikembalikan
 * sebagai `null` — pemanggil menampilkan pesan generik.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { hashPassword } from "./password";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
};

/** Email disimpan lowercase dan dipangkas; lookup memakai bentuk yang sama. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * @returns id pengguna baru, atau `null` bila email sudah terdaftar.
 */
export async function createUser(
  db: Db,
  input: { email: string; password: string; name?: string | null },
): Promise<string | null> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  try {
    return await db.$transaction(async (tx) => {
      // `pending` bukan `active`: aktivasi akun adalah pekerjaan WP terpisah
      // (mode tanpa SMTP), dan login menolak status selain `active`.
      const isFirst = (await tx.user.count()) === 0;
      const id = randomUUID();
      await tx.user.create({
        data: {
          id,
          email,
          name: input.name?.trim() || null,
          role: isFirst ? "admin" : "user",
          status: isFirst ? "active" : "pending",
        },
      });
      await tx.credential.create({ data: { userId: id, passwordHash } });
      return id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/** `P2002` = pelanggaran constraint unik. Kode dibaca dari bentuknya, bukan
 *  dari kelas error hasil generate, supaya berlaku untuk kedua provider. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/** Dibaca per permintaan; jangan pernah memakai klaim role/status dari token
 *  yang bisa basi (SDD-5.1). */
export async function findUserById(db: Db, id: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  return user ?? null;
}
