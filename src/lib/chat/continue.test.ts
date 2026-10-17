/**
 * Uji lanjutkan jawaban (WP-NT-P3-10, REQ-NT-30, SDD-3.4).
 *
 * Dua lapis dalam satu berkas: `continueMessage` langsung atas SQLite sementara,
 * dan handler HTTP dengan sesi/konfigurasi dipalsukan (pola `regenerate.test.ts`).
 *
 * Bukti inti: output lama TIDAK berubah; node assistant baru digantung pada
 * jawaban lama sehingga jalur ancestry generasi baru memuat teks lama.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { continueMessage } from "./continue";
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
  "@/app/api/kawan/v1/chat/[chatId]/messages/[messageId]/continue/route"
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

/** Satu giliran selesai: generasi ditutup supaya tidak memicu penolakan 409. */
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
  await db.generation.update({ where: { id: sent.generationId }, data: { status: "complete" } });
  await db.chatMessage.update({
    where: { id: sent.assistantMessageId },
    data: { status: "complete", contentJson: JSON.stringify({ parts: [{ kind: "text", text: "Jawaban lama" }] }) },
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

describe("continueMessage", () => {
  it("membuat node assistant baru yang digantung pada jawaban lama; output lama utuh", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    const result = await continueMessage(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    expect(result.assistantMessageId).not.toBe(assistantMessageId);

    const old = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    const created = await db.chatMessage.findUniqueOrThrow({
      where: { id: result.assistantMessageId },
    });

    expect(JSON.parse(old.contentJson)).toEqual({ parts: [{ kind: "text", text: "Jawaban lama" }] });
    expect(old.status).toBe("complete");
    expect(created.role).toBe("assistant");
    expect(created.parentId).toBe(assistantMessageId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(generation.chatId).toBe(chatId);
    expect(generation.assistantMessageId).toBe(result.assistantMessageId);
    expect(generation.status).toBe("queued");
  });

  it("ancestry generasi baru memuat jawaban lama lalu node lanjutan", async () => {
    const { chatId, userMessageId, assistantMessageId } = await seedTurn();

    const result = await continueMessage(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    const ids = buildAncestryPath(await treeRows(chatId), result.assistantMessageId).map((n) => n.id);
    expect(ids).toEqual([userMessageId, assistantMessageId, result.assistantMessageId]);
  });

  it("Chat.currentMessageId menunjuk node lanjutan", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    const result = await continueMessage(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.currentMessageId).toBe(result.assistantMessageId);
  });

  it("model opsional mengisi Chat.modelRef", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    await continueMessage(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
      model: "gpt-4o",
    });

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.modelRef).toBe("gpt-4o");
  });

  it("messageId berperan user → 400 NOT_ASSISTANT", async () => {
    const { chatId, userMessageId } = await seedTurn();

    await expect(
      continueMessage(db, { chatId, userId: state.userId, messageId: userMessageId }),
    ).rejects.toMatchObject({ status: 400, code: "NOT_ASSISTANT" });
  });

  it("generasi aktif → 409 GENERATION_IN_PROGRESS", async () => {
    const { chatId, assistantMessageId, generationId } = await seedTurn();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });

    await expect(
      continueMessage(db, { chatId, userId: state.userId, messageId: assistantMessageId }),
    ).rejects.toMatchObject({ status: 409, code: "GENERATION_IN_PROGRESS" });
  });

  it("pesan tidak ada → 404", async () => {
    const { chatId } = await seedTurn();

    await expect(
      continueMessage(db, { chatId, userId: state.userId, messageId: "msg_tidak_ada" }),
    ).rejects.toMatchObject({ status: 404, code: "MESSAGE_NOT_FOUND" });
  });

  it("chat milik pengguna lain → 404 CHAT_NOT_FOUND", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedTurn(otherUserId);

    await expect(
      continueMessage(db, {
        chatId: foreign.chatId,
        userId: state.userId,
        messageId: foreign.assistantMessageId,
      }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
  });
});

describe("POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/continue", () => {
  function request(chatId: string, messageId: string, body?: unknown): Request {
    return new Request(
      `http://localhost/api/kawan/v1/chat/${chatId}/messages/${messageId}/continue`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
  }

  const ctx = (chatId: string, messageId: string) => ({
    params: Promise.resolve({ chatId, messageId }),
  });

  it("belum masuk → 401", async () => {
    const { chatId, assistantMessageId } = await seedTurn();
    state.userId = "";

    const res = await POST(request(chatId, assistantMessageId), ctx(chatId, assistantMessageId));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("sukses tanpa body → 202", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    const res = await POST(request(chatId, assistantMessageId), ctx(chatId, assistantMessageId));
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.assistantMessageId).toMatch(/^msg_/);
    expect(body.generationId).toMatch(/^gen_/);
  });

  it("messageId berperan user → 400 lewat HTTP", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const res = await POST(request(chatId, userMessageId), ctx(chatId, userMessageId));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("NOT_ASSISTANT");
  });
});
