/**
 * Uji edit pesan (WP-NT-P3-09, REQ-NT-25, REQ-NT-26, SDD-3.4).
 *
 * Dua lapis dalam satu berkas: `editMessage` langsung atas SQLite sementara,
 * dan handler HTTP dengan sesi/konfigurasi dipalsukan (pola `regenerate.test.ts`).
 *
 * Bukti inti: `branch` membuat sibling user dengan parent yang sama lalu
 * memulai generasi untuk sibling itu; `inplace` tidak menambah baris; generasi
 * aktif menolak edit dengan 409.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { editMessage } from "./edit";
import { sendMessage } from "./messages";
import { buildAncestryPath, type TreeNode } from "./tree";

const state = vi.hoisted(() => ({
  userId: "",
  config: null as unknown as Config,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => (state.userId ? { user: { id: state.userId } } : null),
}));

vi.mock("@/lib/config/env", () => ({
  loadConfig: () => state.config,
}));

vi.mock("@/lib/api/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  redact: (v: unknown) => v,
  REDACTED: "[REDACTED]",
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

const { POST } = await import(
  "@/app/api/kawan/v1/chat/[chatId]/messages/[messageId]/edit/route"
);

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  state.userId = randomUUID();
  state.config = {
    databaseUrl: `file:${temp.file}`,
    encryptionKey: Buffer.alloc(32, 7),
    encryptionKeyId: "v1",
    authSecret: "rahasia-sesi-uji",
    loginRateLimitMax: 5,
    loginRateLimitWindowSeconds: 900,
    passwordResetTtlSeconds: 3600,
    emailConfigured: false,
    modelCacheTtlSeconds: 600,
    outboundAllowlist: [],
    allowInsecureHttp: false,
  };
  await db.user.create({ data: { id: state.userId, email: `${state.userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

/**
 * Satu giliran user + assistant yang sudah selesai. `sendMessage` selalu
 * meninggalkan generasi `queued`; ditutup di sini supaya fixture tidak
 * memicu penolakan 409 yang diuji terpisah.
 */
async function seedTurn(userId = state.userId) {
  const chat = await createChat(db, { userId });
  const sent = await sendMessage(db, {
    userId,
    chatId: chat.id,
    content: "Halo",
    parentId: null,
    model: null,
    idempotencyKey: null,
  });
  await db.generation.update({
    where: { id: sent.generationId },
    data: { status: "complete" },
  });
  return { chatId: chat.id, ...sent };
}

const TREE_FIELDS = {
  id: true,
  chatId: true,
  parentId: true,
  role: true,
  seq: true,
  status: true,
  contentJson: true,
} as const;

async function treeRows(chatId: string): Promise<TreeNode[]> {
  return db.chatMessage.findMany({ where: { chatId }, select: TREE_FIELDS });
}

function textOf(contentJson: string): string {
  const parsed = JSON.parse(contentJson) as { parts: { kind: string; text: string }[] };
  return parsed.parts.map((p) => p.text).join("");
}

