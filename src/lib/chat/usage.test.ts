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
import { recordUsage, summarizeUsage, usageByDay, usageByModel, usageCsv, usageForChat } from "./usage";

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

describe("usageByDay", () => {
  async function seed(model: string, at: string, usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null) {
    const row = await recordUsage(db, { userId, model, usage });
    await db.usageRecord.update({ where: { id: row.id }, data: { createdAt: new Date(at) } });
  }

  it("dua baris di hari sama → satu baris, token dijumlah", async () => {
    await seed("a", "2026-01-02T08:00:00Z", { promptTokens: 1, completionTokens: 2, totalTokens: 3 });
    await seed("b", "2026-01-02T20:00:00Z", { promptTokens: 4, completionTokens: 5, totalTokens: 9 });

    const { reported, rows } = await usageByDay(db, {
      userId,
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });

    expect(reported).toBe(true);
    expect(rows).toEqual([
      { day: "2026-01-02", promptTokens: 5, completionTokens: 7, totalTokens: 12, unreported: 0 },
    ]);
  });

  it("baris reported=0 masuk unreported, bukan token", async () => {
    await seed("a", "2026-01-02T08:00:00Z", { promptTokens: 1, completionTokens: 1, totalTokens: 2 });
    await seed("a", "2026-01-02T09:00:00Z", null);

    const { rows } = await usageByDay(db, {
      userId,
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });

    expect(rows[0]).toMatchObject({ totalTokens: 2, unreported: 1 });
  });

  it("semua baris reported=0 → reported=false", async () => {
    await seed("a", "2026-01-02T08:00:00Z", null);
    await seed("b", "2026-01-03T08:00:00Z", null);

    const result = await usageByDay(db, {
      userId,
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });

    expect(result.reported).toBe(false);
    expect(result.rows.every((row) => row.totalTokens === 0)).toBe(true);
  });

  it("tabel kosong → reported=true, rows=[]", async () => {
    const result = await usageByDay(db, {
      userId,
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-01-31T00:00:00Z"),
    });
    expect(result).toEqual({ reported: true, rows: [] });
  });
});

describe("usageByModel", () => {
  it("mengelompokkan per model dan mengurutkan total menurun", async () => {
    await recordUsage(db, { userId, model: "kecil", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } });
    await recordUsage(db, { userId, model: "besar", usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } });
    await recordUsage(db, { userId, model: "besar", usage: null });

    const { reported, rows } = await usageByModel(db, {
      userId,
      from: new Date(0),
      to: new Date("2100-01-01T00:00:00Z"),
    });

    expect(reported).toBe(true);
    expect(rows.map((row) => row.model)).toEqual(["besar", "kecil"]);
    expect(rows[0]).toEqual({ model: "besar", promptTokens: 5, completionTokens: 5, totalTokens: 10, unreported: 1 });
  });
});

describe("usageCsv", () => {
  const base = {
    id: "u1",
    chatId: null,
    reported: true,
    createdAt: "2026-01-02T08:00:00.000Z",
  };

  it("header persis, BOM di awal, akhir baris CRLF", () => {
    const csv = usageCsv([]);
    expect(csv).toBe(
      "﻿created_at,model,prompt_tokens,completion_tokens,total_tokens,reported\r\n",
    );
  });

  it("nilai null → sel kosong, bukan 0", () => {
    const csv = usageCsv([
      { ...base, model: "m", promptTokens: null, completionTokens: null, totalTokens: null, reported: false },
    ]);
    expect(csv.split("\r\n")[1]).toBe("2026-01-02T08:00:00.000Z,m,,,,false");
  });

  it("model dengan koma dan quote dikutip, quote di-escape", () => {
    const csv = usageCsv([
      { ...base, model: 'a,b"c', promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    ]);
    expect(csv.split("\r\n")[1]).toBe('2026-01-02T08:00:00.000Z,"a,b""c",1,2,3,true');
  });
});
