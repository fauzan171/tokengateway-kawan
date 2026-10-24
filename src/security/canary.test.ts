/**
 * SDD-9.3 butir 1 — kanari rahasia tidak lolos ke keluaran yang bisa dilihat
 * pihak lain.
 *
 * Kanari disuntikkan lewat nama kunci yang JINAK (`note`) supaya yang menangkap
 * benar-benar lapis kedua (`redactString`), bukan pencocokan nama kunci.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../tests/helpers/auth-db";
import { createLogger, redact } from "@/lib/api/logger";
import { createChat } from "@/lib/chat/chats";
import { sendMessage } from "@/lib/chat/messages";
import { createShareLink, getPublicShare } from "@/lib/chat/share";
import { exportAll, exportChatJson } from "@/lib/chat/transfer";
import { usageCsv } from "@/lib/chat/usage";
import { getActiveConnection, listConnections } from "@/lib/connections/connections";
import type { Db } from "@/lib/db";

const CANARY = "sk-canary-" + "a".repeat(24);

const FIELDS = { requestId: "r1", route: "/uji", latencyMs: 1, result: "ok" };

describe("logger", () => {
  it("meredaksi kanari pada kunci yang namanya tidak sensitif", () => {
    expect(JSON.stringify(redact({ note: CANARY }))).not.toContain(CANARY);
  });

  it("meredaksi kanari di dalam Error.message", () => {
    expect(JSON.stringify(redact(new Error(`gagal memanggil ${CANARY}`)))).not.toContain(CANARY);
  });

  it("meredaksi kanari di kedalaman bersarang", () => {
    expect(JSON.stringify(redact({ a: { b: { c: { note: CANARY } } } }))).not.toContain(CANARY);
  });

  it("tidak merusak teks biasa yang bukan rahasia", () => {
    expect(redact({ note: "ringkas dokumen ini" })).toEqual({ note: "ringkas dokumen ini" });
  });

  it("createLogger menulis baris tanpa kanari ke sink", () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).error(FIELDS, { note: CANARY });
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(CANARY);
  });
});

it("model bernama kanari tetap muncul di CSV pemakaian (data milik pengguna)", () => {
  const csv = usageCsv([
    {
      id: "u1",
      chatId: null,
      model: CANARY,
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      reported: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  expect(csv).toContain(CANARY);
});

describe("keluaran yang bisa dilihat pihak lain", () => {
  let temp: TempDb;
  let db: Db;
  let userId: string;
  let chatId: string;

  beforeEach(async () => {
    temp = await createTempDb();
    db = temp.db;
    userId = randomUUID();
    await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
    const chat = await createChat(db, { userId, title: `Rahasia ${CANARY}` });
    chatId = chat.id;
    await sendMessage(db, {
      userId,
      chatId,
      content: `tolong olah ${CANARY}`,
      parentId: null,
      model: null,
      idempotencyKey: null,
    });
    // Baris koneksi nyata: ciphertext dan key mentah tidak boleh keluar lewat DTO.
    await db.connection.create({
      data: {
        id: randomUUID(),
        userId,
        name: "gw",
        baseUrl: "https://api.contoh.test/v1",
        apiKeyEncrypted: `cipher-${CANARY}`,
        apiKeyMask: "sk-…aaaa",
        keyId: "v1",
        isActive: 1,
        status: "active",
      },
    });
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("ekspor chat tidak memuat ciphertext koneksi", async () => {
    const json = JSON.stringify(await exportChatJson(db, userId, chatId));
    expect(json).not.toContain("cipher-");
    expect(json).not.toContain("apiKey");
    expect(json).not.toContain("apiKeyEncrypted");
  });

  it("arsip seluruh data tidak memuat ciphertext koneksi", async () => {
    expect(JSON.stringify(await exportAll(db, userId))).not.toContain("cipher-");
  });

  it("snapshot berbagi tidak memuat koneksi, system prompt, atau ciphertext", async () => {
    const link = await createShareLink(db, userId, chatId);
    const snapshot = JSON.stringify(await getPublicShare(db, link.token));
    expect(snapshot).not.toContain("cipher-");
    expect(snapshot).not.toContain("apiKey");
    expect(snapshot).not.toContain("modelRef");
  });

  it("DTO koneksi hanya memuat topeng, bukan ciphertext maupun kunci mentah", async () => {
    const [listed] = await listConnections(db, userId);
    const active = await getActiveConnection(db, userId);
    for (const dto of [listed, active]) {
      const json = JSON.stringify(dto);
      expect(json).not.toContain(CANARY);
      expect(json).not.toContain("cipher-");
      expect(json).not.toContain("apiKeyEncrypted");
      expect(dto?.apiKeyMask).toBe("sk-…aaaa");
    }
  });
});
