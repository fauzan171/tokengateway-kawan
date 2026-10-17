/**
 * Uji reset kata sandi token sekali pakai (WP-NT-P1-06, REQ-NT-16, SDD-5.1).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts` — pola yang sama
 * dengan `src/lib/jobs/queue.test.ts`: migrasi yang dikirim repo dijalankan apa
 * adanya, jadi uji ini sekaligus membuktikan tabel `PasswordResetToken` benar-
 * benar bisa dipakai.
 *
 * Bukti inti REQ-NT-16 ada di blok "token sekali pakai" (pemakaian kedua
 * DITOLAK) dan "kedaluwarsa" (geser `now` melewati TTL → DITOLAK). Keduanya
 * dibuktikan lewat `ok` DAN lewat hash kata sandi yang tidak berubah.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createSession, hashToken, isSessionValid } from "./session-store";
import { normalizeEmail } from "./users";
import {
  consumeResetToken,
  createResetToken,
  invalidateUserTokens,
  requestReset,
  resetRateLimitKey,
} from "./password-reset";
import { isRateLimited, rateLimitKey, recordAttempt } from "./rate-limit";

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
async function makeUser(email?: string, password = LAMA): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: email ?? `${id}@contoh.test` } });
  await db.credential.create({ data: { userId: id, passwordHash: await hashPassword(password) } });
  return id;
}

const hashOf = async (userId: string): Promise<string> =>
  (await db.credential.findUniqueOrThrow({ where: { userId } })).passwordHash;

async function makeSession(userId: string, label: string): Promise<string> {
  const token = `${label}-${randomUUID()}`;
  await createSession(db, { userId, token, expiresAt: new Date(Date.now() + 60_000) });
  return token;
}

describe("createResetToken", () => {
  it("token mentah tidak disimpan; yang masuk tabel hanya hash-nya", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");

    const { token, expiresAt } = await createResetToken(db, { userId, now, ttlSeconds: 3600 });

    expect(token).not.toBe("");
    expect(expiresAt.getTime()).toBe(now.getTime() + 3600 * 1000);

    const rows = await db.passwordResetToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(token));
    // Token mentah tidak muncul di mana pun pada baris tersebut.
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(rows[0]!.usedAt).toBeNull();
  });

  it("token baru membatalkan token lama pengguna yang sama", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");

    const first = await createResetToken(db, { userId, now });
    const second = await createResetToken(db, { userId, now });

    // Token lama sudah ditandai terpakai.
    const firstRow = await db.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(first.token) },
    });
    expect(firstRow.usedAt).not.toBeNull();

    // Dan benar-benar ditolak saat dicoba.
    const result = await consumeResetToken(db, { token: first.token, newPassword: BARU, now });
    expect(result.ok).toBe(false);

    // Token baru masih berlaku.
    const ok = await consumeResetToken(db, { token: second.token, newPassword: BARU, now });
    expect(ok.ok).toBe(true);
  });

  it("token milik pengguna lain tidak ikut dibatalkan", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");

    const tokenA = await createResetToken(db, { userId: a, now });
    await createResetToken(db, { userId: b, now });

    const result = await consumeResetToken(db, { token: tokenA.token, newPassword: BARU, now });
    expect(result.ok).toBe(true);
    expect(result.userId).toBe(a);
  });
});

describe("consumeResetToken — keberhasilan", () => {
  it("kata sandi berganti dan sandi baru lolos verifyPassword", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const sebelum = await hashOf(userId);

    const { token } = await createResetToken(db, { userId, now });
    const result = await consumeResetToken(db, { token, newPassword: BARU, now });

    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.userId).toBe(userId);

    const sesudah = await hashOf(userId);
    expect(sesudah).not.toBe(sebelum);
    expect(await verifyPassword(sesudah, BARU)).toBe(true);
    expect(await verifyPassword(sesudah, LAMA)).toBe(false);
  });

  it("token ditandai terpakai dengan waktu `now`", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const { token } = await createResetToken(db, { userId, now });

    await consumeResetToken(db, { token, newPassword: BARU, now });

    const row = await db.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(row.usedAt?.getTime()).toBe(now.getTime());
  });
});

describe("consumeResetToken — token sekali pakai (REQ-NT-16)", () => {
  it("KRITIS: pemakaian kedua DITOLAK dan kata sandi tidak berubah lagi", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const { token } = await createResetToken(db, { userId, now });

    const first = await consumeResetToken(db, { token, newPassword: BARU, now });
    expect(first.ok).toBe(true);
    const hashSetelahPertama = await hashOf(userId);

    // Percobaan kedua dengan sandi lain.
    const second = await consumeResetToken(db, {
      token,
      newPassword: "sandi-ketiga-yang-panjang",
      now,
    });
    expect(second.ok).toBe(false);
    expect(second.code).toBe("TOKEN_USED");
    expect(second.reason).toBeTruthy();

    // Bukti kuat: hash tidak berubah, jadi tidak ada penulisan kedua.
    expect(await hashOf(userId)).toBe(hashSetelahPertama);
    expect(await verifyPassword(hashSetelahPertama, "sandi-ketiga-yang-panjang")).toBe(false);
  });
});

describe("consumeResetToken — kedaluwarsa (REQ-NT-16)", () => {
  it("KRITIS: token kedaluwarsa DITOLAK dan kata sandi tidak berubah", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const sebelum = await hashOf(userId);

    const { token } = await createResetToken(db, { userId, now, ttlSeconds: 60 });

    // Geser `now` melewati TTL: token dibuat untuk 60 detik, dipakai 61 detik
    // kemudian. Kedaluwarsa dihitung dari DATA, bukan timer proses.
    const nanti = new Date(now.getTime() + 61 * 1000);
    const result = await consumeResetToken(db, { token, newPassword: BARU, now: nanti });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOKEN_EXPIRED");
    expect(await hashOf(userId)).toBe(sebelum);
  });

  it("tepat pada batas TTL sudah kedaluwarsa; satu milidetik sebelumnya masih berlaku", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const { token } = await createResetToken(db, { userId, now, ttlSeconds: 60 });

    // Batas mengikuti `isSessionValid` di session-store.ts: `expiresAt > now`
    // berarti valid, jadi tepat pada `expiresAt` token sudah tidak berlaku.
    const tepat = new Date(now.getTime() + 60 * 1000);
    expect((await consumeResetToken(db, { token, newPassword: BARU, now: tepat })).code).toBe(
      "TOKEN_EXPIRED",
    );

    const sebelum = new Date(now.getTime() + 60 * 1000 - 1);
    expect((await consumeResetToken(db, { token, newPassword: BARU, now: sebelum })).ok).toBe(true);
  });
});

describe("consumeResetToken — penolakan yang tidak melempar", () => {
  it("token kosong ditolak tanpa melempar", async () => {
    const result = await consumeResetToken(db, { token: "", newPassword: BARU });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOKEN_INVALID");
    expect(result.userId).toBeNull();
  });

  it("token spasi saja diperlakukan seperti kosong", async () => {
    const result = await consumeResetToken(db, { token: "   ", newPassword: BARU });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOKEN_INVALID");
  });

  it("token tidak dikenal ditolak tanpa melempar", async () => {
    const result = await consumeResetToken(db, { token: "token-yang-tidak-ada", newPassword: BARU });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOKEN_INVALID");
  });

  it("kata sandi terlalu pendek ditolak dan token TIDAK diklaim", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const { token } = await createResetToken(db, { userId, now });

    const result = await consumeResetToken(db, { token, newPassword: "pendek", now });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PASSWORD_TOO_SHORT");

    // Token belum terpakai, jadi masih bisa dipakai dengan sandi yang benar.
    const row = await db.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(row.usedAt).toBeNull();
    expect((await consumeResetToken(db, { token, newPassword: BARU, now })).ok).toBe(true);
  });

  it("alasan token sekali pakai dan kedaluwarsa BERBEDA", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");

    const { token: sekaliPakai } = await createResetToken(db, { userId, now });
    await consumeResetToken(db, { token: sekaliPakai, newPassword: BARU, now });
    const used = await consumeResetToken(db, { token: sekaliPakai, newPassword: BARU, now });

    const { token: kedaluwarsa } = await createResetToken(db, { userId, now, ttlSeconds: 1 });
    const expired = await consumeResetToken(db, {
      token: kedaluwarsa,
      newPassword: BARU,
      now: new Date(now.getTime() + 5_000),
    });

    expect(used.reason).not.toBe(expired.reason);
  });

  it("baris rusak (pengguna tanpa credential) ditolak tanpa melempar", async () => {
    const id = randomUUID();
    await db.user.create({ data: { id, email: `${id}@contoh.test` } });
    // Sengaja tanpa Credential.
    const now = new Date("2026-10-16T10:00:00.000Z");
    const { token } = await createResetToken(db, { userId: id, now });

    const result = await consumeResetToken(db, { token, newPassword: BARU, now });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("USER_MISSING");

    // Transaksi digagalkan: token tidak boleh tersisa terklaim tanpa efek.
    const row = await db.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
    });
    expect(row.usedAt).toBeNull();
  });
});

describe("consumeResetToken — pencabutan sesi (REQ-NT-16)", () => {
  it("KRITIS: setelah reset, sesi lama pengguna dicabut", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const sesiLama = await makeSession(userId, "lama");

    expect(await isSessionValid(db, { userId, token: sesiLama })).toBe(true);

    const { token } = await createResetToken(db, { userId, now });
    const result = await consumeResetToken(db, { token, newPassword: BARU, now });
    expect(result.ok).toBe(true);

    // Kata sandi berganti → perangkat lama kehilangan izin.
    expect(await isSessionValid(db, { userId, token: sesiLama, now })).toBe(false);
  });

  it("sesi pengguna LAIN tidak tersentuh", async () => {
    const userId = await makeUser();
    const lain = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");
    const sesiOrangLain = await makeSession(lain, "orang-lain");

    const { token } = await createResetToken(db, { userId, now });
    await consumeResetToken(db, { token, newPassword: BARU, now });

    expect(await isSessionValid(db, { userId: lain, token: sesiOrangLain, now })).toBe(true);
  });
});

describe("requestReset — tidak membocorkan keberadaan akun (REQ-NT-11)", () => {
  it("email tidak terdaftar: ok true TANPA token", async () => {
    const result = await requestReset(db, { email: "tidak-ada@contoh.test" });
    expect(result.ok).toBe(true);
    expect(result.token).toBeUndefined();
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  it("email terdaftar: ok true DENGAN token", async () => {
    const userId = await makeUser("ada@contoh.test");
    const result = await requestReset(db, { email: "ada@contoh.test" });
    expect(result.ok).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(result.expiresAt).toBeInstanceOf(Date);

    const row = await db.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(result.token!) },
    });
    expect(row.userId).toBe(userId);
  });

  it("email dinormalisasi: huruf besar dan spasi tetap menemukan akun", async () => {
    await makeUser("budi@contoh.test");
    const result = await requestReset(db, { email: "  BUDI@Contoh.TEST " });
    expect(result.ok).toBe(true);
    expect(result.token).toBeTruthy();
    expect(normalizeEmail("  BUDI@Contoh.TEST ")).toBe("budi@contoh.test");
  });

  it("email kosong: ok true tanpa token, tidak melempar", async () => {
    const result = await requestReset(db, { email: "" });
    expect(result.ok).toBe(true);
    expect(result.token).toBeUndefined();
  });
});

describe("pembatas laju permintaan reset (REQ-NT-16)", () => {
  it("kunci reset BERBEDA dari kunci login untuk email yang sama", () => {
    const input = { email: "  Budi@Contoh.TEST ", ip: "203.0.113.9" };
    const reset = resetRateLimitKey(input);
    const login = rateLimitKey(input);

    expect(reset).not.toBe(login);
    // Masih memakai bentuk yang sama: prefiks "reset:" lalu kunci login.
    expect(reset).toBe(`reset:${login}`);
  });

  it("normalisasi email tetap berlaku: huruf besar dan spasi berbagi satu kunci", () => {
    expect(resetRateLimitKey({ email: "BUDI@contoh.test" })).toBe(
      resetRateLimitKey({ email: "  budi@contoh.test  " }),
    );
  });

  it("percobaan reset memakai kunci reset, sehingga login tidak ikut terkunci", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    const input = { email: "budi@contoh.test" };
    const resetKey = resetRateLimitKey(input);
    const loginKey = rateLimitKey(input);

    // Tiga permintaan reset dengan batas dua.
    for (let i = 0; i < 3; i += 1) await recordAttempt(db, { key: resetKey, now });

    const resetStatus = await isRateLimited(db, { key: resetKey, now, limit: 2, windowSeconds: 900 });
    expect(resetStatus.limited).toBe(true);

    // Jalur login tetap bersih: hitungannya terpisah.
    const loginStatus = await isRateLimited(db, { key: loginKey, now, limit: 2, windowSeconds: 900 });
    expect(loginStatus.limited).toBe(false);
    expect(loginStatus.remaining).toBe(2);
  });
});

describe("invalidateUserTokens", () => {
  it("menandai semua token yang belum terpakai dan mengembalikan jumlahnya", async () => {
    const userId = await makeUser();
    const now = new Date("2026-10-16T10:00:00.000Z");

    // Tiga token; `createResetToken` membatalkan yang sebelumnya, jadi untuk
    // menguji invalidate atas beberapa baris sekaligus kita tulis langsung.
    for (let i = 0; i < 3; i += 1) {
      await db.passwordResetToken.create({
        data: {
          id: randomUUID(),
          userId,
          tokenHash: hashToken(`token-${i}`),
          expiresAt: new Date(now.getTime() + 3_600_000),
          createdAt: now,
        },
      });
    }

    const count = await invalidateUserTokens(db, { userId, now });
    expect(count).toBe(3);
    // Idempoten: yang sudah terpakai tidak dihitung lagi.
    expect(await invalidateUserTokens(db, { userId, now })).toBe(0);
  });
});
