/**
 * Uji stop/cancel + penyimpanan partial (WP-NT-P3-07, REQ-NT-23, SDD-4.6).
 *
 * Basis data SQLite sementara dengan migrasi yang dikirim repo, sama seperti
 * `queue.test.ts`. Chat/generasi dibuat lewat jalur produksi (`sendMessage`)
 * supaya bentuk data yang diuji identik dengan yang dilihat worker.
 *
 * Uji partial memakai `fetch` yang dipalsukan: server gateway tiruan menulis
 * potongan satu per satu dan menandai potongan yang SUDAH terkirim. Stop
 * diminta setelah 2 potongan, lalu dibuktikan tidak ada potongan ketiga yang
 * tersimpan — inilah inti "tidak ada token setelah stop".
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { createChat } from "./chats";
import { runGeneration, type GenerateConfig } from "./generate";
import { sendMessage } from "./messages";
import { requestStop, stopIfRequested } from "./stop";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";
import type { Db } from "@/lib/db";

const ENCRYPTION_KEY = Buffer.alloc(32, 7);
const BASE_URL = "https://gateway.contoh.test/v1";

let temp: TempDb;
let db: Db;
let userId: string;

function config(): GenerateConfig {
  return {
    encryptionKey: ENCRYPTION_KEY,
    allowInsecureHttp: false,
    outboundAllowlist: ["gateway.contoh.test"],
  };
}

async function seedUserWithConnection(): Promise<void> {
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });

  const connectionId = randomUUID();
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "gateway uji",
      baseUrl: BASE_URL,
      apiKeyEncrypted: encryptSecret({
        plaintext: "kunci-uji",
        key: ENCRYPTION_KEY,
        keyId: "v1",
        aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
      }),
      apiKeyMask: "kunci-****",
      keyId: "v1",
      isActive: 1,
      status: "active",
    },
  });
}

async function seedGeneration(): Promise<{ chatId: string; assistantMessageId: string; generationId: string }> {
  const chat = await createChat(db, { userId });
  const sent = await sendMessage(db, {
    userId,
    chatId: chat.id,
    content: "Halo",
    parentId: null,
    model: null,
    idempotencyKey: null,
  });
  return { chatId: chat.id, ...sent };
}

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  await seedUserWithConnection();
});

afterAll(async () => {
  await temp.cleanup();
});

describe("requestStop", () => {
  it("mengisi cancelRequestedAt pada generasi yang berjalan", async () => {
    const { chatId, generationId } = await seedGeneration();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });

    const result = await requestStop(db, { chatId, userId, generationId });

    expect(result).toEqual({ generationId, status: "streaming" });
    const row = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(row.cancelRequestedAt).not.toBeNull();
  });

  it("idempoten: stop dua kali tetap satu nilai, tidak melempar", async () => {
    const { chatId, generationId } = await seedGeneration();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });

    await requestStop(db, { chatId, userId, generationId });
    const first = (await db.generation.findUniqueOrThrow({ where: { id: generationId } }))
      .cancelRequestedAt;
    await requestStop(db, { chatId, userId, generationId });
    const second = (await db.generation.findUniqueOrThrow({ where: { id: generationId } }))
      .cancelRequestedAt;

    expect(second?.getTime()).toBe(first?.getTime());
  });

  it("generasi yang sudah complete tidak berubah", async () => {
    const { chatId, generationId } = await seedGeneration();
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const result = await requestStop(db, { chatId, userId, generationId });

    expect(result.status).toBe("complete");
    const row = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(row.cancelRequestedAt).toBeNull();
    expect(row.status).toBe("complete");
  });

  it("chat atau generasi milik pengguna lain → tidak ditemukan", async () => {
    const { generationId } = await seedGeneration();
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });

    await expect(
      requestStop(db, { chatId: "chat_orang_lain", userId: other, generationId }),
    ).rejects.toMatchObject({ code: "GENERATION_NOT_FOUND", status: 404 });
  });
});

describe("stopIfRequested", () => {
  it("false tanpa bendera, true setelah stop", async () => {
    const { chatId, generationId } = await seedGeneration();
    expect(await stopIfRequested(db, generationId)).toBe(false);

    await requestStop(db, { chatId, userId, generationId });
    expect(await stopIfRequested(db, generationId)).toBe(true);
  });
});

describe("worker menghormati pembatalan", () => {
  it("menyimpan partial setelah 2 potongan, tanpa potongan setelahnya", async () => {
    const { chatId, assistantMessageId, generationId } = await seedGeneration();
    await db.generation.update({ where: { id: generationId }, data: { status: "streaming" } });

    const frame = (text: string) =>
      `data: ${JSON.stringify({
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
      })}\n\n`;

    /** Menunggu sampai worker menyimpan `count` potongan. */
    const waitForParts = async (count: number) => {
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        if ((await db.chatMessagePart.count({ where: { messageId: assistantMessageId } })) >= count) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new Error("potongan tidak tersimpan sebelum batas waktu");
    };

    const encoder = new TextEncoder();
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode(frame("Satu ")));
          controller.enqueue(encoder.encode(frame("Dua ")));
          // Baru setelah dua potongan PERSISTED, minta stop; potongan ketiga
          // tetap dikirim gateway tetapi tidak boleh ditulis worker.
          await waitForParts(2);
          await requestStop(db, { chatId, userId, generationId });
          controller.enqueue(encoder.encode(frame("Tiga ")));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          try {
            controller.close();
          } catch {
            // Worker sudah membatalkan reader; tidak ada yang perlu ditutup.
          }
        },
      });
      return new Response(body, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    try {
      await runGeneration(db, config(), generationId, new AbortController().signal);
    } finally {
      spy.mockRestore();
    }

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("stopped");

    const parts = await db.chatMessagePart.findMany({
      where: { messageId: assistantMessageId },
      orderBy: { ordinal: "asc" },
    });
    const texts = parts.map((part) => (JSON.parse(part.payloadJson) as { text: string }).text);
    expect(texts).toEqual(["Satu ", "Dua "]);
    expect(texts.join("")).not.toContain("Tiga");

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("stopped");
    expect(generation.finishedAt).not.toBeNull();

    const done = await db.generationEvent.findFirst({
      where: { generationId, kind: "done" },
    });
    expect(done).not.toBeNull();
    expect(JSON.parse(done!.payloadJson)).toEqual({ status: "stopped" });
  });
});