describe("editMessage", () => {
  it("mode branch membuat sibling user dengan parent sama dan generasi baru", async () => {
    const { chatId, userMessageId, assistantMessageId } = await seedTurn();

    const result = await editMessage(db, {
      chatId,
      userId: state.userId,
      messageId: userMessageId,
      content: "Teks baru",
      mode: "branch",
    });

    expect(result.newMessageId).not.toBe(userMessageId);
    if (!("generationId" in result)) throw new Error("branch harus memulai generasi");

    const old = await db.chatMessage.findUniqueOrThrow({ where: { id: userMessageId } });
    const created = await db.chatMessage.findUniqueOrThrow({ where: { id: result.newMessageId } });

    expect(created.role).toBe("user");
    expect(created.parentId).toBe(old.parentId);
    expect(created.parentId).toBeNull();
    expect(textOf(created.contentJson)).toBe("Teks baru");
    // Cabang lama tetap utuh.
    expect(textOf(old.contentJson)).toBe("Halo");
    expect(await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } })).toBeTruthy();

    expect(result.siblings).toEqual([userMessageId, result.newMessageId]);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(generation.userMessageId).toBe(result.newMessageId);
    expect(generation.assistantMessageId).toBe(result.assistantMessageId);
    expect(generation.status).toBe("queued");

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.currentMessageId).toBe(result.assistantMessageId);
    expect(result.currentMessageId).toBe(result.assistantMessageId);
  });

  it("mode branch: konteks leaf baru lewat sibling baru, bukan pesan lama", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const result = await editMessage(db, {
      chatId,
      userId: state.userId,
      messageId: userMessageId,
      content: "Teks baru",
      mode: "branch",
    });
    if (!("assistantMessageId" in result)) throw new Error("branch harus memulai generasi");

    const ids = buildAncestryPath(await treeRows(chatId), result.assistantMessageId).map((n) => n.id);
    expect(ids).toEqual([result.newMessageId, result.assistantMessageId]);
    expect(ids).not.toContain(userMessageId);
  });

  it("mode inplace mengubah node yang sama tanpa menambah pesan", async () => {
    const { chatId, userMessageId } = await seedTurn();
    const before = await db.chatMessage.count({ where: { chatId } });

    const result = await editMessage(db, {
      chatId,
      userId: state.userId,
      messageId: userMessageId,
      content: "Teks baru",
      mode: "inplace",
    });

    expect(result.newMessageId).toBe(userMessageId);
    expect(result.siblings).toEqual([userMessageId]);
    expect(await db.chatMessage.count({ where: { chatId } })).toBe(before);
    expect(await db.generation.count({ where: { chatId } })).toBe(1);

    const row = await db.chatMessage.findUniqueOrThrow({ where: { id: userMessageId } });
    expect(textOf(row.contentJson)).toBe("Teks baru");
  });

  it("mode absen dianggap branch", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const result = await editMessage(db, {
      chatId,
      userId: state.userId,
      messageId: userMessageId,
      content: "Teks baru",
    });
    expect("generationId" in result).toBe(true);
  });

  it("generasi aktif → 409 GENERATION_IN_PROGRESS dan tidak ada tulisan", async () => {
    const { chatId, userMessageId, generationId } = await seedTurn();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });
    const before = await db.chatMessage.count({ where: { chatId } });

    await expect(
      editMessage(db, {
        chatId,
        userId: state.userId,
        messageId: userMessageId,
        content: "Teks baru",
        mode: "branch",
      }),
    ).rejects.toMatchObject({ status: 409, code: "GENERATION_IN_PROGRESS" });

    expect(await db.chatMessage.count({ where: { chatId } })).toBe(before);
  });

  it("generasi preparing/queued juga menolak", async () => {
    const { chatId, userMessageId, generationId } = await seedTurn();

    for (const status of ["preparing", "queued"]) {
      await db.generation.update({ where: { id: generationId }, data: { status } });
      await expect(
        editMessage(db, {
          chatId,
          userId: state.userId,
          messageId: userMessageId,
          content: "Teks baru",
          mode: "inplace",
        }),
      ).rejects.toMatchObject({ status: 409, code: "GENERATION_IN_PROGRESS" });
    }
  });

  it("pesan assistant → 400 NOT_USER", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    await expect(
      editMessage(db, {
        chatId,
        userId: state.userId,
        messageId: assistantMessageId,
        content: "Teks baru",
        mode: "branch",
      }),
    ).rejects.toMatchObject({ status: 400, code: "NOT_USER" });
  });

  it("content kosong → 400 INVALID_CONTENT", async () => {
    const { chatId, userMessageId } = await seedTurn();

    await expect(
      editMessage(db, {
        chatId,
        userId: state.userId,
        messageId: userMessageId,
        content: "   ",
        mode: "branch",
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CONTENT" });
  });

  it("mode tidak dikenal → 400 INVALID_MODE", async () => {
    const { chatId, userMessageId } = await seedTurn();

    await expect(
      editMessage(db, {
        chatId,
        userId: state.userId,
        messageId: userMessageId,
        content: "Teks baru",
        mode: "hapus",
      }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_MODE" });
  });

  it("chat milik pengguna lain → 404 CHAT_NOT_FOUND", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedTurn(otherUserId);

    await expect(
      editMessage(db, {
        chatId: foreign.chatId,
        userId: state.userId,
        messageId: foreign.userMessageId,
        content: "Teks baru",
        mode: "branch",
      }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
  });

  it("pesan milik chat lain → 404 MESSAGE_NOT_FOUND", async () => {
    const mine = await seedTurn();
    const other = await seedTurn();

    await expect(
      editMessage(db, {
        chatId: mine.chatId,
        userId: state.userId,
        messageId: other.userMessageId,
        content: "Teks baru",
        mode: "branch",
      }),
    ).rejects.toMatchObject({ status: 404, code: "MESSAGE_NOT_FOUND" });
  });
});

describe("POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/edit", () => {
  function request(chatId: string, messageId: string, body: unknown): Request {
    return new Request(
      `http://localhost/api/kawan/v1/chat/${chatId}/messages/${messageId}/edit`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  const ctx = (chatId: string, messageId: string) => ({
    params: Promise.resolve({ chatId, messageId }),
  });

  it("belum masuk → 401", async () => {
    const { chatId, userMessageId } = await seedTurn();
    state.userId = "";

    const res = await POST(
      request(chatId, userMessageId, { content: "x", mode: "branch" }),
      ctx(chatId, userMessageId),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("branch → 202 dengan id generasi dan sibling", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const res = await POST(
      request(chatId, userMessageId, { content: "Teks baru", mode: "branch" }),
      ctx(chatId, userMessageId),
    );
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.newMessageId).toMatch(/^msg_/);
    expect(body.assistantMessageId).toMatch(/^msg_/);
    expect(body.generationId).toMatch(/^gen_/);
    expect(body.siblings).toEqual([userMessageId, body.newMessageId]);
    expect(body.currentMessageId).toBe(body.assistantMessageId);
  });

  it("inplace → 200 tanpa id generasi", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const res = await POST(
      request(chatId, userMessageId, { content: "Teks baru", mode: "inplace" }),
      ctx(chatId, userMessageId),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.newMessageId).toBe(userMessageId);
    expect(body.siblings).toEqual([userMessageId]);
    expect(body).not.toHaveProperty("generationId");
  });

  it("generasi aktif → 409 lewat HTTP", async () => {
    const { chatId, userMessageId, generationId } = await seedTurn();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });

    const res = await POST(
      request(chatId, userMessageId, { content: "Teks baru", mode: "branch" }),
      ctx(chatId, userMessageId),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("GENERATION_IN_PROGRESS");
  });

  it("chat milik pengguna lain → 404 lewat HTTP", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedTurn(otherUserId);

    const res = await POST(
      request(foreign.chatId, foreign.userMessageId, { content: "x", mode: "branch" }),
      ctx(foreign.chatId, foreign.userMessageId),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("CHAT_NOT_FOUND");
  });
});
