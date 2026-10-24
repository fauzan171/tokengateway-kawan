/**
 * Uji buku besar sesi (WP-NT-P1-01, REQ-NT-13, SDD-5.1).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts`: migrasi yang
 * dikirim repo dijalankan apa adanya, jadi uji ini juga membuktikan skema
 * benar-benar bisa dipakai modul sesi. Baris `User` dibuat langsung lewat
 * `db.user.create` (bukan `createUser` dari `users.ts`) supaya uji ini tidak
 * bergantung pada modul lain.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  createSession,
  hashToken,
  hashUserAgent,
  isSessionValid,
  pruneSessions,
  revokeSession,
} from "./session-store";

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp.cleanup();
});

/** Membuat satu pengguna mentah; cukup untuk memenuhi foreign key Session. */
async function makeUser(label: string): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${label}-${id}@contoh.test`, status: "active" } });
  return id;
}

/** Semua nilai kolom satu baris sesi; dipakai untuk membuktikan token mentah
 *  tidak bocor ke kolom mana pun. */
async function sessionRowValues(id: string): Promise<unknown[]> {
  const row = await db.session.findUniqueOrThrow({ where: { id } });
  return Object.values(row);
}

describe("hashToken", () => {
  it("deterministik: input sama menghasilkan hash sama", () => {
    expect(hashToken("token-rahasia")).toBe(hashToken("token-rahasia"));
  });

  it("berupa hex 64 karakter (SHA-256)", () => {
    expect(hashToken("token-rahasia")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("input berbeda menghasilkan hash berbeda", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("token mentah tidak muncul di output", () => {
    const token = "token-yang-tidak-boleh-bocor";
    expect(hashToken(token)).not.toContain(token);
  });
});

describe("hashUserAgent", () => {
  it("null, undefined, string kosong, dan spasi-saja menjadi null", () => {
    expect(hashUserAgent(null)).toBeNull();
    expect(hashUserAgent(undefined)).toBeNull();
    expect(hashUserAgent("")).toBeNull();
    expect(hashUserAgent("   ")).toBeNull();
  });

  it("User-Agent wajar menghasilkan hex 64 karakter", () => {
    expect(hashUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dua User-Agent berbeda menghasilkan hash berbeda", () => {
    expect(hashUserAgent("agen-a")).not.toBe(hashUserAgent("agen-b"));
  });
});

describe("createSession", () => {
  it("menulis tokenHash = hashToken(token)", async () => {
    const userId = await makeUser("pemilik");
    const token = "id-sesi-acak-123";

    const id = await createSession(db, {
      userId,
      token,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const row = await db.session.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.userId).toBe(userId);
  });

  it("token mentah tidak tersimpan di kolom mana pun", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-mentah-jangan-tersimpan";

    const id = await createSession(db, {
      userId,
      token,
      expiresAt: new Date(Date.now() + 60_000),
      userAgent: "Mozilla/5.0",
    });

    const values = await sessionRowValues(id);
    expect(values).not.toContain(token);
    // Tidak ada kolom yang mengandung token sebagai bagian dari nilainya.
    for (const value of values) {
      if (typeof value === "string") expect(value).not.toContain(token);
    }
  });
});

describe("isSessionValid", () => {
  it("true untuk token baru yang belum kedaluwarsa", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-aktif";
    await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });

    expect(await isSessionValid(db, { userId, token })).toBe(true);
  });

  it("false untuk token yang tidak dikenal", async () => {
    const userId = await makeUser("pemilik");

    expect(await isSessionValid(db, { userId, token: "token-tak-dikenal" })).toBe(false);
  });

  it("KRITIS: false bila userId bukan pemilik baris sesi", async () => {
    const pemilik = await makeUser("pemilik");
    const penyusup = await makeUser("penyusup");
    const token = "token-milik-pemilik";
    await createSession(db, { userId: pemilik, token, expiresAt: new Date(Date.now() + 60_000) });

    // Token benar, tetapi userId yang diminta milik pengguna lain.
    expect(await isSessionValid(db, { userId: penyusup, token })).toBe(false);
    // Kontrol: dengan userId yang benar, token itu valid.
    expect(await isSessionValid(db, { userId: pemilik, token })).toBe(true);
  });

  it("KRITIS: false untuk token yang sudah dicabut", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-akan-dicabut";
    await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });

    expect(await revokeSession(db, token)).toBe(1);
    expect(await isSessionValid(db, { userId, token })).toBe(false);
  });

  it("KRITIS: false untuk sesi kedaluwarsa lewat expiresAt di masa lalu", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-kedaluwarsa";
    await createSession(db, { userId, token, expiresAt: new Date(Date.now() - 1_000) });

    expect(await isSessionValid(db, { userId, token })).toBe(false);
  });

  it("KRITIS: false untuk sesi kedaluwarsa lewat parameter now (waktu maju)", async () => {
    // Beda dengan uji sebelumnya: barisnya dibuat masih berlaku, lalu waktu
    // "sekarang" dimajukan lewat `now`. Ini menguji perbandingan waktu di
    // dalam `isSessionValid` tanpa bergantung pada jam sistem.
    const userId = await makeUser("pemilik");
    const token = "token-masih-muda";
    const expiresAt = new Date(Date.now() + 60_000);
    await createSession(db, { userId, token, expiresAt });

    expect(await isSessionValid(db, { userId, token, now: new Date(expiresAt.getTime() - 1) })).toBe(
      true,
    );
    expect(await isSessionValid(db, { userId, token, now: new Date(expiresAt.getTime() + 1) })).toBe(
      false,
    );
  });

  it("KRITIS: false untuk pengguna berstatus disabled walau baris sesi masih ada", async () => {
    const userId = await makeUser("nonaktif");
    const token = "token-pengguna-nonaktif";
    await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });

    // Baris sesi sengaja TIDAK dihapus: status saja harus cukup menutup sesi.
    await db.user.update({ where: { id: userId }, data: { status: "disabled" } });

    expect(await isSessionValid(db, { userId, token })).toBe(false);
  });
});

describe("revokeSession", () => {
  it("mengembalikan 1 untuk token aktif, 0 untuk yang sudah dicabut, 0 untuk tak dikenal", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-untuk-dicabut";
    await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });

    expect(await revokeSession(db, token)).toBe(1);
    expect(await revokeSession(db, token)).toBe(0);
    expect(await revokeSession(db, "token-tak-dikenal")).toBe(0);
  });

  it("tidak menghapus baris: barisnya tetap ada dengan revokedAt terisi", async () => {
    const userId = await makeUser("pemilik");
    const token = "token-jejak-audit";
    const id = await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });

    await revokeSession(db, token);

    const row = await db.session.findUniqueOrThrow({ where: { id } });
    expect(row.revokedAt).not.toBeNull();
    expect(row.tokenHash).toBe(hashToken(token));
  });
});

describe("pruneSessions", () => {
  it("menghapus yang kedaluwarsa dan yang dicabut, mempertahankan yang aktif", async () => {
    const userId = await makeUser("pemilik");
    const now = new Date();

    const aktif = await createSession(db, {
      userId,
      token: "token-aktif",
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const kedaluwarsa = await createSession(db, {
      userId,
      token: "token-kedaluwarsa",
      expiresAt: new Date(now.getTime() - 60_000),
    });
    const dicabut = await createSession(db, {
      userId,
      token: "token-dicabut",
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await revokeSession(db, "token-dicabut");

    expect(await pruneSessions(db, now)).toBe(2);

    expect(await db.session.findUnique({ where: { id: aktif } })).not.toBeNull();
    expect(await db.session.findUnique({ where: { id: kedaluwarsa } })).toBeNull();
    expect(await db.session.findUnique({ where: { id: dicabut } })).toBeNull();
  });
});
