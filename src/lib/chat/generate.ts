/**
 * Job `chat.generate`: panggil gateway, tulis potongan, publikasikan event
 * (WP-NT-P3-04, REQ-NT-22, SDD-4.3, SDD-4.4, SDD-5.3, SDD-5.4).
 *
 * `runGeneration` dijalankan worker untuk satu `Generation`. Ia:
 *   1. memuat Generation + Chat + pesan chat,
 *   2. menyusun konteks dari `buildAncestryPath` (reducer `tree.ts`, tidak ditulis ulang),
 *   3. membuka koneksi aktif lewat `lib/connections` lalu mendekripsi key lewat
 *      `lib/secrets` (dekripsi tidak ditulis ulang),
 *   4. POST `{baseUrl}/chat/completions` `stream:true` lewat `fetch` LANGSUNG
 *      (fetchJson tidak mengembalikan stream) tetapi tetap melewati kebijakan
 *      keluar `lib/net` (SSRF) dan batas waktunya (SDD-5.3),
 *   5. menyimpan tiap delta ke `ChatMessagePart` + `GenerationEvent(seq, ...)`,
 *   6. menutup dengan `complete` (atau `error` + `errorCode`).
 *
 * Aturan yang ditegakkan:
 *   - Tidak ada tulisan setelah `done`/`error` (SDD-4.4).
 *   - 401/403 gateway menjadi `error` GENERASI, bukan galat akun (SDD-5.4).
 *   - `indeterminate` TIDAK diulang di sini; itu keputusan worker (SDD-4.2).
 */

import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import { getActiveConnection } from "@/lib/connections/connections";
import type { Db } from "@/lib/db";
import { assertOutboundAllowed, OUTBOUND_LIMITS, type OutboundPolicyOptions } from "@/lib/net";
import {
  DISCONNECTED_MESSAGE,
  PROVIDER_MESSAGES,
  fromApiError,
  fromUpstreamStatus,
} from "@/lib/providers/errors";
import { CONNECTION_API_KEY_PURPOSE, decryptSecret } from "@/lib/secrets";
import { buildContext } from "@/lib/documents/context";
import { readEmbeddingConfig } from "@/lib/documents/embed";
import { retrieveChunks, type RetrievedChunk } from "@/lib/documents/retrieve";
import { extractCitations } from "@/lib/documents/citations";
import { StopRequested, stopIfRequested } from "./stop";
import { imageParts } from "./content";
import { createStreamParser, type StreamUsage } from "./stream-parse";
import { buildAncestryPath, type TreeNode } from "./tree";

/** Model cadangan bila chat belum pernah memilih model. */
export const DEFAULT_MODEL = "deepseek-v4.1-flash";

const CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * Bagian konfigurasi yang dipakai `runGeneration`. Sengaja potongan sempit
 * (bukan `Config` penuh) supaya pemanggil tidak butuh akses lebih dari yang ia
 * pakai; `Config` penuh tetap bisa diberikan karena tipe ini struktural.
 */
export type GenerateConfig = {
  encryptionKey: Buffer;
  allowInsecureHttp: boolean;
  outboundAllowlist: readonly string[];
};

/** Galat jalur generasi dengan kode yang disimpan ke `Generation.errorCode`. */
export class GenerationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
    this.retryable = retryable;
  }
}

/** Galat pemrograman/data yang tidak boleh diulang otomatis (→ `indeterminate`). */
export class GenerationSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationSetupError";
  }
}

type GatewayContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type ChatCompletionMessage = { role: string; content: GatewayContent };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Menggabungkan bagian `text` dari `contentJson` jadi satu string. */
function messageText(contentJson: string): string {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (!isRecord(parsed) || !Array.isArray(parsed["parts"])) return "";
    return parsed["parts"]
      .filter(
        (part): part is { kind: string; text: string } =>
          isRecord(part) && part["kind"] === "text" && typeof part["text"] === "string",
      )
      .map((part) => part.text)
      .join("");
  } catch {
    return "";
  }
}

