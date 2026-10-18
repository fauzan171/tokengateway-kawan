/**
 * Uji pesan sistem per chat (WP-NT-P3-12, REQ-NT-31).
 *
 * Dua lapis dalam satu berkas, pola sama dengan `messages.test.ts`:
 *   - `lib`: `setSystemPrompt`/`getSystemPrompt`/`deleteSystemPrompt` atas
 *     SQLite sementara.
 *   - route: handler HTTP `PUT`/`DELETE` dengan sesi, konfigurasi, dan logger
 *     dipalsukan.
 *
 * Uji "tidak muncul di daftar yang dirender" memakai `buildAncestryPath` —
 * pohon pesan yang sesungguhnya dikirim ke gateway — bukan daftar datar
 * `getChat`, yang sampai penyaringan di `messages.ts` masih memuat baris
 * sistem (lihat catatan di `system-prompt.ts`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { sendMessage } from "./messages";
import { deleteSystemPrompt, getSystemPrompt, setSystemPrompt } from "./system-prompt";
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

const { PUT, DELETE } = await import("@/app/api/kawan/v1/chat/[chatId]/system/route");

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
  return (await createChat(db, { userId })).id;
}

async function otherUser(): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${id}@contoh.test` } });
  return id;
}

describe("setSystemPrompt / getSystemPrompt / deleteSystemPrompt", () => {
  it("set lalu get → nilai sama", async () => {
    const chatId = await seedChat();
    const saved = await setSystemPrompt(db, {
      chatId,
      userId: state.userId,
      content: "Jawab dalam bahasa Indonesia.",
    });

    expect(saved).toBe("Jawab dalam bahasa Indonesia.");
    expect(await getSystemPrompt(db, chatId)).toBe("Jawab dalam bahasa Indonesia.");
  });

  it("set ulang mengganti, hanya satu baris sistem", async () => {
    const chatId = await seedChat();
    await setSystemPrompt(db, { chatId, userId: state.userId, content: "satu" });
    await setSystemPrompt(db, { chatId, userId: state.userId, content: "dua" });

    expect(await getSystemPrompt(db, chatId)).toBe("dua");
    expect(await db.chatMessage.count({ where: { chatId, role: "system" } })).toBe(1);
  });

  it("string kosong / whitespace → terhapus, get → null", async () => {
    const chatId = await seedChat();
    await setSystemPrompt(db, { chatId, userId: state.userId, content: "ada isi" });

    expect(await setSystemPrompt(db, { chatId, userId: state.userId, content: "   " })).toBeNull();
    expect(await getSystemPrompt(db, chatId)).toBeNull();
    expect(await db.chatMessage.count({ where: { chatId, role: "system" } })).toBe(0);
  });

  it("delete menghapus; get → null", async () => {
    const chatId = await seedChat();
    await setSystemPrompt(db, { chatId, userId: state.userId, content: "hapus aku" });

    await deleteSystemPrompt(db, { chatId, userId: state.userId });
    expect(await getSystemPrompt(db, chatId)).toBeNull();
  });

  it("terlalu panjang (8001) → ditolak dengan galat jelas", async () => {
    const chatId = await seedChat();
    await expect(
      setSystemPrompt(db, { chatId, userId: state.userId, content: "x".repeat(8001) }),
    ).rejects.toMatchObject({ status: 400, code: "SYSTEM_PROMPT_TOO_LONG" });

    // Tepat di batas tetap diterima.
    await expect(
      setSystemPrompt(db, { chatId, userId: state.userId, content: "x".repeat(8000) }),
    ).resolves.toHaveLength(8000);
  });

  it("konten bukan teks → ditolak 400", async () => {
    const chatId = await seedChat();
    await expect(
      setSystemPrompt(db, { chatId, userId: state.userId, content: 123 }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_SYSTEM_PROMPT" });
  });

  it("chat pengguna lain → tidak ditemukan (404), tidak bocor", async () => {
    const foreignChatId = await seedChat(await otherUser());

    await expect(
      setSystemPrompt(db, { chatId: foreignChatId, userId: state.userId, content: "halo" }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
    await expect(
      deleteSystemPrompt(db, { chatId: foreignChatId, userId: state.userId }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
    // getSystemPrompt sengaja tidak melempar; chat asing = tidak ada.
    expect(await getSystemPrompt(db, foreignChatId)).toBeNull();
  });

  it("chat tidak ada → tidak ditemukan (404)", async () => {
    await expect(
      setSystemPrompt(db, { chatId: "chat-tidak-ada", userId: state.userId, content: "halo" }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
    await expect(
      deleteSystemPrompt(db, { chatId: "chat-tidak-ada", userId: state.userId }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
  });

  it("getSystemPrompt chat tanpa sistem → null", async () => {
    const chatId = await seedChat();
    expect(await getSystemPrompt(db, chatId)).toBeNull();
  });

  it("pesan sistem tidak muncul di pohon pesan yang dirender", async () => {
    const chatId = await seedChat();
    await setSystemPrompt(db, { chatId, userId: state.userId, content: "INSTRUKSI RAHASIA" });
    const sent = await sendMessage(db, {
      userId: state.userId,
      chatId,
      content: "Halo",
      parentId: null,
      model: null,
      idempotencyKey: null,
    });

    const rows = await db.chatMessage.findMany({
      where: { chatId },
      select: {
        id: true,
        chatId: true,
        parentId: true,
        role: true,
        seq: true,
        status: true,
        contentJson: true,
      },
      orderBy: { seq: "asc" },
    });

    // Baris sistem ada di DB...
    expect(rows.some((r) => r.role === "system")).toBe(true);
    // ...tetapi jalur ancestry leaf percakapan hanya berisi user + assistant.
    const path = buildAncestryPath(rows as TreeNode[], sent.assistantMessageId);
    expect(path.map((n) => n.role)).toEqual(["user", "assistant"]);
    expect(path.some((n) => n.role === "system")).toBe(false);
  });
});

describe("PUT/DELETE /api/kawan/v1/chat/{chatId}/system", () => {
  const ctx = (chatId: string) => ({ params: Promise.resolve({ chatId }) });

  function put(chatId: string, body: unknown): Request {
    return new Request(`http://localhost/api/kawan/v1/chat/${chatId}/system`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function del(chatId: string): Request {
    return new Request(`http://localhost/api/kawan/v1/chat/${chatId}/system`, {
      method: "DELETE",
    });
  }

  it("belum masuk → 401", async () => {
    const chatId = await seedChat();
    state.userId = "";
    const res = await PUT(put(chatId, { content: "halo" }), ctx(chatId));
    expect(res.status).toBe(401);
  });

  it("PUT sukses → 200 dengan systemPrompt", async () => {
    const chatId = await seedChat();
    const res = await PUT(put(chatId, { content: "Ringkas." }), ctx(chatId));
    expect(res.status).toBe(200);
    expect((await res.json()).systemPrompt).toBe("Ringkas.");
  });

  it("PUT kosong → 200 dengan systemPrompt null", async () => {
    const chatId = await seedChat();
    await PUT(put(chatId, { content: "ada" }), ctx(chatId));
    const res = await PUT(put(chatId, { content: "" }), ctx(chatId));
    expect(res.status).toBe(200);
    expect((await res.json()).systemPrompt).toBeNull();
  });

  it("PUT terlalu panjang → 400 SYSTEM_PROMPT_TOO_LONG", async () => {
    const chatId = await seedChat();
    const res = await PUT(put(chatId, { content: "x".repeat(8001) }), ctx(chatId));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("SYSTEM_PROMPT_TOO_LONG");
  });

  it("PUT chat asing → 404 CHAT_NOT_FOUND", async () => {
    const foreignChatId = await seedChat(await otherUser());
    const res = await PUT(put(foreignChatId, { content: "halo" }), ctx(foreignChatId));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("CHAT_NOT_FOUND");
  });

  it("DELETE → 200 deleted:true, sistem hilang", async () => {
    const chatId = await seedChat();
    await PUT(put(chatId, { content: "hapus" }), ctx(chatId));
    const res = await DELETE(del(chatId), ctx(chatId));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    expect(await getSystemPrompt(db, chatId)).toBeNull();
  });
});
