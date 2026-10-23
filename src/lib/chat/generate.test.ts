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
  it("tidak mengikuti redirect gateway atau mengirim key ke target redirect", async () => {
    const { generationId } = await seedGeneration("redirect");
    const before = fixture.requests.length;
    await run(generationId);
    expect(fixture.requests.slice(before).map((request) => request.path)).toEqual(["/chat/completions"]);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
  });
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
    // Prompt bawaan → konteks server (FIX-04) → riwayat.
    const sent = body.messages as { role: string; content: string }[];
    expect(sent).toHaveLength(3);
    expect(sent[0]?.role).toBe("system");
    expect(sent[0]?.content).toContain("Jawab dengan bahasa yang dipakai pengguna.");
    // FIX-04: blok konteks server membawa waktu/judul/model, bukan tebakan.
    expect(sent[1]?.role).toBe("system");
    expect(sent[1]?.content).toContain("## Konteks dari server");
    expect(sent[2]).toEqual({ role: "user", content: "Halo" });
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
    // FIX-04 menyisipkan blok konteks server tepat setelah prompt bawaan.
    expect(body.messages[1]?.content).toContain("## Konteks dari server");
    expect(body.messages[2]).toEqual({
      role: "system",
      content: "Kamu adalah analis keuangan. Jawab dengan tabel.",
    });
    // Tetap satu system per lapisan: bawaan + konteks server + prompt pengguna.
    expect(body.messages.filter((m) => m.role === "system")).toHaveLength(3);
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
    // FIX-06: satu-satunya note yang boleh muncul di chat tanpa dokumen adalah
    // rag-degraded (retrieval memang kosong) — bukan truncated/web-search-unavailable.
    const notes = parsed.parts.filter(
      (p): p is { kind: "note"; code: string } => p.kind === "note" && "code" in p,
    );
    expect(notes.every((n) => n.code === "rag-degraded")).toBe(true);

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

  it("FIX-05: koneksi dipin saat admission, tidak bergeser walau koneksi aktif berganti", async () => {
    const chat = await createChat(db, { userId });
    const sent = await sendMessage(db, {
      userId,
      chatId: chat.id,
      content: "Halo",
      parentId: null,
      model: modelFor("usage-present"),
      idempotencyKey: null,
    });

    const pinned = await db.generation.findUniqueOrThrow({
      where: { id: sent.generationId },
      select: { connectionId: true },
    });
    expect(pinned.connectionId).not.toBeNull();

    // Koneksi lain menggantikan yang lama sebagai aktif. Generasi yang sudah
    // admitted tetap memakai koneksi lamanya; tidak boleh pindah diam-diam.
    await db.connection.updateMany({ where: { userId }, data: { isActive: 0 } });
    await db.connection.create({
      data: {
        id: randomUUID(),
        userId,
        name: "gateway lain",
        baseUrl: "http://127.0.0.1:1",
        apiKeyEncrypted: "rusak",
        apiKeyMask: "****",
        keyId: "v1",
        isActive: 1,
        status: "active",
      },
    });

    // Bila worker memakai koneksi aktif baru, dekripsi kunci gagal dan generasi
    // tidak menghasilkan token. Dengan pinning, jalur lama tetap jalan.
    await run(sent.generationId);

    const message = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent.assistantMessageId },
      select: { status: true },
    });
    expect(message.status).toBe("complete");
  });

  it("FIX-05: pesan user yang sendirian melebihi budget ditolak INPUT_TOO_LARGE", async () => {
    const chat = await createChat(db, { userId });
    const sent = await sendMessage(db, {
      userId,
      chatId: chat.id,
      content: "x".repeat(4_000),
      parentId: null,
      model: modelFor("usage-present"),
      idempotencyKey: null,
    });
    // `sendMessage` membatasi 100_000 karakter, jadi pesan dibesarkan lewat DB
    // untuk melewati budget estimasi (30_000 token ≈ 120_000 karakter).
    const oversized = JSON.stringify({ parts: [{ kind: "text", text: "x".repeat(200_000) }] });
    await db.chatMessage.update({ where: { id: sent.userMessageId }, data: { contentJson: oversized } });

    await run(sent.generationId);

    const events = await db.generationEvent.findMany({
      where: { generationId: sent.generationId },
      orderBy: { seq: "asc" },
    });
    expect(events.some((event) => event.kind === "error")).toBe(true);
    expect(events.some((event) => event.payloadJson?.includes("INPUT_TOO_LARGE"))).toBe(true);

    const assistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent.assistantMessageId },
    });
    expect(assistant.status).not.toBe("complete");
  });

  it("FIX-11: tool generate_file membuat artefak ready yang bisa diunduh", async () => {
    const { generationId, assistantMessageId } = await seedGeneration("file-tool");

    await run(generationId);

    const artifacts = await db.artifact.findMany({ where: { userId } });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].status).toBe("ready");
    expect(artifacts[0].displayName).toBe("laporan.md");
    expect(artifacts[0].format).toBe("md");
    expect(artifacts[0].messageId).toBe(assistantMessageId);

    const { openArtifactBytes } = await import("@/lib/artifacts/create");
    const { bytes } = await openArtifactBytes(db, userId, artifacts[0].id);
    expect(bytes.toString("utf8")).toContain("# Laporan");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.contentJson).toContain(artifacts[0].id);
    expect(assistant.status).toBe("complete");
  });

  it("riwayat di bawah budget tidak mencatat history-trimmed", async () => {
    const chat = await createChat(db, { userId });
    let parentId: string | null = null;
    let sent: { userMessageId: string; generationId: string; assistantMessageId: string } | null =
      null;
    for (let i = 0; i < 20; i++) {
      sent = await sendMessage(db, {
        userId,
        chatId: chat.id,
        content: "x".repeat(4_000),
        parentId,
        model: modelFor("usage-present"),
        idempotencyKey: null,
      });
      parentId = sent.userMessageId;
    }
    await run(sent!.generationId);

    const assistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent!.assistantMessageId },
    });
    expect(assistant.contentJson).not.toContain("history-trimmed");
  });

  it("riwayat di atas budget mencatat history-trimmed", async () => {
    const chat = await createChat(db, { userId });
    let parentId: string | null = null;
    let sent: { userMessageId: string; generationId: string; assistantMessageId: string } | null =
      null;
    for (let i = 0; i < 40; i++) {
      sent = await sendMessage(db, {
        userId,
        chatId: chat.id,
        content: "x".repeat(4_000),
        parentId,
        model: modelFor("usage-present"),
        idempotencyKey: null,
      });
      parentId = sent.userMessageId;
    }
    await run(sent!.generationId);

    const assistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent!.assistantMessageId },
    });
    expect(assistant.contentJson).toContain("history-trimmed");
  });
});