/**
 * Menyusun riwayat pesan untuk gateway dari jalur ancestry.
 *
 * Placeholder assistant milik generasi ini dikeluarkan (isinya belum ada), dan
 * pesan tanpa teks dilewati. `buildAncestryPath` melempar pada pohon cacat;
 * itu diteruskan sebagai galat setup.
 */
function buildMessages(
  path: readonly TreeNode[],
  assistantMessageId: string,
): ChatCompletionMessage[] {
  return path
    .filter((node) => node.id !== assistantMessageId)
    .map((node) => {
      const text = messageText(node.contentJson);
      const images = imageParts(node.contentJson);
      // Gateway gaya OpenAI: teks + gambar dalam satu array; tanpa gambar tetap string.
      const content: GatewayContent =
        images.length === 0
          ? text
          : [
              ...(text ? [{ type: "text" as const, text }] : []),
              ...images.map((image) => ({
                type: "image_url" as const,
                image_url: { url: image.dataUrl },
              })),
            ];
      return { role: node.role, content };
    })
    .filter((message) => message.content !== "" && (message.content as unknown[]).length !== 0);
}

/**
 * Membuka kunci API baris koneksi.
 *
 * Koneksi aktif ditemukan lewat `getActiveConnection` (satu sumber aturan
 * "aktif"). Ciphertext-nya dibaca langsung dari `Connection` karena bentuk
 * publik tidak punya kolom itu, lalu didekripsi dengan `decryptSecret` dan AAD
 * yang sama persis dengan saat penyimpanan (SDD-5.2). Dekripsinya sendiri TIDAK
 * ditulis ulang di sini.
 */
async function openApiKey(
  db: Db,
  config: GenerateConfig,
  connectionId: string,
  userId: string,
): Promise<{ baseUrl: string; apiKey: string }> {
  const row = await db.connection.findFirst({
    where: { id: connectionId, userId },
    select: { baseUrl: true, apiKeyEncrypted: true },
  });
  if (!row) throw new GenerationSetupError("Koneksi aktif tidak ditemukan.");

  try {
    const apiKey = decryptSecret({
      envelope: row.apiKeyEncrypted,
      key: config.encryptionKey,
      aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
    });
    return { baseUrl: row.baseUrl, apiKey };
  } catch {
    // Envelope rusak atau kunci server berganti: generasi tidak bisa jalan.
    throw new GenerationSetupError("Kunci koneksi tidak dapat dibuka.");
  }
}

/** Memetakan kegagalan transport/policy jadi galat generasi berkode. */
function transportError(err: unknown): GenerationError {
  if (err instanceof ApiError) {
    const failure = fromApiError(err);
    return new GenerationError(failure.reason, failure.message, failure.retryable);
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return new GenerationError("TIMEOUT", PROVIDER_MESSAGES.TIMEOUT, true);
  }
  return new GenerationError("UPSTREAM_ERROR", DISCONNECTED_MESSAGE, true);
}

/**
 * Membuka stream SSE ke gateway dan memanggil `onDelta` untuk tiap potongan.
 *
 * `signal` adalah pembatalan DARI LUAR (worker berhenti); batas waktu total
 * ditambahkan di dalam lewat `AbortSignal.timeout` (SDD-5.3 butir 4). Keduanya
 * digabung supaya satu mekanisme membatalkan `fetch`.
 *
 * Mengembalikan usage terakhir yang terlihat (atau `null`). Melempar
 * `GenerationError` untuk kegagalan yang bisa dipetakan; pembatalan dari luar
 * diteruskan apa adanya agar pemanggil tahu itu bukan galat generasi.
 */
