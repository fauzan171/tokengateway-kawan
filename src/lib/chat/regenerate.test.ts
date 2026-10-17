/**
 * Uji regenerate + cabang assistant sibling (WP-NT-P3-08, REQ-NT-24, SDD-3.4).
 *
 * Dua lapis dalam satu berkas:
 *   - `lib`: `regenerate` diuji langsung atas SQLite sementara.
 *   - route: handler HTTP diuji dengan sesi dan konfigurasi dipalsukan, pola
 *     yang sama dengan `messages.test.ts`.
 *
 * Bukti inti: dua pesan assistant berbagi `parentId` yang sama (sibling), dan
 * konteks generasi baru mengikuti cabang baru — bukan cabang lama.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { sendMessage } from "./messages";
import { regenerate } from "./regenerate";
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
  "@/app/api/kawan/v1/chat/[chatId]/messages/[messageId]/regenerate/route"
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

async function seedChat(userId = state.userId): Promise<string> {
  const chat = await createChat(db, { userId });
  return chat.id;
}

/** Chat dengan satu pasang pesan user + assistant; mengembalikan id-nya. */
async function seedTurn(userId = state.userId) {
  const chatId = await seedChat(userId);
  const sent = await sendMessage(db, {
    userId,
    chatId,
    content: "Halo",
    parentId: null,
    model: null,
    idempotencyKey: null,
  });
  return { chatId, ...sent };
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

describe("regenerate", () => {
  it("membuat sibling: dua assistant berbagi parentId yang sama, yang lama tetap ada", async () => {
    const { chatId, userMessageId, assistantMessageId } = await seedTurn();

    const result = await regenerate(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    expect(result.assistantMessageId).not.toBe(assistantMessageId);

    const oldAssistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    const newAssistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: result.assistantMessageId },
    });

    expect(oldAssistant.role).toBe("assistant");
    expect(newAssistant.role).toBe("assistant");
    // Sibling: parent yang sama = pesan user yang dijawabnya, bukan jawaban lama.
    expect(newAssistant.parentId).toBe(userMessageId);
    expect(newAssistant.parentId).toBe(oldAssistant.parentId);

    const assistants = await db.chatMessage.findMany({
      where: { chatId, role: "assistant" },
      orderBy: { seq: "asc" },
    });
    expect(assistants.map((m) => m.id)).toEqual([assistantMessageId, result.assistantMessageId]);
    expect(new Set(assistants.map((m) => m.parentId)).size).toBe(1);
  });

  it("Chat.currentMessageId menunjuk sibling baru", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    const result = await regenerate(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.currentMessageId).toBe(result.assistantMessageId);
    expect(chat.currentMessageId).not.toBe(assistantMessageId);
  });

  it("konteks mengikuti cabang aktif: ancestry leaf baru lewat sibling baru, bukan yang lama", async () => {
    const { chatId, userMessageId, assistantMessageId } = await seedTurn();

    const result = await regenerate(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    const path = buildAncestryPath(await treeRows(chatId), result.assistantMessageId);
    const ids = path.map((n) => n.id);

    expect(ids).toContain(result.assistantMessageId);
    expect(ids).toContain(userMessageId);
    expect(ids).not.toContain(assistantMessageId);
    expect(ids.at(-1)).toBe(result.assistantMessageId);

    // Cabang lama masih dapat ditelusuri dari leaf lama, terpisah dari cabang baru.
    const oldPath = buildAncestryPath(await treeRows(chatId), assistantMessageId);
    expect(oldPath.map((n) => n.id)).toContain(assistantMessageId);
    expect(oldPath.map((n) => n.id)).not.toContain(result.assistantMessageId);
  });

  it("generasi baru berstatus queued dan punya Job chat.generate", async () => {
    const { chatId, userMessageId, assistantMessageId } = await seedTurn();

    const result = await regenerate(db, {
      chatId,
      userId: state.userId,
      messageId: assistantMessageId,
    });

    const generation = await db.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(generation.status).toBe("queued");
    expect(generation.chatId).toBe(chatId);
    expect(generation.userMessageId).toBe(userMessageId);
    expect(generation.assistantMessageId).toBe(result.assistantMessageId);
    expect(generation.jobId).not.toBeNull();

    const job = await db.job.findUniqueOrThrow({ where: { id: generation.jobId! } });
    expect(job.kind).toBe("chat.generate");
    expect(job.state).toBe("queued");
    expect(JSON.parse(job.payloadJson)).toEqual({ generationId: result.generationId });
  });

  it("model opsional mengisi Chat.modelRef", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    await regenerate(db, { chatId, userId: state.userId, messageId: assistantMessageId, model: "gpt-4o" });

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.modelRef).toBe("gpt-4o");
  });

  it("messageId berperan user → 400, bukan membuat cabang", async () => {
    const { chatId, userMessageId } = await seedTurn();

    await expect(
      regenerate(db, { chatId, userId: state.userId, messageId: userMessageId }),
    ).rejects.toMatchObject({ status: 400, code: "NOT_ASSISTANT" });

    expect(await db.generation.count({ where: { chatId } })).toBe(1);
  });

  it("messageId tidak ada → 404", async () => {
    const { chatId } = await seedTurn();

    await expect(
      regenerate(db, { chatId, userId: state.userId, messageId: "msg_tidak_ada" }),
    ).rejects.toMatchObject({ status: 404, code: "MESSAGE_NOT_FOUND" });
  });

  it("chat milik pengguna lain → 404, tanpa membocorkan keberadaannya", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedTurn(otherUserId);

    await expect(
      regenerate(db, { chatId: foreign.chatId, userId: state.userId, messageId: foreign.assistantMessageId }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
  });

  it("pesan assistant milik chat lain → 404", async () => {
    const mine = await seedTurn();
    const other = await seedTurn();

    await expect(
      regenerate(db, { chatId: mine.chatId, userId: state.userId, messageId: other.assistantMessageId }),
    ).rejects.toMatchObject({ status: 404, code: "MESSAGE_NOT_FOUND" });
  });
});

describe("POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/regenerate", () => {
  function request(chatId: string, messageId: string, body: unknown = {}): Request {
    return new Request(
      `http://localhost/api/kawan/v1/chat/${chatId}/messages/${messageId}/regenerate`,
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
    const { chatId, assistantMessageId } = await seedTurn();
    state.userId = "";

    const res = await POST(request(chatId, assistantMessageId), ctx(chatId, assistantMessageId));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("sukses → 202 dengan id assistant/generation", async () => {
    const { chatId, assistantMessageId } = await seedTurn();

    const res = await POST(
      request(chatId, assistantMessageId, { model: "gpt-4o-mini" }),
      ctx(chatId, assistantMessageId),
    );
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.assistantMessageId).toMatch(/^msg_/);
    expect(body.generationId).toMatch(/^gen_/);
    expect(body.assistantMessageId).not.toBe(assistantMessageId);
  });

  it("messageId berperan user → 400 lewat HTTP", async () => {
    const { chatId, userMessageId } = await seedTurn();

    const res = await POST(request(chatId, userMessageId), ctx(chatId, userMessageId));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("NOT_ASSISTANT");
  });

  it("chat milik pengguna lain → 404 lewat HTTP", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedTurn(otherUserId);

    const res = await POST(
      request(foreign.chatId, foreign.assistantMessageId),
      ctx(foreign.chatId, foreign.assistantMessageId),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("CHAT_NOT_FOUND");
  });
});