describe("FIX-12: tool generate_document", () => {
  it("membuat artefak PDF ready yang bisa diunduh", async () => {
    const { generationId, assistantMessageId } = await seedGeneration("document-tool");

    await run(generationId);

    const artifacts = await db.artifact.findMany({ where: { userId } });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].status).toBe("ready");
    expect(artifacts[0].format).toBe("pdf");
    expect(artifacts[0].mime).toBe("application/pdf");
    expect(artifacts[0].messageId).toBe(assistantMessageId);

    const { openArtifactBytes } = await import("@/lib/artifacts/create");
    const { bytes } = await openArtifactBytes(db, userId, artifacts[0].id);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.contentJson).toContain(artifacts[0].id);
    expect(assistant.status).toBe("complete");
  });
});

describe("FIX-05: pin revisi konfigurasi koneksi", () => {
  it("menolak jalan bila revisi koneksi bergeser setelah admission", async () => {
    const { generationId, assistantMessageId } = await seedGeneration("usage-present");
    const connection = await db.connection.findFirstOrThrow({ where: { userId } });
    const pinned = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(pinned.connectionRevision).toBe(connection.revision);

    // Kredensial/base URL diedit setelah pesan dikirim.
    await db.connection.update({
      where: { id: connection.id },
      data: { revision: { increment: 1 } },
    });

    const before = fixture.requests.length;
    await run(generationId);

    // Tidak ada permintaan ke provider: konfigurasi baru tidak boleh dipakai.
    expect(fixture.requests.length).toBe(before);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("error");
    expect(generation.errorCode).toBe("CONNECTION_CHANGED");
    const assistant = await db.chatMessage.findUniqueOrThrow({ where: { id: assistantMessageId } });
    expect(assistant.status).toBe("error");
  });

  it("berjalan normal saat revisi masih cocok", async () => {
    const { generationId } = await seedGeneration("usage-present");
    await run(generationId);
    const generation = await db.generation.findUniqueOrThrow({ where: { id: generationId } });
    expect(generation.status).toBe("complete");
    expect(generation.errorCode).toBeNull();
  });
});

describe("FIX-05: provenance budget pada catatan pemangkasan", () => {
  it("catatan history-trimmed membawa model, sumber budget dan jumlah pesan dibuang", async () => {
    const chat = await createChat(db, { userId });
    let parentId: string | null = null;
    let sent: { userMessageId: string; generationId: string; assistantMessageId: string } | null =
      null;
    for (let i = 0; i < 40; i++) {
      sent = await sendMessage(db, {
        userId,
        chatId: chat.id,
        content: "x".repeat(4_000),
        parentId,
        model: modelFor("usage-present"),
        idempotencyKey: null,
      });
      parentId = sent.userMessageId;
    }
    await run(sent!.generationId);

    const assistant = await db.chatMessage.findUniqueOrThrow({
      where: { id: sent!.assistantMessageId },
    });
    const note = JSON.parse(assistant.contentJson).parts.find(
      (part: { code?: string }) => part.code === "history-trimmed",
    );
    expect(note.data.droppedMessages).toBeGreaterThan(0);
    expect(typeof note.data.model).toBe("string");
    expect(["gateway", "known-family", "assumed"]).toContain(note.data.budgetSource);
    expect(note.data.contextTokens).toBeGreaterThan(0);
    expect(note.data.reserveTokens).toBeGreaterThan(0);
  });
});