async function streamGateway(input: {
  url: string;
  apiKey: string;
  body: unknown;
  outbound: OutboundPolicyOptions;
  signal: AbortSignal;
  /** Dipanggil sekali per potongan; `true` → pembatalan diminta pengguna. */
  shouldStop: () => Promise<boolean>;
  onDelta: (delta: { kind: string; text?: string; usage?: StreamUsage; finishReason?: string | null }) => Promise<void>;
}): Promise<{ usage: StreamUsage | null; finishReason: string | null }> {
  // Validasi alamat keluar dulu (SSRF, SDD-5.3) — `fetch` langsung tetap harus
  // melewatinya, sama seperti `fetchJson`.
  let url: URL;
  try {
    url = await assertOutboundAllowed(input.url, input.outbound);
  } catch (err) {
    throw transportError(err);
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  if (input.apiKey !== "") headers["authorization"] = `Bearer ${input.apiKey}`;

  const combined = AbortSignal.any([
    input.signal,
    AbortSignal.timeout(OUTBOUND_LIMITS.totalTimeoutMs),
  ]);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.body),
      signal: combined,
    });
  } catch (err) {
    if (input.signal.aborted) throw err;
    throw transportError(err);
  }

  if (!response.ok) {
    // 401/403 gateway BUKAN 401 akun: dipetakan jadi kode provider (SDD-5.4).
    const failure = fromUpstreamStatus(response.status);
    throw new GenerationError(failure.reason, failure.message, failure.retryable);
  }
  if (!response.body) {
    throw new GenerationError("UPSTREAM_ERROR", DISCONNECTED_MESSAGE, true);
  }

  const parser = createStreamParser();
  const reader = response.body.getReader();
  let usage: StreamUsage | null = null;
  let sawDone = false;
  let finishReason: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Setiap potongan diperiksa (SDD-4.6): begitu `cancelRequestedAt` terisi,
      // potongan yang baru dibaca ini TIDAK ditulis dan koneksi ditutup —
      // tidak ada token yang tersimpan setelah pembatalan.
      if (await input.shouldStop()) throw new StopRequested();
      for (const delta of parser.push(value)) {
        if (delta.kind === "done") {
          sawDone = true;
          finishReason = delta.finishReason ?? null;
          break;
        }
        if (delta.kind === "usage" && delta.usage) usage = delta.usage;
        await input.onDelta(delta);
      }
      if (sawDone) break;
    }
    if (!sawDone) {
      for (const delta of parser.flush()) {
        if (delta.kind === "done") {
          finishReason = delta.finishReason ?? null;
          break;
        }
        if (delta.kind === "usage" && delta.usage) usage = delta.usage;
        await input.onDelta(delta);
      }
    }
  } catch (err) {
    // Pembatalan (dari luar atau karena stop) bukan galat generasi: teruskan
    // apa adanya supaya pemanggil membedakannya dari kegagalan gateway.
    if (input.signal.aborted || err instanceof StopRequested) throw err;
    throw transportError(err);
  } finally {
    // Menutup koneksi ke gateway — juga jalur pembatalan (SDD-4.6).
    reader.cancel().catch(() => {});
  }

  return { usage, finishReason };
}

/**
 * Mengalokasikan `seq` berikutnya untuk generasi ini dan menulis satu
 * `GenerationEvent`.
 *
 * `max(seq)+1` dihitung di dalam transaksi; unique `(generationId, seq)`
 * menjadi jaring terakhir. Satu generasi hanya ditulis oleh satu worker, jadi
 * tidak ada dua penulis bersamaan pada jalur normal.
 */
export async function publishEvent(
  db: Db,
  generationId: string,
  kind: string,
  payload: unknown,
): Promise<number> {
  return db.$transaction(async (tx) => {
    const last = await tx.generationEvent.findFirst({
      where: { generationId },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const seq = (last?.seq ?? 0) + 1;
    await tx.generationEvent.create({
      data: {
        id: randomUUID(),
        generationId,
        seq,
        kind,
        payloadJson: JSON.stringify(payload ?? {}),
      },
    });
    return seq;
  });
}

export type UsageInput = {
  userId: string;
  chatId: string | null;
  model: string;
  /** `false` bila gateway tidak melaporkan usage → token dikosongkan. */
  reported: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
};

/**
 * Mencatat pemakaian (REQ-NT-71). Bila gateway tidak melaporkan usage,
 * `reported=0` dan angka token dibiarkan kosong — TIDAK diisi nol karangan.
 */
export async function recordUsage(db: Db, input: UsageInput): Promise<void> {
  const reported = input.reported;
  await db.usageRecord.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      chatId: input.chatId,
      model: input.model,
      promptTokens: reported ? (input.promptTokens ?? null) : null,
      completionTokens: reported ? (input.completionTokens ?? null) : null,
      totalTokens: reported ? (input.totalTokens ?? null) : null,
      reported: reported ? 1 : 0,
    },
  });
}

