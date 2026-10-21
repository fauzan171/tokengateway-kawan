/**
 * Fencing worker (FIX-02, V02).
 *
 * Membuktikan bahwa worker yang lease-nya hilang berhenti menulis: tidak ada
 * part, event, atau status baru, dan generasi tidak ditutup sebagai `complete`.
 * Uji memakai fixture provider sungguhan lewat `runGeneration`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { modelFor, startProviderFixture, type ProviderFixture } from "../../../tests/fixtures/provider-server";
import { createChat } from "./chats";
import { runGeneration, type GenerateConfig } from "./generate";
import { sendMessage } from "./messages";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";
import { createFence } from "@/lib/jobs/fence";
import { claim, enqueue, heartbeat } from "@/lib/jobs/queue";
import type { Db } from "@/lib/db";

const ENCRYPTION_KEY = Buffer.alloc(32, 7);

let fixture: ProviderFixture;
let temp: TempDb;
let db: Db;
let userId: string;

beforeAll(async () => {
  fixture = await startProviderFixture();
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });

  const connectionId = randomUUID();
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "gateway uji",
      baseUrl: fixture.baseUrl,
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
});

function config(): GenerateConfig {
  return {
    encryptionKey: ENCRYPTION_KEY,
    allowInsecureHttp: true,
    outboundAllowlist: [`127.0.0.1:${new URL(fixture.baseUrl).port}`],
  };
}

async function seed(scenario: Parameters<typeof modelFor>[0]) {
  const chat = await createChat(db, { userId });
  const sent = await sendMessage(db, {
    userId,
    chatId: chat.id,
    content: "Halo",
    parentId: null,
    model: modelFor(scenario),
    idempotencyKey: null,
  });
  return sent;
}

/** Fence yang selalu melaporkan lease hilang. */
const lost = {
  held: async () => false,
  heldFresh: async () => false,
};

describe("fencing lease", () => {
  it("worker yang kehilangan lease tidak menulis part atau menutup generasi", async () => {
    const { generationId, assistantMessageId } = await seed("usage-present");

    // Lease hilang bukan kegagalan job: `runGeneration` berhenti diam-diam
    // tanpa menulis, dan worker tidak menutup job sebagai sukses.
    await runGeneration(db, config(), generationId, new AbortController().signal, lost);

    expect(await db.chatMessagePart.count({ where: { messageId: assistantMessageId } })).toBe(0);
    expect(await db.generationEvent.count({ where: { generationId } })).toBe(0);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("queued");
    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("streaming");
  });

  it("fence hidup tetap menulis seperti biasa", async () => {
    const { generationId, assistantMessageId } = await seed("usage-present");
    const jobId = await enqueue(db, { kind: "chat.generate", payload: { generationId } });
    const held = await claim(db, { workerId: "uji", id: jobId });
    const fence = createFence(db, { jobId, leaseToken: held!.leaseToken });

    await runGeneration(db, config(), generationId, new AbortController().signal, fence);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
    expect(await db.chatMessagePart.count({ where: { messageId: assistantMessageId } })).toBeGreaterThan(0);
  });

  it("lease yang kedaluwarsa di tengah jalan menghentikan tulisan", async () => {
    const { generationId } = await seed("usage-present");
    const jobId = await enqueue(db, { kind: "chat.generate", payload: { generationId } });
    const held = await claim(db, { workerId: "uji", id: jobId, leaseMs: 1 });
    const fence = createFence(db, { jobId, leaseToken: held!.leaseToken });
    // Tunggu lease benar-benar habis sebelum worker mulai.
    await new Promise((resolve) => setTimeout(resolve, 20));

    await runGeneration(db, config(), generationId, new AbortController().signal, fence);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("queued");
    expect(await db.generationEvent.count({ where: { generationId } })).toBe(0);
  });

  it("heartbeat yang telat tidak memperpanjang lease mati", async () => {
    const jobId = await enqueue(db, { kind: "chat.generate", payload: {} });
    const held = await claim(db, { workerId: "uji", id: jobId, leaseMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await heartbeat(db, held!, 60_000)).toBe(false);
  });
});
