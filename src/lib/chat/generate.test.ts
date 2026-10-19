/**
 * Uji job `chat.generate` (WP-NT-P3-04, SDD-4.3, SDD-4.4, SDD-5.4, REQ-NT-71).
 *
 * Uji ini memakai fixture provider loopback (`tests/fixtures/provider-server`)
 * lewat `fetch` nyata, jadi jalur stream diuji sungguhan tanpa menyentuh
 * jaringan luar. Koneksi disemai dengan kunci terenkripsi asli supaya dekripsi
 * dan AAD ikut terbukti.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import {
  UNICODE_TEXT,
  modelFor,
  startProviderFixture,
  type ProviderFixture,
} from "../../../tests/fixtures/provider-server";
import { createChat } from "./chats";
import { runGeneration, type GenerateConfig } from "./generate";
import { sendMessage } from "./messages";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";
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
  const port = new URL(fixture.baseUrl).port;
  return {
    encryptionKey: ENCRYPTION_KEY,
    allowInsecureHttp: true,
    outboundAllowlist: [`127.0.0.1:${port}`],
  };
}

/** Menyiapkan chat + pesan + Generation lewat jalur produksi `sendMessage`. */
async function seedGeneration(scenario: Parameters<typeof modelFor>[0]) {
  const chat = await createChat(db, { userId });
  const sent = await sendMessage(db, {
    userId,
    chatId: chat.id,
    content: "Halo",
    parentId: null,
    model: modelFor(scenario),
    idempotencyKey: null,
  });
  return { chatId: chat.id, ...sent };
}

function run(generationId: string): Promise<void> {
  return runGeneration(db, config(), generationId, new AbortController().signal);
}

describe("runGeneration", () => {
  it("menyusun jawaban utuh walau potongan byte terbelah (unicode-split)", async () => {
    const { chatId, assistantMessageId, generationId } = await seedGeneration("unicode-split");

    await run(generationId);

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("complete");
    const parsed = JSON.parse(assistant.contentJson) as { parts: { text: string }[] };
    expect(parsed.parts.map((p) => p.text).join("")).toBe(UNICODE_TEXT);
    expect(parsed.parts.map((p) => p.text).join("")).not.toContain("�");

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
    expect(generation.finishedAt).not.toBeNull();
    expect(generation.chatId).toBe(chatId);
  });

  it("membaca usage bila gateway melaporkannya", async () => {
    const { generationId } = await seedGeneration("usage-present");

    await run(generationId);

    const usage = await db.usageRecord.findFirstOrThrow({ where: { userId } });
    expect(usage.reported).toBe(1);
    expect(usage.promptTokens).toBe(11);
    expect(usage.completionTokens).toBe(7);
    expect(usage.totalTokens).toBe(18);
  });

  it("tanpa usage: reported=0 dan angka token kosong, bukan nol karangan (REQ-NT-71)", async () => {
    const { generationId } = await seedGeneration("usage-absent");

    await run(generationId);

    const usage = await db.usageRecord.findFirstOrThrow({ where: { userId } });
    expect(usage.reported).toBe(0);
    expect(usage.promptTokens).toBeNull();
    expect(usage.completionTokens).toBeNull();
    expect(usage.totalTokens).toBeNull();
  });

  it("seq event monoton, tanpa duplikat, ditutup satu done", async () => {
    const { generationId } = await seedGeneration("usage-present");

    await run(generationId);

    const events = await db.generationEvent.findMany({
      where: { generationId },
      orderBy: { seq: "asc" },
    });
    const seqs = events.map((event) => event.seq);
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(events.at(-1)?.kind).toBe("done");
  });

  it("galat gateway 401 → status error + errorCode UNAUTHORIZED, bukan galat akun (SDD-5.4)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("unauthorized");

    await run(generationId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    expect(generation.errorCode).toBe("UNAUTHORIZED");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("error");

    const kinds = (
      await db.generationEvent.findMany({ where: { generationId }, orderBy: { seq: "asc" } })
    ).map((event) => event.kind);
    expect(kinds).toEqual(["error"]);
    expect(await db.usageRecord.count({ where: { userId } })).toBe(0);
  });

  it("mengirim riwayat ancestry + stream:true ke /chat/completions", async () => {
    const { generationId } = await seedGeneration("usage-absent");

    await run(generationId);

    const request = fixture.requests.at(-1);
    expect(request?.path).toBe("/chat/completions");
    expect(request?.headers["authorization"]).toBe("Bearer kunci-uji");
    const body = request?.body as { model: string; stream: boolean; messages: unknown[] };
    expect(body.stream).toBe(true);
    expect(body.model).toBe(modelFor("usage-absent"));
    expect(body.messages).toEqual([{ role: "user", content: "Halo" }]);
  });

  it("pembatalan sebelum potongan pertama: stopped, tanpa token (SDD-4.6)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("usage-present");
    // Bendera dipasang sebelum worker mulai: pemeriksaan pertama langsung
    // menghentikan loop, jadi tidak ada token yang ditulis.
    await db.generation.update({
      where: { id: generationId },
      data: { status: "streaming", cancelRequestedAt: new Date() },
    });

    await run(generationId);

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("stopped");
    expect(await db.chatMessagePart.count({ where: { messageId: assistantMessageId } })).toBe(0);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("stopped");
    expect(generation.finishedAt).not.toBeNull();

    const done = await db.generationEvent.findFirstOrThrow({
      where: { generationId, kind: "done" },
    });
    expect(JSON.parse(done.payloadJson)).toEqual({ status: "stopped" });
  });

  it("400 upstream → INVALID_UPSTREAM_REQUEST, status tercatat tanpa rahasia (AUD-02)", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    const { generationId } = await seedGeneration("bad-request");
    try {
      await run(generationId);
    } finally {
      spy.mockRestore();
    }

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    expect(generation.errorCode).toBe("INVALID_UPSTREAM_REQUEST");

    const logged = lines.join("\n");
    expect(logged).toContain('"upstreamStatus":400');
    expect(logged).toContain('"providerCode":"invalid_messages"');
    expect(logged).toContain('"upstreamRequestId":"req-uji-400"');
    // Body mentah dan kanari tidak boleh ikut tercatat.
    expect(logged).not.toContain("messages kosong");
    expect(logged).not.toContain("sk-canary-");
  });

  it("5xx tetap UPSTREAM_ERROR, bukan kode payload invalid", async () => {
    const { generationId } = await seedGeneration("server-error");

    await run(generationId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.errorCode).toBe("UPSTREAM_ERROR");
  });

  it("pohon tanpa pesan user (parentId NULL) → INVALID_ANCESTRY tanpa fetch (AUD-01)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("usage-present");
    const before = fixture.requests.length;
    // Bentuk data rusak: placeholder assistant lepas dari pesan user.
    await db.chatMessage.update({ where: { id: assistantMessageId }, data: { parentId: null } });

    await run(generationId);

    expect(fixture.requests.length).toBe(before);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    expect(generation.errorCode).toBe("INVALID_ANCESTRY");
    expect(generation.finishedAt).not.toBeNull();
  });

  it("koneksi tanpa kunci yang cocok → galat setup, tidak menulis event", async () => {
    await db.connection.deleteMany({ where: { userId } });
    const chat = await createChat(db, { userId });
    const sent = await sendMessage(db, {
      userId,
      chatId: chat.id,
      content: "Halo",
      parentId: null,
      model: modelFor("usage-present"),
      idempotencyKey: null,
    });

    await expect(run(sent.generationId)).rejects.toThrow();
    expect(await db.generationEvent.count({ where: { generationId: sent.generationId } })).toBe(0);
  });
});