/**
 * Menutup generasi yang dihentikan pengguna (SDD-4.6): event `done` berstatus
 * `stopped`, partial yang sudah terkumpul disimpan, status jadi `stopped`.
 * Tidak ada token setelah pembatalan karena loop sudah berhenti.
 */
async function stopGeneration(
  db: Db,
  generationId: string,
  assistantMessageId: string,
  partialText: string,
  now: Date,
): Promise<void> {
  const contentJson =
    partialText === ""
      ? JSON.stringify({ parts: [] })
      : JSON.stringify({ parts: [{ kind: "text", text: partialText }] });

  await db.chatMessage.update({
    where: { id: assistantMessageId },
    data: { status: "stopped", contentJson },
  });
  await publishEvent(db, generationId, "done", { status: "stopped" });
  await db.generation.update({
    where: { id: generationId },
    data: { status: "stopped", finishedAt: now },
  });
}

/** Menutup generasi dengan galat: event `error`, pesan assistant, dan status. */
async function failGeneration(
  db: Db,
  generationId: string,
  assistantMessageId: string,
  error: GenerationError,
  partialText: string,
  now: Date,
): Promise<void> {
  await publishEvent(db, generationId, "error", {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
  });
  await db.chatMessage.update({
    where: { id: assistantMessageId },
    data: {
      status: "error",
      contentJson: JSON.stringify(
        partialText === "" ? { parts: [] } : { parts: [{ kind: "text", text: partialText }] },
      ),
    },
  });
  await db.generation.update({
    where: { id: generationId },
    data: { status: "error", errorCode: error.code, finishedAt: now },
  });
}

/**
 * Menjalankan satu generasi sampai tuntas.
 *
 * Galat provider dipetakan ke `Generation.status='error'` dan TIDAK dilempar
 * supaya job tidak diulang otomatis (SDD-4.2). Hanya galat setup yang dilempar.
 * Pembatalan dari luar (worker berhenti) membiarkan status apa adanya.
 */
