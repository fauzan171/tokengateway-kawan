/**
 * Uji pembatas laju login berbasis tabel (WP-NT-P1-04, REQ-NT-15, SDD-5.1).
 *
 * Memakai pola SQLite sementara yang sama dengan `src/lib/jobs/queue.test.ts`
 * (lewat helper bersama `tests/helpers/auth-db.ts`): migrasi yang dikirim repo
 * dijalankan apa adanya, jadi uji ini sekaligus membuktikan tabel
 * `LoginAttempt` benar-benar bisa dipakai.
 *
 * Bukti inti ada di blok "persistensi": hitungan dibaca dari koneksi KEDUA ke
 * database yang sama. Bila batas disimpan di memori proses, koneksi kedua
 * tidak akan melihatnya.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  clearAttempts,
  hashIp,
  isRateLimited,
  pruneAttempts,
  rateLimitKey,
  recordAttempt,
} from "./rate-limit";

const LIMIT = 5;
const WINDOW_S = 15 * 60;

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp.cleanup();
});

const KEY = "budi@contoh.test\u0000-";

/** Mencatat `n` percobaan gagal pada satu waktu tetap. */
async function record(key: string, n: number, at: Date): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await recordAttempt(db, { key, now: at });
  }
}

describe("pembatas laju login", () => {
  it("di bawah batas: tidak dibatasi dan sisa benar", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT - 2, now);

    const status = await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S });
    expect(status.limited).toBe(false);
    expect(status.remaining).toBe(2);
    expect(status.retryAfterSeconds).toBe(0);
  });

  it("tepat pada batas: dibatasi dengan retryAfter > 0", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT, now);

    const status = await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S });
    expect(status.limited).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("setelah jendela lewat: tidak lagi dibatasi", async () => {
    const start = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT, start);

    const later = new Date(start.getTime() + WINDOW_S * 1000 + 1);
    const status = await isRateLimited(db, {
      key: KEY,
      now: later,
      limit: LIMIT,
      windowSeconds: WINDOW_S,
    });
    expect(status.limited).toBe(false);
    expect(status.remaining).toBe(LIMIT);
  });

  it("hitungan bergulir: hanya percobaan di dalam jendela yang dihitung", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    // Dua percobaan lama (di luar jendela) tidak boleh ikut membebani.
    await record(KEY, 2, new Date(now.getTime() - WINDOW_S * 1000 - 60_000));
    await record(KEY, 3, now);

    const status = await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S });
    expect(status.limited).toBe(false);
    expect(status.remaining).toBe(2);
  });

  it("clearAttempts mengembalikan status tidak dibatasi", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT, now);
    expect((await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S })).limited)
      .toBe(true);

    const removed = await clearAttempts(db, { key: KEY });
    expect(removed).toBe(LIMIT);

    const status = await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S });
    expect(status.limited).toBe(false);
    expect(status.remaining).toBe(LIMIT);
  });

  it("pruneAttempts membuang yang kedaluwarsa dan mempertahankan yang berlaku", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    const stale = new Date(now.getTime() - WINDOW_S * 1000 - 1);
    await record(KEY, 3, stale);
    await record(KEY, 2, now);

    const removed = await pruneAttempts(db, now, WINDOW_S);
    expect(removed).toBe(3);

    const remaining = await db.loginAttempt.count({ where: { key: KEY } });
    expect(remaining).toBe(2);
  });

  it("kunci berbeda tidak saling mempengaruhi", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT, now);

    const other = await isRateLimited(db, {
      key: "siti@contoh.test\u0000-",
      now,
      limit: LIMIT,
      windowSeconds: WINDOW_S,
    });
    expect(other.limited).toBe(false);
  });

  it("tabel kosong dan nilai rusak tidak melempar", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");

    // Tabel kosong: tidak ada percobaan sama sekali.
    const empty = await isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: WINDOW_S });
    expect(empty).toEqual({ limited: false, retryAfterSeconds: 0, remaining: LIMIT });

    // Nilai konfigurasi rusak jatuh ke bawaan aman (5 / 15 menit), bukan
    // melempar. Tabel masih kosong, jadi hasilnya sama dengan kasus kosong.
    await expect(
      isRateLimited(db, { key: KEY, now, limit: Number.NaN, windowSeconds: WINDOW_S }),
    ).resolves.toEqual({ limited: false, retryAfterSeconds: 0, remaining: LIMIT });

    await expect(
      isRateLimited(db, { key: KEY, now, limit: LIMIT, windowSeconds: -1 }),
    ).resolves.toEqual({ limited: false, retryAfterSeconds: 0, remaining: LIMIT });

    // Membersihkan kunci yang tidak ada juga tidak melempar.
    await expect(clearAttempts(db, { key: "tidak-ada" })).resolves.toBe(0);
  });
});

