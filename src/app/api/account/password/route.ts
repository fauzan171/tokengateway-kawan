/**
 * Ganti kata sandi pengguna yang sedang masuk (REQ-NT-14, SDD-5.1).
 *
 * Setelah kata sandi berganti, semua sesi LAIN milik pengguna dicabut; sesi yang
 * sedang dipakai dipertahankan supaya pengguna tidak ikut ter-logout. Logika itu
 * ada di `src/lib/auth/password-change.ts` — di sini hanya penyambungan HTTP.
 *
 * Token sesi sekarang diambil dengan MENDEKODE cookie di sisi server, bukan
 * dengan menaruh `sid` di objek sesi. Objek sesi ikut terkirim ke peramban lewat
 * `/api/auth/session`, sehingga menaruh token mentah di sana akan membuatnya
 * terbaca JavaScript — tepat hal yang ingin dihindari cookie HttpOnly.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { changePassword } from "@/lib/auth/password-change";

export const runtime = "nodejs";

/** Nama cookie sesi Auth.js v5; yang berawalan `__Secure-` dipakai saat HTTPS. */
const SESSION_COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

async function currentSessionToken(secret: string): Promise<string | null> {
  const jar = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (!value) continue;
    try {
      const payload = await decode({ token: value, secret, salt: name });
      const sid = payload?.["sid"];
      if (typeof sid === "string" && sid) return sid;
    } catch {
      // Cookie rusak atau bertanda tangan salah: perlakukan sebagai tidak ada.
      return null;
    }
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>;
  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");
  const confirm = String(confirmPassword ?? "");

  if (!current || !next) {
    return NextResponse.json({ error: "Kata sandi saat ini dan kata sandi baru wajib diisi." }, { status: 422 });
  }
  // Konfirmasi diperiksa di sini, bukan di modul: modul tidak perlu tahu soal UI.
  if (next !== confirm) {
    return NextResponse.json(
      { error: "Input tidak valid.", fields: { confirmPassword: "Kata sandi tidak cocok." } },
      { status: 422 },
    );
  }

  try {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    const keepSessionToken = await currentSessionToken(config.authSecret);

    const result = await changePassword(db, {
      userId,
      currentPassword: current,
      newPassword: next,
      keepSessionToken,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.reason ?? "Kata sandi tidak dapat diubah." }, { status: 422 });
    }

    return NextResponse.json({
      message: "Kata sandi berhasil diubah.",
      revokedSessions: result.revokedSessions,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") {
      return NextResponse.json({ error: "Konfigurasi server tidak valid." }, { status: 500 });
    }
    throw err;
  }
}
