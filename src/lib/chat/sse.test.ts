/**
 * Uji penulis event SSE (WP-NT-P3-05, SDD-4.4).
 *
 * Dua lapis, pola sama dengan `messages.test.ts`:
 *   - `lib`: `sseEvent` + `createSseStream` atas SQLite sementara.
 *   - route: handler HTTP dengan sesi/konfigurasi dipalsukan.
 *
 * Semua uji membaca stream sampai tutup dengan batas waktu: stream yang
 * menggantung akan gagal, bukan menyandera test.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import { createSseStream, loadStreamTarget, sseEvent } from "./sse";

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

const { GET } = await import("@/app/api/kawan/v1/chat/[chatId]/stream/route");

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

/** Chat + generasi milik `userId`; mengembalikan idnya. */
async function seedGeneration(options: {
  userId?: string;
  model?: string | null;
  status?: string;
  errorCode?: string | null;
} = {}): Promise<{ chatId: string; generationId: string; assistantMessageId: string }> {
  const userId = options.userId ?? state.userId;
  const chat = await createChat(db, { userId, modelRef: options.model ?? null });
  const userMessageId = `msg_${randomUUID()}`;
  const assistantMessageId = `msg_${randomUUID()}`;
  await db.chatMessage.create({
    data: {
      id: userMessageId,
      chatId: chat.id,
      parentId: null,
      role: "user",
      contentJson: JSON.stringify({ parts: [{ kind: "text", text: "Halo" }] }),
      status: "complete",
      seq: 1,
    },
  });
  await db.chatMessage.create({
    data: {
      id: assistantMessageId,
      chatId: chat.id,
      parentId: userMessageId,
      role: "assistant",
      contentJson: JSON.stringify({ parts: [] }),
      status: "streaming",
      seq: 2,
    },
  });
  const generationId = `gen_${randomUUID()}`;
  await db.generation.create({
    data: {
      id: generationId,
      chatId: chat.id,
      userMessageId,
      assistantMessageId,
      status: options.status ?? "queued",
      errorCode: options.errorCode ?? null,
    },
  });
  return { chatId: chat.id, generationId, assistantMessageId };
}

async function addEvent(generationId: string, seq: number, kind: string, payload: unknown) {
  await db.generationEvent.create({
    data: {
      id: randomUUID(),
      generationId,
      seq,
      kind,
      payloadJson: JSON.stringify(payload),
    },
  });
}

/** Membaca stream sampai tutup; membatalkan pembaca bila melewati batas waktu. */
async function readAll(stream: ReadableStream<Uint8Array>, timeoutMs = 3_000): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const timer = setTimeout(() => void reader.cancel(), timeoutMs);
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    clearTimeout(timer);
  }
  return out;
}

type ParsedEvent = { kind: string; data: Record<string, unknown> };

function parseBlock(block: string): ParsedEvent {
  const lines = block.split("\n");
  const kind = lines[0].replace(/^event: /, "");
  const data = JSON.parse(lines[1].replace(/^data: /, "")) as Record<string, unknown>;
  return { kind, data };
}

function parseEvents(text: string): ParsedEvent[] {
  return text
    .split("\n\n")
    .filter((block) => block.trim() !== "")
    .map(parseBlock);
}

/**
 * Membaca `count` event utuh lalu MEMUTUS koneksi (meniru klien yang terputus
 * di tengah stream). Sisa buffer yang belum menjadi blok utuh dibuang.
 */
async function readEvents(
  stream: ReadableStream<Uint8Array>,
  count: number,
  timeoutMs = 3_000,
): Promise<ParsedEvent[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const out: ParsedEvent[] = [];
  const timer = setTimeout(() => void reader.cancel(), timeoutMs);
  let buf = "";
  try {
    while (out.length < count) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf("\n\n");
      while (idx !== -1 && out.length < count) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (block.trim() !== "") out.push(parseBlock(block));
        idx = buf.indexOf("\n\n");
      }
    }
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
  return out;
}

const noSignal = () => new AbortController().signal;

