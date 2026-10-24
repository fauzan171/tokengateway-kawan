/**
 * Uji memori eksplisit (FIX-13): consent, isolasi antar pengguna, koreksi
 * berversi, dan pencabutan yang menggugurkan turunan.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  buildMemoryContext,
  confirmProposal,
  correctMemory,
  createMemory,
  linkDependency,
  listMemories,
  MEMORY_LIMITS,
  revokeMemory,
} from "./store";

let temp: TempDb;
let db: Db;
let userId: string;
let otherId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  otherId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  await db.user.create({ data: { id: otherId, email: `${otherId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

async function seedChat(owner: string): Promise<string> {
  const id = `chat_${randomUUID()}`;
  await db.chat.create({ data: { id, userId: owner, title: "uji" } });
  return id;
}

describe("createMemory", () => {
  it("positif: butir eksplisit langsung aktif dengan provenance", async () => {
    const memory = await createMemory(db, {
      userId,
      text: "  Suka jawaban ringkas  ",
      category: "preference",
      sourceKind: "manual",
    });
    expect(memory.text).toBe("Suka jawaban ringkas");
    expect(memory.status).toBe("active");
    expect(memory.consent).toBe("explicit");
    expect(memory.version).toBe(1);
    expect(memory.parentId).toBeNull();
  });

  it("negatif: teks kosong / bukan string ditolak", async () => {
    await expect(createMemory(db, { userId, text: "   " })).rejects.toMatchObject({
      code: "INVALID_MEMORY_TEXT",
    });
    await expect(
      createMemory(db, { userId, text: 42 as unknown as string }),
    ).rejects.toMatchObject({ code: "INVALID_MEMORY_TEXT" });
  });

  it("negatif: teks kepanjangan ditolak, bukan dipotong", async () => {
    await expect(
      createMemory(db, { userId, text: "x".repeat(MEMORY_LIMITS.maxTextChars + 1) }),
    ).rejects.toMatchObject({ code: "MEMORY_TEXT_TOO_LONG" });
  });

  it("negatif: kategori asing ditolak", async () => {
    await expect(
      createMemory(db, { userId, text: "a", category: "ramalan" as never }),
    ).rejects.toMatchObject({ code: "INVALID_MEMORY_CATEGORY" });
  });

  it("negatif: scope chat tanpa chatId ditolak", async () => {
    await expect(
      createMemory(db, { userId, text: "a", scope: "chat" }),
    ).rejects.toMatchObject({ code: "MEMORY_CHAT_REQUIRED" });
  });

  it("negatif: chat milik pengguna lain tidak bisa dipakai (404, bukan 403)", async () => {
    const foreign = await seedChat(otherId);
    await expect(
      createMemory(db, { userId, text: "a", scope: "chat", chatId: foreign }),
    ).rejects.toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
  });

  it("usulan inferensi tidak aktif sampai ditinjau", async () => {
    const proposed = await createMemory(db, {
      userId,
      text: "Mungkin suka bahasa Indonesia",
      consent: "proposed",
    });
    expect(proposed.status).toBe("proposed");
    const active = await listMemories(db, { userId });
    expect(active.map((m) => m.id)).not.toContain(proposed.id);

    const confirmed = await confirmProposal(db, { userId, memoryId: proposed.id });
    expect(confirmed.status).toBe("active");
    expect(confirmed.consent).toBe("explicit");
  });

  it("negatif: konfirmasi butir yang bukan usulan ditolak", async () => {
    const memory = await createMemory(db, { userId, text: "fakta" });
    await expect(
      confirmProposal(db, { userId, memoryId: memory.id }),
    ).rejects.toMatchObject({ code: "MEMORY_NOT_PROPOSED" });
  });
});

describe("listMemories", () => {
  it("preferensi bertahan lintas sesi (dibaca ulang dari DB)", async () => {
    await createMemory(db, { userId, text: "Bahasa: Indonesia", category: "preference" });
    const rows = await listMemories(db, { userId });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("Bahasa: Indonesia");
  });

  it("negatif: memori pengguna lain tidak terbaca", async () => {
    await createMemory(db, { userId: otherId, text: "rahasia orang lain" });
    expect(await listMemories(db, { userId })).toEqual([]);
  });

  it("pencarian kata kunci dibatasi owner", async () => {
    await createMemory(db, { userId, text: "suka kopi tubruk" });
    await createMemory(db, { userId: otherId, text: "suka kopi tubruk" });
    const found = await listMemories(db, { userId, query: "kopi" });
    expect(found).toHaveLength(1);
    expect(found[0]?.text).toBe("suka kopi tubruk");
  });

  it("scope chat hanya memuat global + chat itu", async () => {
    const chatId = await seedChat(userId);
    const otherChat = await seedChat(userId);
    await createMemory(db, { userId, text: "global" });
    await createMemory(db, { userId, text: "chat satu", scope: "chat", chatId });
    await createMemory(db, { userId, text: "chat dua", scope: "chat", chatId: otherChat });

    const rows = await listMemories(db, { userId, chatId });
    expect(rows.map((m) => m.text).sort()).toEqual(["chat satu", "global"]);
  });
});

describe("correctMemory", () => {
  it("koreksi membuat versi baru, versi lama superseded dan tidak hilang", async () => {
    const v1 = await createMemory(db, {
      userId,
      text: "Zona waktu: WIB",
      category: "fact",
      sourceKind: "message",
      sourceRef: "msg_1",
      sourceRevision: 3,
    });
    const v2 = await correctMemory(db, { userId, memoryId: v1.id, text: "Zona waktu: WITA" });

    expect(v2.version).toBe(2);
    expect(v2.parentId).toBe(v1.id);
    expect(v2.sourceRef).toBe("msg_1");
    expect(v2.sourceRevision).toBe(3);

    const old = await db.memoryItem.findUnique({ where: { id: v1.id } });
    expect(old?.status).toBe("superseded");
    expect(old?.text).toBe("Zona waktu: WIB");
  });

  it("negatif: butir yang sudah dicabut tidak bisa dikoreksi", async () => {
    const memory = await createMemory(db, { userId, text: "a" });
    await revokeMemory(db, { userId, memoryId: memory.id });
    await expect(
      correctMemory(db, { userId, memoryId: memory.id, text: "b" }),
    ).rejects.toMatchObject({ code: "MEMORY_REVOKED" });
  });

  it("negatif: koreksi milik pengguna lain → 404", async () => {
    const memory = await createMemory(db, { userId: otherId, text: "a" });
    await expect(
      correctMemory(db, { userId, memoryId: memory.id, text: "b" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("revokeMemory", () => {
  it("butir yang dicabut tidak muncul pada run berikutnya", async () => {
    const memory = await createMemory(db, { userId, text: "Suka emoji" });
    const before = await buildMemoryContext(db, { userId });
    expect(before.system).toContain("Suka emoji");

    await revokeMemory(db, { userId, memoryId: memory.id });

    const after = await buildMemoryContext(db, { userId });
    expect(after.system).toBeNull();
    expect(after.used).toEqual([]);
  });

  it("summary turunan ikut gugur (rekursif)", async () => {
    const fact = await createMemory(db, { userId, text: "Fakta dasar" });
    const summary = await createMemory(db, { userId, text: "Ringkasan dari fakta" });
    const outer = await createMemory(db, { userId, text: "Ringkasan dari ringkasan" });
    await linkDependency(db, { userId, memoryId: summary.id, targetId: fact.id });
    await linkDependency(db, { userId, memoryId: outer.id, targetId: summary.id });

    const { revoked } = await revokeMemory(db, { userId, memoryId: fact.id });
    expect(revoked.sort()).toEqual([fact.id, summary.id, outer.id].sort());

    const rows = await listMemories(db, { userId });
    expect(rows).toEqual([]);
  });

  it("negatif: pencabutan milik pengguna lain → 404 dan butir tetap aktif", async () => {
    const memory = await createMemory(db, { userId: otherId, text: "a" });
    await expect(
      revokeMemory(db, { userId, memoryId: memory.id }),
    ).rejects.toMatchObject({ status: 404 });
    const row = await db.memoryItem.findUnique({ where: { id: memory.id } });
    expect(row?.status).toBe("active");
  });

  it("pencabutan kedua tidak menggandakan hasil", async () => {
    const memory = await createMemory(db, { userId, text: "a" });
    await revokeMemory(db, { userId, memoryId: memory.id });
    expect(await revokeMemory(db, { userId, memoryId: memory.id })).toEqual({ revoked: [] });
  });
});

describe("buildMemoryContext", () => {
  it("mode sementara tidak membaca memori", async () => {
    await createMemory(db, { userId, text: "Suka ringkas" });
    const ctx = await buildMemoryContext(db, { userId, ephemeral: true });
    expect(ctx).toEqual({ system: null, used: [] });
  });

  it("hanya active yang dipakai; proposed/revoked/superseded tidak", async () => {
    await createMemory(db, { userId, text: "aktif" });
    await createMemory(db, { userId, text: "usulan", consent: "proposed" });
    const revoked = await createMemory(db, { userId, text: "dicabut" });
    await revokeMemory(db, { userId, memoryId: revoked.id });
    const superseded = await createMemory(db, { userId, text: "lama" });
    await correctMemory(db, { userId, memoryId: superseded.id, text: "baru" });

    const ctx = await buildMemoryContext(db, { userId });
    expect(ctx.system).toContain("aktif");
    expect(ctx.system).toContain("baru");
    expect(ctx.system).not.toContain("usulan");
    expect(ctx.system).not.toContain("dicabut");
    expect(ctx.system).not.toContain("lama");
  });

  it("butir kedaluwarsa tidak dipakai", async () => {
    await createMemory(db, { userId, text: "kedaluwarsa", expiresAt: new Date(Date.now() - 1000) });
    const ctx = await buildMemoryContext(db, { userId });
    expect(ctx.system).toBeNull();
  });

  it("negatif: memori pengguna lain tidak masuk konteks", async () => {
    await createMemory(db, { userId: otherId, text: "rahasia" });
    expect(await buildMemoryContext(db, { userId })).toEqual({ system: null, used: [] });
  });

  it("menghormati anggaran karakter", async () => {
    for (let i = 0; i < 40; i++) {
      await createMemory(db, { userId, text: `${i} `.padEnd(200, "z") });
    }
    const ctx = await buildMemoryContext(db, { userId });
    const body = ctx.system ?? "";
    expect(body.length).toBeLessThanOrEqual(MEMORY_LIMITS.contextCharBudget + 400);
    expect(ctx.used.length).toBeGreaterThan(0);
    expect(ctx.used.length).toBeLessThan(40);
  });
});