describe("persistensi lewat koneksi kedua", () => {
  it("hitungan tercatat di tabel, terlihat oleh koneksi lain ke database yang sama", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    await record(KEY, LIMIT, now);

    // Koneksi kedua yang benar-benar terpisah dari singleton `getDb`.
    const second = new (await import("@/generated/prisma-sqlite/client")).PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${temp.file}` }),
    }) as unknown as Db;

    try {
      const seen = await isRateLimited(second, {
        key: KEY,
        now,
        limit: LIMIT,
        windowSeconds: WINDOW_S,
      });
      expect(seen.limited).toBe(true);
      expect(seen.remaining).toBe(0);

      // Penghapusan lewat koneksi kedua juga terlihat oleh koneksi pertama.
      expect(await clearAttempts(second, { key: KEY })).toBe(LIMIT);
      const afterClear = await isRateLimited(db, {
        key: KEY,
        now,
        limit: LIMIT,
        windowSeconds: WINDOW_S,
      });
      expect(afterClear.limited).toBe(false);
    } finally {
      await second.$disconnect();
    }
  });
});

describe("rateLimitKey", () => {
  it("menormalkan email sehingga beda huruf besar/kecil berbagi hitungan", () => {
    const a = rateLimitKey({ email: "  Budi@Contoh.COM  ", ip: "203.0.113.7" });
    const b = rateLimitKey({ email: "budi@contoh.com", ip: "203.0.113.7" });
    expect(a).toBe(b);
  });

  it("memisahkan hitungan per alamat IP", () => {
    const a = rateLimitKey({ email: "budi@contoh.com", ip: "203.0.113.7" });
    const b = rateLimitKey({ email: "budi@contoh.com", ip: "198.51.100.9" });
    expect(a).not.toBe(b);
  });

  it("tidak menyimpan alamat IP mentah; hanya hash-nya", () => {
    const key = rateLimitKey({ email: "budi@contoh.com", ip: "203.0.113.7" });
    expect(key).not.toContain("203.0.113.7");
    expect(key).toContain(hashIp("203.0.113.7"));
  });

  it("tanpa IP: kunci tetap berlaku, memakai penanda kosong", () => {
    expect(rateLimitKey({ email: "budi@contoh.com" })).toBe("budi@contoh.com\u0000-");
    expect(rateLimitKey({ email: "budi@contoh.com", ip: null })).toBe("budi@contoh.com\u0000-");
  });
});

describe("hashIp", () => {
  it("stabil dan berbeda antar alamat", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp(" 203.0.113.7 "));
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
    // 32 karakter hex = 128 bit.
    expect(hashIp("203.0.113.7")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("recordAttempt memakai id unik per baris", async () => {
    const now = new Date("2026-10-16T10:00:00.000Z");
    const before = await db.loginAttempt.count();
    await recordAttempt(db, { key: KEY, now });
    await recordAttempt(db, { key: KEY, now });

    const rows = await db.loginAttempt.findMany({ select: { id: true } });
    expect(rows).toHaveLength(before + 2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.every((r) => /^[0-9a-f-]{36}$/.test(r.id))).toBe(true);
  });
});
