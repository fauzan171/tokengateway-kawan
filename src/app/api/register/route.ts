/**
 * Endpoint pendaftaran publik (REQ-NT-11, SDD-5.1).
 *
 * - Validasi input memakai `src/lib/auth/validation.ts`.
 * - Pesan keluaran generik: tidak membocorkan apakah email sudah terdaftar.
 * - Pengguna pertama yang terdaftar menjadi admin secara atomik (terurus di
 *   `createUser`); pendaftar selanjutnya status `pending` hingga aktivasi manual.
 */

import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { createUser } from "@/lib/auth/users";
import { readAppConfig } from "@/lib/admin/config";
import { validateRegister } from "@/lib/auth/validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // Pendaftaran publik bisa ditutup admin (REQ-NT-76). Diperiksa sebelum
  // validasi input supaya tidak ada petunjuk lain yang ikut keluar.
  try {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    const appConfig = await readAppConfig(db);
    if (!appConfig.registrationOpen) {
      return NextResponse.json(
        { error: "Pendaftaran publik ditutup. Hubungi administrator.", code: "REGISTRATION_CLOSED" },
        { status: 403 },
      );
    }
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") {
      return NextResponse.json({ error: "Konfigurasi server tidak valid." }, { status: 500 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const { email, name, password, confirmPassword } = body as Record<string, unknown>;
  const input = {
    email: String(email ?? ""),
    name: name === undefined || name === null ? undefined : String(name),
    password: String(password ?? ""),
    confirmPassword: String(confirmPassword ?? ""),
  };

  const validation = validateRegister(input);
  if (!validation.success) {
    return NextResponse.json({ error: "Input tidak valid.", fields: validation.errors }, { status: 422 });
  }

  try {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    const result = await createUser(db, {
      email: input.email,
      name: input.name,
      password: input.password,
    });

    if (result === null) {
      // Pesan generik: tidak membocorkan keberadaan akun (REQ-NT-11).
      return NextResponse.json(
        { error: "Pendaftaran tidak dapat diselesaikan. Pastikan email belum terdaftar dan coba lagi." },
        { status: 422 },
      );
    }

    return NextResponse.json({ message: "Pendaftaran berhasil. Silakan masuk." }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") {
      return NextResponse.json({ error: "Konfigurasi server tidak valid." }, { status: 500 });
    }
    throw err;
  }
}
