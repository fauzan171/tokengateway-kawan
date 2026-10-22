/**
 * Uji kirim pesan + idempotensi (WP-NT-P3-03, SDD-3.4, SDD-4.3, SDD-4.7).
 *
 * Dua lapis dalam satu berkas:
 *   - `lib`: `sendMessage`/`getChat` diuji langsung atas SQLite sementara.
 *   - route: handler HTTP diuji dengan sesi dan konfigurasi dipalsukan, pola
 *     yang sama dengan `models/route.test.ts`. Berkas uji route terpisah tidak
 *     boleh dibuat (batas file work package ini), jadi keduanya disatukan.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { getChat, sendMessage } from "./messages";
import { idempotencyDigest } from "./idempotency";

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

const { POST } = await import("@/app/api/kawan/v1/chat/[chatId]/messages/route");

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
    maxUploadBytes: 10 * 1024 * 1024,
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

function send(chatId: string, overrides: Record<string, unknown> = {}) {
  return sendMessage(db, {
    userId: state.userId,
    chatId,
    content: "Halo",
    parentId: null,
    model: null,
    idempotencyKey: null,
    ...overrides,
  });
}

describe("sendMessage", () => {
  it("menyisipkan pesan user, placeholder assistant, Generation, dan Job sekaligus", async () => {
    const chatId = await seedChat();

    const result = await send(chatId, { model: "gpt-4o-mini" });

    const userMsg = await db.chatMessage.findUniqueOrThrow({ where: { id: result.userMessageId } });
    expect(userMsg.role).toBe("user");
    expect(userMsg.status).toBe("complete");
    expect(userMsg.parentId).toBeNull();
    expect(userMsg.seq).toBe(1);
    expect(JSON.parse(userMsg.contentJson)).toEqual({ parts: [{ kind: "text", text: "Halo" }] });

    const part = await db.chatMessagePart.findFirstOrThrow({ where: { messageId: result.userMessageId } });
    expect(part.kind).toBe("text");
    expect(part.ordinal).toBe(0);
    expect(JSON.parse(part.payloadJson)).toEqual({ text: "Halo" });

    const assistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: result.assistantMessageId },
    });
    expect(assistant.role).toBe("assistant");
    expect(assistant.status).toBe("streaming");
    expect(assistant.parentId).toBe(result.userMessageId);
    expect(assistant.seq).toBe(2);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: result.generationId } });
    expect(generation.status).toBe("queued");
    expect(generation.chatId).toBe(chatId);
    expect(generation.userMessageId).toBe(result.userMessageId);
    expect(generation.assistantMessageId).toBe(result.assistantMessageId);
    expect(generation.jobId).not.toBeNull();

    const job = await db.job.findUniqueOrThrow({ where: { id: generation.jobId! } });
    expect(job.kind).toBe("chat.generate");
    expect(job.state).toBe("queued");
    expect(JSON.parse(job.payloadJson)).toEqual({ generationId: result.generationId });

    const chat = await db.chat.findUniqueOrThrow({ where: { id: chatId } });
    expect(chat.currentMessageId).toBe(result.assistantMessageId);
    expect(chat.modelRef).toBe("gpt-4o-mini");
  });

  it("kunci sama + body sama → hasil sama, tidak ada Generation kedua", async () => {
    const chatId = await seedChat();

    const first = await send(chatId, { idempotencyKey: "kunci-1" });
    const second = await send(chatId, { idempotencyKey: "kunci-1" });

    expect(second).toEqual(first);
    expect(await db.generation.count({ where: { chatId } })).toBe(1);
    expect(await db.chatMessage.count({ where: { chatId } })).toBe(2);
    expect(await db.job.count()).toBe(1);
  });

  it("kunci sama + body beda → 409", async () => {
    const chatId = await seedChat();
    await send(chatId, { idempotencyKey: "kunci-2", content: "Halo" });

    await expect(
      send(chatId, { idempotencyKey: "kunci-2", content: "Teks lain" }),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_CONFLICT" });
  });

  it("kunci beda → generasi baru", async () => {
    const chatId = await seedChat();

    const first = await send(chatId, { idempotencyKey: "kunci-a" });
    const second = await send(chatId, { idempotencyKey: "kunci-b" });

    expect(second.generationId).not.toBe(first.generationId);
    expect(await db.generation.count({ where: { chatId } })).toBe(2);
  });

  it("seq bertambah benar untuk pesan berurutan", async () => {
    const chatId = await seedChat();

    const one = await send(chatId, { idempotencyKey: "s1", content: "satu" });
    const two = await send(chatId, { idempotencyKey: "s2", content: "dua" });

    const rows = await db.chatMessage.findMany({ where: { chatId }, orderBy: { seq: "asc" } });
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.id)).toEqual([
      one.userMessageId,
      one.assistantMessageId,
      two.userMessageId,
      two.assistantMessageId,
    ]);
  });

  it("chat milik pengguna lain → 404, bukan 403", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreignChatId = await seedChat(otherUserId);

    await expect(send(foreignChatId)).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
    await expect(getChat(db, state.userId, foreignChatId)).rejects.toMatchObject({
      status: 404,
      code: "CHAT_NOT_FOUND",
    });
  });

  it("chat tidak ada → 404", async () => {
    await expect(send("chat-tidak-ada")).rejects.toMatchObject({ status: 404 });
  });

  it("parentId yang bukan pesan chat ini ditolak 400", async () => {
    const chatId = await seedChat();
    await expect(send(chatId, { parentId: "msg_asing" })).rejects.toMatchObject({ status: 400 });
  });

  it("content kosong / bukan teks ditolak 400", async () => {
    const chatId = await seedChat();
    await expect(send(chatId, { content: "   " })).rejects.toMatchObject({ status: 400 });
    await expect(send(chatId, { content: 123 })).rejects.toMatchObject({ status: 400 });
  });

  it("getChat mengembalikan chat + pesan urut seq dan currentMessageId", async () => {
    const chatId = await seedChat();
    const sent = await send(chatId, { content: "hai" });

    const { chat, messages } = await getChat(db, state.userId, chatId);
    expect(chat.currentMessageId).toBe(sent.assistantMessageId);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[0].content).toEqual({ parts: [{ kind: "text", text: "hai" }] });
    expect(messages[1].status).toBe("streaming");
  });

  it("digest kanonik: owner+operasi+chat ikut, payload berbeda menghasilkan kunci berbeda", () => {
    const base = { owner: "u1", operation: "chat.messages.send", chatId: "c1", payload: ["a", null, null, [], false] };
    expect(idempotencyDigest(base)).toBe(idempotencyDigest({ ...base }));
    // Kunci yang sama tidak boleh memutar ulang hasil milik owner/chat lain.
    expect(idempotencyDigest(base)).not.toBe(idempotencyDigest({ ...base, owner: "u2" }));
    expect(idempotencyDigest(base)).not.toBe(idempotencyDigest({ ...base, chatId: "c2" }));
    expect(idempotencyDigest(base)).not.toBe(idempotencyDigest({ ...base, operation: "chat.stop" }));
    // Payload yang berbeda (model lain, parent lain) harus berbeda.
    expect(idempotencyDigest(base)).not.toBe(idempotencyDigest({ ...base, payload: ["a", "msg_1", null, [], false] }));
    expect(idempotencyDigest(base)).not.toBe(idempotencyDigest({ ...base, payload: ["a", null, "gpt-4o", [], false] }));
  });
});

describe("POST /api/kawan/v1/chat/{chatId}/messages", () => {
  function request(chatId: string, body: unknown, key?: string): Request {
    return new Request(`http://localhost/api/kawan/v1/chat/${chatId}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  const ctx = (chatId: string) => ({ params: Promise.resolve({ chatId }) });

  it("belum masuk → 401", async () => {
    const chatId = await seedChat();
    state.userId = "";

    const res = await POST(request(chatId, { content: "Halo" }), ctx(chatId));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("sukses → 202 dengan id user/assistant/generation", async () => {
    const chatId = await seedChat();

    const res = await POST(request(chatId, { content: "Halo", model: "gpt-4o-mini" }), ctx(chatId));
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.userMessageId).toMatch(/^msg_/);
    expect(body.assistantMessageId).toMatch(/^msg_/);
    expect(body.generationId).toMatch(/^gen_/);
  });

  it("kunci sama + body sama → 202 dengan id yang sama", async () => {
    const chatId = await seedChat();

    const first = await (await POST(request(chatId, { content: "Halo" }, "h-1"), ctx(chatId))).json();
    const second = await (await POST(request(chatId, { content: "Halo" }, "h-1"), ctx(chatId))).json();

    expect(second).toEqual(first);
    expect(await db.generation.count({ where: { chatId } })).toBe(1);
  });

  it("kunci sama + body beda → 409", async () => {
    const chatId = await seedChat();
    await POST(request(chatId, { content: "Halo" }, "h-2"), ctx(chatId));

    const res = await POST(request(chatId, { content: "Beda" }, "h-2"), ctx(chatId));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("chat milik pengguna lain → 404 lewat HTTP", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreignChatId = await seedChat(otherUserId);

    const res = await POST(request(foreignChatId, { content: "Halo" }), ctx(foreignChatId));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("CHAT_NOT_FOUND");
  });

  it("body bukan objek → 400", async () => {
    const chatId = await seedChat();
    const res = await POST(request(chatId, ["bukan", "objek"]), ctx(chatId));
    expect(res.status).toBe(400);
  });
});

// FIX-06: admission documentIds mengisi manifest ChatDocument.
describe("sendMessage documentIds", () => {
  it("menautkan dokumen ready milik pengguna ke chat", async () => {
    const chatId = await seedChat();
    const doc = await db.document.create({
      data: { id: "doc_ok", userId: state.userId, filename: "a.txt", mime: "text/plain", sizeBytes: 1, storageKey: "k", status: "ready" },
    });
    await send(chatId, { documentIds: [doc.id] });
    const manifest = await db.chatDocument.findMany({ where: { chatId } });
    expect(manifest.map((m) => m.documentId)).toEqual([doc.id]);
  });

  it("menolak dokumen milik pengguna lain", async () => {
    const chatId = await seedChat();
    const other = await db.user.create({ data: { id: "u2", email: "u2@t.id" } });
    const doc = await db.document.create({
      data: { id: "doc_lain", userId: other.id, filename: "b.txt", mime: "text/plain", sizeBytes: 1, storageKey: "k", status: "ready" },
    });
    await expect(send(chatId, { documentIds: [doc.id] })).rejects.toMatchObject({ code: "INVALID_DOCUMENTS" });
    expect(await db.chatDocument.count({ where: { chatId } })).toBe(0);
  });
});