describe("sseEvent", () => {
  it("memformat event: + data: + baris kosong", () => {
    expect(sseEvent("part", { seq: 1, kind: "text", text: "Halo" })).toBe(
      'event: part\ndata: {"seq":1,"kind":"text","text":"Halo"}\n\n',
    );
    expect(sseEvent("done", { seq: 15, status: "complete" })).toBe(
      'event: done\ndata: {"seq":15,"status":"complete"}\n\n',
    );
  });
});

describe("createSseStream", () => {
  it("meta dikirim lebih dulu dengan seq 0", async () => {
    const { chatId, generationId, assistantMessageId } = await seedGeneration({ model: "gpt-4o-mini" });
    await addEvent(generationId, 1, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const events = parseEvents(
      await readAll(createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() })),
    );

    expect(events[0]!.kind).toBe("meta");
    expect(events[0]!.data).toEqual({
      generationId,
      assistantMessageId,
      model: "gpt-4o-mini",
      seq: 0,
    });
  });

  it("seq monoton dan tidak ada yang hilang; usage membawa reported", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "Halo" });
    await addEvent(generationId, 2, "part", { kind: "text", text: " dunia" });
    await addEvent(generationId, 3, "usage", { promptTokens: 12, completionTokens: 8, totalTokens: 20 });
    await addEvent(generationId, 4, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const events = parseEvents(
      await readAll(createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() })),
    );

    expect(events.map((e) => e.data.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(events.map((e) => e.kind)).toEqual(["meta", "part", "part", "usage", "done"]);
    expect(events[3]!.data).toEqual({
      seq: 3,
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
      reported: true,
    });
  });

  it("tidak menulis apa pun setelah done", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "Halo" });
    await addEvent(generationId, 2, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const text = await readAll(
      createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() }),
    );
    const events = parseEvents(text);

    expect(events[events.length - 1]!.kind).toBe("done");
    expect(text.endsWith("\n\n")).toBe(true);
  });

  it("generasi sudah terminal saat menyambung → langsung done, stream tertutup", async () => {
    const { chatId, generationId } = await seedGeneration({ status: "complete" });
    await addEvent(generationId, 1, "done", { status: "complete", finishReason: "stop" });

    const events = parseEvents(
      await readAll(createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() })),
    );

    expect(events.map((e) => e.kind)).toEqual(["meta", "done"]);
  });

  it("terminal tanpa event penutup → done disintesis (status stopped)", async () => {
    const { chatId, generationId } = await seedGeneration({ status: "stopped" });
    await addEvent(generationId, 1, "part", { kind: "text", text: "Halo" });

    const events = parseEvents(
      await readAll(createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() })),
    );

    expect(events.map((e) => e.kind)).toEqual(["meta", "part", "done"]);
    expect(events[2]!.data).toEqual({ seq: 2, status: "stopped", finishReason: null });
  });

  it("generasi error → event error berkode, bukan done", async () => {
    const { chatId, generationId } = await seedGeneration({
      status: "error",
      errorCode: "UPSTREAM_TIMEOUT",
    });
    await addEvent(generationId, 1, "error", {
      code: "UPSTREAM_TIMEOUT",
      message: "Gateway tidak merespons.",
      retryable: true,
    });

    const events = parseEvents(
      await readAll(createSseStream({ db, userId: state.userId, chatId, generationId, signal: noSignal() })),
    );

    expect(events.map((e) => e.kind)).toEqual(["meta", "error"]);
    expect(events[1]!.data).toEqual({
      seq: 1,
      code: "UPSTREAM_TIMEOUT",
      message: "Gateway tidak merespons.",
      retryable: true,
    });
    expect(events.some((e) => e.kind === "done")).toBe(false);
  });

  it("signal dibatalkan → stream berhenti, tidak menggantung", async () => {
    const { chatId, generationId } = await seedGeneration({ status: "queued" });
    const controller = new AbortController();

    const started = Date.now();
    const reading = readAll(
      createSseStream({ db, userId: state.userId, chatId, generationId, signal: controller.signal }),
      2_000,
    );
    setTimeout(() => controller.abort(), 50);

    const events = parseEvents(await reading);
    expect(Date.now() - started).toBeLessThan(1_500);
    // Meta sudah terkirim sebelum pembatalan; tidak ada penutup karena stream
    // dipotong, bukan tuntas.
    expect(events.map((e) => e.kind)).toEqual(["meta"]);
  });

  it("chat/generasi pengguna lain → 404", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedGeneration({ userId: otherUserId });

    await expect(
      loadStreamTarget(db, {
        userId: state.userId,
        chatId: foreign.chatId,
        generationId: foreign.generationId,
      }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });
  });

  it("generationId bukan milik chat itu → 404", async () => {
    const mine = await seedGeneration();
    const other = await seedGeneration();

    await expect(
      loadStreamTarget(db, {
        userId: state.userId,
        chatId: mine.chatId,
        generationId: other.generationId,
      }),
    ).rejects.toMatchObject({ status: 404, code: "GENERATION_NOT_FOUND" });
  });
});

