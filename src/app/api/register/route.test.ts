/**
 * Uji gerbang pendaftaran publik (REQ-NT-76).
 *
 * Hanya dua hal yang dibuktikan: saat ditutup route membalas 403 dengan kode
 * `REGISTRATION_CLOSED` sebelum menyentuh input, dan saat terbuka alur lama
 * tetap berjalan.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../../tests/helpers/auth-db";

const state = vi.hoisted(() => ({ databaseUrl: "" }));

vi.mock("@/lib/config/env", () => ({
  loadConfig: () => ({ databaseUrl: state.databaseUrl }),
}));

const { POST } = await import("./route");

let temp: TempDb;

function request(body: unknown): Request {
  return new Request("http://localhost/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  email: "baru@contoh.test",
  password: "kata-sandi-panjang-sekali",
  confirmPassword: "kata-sandi-panjang-sekali",
};

beforeEach(async () => {
  temp = await createTempDb();
  state.databaseUrl = `file:${temp.file}`;
});

afterAll(async () => {
  await temp?.cleanup();
});

describe("POST /api/register", () => {
  it("registrationOpen 0 → 403 REGISTRATION_CLOSED", async () => {
    await temp.db.appConfig.create({ data: { id: "app", registrationOpen: 0 } });

    const response = await POST(request(VALID));
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe("REGISTRATION_CLOSED");
    expect(body.error).toBe("Pendaftaran publik ditutup. Hubungi administrator.");
    // Ditolak sebelum membuat akun.
    expect(await temp.db.user.count()).toBe(0);
  });

  it("tanpa baris konfigurasi → pendaftaran tetap berjalan", async () => {
    const response = await POST(request(VALID));

    expect(response.status).toBe(201);
    expect(await temp.db.user.count()).toBe(1);
  });
});
