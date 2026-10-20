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
import { setSystemPrompt } from "./system-prompt";
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
    // Prompt bawaan selalu dikirim lebih dulu (WO-1), lalu riwayat.
    const sent = body.messages as { role: string; content: string }[];
    expect(sent).toHaveLength(2);
    expect(sent[0]?.role).toBe("system");
    expect(sent[0]?.content).toContain("Jawab dengan bahasa yang dipakai pengguna.");
    expect(sent[1]).toEqual({ role: "user", content: "Halo" });
  });

  it("mengirim system prompt pengguna tepat setelah prompt bawaan (WO-1)", async () => {
    const { chatId, generationId } = await seedGeneration("usage-absent");
    await setSystemPrompt(db, {
      chatId,
      userId,
      content: "Kamu adalah analis keuangan. Jawab dengan tabel.",
    });

    await run(generationId);

    const body = fixture.requests.at(-1)?.body as { messages: { role: string; content: string }[] };
    expect(body.messages[0]?.role).toBe("system");
    expect(body.messages[1]).toEqual({
      role: "system",
      content: "Kamu adalah analis keuangan. Jawab dengan tabel.",
    });
    // Tetap satu system per lapisan: prompt bawaan + prompt pengguna, tidak dobel.
    expect(body.messages.filter((m) => m.role === "system")).toHaveLength(2);
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

  it("EOF tanpa [DONE] dan tanpa finish_reason → STREAM_INCOMPLETE, bukan complete (AUD-09)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("eof-no-done");

    await run(generationId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    expect(generation.errorCode).toBe("STREAM_INCOMPLETE");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("error");
    // Teks yang sempat masuk tetap disimpan, bukan dibuang: pengguna melihat
    // sampai mana jawaban berhenti.
    expect(assistant.contentJson).toContain("Kalimat yang menggantung");
  });

  it("finish_reason=length memunculkan catatan truncated (AUD-10)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("length-truncated");

    await run(generationId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
    expect(generation.finishReason).toBe("length");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    const parsed = JSON.parse(assistant.contentJson) as { parts: { kind: string; code?: string }[] };
    expect(parsed.parts.some((part) => part.kind === "note" && part.code === "truncated")).toBe(true);
  });

  it("429 sekali lalu sukses: permintaan diulang, hasil akhir complete (WO-5)", async () => {
    const { generationId } = await seedGeneration("rate-limited-once");
    const before = fixture.requests.length;

    await run(generationId);

    const attempts = fixture.requests.slice(before).filter((req) => req.scenario === "rate-limited-once");
    expect(attempts.length).toBe(2);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
  });

  it("429 terus-menerus berhenti di 3 percobaan, tidak menggantung (WO-5)", async () => {
    const { generationId } = await seedGeneration("rate-limited");
    const before = fixture.requests.length;

    await run(generationId);

    expect(fixture.requests.length - before).toBe(3);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    // SDD-3.2 tidak menyediakan `reason` khusus 429: tetap UPSTREAM_ERROR
    // dengan pesan "Terlalu banyak permintaan" (lihat providers/errors.ts).
    expect(generation.errorCode).toBe("UPSTREAM_ERROR");
    const events = await db.generationEvent.findMany({ where: { generationId }, orderBy: { seq: "asc" } });
    expect(events.at(-1)?.kind).toBe("error");
    expect(events.at(-1)?.payloadJson).toContain("Terlalu banyak permintaan");
  });

  it("provider tanpa [DONE] tapi ada finish_reason → tetap complete, bukan STREAM_INCOMPLETE (9Router)", async () => {
    const { assistantMessageId, generationId } = await seedGeneration("no-done-marker");

    await run(generationId);

    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
    expect(generation.finishReason).toBe("stop");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("complete");
    const parsed = JSON.parse(assistant.contentJson) as { parts: { kind: string; text?: string }[] };
    expect(parsed.parts.map((p) => p.text ?? "").join("")).toBe("Jawaban tanpa DONE.");
    // Bukan error, jadi tidak boleh ada catatan truncated.
    expect(parsed.parts.some((p) => p.kind === "note")).toBe(false);

    const usage = await db.usageRecord.findFirstOrThrow({ where: { userId } });
    expect(usage.totalTokens).toBe(18);
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