describe("createSseStream resume (WP-NT-P3-06, SDD-4.5)", () => {
  const seqs = (events: ParsedEvent[]) => events.map((e) => e.data.seq);

  it("afterSeq=2 dari 5 event → hanya seq 3,4,5, tepat sekali, tanpa meta", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "a" });
    await addEvent(generationId, 2, "part", { kind: "text", text: "b" });
    await addEvent(generationId, 3, "part", { kind: "text", text: "c" });
    await addEvent(generationId, 4, "usage", { promptTokens: 1, completionTokens: 2, totalTokens: 3 });
    await addEvent(generationId, 5, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const events = parseEvents(
      await readAll(
        createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 2, signal: noSignal() }),
      ),
    );

    expect(events.map((e) => e.kind)).toEqual(["part", "usage", "done"]);
    expect(seqs(events)).toEqual([3, 4, 5]);
    expect(events.some((e) => e.kind === "meta")).toBe(false);
  });

  it("afterSeq=0 → semua event termasuk meta", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "a" });
    await addEvent(generationId, 2, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const events = parseEvents(
      await readAll(
        createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 0, signal: noSignal() }),
      ),
    );

    expect(events.map((e) => e.kind)).toEqual(["meta", "part", "done"]);
    expect(seqs(events)).toEqual([0, 1, 2]);
  });

  it("afterSeq = seq terakhir → tidak ada potongan lama, langsung ke event baru", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "a" });
    await addEvent(generationId, 2, "part", { kind: "text", text: "b" });

    const stream = createSseStream({
      db,
      userId: state.userId,
      chatId,
      generationId,
      afterSeq: 2,
      signal: noSignal(),
    });
    await addEvent(generationId, 3, "part", { kind: "text", text: "c" });

    const events = await readEvents(stream, 1);
    expect(events.map((e) => e.kind)).toEqual(["part"]);
    expect(seqs(events)).toEqual([3]);
  });

  it("afterSeq > seq terakhir → tidak melempar, langsung penutup", async () => {
    const { chatId, generationId } = await seedGeneration({ status: "stopped" });
    await addEvent(generationId, 1, "part", { kind: "text", text: "a" });

    const events = parseEvents(
      await readAll(
        createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 10, signal: noSignal() }),
      ),
    );

    expect(events.map((e) => e.kind)).toEqual(["done"]);
    expect(events[0]!.data.status).toBe("stopped");
    expect(events[0]!.data.seq as number).toBeGreaterThan(1);
  });

  it("generasi terminal + afterSeq → penutup langsung, tanpa menunggu", async () => {
    const { chatId, generationId } = await seedGeneration({ status: "complete" });
    await addEvent(generationId, 1, "done", { status: "complete", finishReason: "stop" });

    const started = Date.now();
    const events = parseEvents(
      await readAll(
        createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 1, signal: noSignal() }),
      ),
    );

    expect(Date.now() - started).toBeLessThan(1_000);
    expect(events.map((e) => e.kind)).toEqual(["done"]);
    expect(seqs(events)).toEqual([2]);
  });

  it("part/usage diputar ulang dengan isi sama, bukan hanya jenisnya", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "halo dunia" });
    await addEvent(generationId, 2, "usage", { promptTokens: 7, completionTokens: 9, totalTokens: 16 });
    await addEvent(generationId, 3, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const events = parseEvents(
      await readAll(
        createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 0, signal: noSignal() }),
      ),
    );

    expect(events[1]!.data).toEqual({ seq: 1, kind: "text", text: "halo dunia" });
    expect(events[2]!.data).toEqual({
      seq: 2,
      promptTokens: 7,
      completionTokens: 9,
      totalTokens: 16,
      reported: true,
    });
  });

  it("dua sambungan (putus di tengah) → gabungan seq utuh, tanpa hilang/ganda", async () => {
    const { chatId, generationId } = await seedGeneration();
    await addEvent(generationId, 1, "part", { kind: "text", text: "a" });
    await addEvent(generationId, 2, "part", { kind: "text", text: "b" });

    // Sesi 1: sambung dari awal, putus setelah 3 event (meta, 1, 2).
    const first = await readEvents(
      createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 0, signal: noSignal() }),
      3,
    );
    const lastSeq = first[first.length - 1]!.data.seq as number;
    expect(lastSeq).toBe(2);

    // Generasi lanjut menulis 3 dan 4 sementara klien terputus.
    await addEvent(generationId, 3, "part", { kind: "text", text: "c" });
    await addEvent(generationId, 4, "part", { kind: "text", text: "d" });

    // Sesi 2: sambung ulang dengan afterSeq=lastSeq.
    const second = await readEvents(
      createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: lastSeq, signal: noSignal() }),
      2,
    );
    expect(seqs(second)).toEqual([3, 4]);

    // Sesi 3: penutup.
    await addEvent(generationId, 5, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });
    const third = await readEvents(
      createSseStream({ db, userId: state.userId, chatId, generationId, afterSeq: 4, signal: noSignal() }),
      1,
    );

    const combined = [...first, ...second, ...third].map((e) => e.data.seq as number);
    expect(combined).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(combined).size).toBe(combined.length);
  });
});