export async function runGeneration(
  db: Db,
  config: GenerateConfig,
  generationId: string,
  signal: AbortSignal,
): Promise<void> {
  const generation = await db.generation.findUnique({
    where: { id: generationId },
    select: { id: true, chatId: true, assistantMessageId: true },
  });
  if (!generation) throw new GenerationSetupError(`Generation "${generationId}" tidak ditemukan.`);

  const chat = await db.chat.findUnique({
    where: { id: generation.chatId },
    select: { id: true, userId: true, modelRef: true },
  });
  if (!chat) throw new GenerationSetupError("Chat untuk generasi ini tidak ditemukan.");

  const model = chat.modelRef ?? DEFAULT_MODEL;

  const rows = await db.chatMessage.findMany({
    where: { chatId: generation.chatId },
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
  const messages = buildMessages(
    buildAncestryPath(rows, generation.assistantMessageId),
    generation.assistantMessageId,
  );

  // Konteks rujukan dokumen (WP-NT-P6-07, SDD-6.2/6.3). Kegagalan retrieval
  // tidak boleh menggagalkan chat: tangkap, lanjut tanpa konteks.
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const query =
    lastUser === undefined
      ? ""
      : typeof lastUser.content === "string"
        ? lastUser.content
        : lastUser.content
            .map((part) => (part.type === "text" ? part.text : ""))
            .join(" ");

  let contextSystem: string | null = null;
  let keywordOnly = false;
  // Di luar `try` supaya sitasi bisa dipetakan setelah streaming selesai.
  let usedChunks: RetrievedChunk[] = [];
  if (query.trim() !== "") {
    const embedding = readEmbeddingConfig();
    try {
      const chunks = await retrieveChunks(db, {
        userId: chat.userId,
        query,
        limit: 6,
        ...(embedding ? { embedding } : {}),
      });
      usedChunks = chunks;
      contextSystem = buildContext(chunks).system;
      keywordOnly = !embedding && chunks.length > 0;
    } catch {
      // Dokumen rusak/provider embedding mati: jawab tanpa rujukan.
    }
  }

  const active = await getActiveConnection(db, chat.userId);
  if (!active) throw new GenerationSetupError("Belum ada koneksi aktif.");

  const { baseUrl, apiKey } = await openApiKey(db, config, active.id, chat.userId);

  let text = "";
  let ordinal = 0;

  if (keywordOnly) {
    try {
      await db.chatMessagePart.create({
        data: {
          id: randomUUID(),
          messageId: generation.assistantMessageId,
          kind: "note",
          payloadJson: JSON.stringify({ code: "keyword-only" }),
          ordinal: ordinal++,
        },
      });
    } catch {
      // Catatan hanya informasi; jangan gagalkan generasi.
    }
  }

  let usage: StreamUsage | null;
  let finishReason: string | null;
  try {
    ({ usage, finishReason } = await streamGateway({
      url: `${baseUrl.replace(/\/+$/, "")}${CHAT_COMPLETIONS_PATH}`,
      apiKey,
      body: {
        model,
        messages: contextSystem
          ? [{ role: "system", content: contextSystem }, ...messages]
          : messages,
        stream: true,
      },
      outbound: {
        allowInsecureHttp: config.allowInsecureHttp,
        allowlist: config.outboundAllowlist,
      },
      signal,
      shouldStop: () => stopIfRequested(db, generationId),
      onDelta: async (delta) => {
        if (delta.kind === "text" && delta.text) {
          text += delta.text;
          await db.chatMessagePart.create({
            data: {
              id: randomUUID(),
              messageId: generation.assistantMessageId,
              kind: "text",
              payloadJson: JSON.stringify({ text: delta.text }),
              ordinal: ordinal++,
            },
          });
          await publishEvent(db, generationId, "part", { kind: "text", text: delta.text });
        } else if (delta.kind === "usage" && delta.usage) {
          await publishEvent(db, generationId, "usage", delta.usage);
        }
      },
    }));
  } catch (err) {
    // Worker berhenti: bukan galat generasi; penanganan stop menutupnya nanti.
    if (signal.aborted) return;
    // Pembatalan pengguna: simpan partial, tutup `stopped` (SDD-4.6).
    if (err instanceof StopRequested) {
      await stopGeneration(db, generationId, generation.assistantMessageId, text, new Date());
      return;
    }
    if (err instanceof GenerationError) {
      await failGeneration(db, generationId, generation.assistantMessageId, err, text, new Date());
      return;
    }
    throw err;
  }

  if (signal.aborted) return;

  const now = new Date();
  // Catatan ikut di `contentJson` karena UI membacanya dari sana (bagian `note`).
  const notePart = keywordOnly ? [{ kind: "note", code: "keyword-only" }] : [];
  // Sitasi hanya dari penanda yang benar-benar ditulis model (SDD-6.2).
  const citationParts = extractCitations(text, usedChunks).map((citation) => ({
    kind: "citation",
    ...citation,
  }));
  const contentJson = JSON.stringify({
    parts: [
      ...notePart,
      ...(text === "" ? [] : [{ kind: "text", text }]),
      ...citationParts,
    ],
  });

  await db.chatMessage.update({
    where: { id: generation.assistantMessageId },
    data: {
      status: "complete",
      contentJson,
      ...(usage ? { usageJson: JSON.stringify(usage) } : {}),
    },
  });
  await publishEvent(db, generationId, "done", { status: "complete", finishReason });
  await db.generation.update({
    where: { id: generationId },
    data: { status: "complete", finishedAt: now, finishReason },
  });

  await recordUsage(db, {
    userId: chat.userId,
    chatId: generation.chatId,
    model,
    reported: usage !== null,
    promptTokens: usage?.promptTokens ?? null,
    completionTokens: usage?.completionTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
  });
}
