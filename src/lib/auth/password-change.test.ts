/**
 * Uji ganti kata sandi + pencabutan sesi lain (WP-NT-P1-05, REQ-NT-14, SDD-5.1).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts` — pola yang sama
 * dengan `src/lib/jobs/queue.test.ts`: migrasi yang dikirim repo dijalankan apa
 * adanya, jadi uji ini sekaligus membuktikan skema benar-benar bisa dipakai
 * jalur ganti sandi. Baris `User`/`Credential` dibuat langsung supaya uji tidak
 * bergantung pada modul `users.ts`.
 *
 * Bukti inti REQ-NT-14 ada di blok "pencabutan sesi lain": dua sesi untuk satu
 * pengguna, ganti sandi dengan `keepSessionToken` = sesi pertama, lalu sesi
 * pertama tetap valid dan sesi kedua tidak.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";
import { createSession, isSessionValid } from "./session-store";
import { changePassword } from "./password-change";

const LAMA = "kata-sandi-lama-yang-panjang";
const BARU = "kata-sandi-baru-yang-panjang";

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp.cleanup();
});

/** Pengguna mentah dengan kredential ber-hash nyata. */
async function makeUser(password = LAMA): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${id}@contoh.test`, status: "active" } });
  await db.credential.create({ data: { userId: id, passwordHash: await hashPassword(password) } });
  return id;
}

const hashOf = async (userId: string): Promise<string> =>
  (await db.credential.findUniqueOrThrow({ where: { userId } })).passwordHash;

/** Sesi aktif baru; mengembalikan token mentahnya. */
async function makeSession(userId: string, label: string): Promise<string> {
  const token = `${label}-${randomUUID()}`;
  await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });
  return token;
}

describe("changePassword — penolakan tanpa perubahan", () => {
  it("kata sandi lama salah: ok false dan hash di database TIDAK berubah", async () => {
    const userId = await makeUser();
    const sebelum = await hashOf(userId);

    const result = await changePassword(db, {
      userId,
      currentPassword: "kata-sandi-lama-yang-SALAH",
      newPassword: BARU,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.revokedSessions).toBe(0);
    expect(result.reason).toBeTruthy();
    // Bukti kuat: hash lama identik, jadi tidak ada penulisan yang terjadi.
    expect(await hashOf(userId)).toBe(sebelum);
    // Kata sandi baru juga tidak boleh mendadak berlaku.
    expect(await verifyPassword(sebelum, BARU)).toBe(false);
  });

  it("kata sandi baru terlalu pendek: ditolak dan hash tidak berubah", async () => {
    const userId = await makeUser();
    const sebelum = await hashOf(userId);
    const pendek = "x".repeat(MIN_PASSWORD_LENGTH - 1);

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: pendek,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain(String(MIN_PASSWORD_LENGTH));
    expect(await hashOf(userId)).toBe(sebelum);
  });

  it("kata sandi baru sama dengan yang lama: ditolak dan hash tidak berubah", async () => {
    const userId = await makeUser();
    const sebelum = await hashOf(userId);

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: LAMA,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(await hashOf(userId)).toBe(sebelum);
  });

  it("pengguna tidak ada: tidak melempar, ok false", async () => {
    const result = await changePassword(db, {
      userId: randomUUID(),
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.revokedSessions).toBe(0);
    expect(result.reason).toBeTruthy();
  });
});

describe("changePassword — keberhasilan", () => {
  it("hash berubah dan kata sandi baru lolos verifyPassword", async () => {
    const userId = await makeUser();
    const sebelum = await hashOf(userId);

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();

    const sesudah = await hashOf(userId);
    expect(sesudah).not.toBe(sebelum);
    expect(await verifyPassword(sesudah, BARU)).toBe(true);
    // Kata sandi lama tidak lagi berlaku.
    expect(await verifyPassword(sesudah, LAMA)).toBe(false);
  });
});

describe("changePassword — pencabutan sesi lain (REQ-NT-14)", () => {
  it("KRITIS: sesi sekarang dipertahankan, sesi lain dicabut", async () => {
    const userId = await makeUser();
    const sesiSekarang = await makeSession(userId, "sekarang");
    const sesiLain = await makeSession(userId, "lain");

    // Keduanya valid sebelum ganti sandi.
    expect(await isSessionValid(db, { userId, token: sesiSekarang })).toBe(true);
    expect(await isSessionValid(db, { userId, token: sesiLain })).toBe(true);

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: sesiSekarang,
    });

    expect(result.ok).toBe(true);
    expect(result.revokedSessions).toBe(1);
    // Sesi sekarang bertahan; sesi lain kehilangan izin.
    expect(await isSessionValid(db, { userId, token: sesiSekarang })).toBe(true);
    expect(await isSessionValid(db, { userId, token: sesiLain })).toBe(false);
  });

  it("melaporkan jumlah sesi lain yang dicabut dengan benar (tiga sesi)", async () => {
    const userId = await makeUser();
    const sesiSekarang = await makeSession(userId, "sekarang");
    await makeSession(userId, "lain-1");
    await makeSession(userId, "lain-2");

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: sesiSekarang,
    });

    expect(result.ok).toBe(true);
    expect(result.revokedSessions).toBe(2);
    expect(await isSessionValid(db, { userId, token: sesiSekarang })).toBe(true);
  });

  it("keepSessionToken null: SEMUA sesi dicabut", async () => {
    const userId = await makeUser();
    const a = await makeSession(userId, "a");
    const b = await makeSession(userId, "b");

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: null,
    });

    expect(result.ok).toBe(true);
    expect(result.revokedSessions).toBe(2);
    expect(await isSessionValid(db, { userId, token: a })).toBe(false);
    expect(await isSessionValid(db, { userId, token: b })).toBe(false);
  });

  it("token yang dipertahankan bukan milik pengguna: semua sesi pengguna dicabut", async () => {
    const userId = await makeUser();
    const milikSendiri = await makeSession(userId, "sendiri");

    const result = await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      // Token asing: tidak cocok dengan baris mana pun milik pengguna ini.
      keepSessionToken: "token-milik-orang-lain",
    });

    expect(result.ok).toBe(true);
    expect(result.revokedSessions).toBe(1);
    expect(await isSessionValid(db, { userId, token: milikSendiri })).toBe(false);
  });

  it("sesi pengguna lain tidak tersentuh", async () => {
    const userId = await makeUser();
    const lain = await makeUser("kata-sandi-orang-lain-panjang");
    const sesiOrangLain = await makeSession(lain, "orang-lain");
    const sesiSendiri = await makeSession(userId, "sendiri");

    await changePassword(db, {
      userId,
      currentPassword: LAMA,
      newPassword: BARU,
      keepSessionToken: sesiSendiri,
    });

    expect(await isSessionValid(db, { userId: lain, token: sesiOrangLain })).toBe(true);
  });
});
