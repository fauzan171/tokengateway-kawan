/**
 * Penukaran token reset dengan kata sandi baru (REQ-NT-16, SDD-5.1).
 *
 * Rute ini tipis: validasi bentuk (konfirmasi sandi, panjang minimum) dilakukan
 * di sini memakai validator bersama `validation.ts`, sedangkan aturan token
 * (sekali pakai, kedaluwarsa, pencabutan sesi) ada di
 * `src/lib/auth/password-reset.ts`.
 *
 * Galat dibedakan dengan jelas: pelanggaran validasi sandi dikembalikan sebagai
 * `fields` (per kolom), sedangkan token yang tidak berlaku dikembalikan sebagai
 * pesan tunggal. Dengan begitu UI dapat menandai kolom yang salah tanpa
 * menuduh tokennya rusak, dan sebaliknya.
 */

import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { consumeResetToken } from "@/lib/auth/password-reset";
import { validatePassword } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const token = String(record.token ?? "");
  const newPassword = String(record.newPassword ?? "");
  const confirmPassword = String(record.confirmPassword ?? "");

  if (!token.trim()) {
    return NextResponse.json(
      { error: "Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru." },
      { status: 422 },
    );
  }

  // Validasi sandi lebih dulu: bila sandinya sendiri tidak memenuhi aturan,
  // pengguna diberi tahu kolom mana yang salah, bukan disuruh meminta tautan
  // baru padahal tautannya masih berlaku.
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json(
      { error: "Input tidak valid.", fields: { newPassword: passwordError } },
      { status: 422 },
    );
  }
  // Konfirmasi diperiksa di sini, sama seperti `account/password`: modul tidak
  // perlu tahu soal UI.
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Input tidak valid.", fields: { confirmPassword: "Kata sandi tidak cocok." } },
      { status: 422 },
    );
  }

  try {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const result = await consumeResetToken(db, { token, newPassword });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason ?? "Tautan reset tidak berlaku atau sudah kedaluwarsa." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      message: "Kata sandi berhasil direset. Silakan masuk dengan kata sandi baru.",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") {
      return NextResponse.json({ error: "Konfigurasi server tidak valid." }, { status: 500 });
    }
    throw err;
  }
}
