/**
 * Uji pencatatan pemakaian token (WP-NT-P3-15, REQ-NT-71).
 *
 * Memakai SQLite sementara dari helper bersama: migrasi dijalankan apa adanya
 * dari `prisma/migrations/sqlite`, jadi uji ini sekaligus membuktikan tabel
 * `UsageRecord` yang dikirim repo bisa dipakai.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { recordUsage, summarizeUsage, usageForChat } from "./usage";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

describe("recordUsage", () => {
  it("usage lengkap → reported=true, ketiga kolom terisi", async () => {
    const row = await recordUsage(db, {
      userId,
      chatId: null,
      model: "gpt-4o-mini",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    expect(row.reported).toBe(true);
    expect(row.promptTokens).toBe(10);
    expect(row.completionTokens).toBe(20);
    expect(row.totalTokens).toBe(30);
  });

  it("usage null → reported=false, kolom token null (bukan 0)", async () => {
    const row = await recordUsage(db, { userId, model: "m", usage: null });

    expect(row.reported).toBe(false);
    expect(row.promptTokens).toBeNull();
    expect(row.completionTokens).toBeNull();
    expect(row.totalTokens).toBeNull();

    // Bukti di DB, bukan hanya bentuk DTO.
    const raw = await db.usageRecord.findUniqueOrThrow({ where: { id: row.id } });
    expect(raw.promptTokens).toBeNull();
    expect(raw.reported).toBe(0);
  });

  it("usage undefined → reported=false, kolom token null", async () => {
    const row = await recordUsage(db, { userId, model: "m" });

    expect(row.reported).toBe(false);
    expect(row.promptTokens).toBeNull();
  });

  it("usage sebagian (hanya promptTokens) → reported=false", async () => {
    const row = await recordUsage(db, {
      userId,
      model: "m",
      usage: { promptTokens: 7 },
    });

    expect(row.reported).toBe(false);
    expect(row.promptTokens).toBe(7);
    expect(row.completionTokens).toBeNull();
    expect(row.totalTokens).toBeNull();
  });

  it("nilai negatif atau bukan angka → diperlakukan sebagai tidak dilaporkan", async () => {
    const row = await recordUsage(db, {
      userId,
      model: "m",
      usage: { promptTokens: -1, completionTokens: "20", totalTokens: 30 },
    });

    expect(row.reported).toBe(false);
    expect(row.promptTokens).toBeNull();
    expect(row.completionTokens).toBeNull();
    expect(row.totalTokens).toBe(30);
  });
});

describe("summarizeUsage", () => {
  it("tidak menjumlah baris reported=false, menghitungnya di unreportedCount", async () => {
    await recordUsage(db, {
      userId,
      model: "a",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    await recordUsage(db, {
      userId,
      model: "b",
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });
    await recordUsage(db, { userId, model: "c", usage: null });

    const summary = await summarizeUsage(db, { userId, since: new Date(0) });
    expect(summary).toEqual({
      totalTokens: 33,
      promptTokens: 11,
      completionTokens: 22,
      reportedCount: 2,
      unreportedCount: 1,
    });
  });

  it("hanya menghitung baris sejak `since`", async () => {
    const old = await recordUsage(db, {
      userId,
      model: "lama",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });
    await db.usageRecord.update({
      where: { id: old.id },
      data: { createdAt: new Date("2020-01-01T00:00:00Z") },
    });
    await recordUsage(db, {
      userId,
      model: "baru",
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const summary = await summarizeUsage(db, { userId, since: new Date("2024-01-01T00:00:00Z") });
    expect(summary.totalTokens).toBe(10);
    expect(summary.reportedCount).toBe(1);
  });

  it("tidak mencampur pengguna lain", async () => {
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });
    await recordUsage(db, {
      userId: other,
      model: "x",
      usage: { promptTokens: 100, completionTokens: 100, totalTokens: 200 },
    });

    const summary = await summarizeUsage(db, { userId, since: new Date(0) });
    expect(summary).toEqual({
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      reportedCount: 0,
      unreportedCount: 0,
    });
  });

  it("tabel kosong → ringkasan nol, tidak melempar", async () => {
    const summary = await summarizeUsage(db, { userId, since: new Date(0) });
    expect(summary).toEqual({
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      reportedCount: 0,
      unreportedCount: 0,
    });
  });
});

describe("usageForChat", () => {
  it("mengembalikan catatan chat milik pengguna, urut waktu menaik", async () => {
    const chat = await db.chat.create({
      data: { id: randomUUID(), userId, title: "c" },
    });
    await recordUsage(db, { userId, chatId: chat.id, model: "a", usage: null });
    await recordUsage(db, {
      userId,
      chatId: chat.id,
      model: "b",
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    });

    const rows = await usageForChat(db, chat.id, userId);
    expect(rows.map((r) => r.model)).toEqual(["a", "b"]);
  });

  it("chat milik pengguna lain → [] (tidak membocorkan)", async () => {
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });
    const chat = await db.chat.create({
      data: { id: randomUUID(), userId: other, title: "rahasia" },
    });
    await recordUsage(db, {
      userId: other,
      chatId: chat.id,
      model: "m",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    expect(await usageForChat(db, chat.id, userId)).toEqual([]);
  });

  it("chat tidak ada → []", async () => {
    expect(await usageForChat(db, "tidak-ada", userId)).toEqual([]);
  });
});