describe("GET /api/kawan/v1/chat/{chatId}/stream", () => {
  function request(chatId: string, generationId?: string, afterSeq = 0): Request {
    const url = new URL(`http://localhost/api/kawan/v1/chat/${chatId}/stream`);
    if (generationId !== undefined) url.searchParams.set("generationId", generationId);
    url.searchParams.set("afterSeq", String(afterSeq));
    return new Request(url, { method: "GET" });
  }

  const ctx = (chatId: string) => ({ params: Promise.resolve({ chatId }) });

  it("belum masuk → 401", async () => {
    const { chatId, generationId } = await seedGeneration();
    state.userId = "";

    const res = await GET(request(chatId, generationId), ctx(chatId));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("sukses → 200 text/event-stream dengan header wajib", async () => {
    const { chatId, generationId } = await seedGeneration({ model: "gpt-4o-mini" });
    await addEvent(generationId, 1, "done", { status: "complete", finishReason: "stop" });
    await db.generation.update({ where: { id: generationId }, data: { status: "complete" } });

    const res = await GET(request(chatId, generationId), ctx(chatId));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const events = parseEvents(await readAll(res.body!));
    expect(events[0]!.kind).toBe("meta");
    expect(events[events.length - 1]!.kind).toBe("done");
  });

  it("generationId tidak ada → 400", async () => {
    const { chatId } = await seedGeneration();
    const res = await GET(request(chatId), ctx(chatId));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_GENERATION_ID");
  });

  it("chat milik pengguna lain → 404 JSON", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const foreign = await seedGeneration({ userId: otherUserId });

    const res = await GET(request(foreign.chatId, foreign.generationId), ctx(foreign.chatId));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("CHAT_NOT_FOUND");
  });
});
