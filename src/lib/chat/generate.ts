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
import { ApiError, STATUS } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { getActiveConnection } from "@/lib/connections/connections";
import type { Db } from "@/lib/db";
import {
  assertOutboundAllowed,
  fetchOutbound,
  OUTBOUND_LIMITS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import {
  DISCONNECTED_MESSAGE,
  INVALID_REQUEST_CODE,
  PROVIDER_MESSAGES,
  fromApiError,
  fromUpstreamStatus,
} from "@/lib/providers/errors";
import { CONNECTION_API_KEY_PURPOSE, decryptSecret } from "@/lib/secrets";
import { buildContext } from "@/lib/documents/context";
import { readEmbeddingConfig } from "@/lib/documents/embed";
import { retrieveChunks, type RetrievedChunk } from "@/lib/documents/retrieve";
import { extractCitations } from "@/lib/documents/citations";
import { buildSearchSystem, webSearchRequested } from "@/lib/search/prompt";
import { webSearch, type SearchResult } from "@/lib/search/web";
import { enrichSources, type EnrichedSource } from "@/lib/sources/read";
import { buildMemoryContext } from "@/lib/memory/store";
import { assertHeld, LeaseLost, type FenceChecker } from "@/lib/jobs/fence";
import { StopRequested, stopIfRequested } from "./stop";
import { imageParts } from "./content";
import { recordUsage } from "./usage";
import { createStreamParser, type StreamUsage, type ToolCallDelta } from "./stream-parse";
import {
  CHAT_TOOLS,
  GENERATE_DOCUMENT_TOOL_NAME,
  GENERATE_FILE_TOOL_NAME,
  assembleToolCalls,
  parseGenerateDocumentArgs,
  parseGenerateFileArgs,
} from "./file-tool";
import { createArtifact, readArtifactForModel } from "@/lib/artifacts/create";
import { buildAncestryPath, type TreeNode } from "./tree";
import { getSystemPrompt } from "./system-prompt";
import { composeSystemPrompt } from "./prompt-builder";
import { getCachedModels, resolveModel } from "@/lib/connections/model-cache";
import { estimateTokens, overBudget } from "./context-budget";
import { modelBudget } from "./model-budget";

/** Model cadangan bila chat belum pernah memilih model. */
export const DEFAULT_MODEL = "deepseek-v4.1-flash";

/**
 * Zona waktu bawaan bila pengguna belum punya preferensi (SDD-3.4).
 *
 * FIX-18: instruksi dasar tidak lagi berupa konstanta di berkas ini — seluruh
 * pesan sistem dirakit `composeSystemPrompt` (prompt-builder.ts) dengan urutan
 * otoritas yang tetap, supaya dokumen/web tidak bisa terbaca sebagai perintah.
 */
export const DEFAULT_TIMEZONE = "Asia/Jakarta";

/**
 * Blok konteks server untuk model (audit G02/G01).
 *
 * Hanya item yang benar-benar diketahui server: waktu, zona waktu, judul chat,
 * dan model. Batas pengetahuan dan jendela konteks model TIDAK ditebak — server
 * tidak punya metadata resminya, jadi ditulis apa adanya.
 */
export function buildRuntimeContext(input: {
  now: Date;
  timezone: string;
  chatTitle: string;
  model: string;
}): string {
  // Zona waktu IANA divalidasi `Intl` (sumber yang sama dengan runtime), bukan
  // daftar nama tulisan tangan; nilai tidak sah jatuh ke bawaan.
  let timezone = DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
    timezone = input.timezone;
  } catch {
    timezone = DEFAULT_TIMEZONE;
  }
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(input.now);

  return [
    "## Konteks dari server",
    `Waktu server (UTC): ${input.now.toISOString()}`,
    `Zona waktu: ${timezone} (waktu lokal ${local})`,
    `Judul chat: ${input.chatTitle}`,
    `Model: ${input.model}`,
    "Batas pengetahuan dan jendela konteks model: tidak diketahui server",
  ].join("\n");
}

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
  /** TTL cache model untuk memeriksa ketersediaan model pilihan pengguna
   *  (audit A01). Tanpa nilai, pemeriksaan dilewati; `Config` penuh mengisinya. */
  modelCacheTtlSeconds?: number;
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
 * Anggaran karakter riwayat. Model di gateway menerima konteks terbatas dan
 * memotong dari awal (yaitu instruksi sistem) bila kelebihan, jadi riwayat
 * dipangkas di sisi kita. 4 karakter/token adalah perkiraan kasar yang
 * sengaja konservatif untuk bahasa Indonesia.
 */
const HISTORY_CHAR_BUDGET = 120_000;

function messageLength(message: ChatCompletionMessage): number {
  return typeof message.content === "string"
    ? message.content.length
    : message.content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
}

/**
 * Pangkas giliran terlama sampai muat, tanpa memutus pasangan user/assistant.
 *
 * Pemotongan selalu per dua pesan dari depan, dan pesan `user` terakhir tidak
 * pernah dibuang: tanpa itu pertanyaan aktif ikut hilang.
 */
function trimHistory(
  messages: readonly ChatCompletionMessage[],
  budget = HISTORY_CHAR_BUDGET,
): { messages: ChatCompletionMessage[]; trimmed: boolean; droppedMessages: number } {
  let total = messages.reduce((sum, message) => sum + messageLength(message), 0);
  let start = 0;
  while (total > budget && start + 2 <= messages.length - 1) {
    total -= messageLength(messages[start] ?? ({} as ChatCompletionMessage));
    total -= messageLength(messages[start + 1] ?? ({} as ChatCompletionMessage));
    start += 2;
  }
  return { messages: messages.slice(start), trimmed: start > 0, droppedMessages: start };
}

/**
 * Menyusun riwayat pesan untuk gateway dari jalur ancestry.
 *
 * Placeholder assistant milik generasi ini dikeluarkan (isinya belum ada), dan
 * pesan tanpa teks dilewati. `buildAncestryPath` melempar pada pohon cacat;
 * itu diteruskan sebagai galat setup.
 */
async function buildMessages(
  db: Db,
  userId: string,
  path: readonly TreeNode[],
  assistantMessageId: string,
): Promise<ChatCompletionMessage[]> {
  const built: ChatCompletionMessage[] = [];
  for (const node of path) {
    if (node.id === assistantMessageId) continue;
    const text = messageText(node.contentJson);
    const images = imageParts(node.contentJson);
    // FIX-16: gambar hasil pembuatan hanya menyimpan rujukan; byte-nya dibaca
    // dari artefak di sini. Artefak hilang/kedaluwarsa dilewati, bukan
    // menggagalkan seluruh generasi.
    const urls: string[] = [];
    for (const image of images) {
      if (image.dataUrl) {
        urls.push(image.dataUrl);
        continue;
      }
      if (!image.artifactId) continue;
      const stored = await readArtifactForModel(db, userId, image.artifactId);
      if (stored) urls.push(`data:${stored.mime};base64,${stored.bytes.toString("base64")}`);
    }
    // Gateway gaya [OI]: teks + gambar dalam satu array; tanpa gambar tetap string.
    const content: GatewayContent =
      urls.length === 0
        ? text
        : [
            ...(text ? [{ type: "text" as const, text }] : []),
            ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ];
    if (content === "" || (Array.isArray(content) && content.length === 0)) continue;
    built.push({ role: node.role, content });
  }
  return built;
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
export async function openApiKey(
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

/** Batas byte body galat yang dibaca supaya balasan raksasa tidak ditelan utuh. */
const MAX_ERROR_BODY_BYTES = 4096;

/** Header yang aman dicatat sebagai ID permintaan upstream (nama saja, tanpa nilai lain). */
const REQUEST_ID_HEADERS = ["x-request-id", "request-id", "cf-ray", "x-amzn-requestid"] as const;

/** Bentuk kode error provider yang boleh dicatat: pendek dan tanpa spasi/rahasia. */
const SAFE_ERROR_CODE = /^[A-Za-z0-9_.:/-]{1,64}$/;

type UpstreamFailureDetail = {
  /** Kode provider dari body galat, bila bentuknya aman. */
  providerCode?: string;
  /** ID permintaan upstream, bila gateway mengirimkannya. */
  upstreamRequestId?: string;
};

/**
 * Membaca body galat SECARA TERBATAS lalu menyaringnya jadi metadata aman.
 *
 * Body mentah TIDAK dikembalikan dan TIDAK pernah ditulis ke log: bisa memuat
 * prompt pengguna atau rahasia. Yang diambil hanya `error.code`/`error.type`
 * (string pendek berkarakter aman) dan ID permintaan dari header allowlist.
 */
async function readFailureDetail(response: Response): Promise<UpstreamFailureDetail> {
  const requestId = REQUEST_ID_HEADERS.map((name) => response.headers.get(name)).find(
    (value) => value !== null && SAFE_ERROR_CODE.test(value),
  );

  let providerCode: string | undefined;
  try {
    const reader = response.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
        if (total >= MAX_ERROR_BODY_BYTES) break;
      }
      await reader.cancel().catch(() => {});
      const text = Buffer.concat(chunks).subarray(0, MAX_ERROR_BODY_BYTES).toString("utf8");
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) {
        const error = isRecord(parsed["error"]) ? parsed["error"] : parsed;
        for (const candidate of [error["code"], error["type"]]) {
          if (typeof candidate === "string" && SAFE_ERROR_CODE.test(candidate)) {
            providerCode = candidate;
            break;
          }
        }
      }
    }
  } catch {
    // Body bukan JSON/tidak terbaca: metadata provider memang tidak tersedia.
  }

  return {
    ...(providerCode ? { providerCode } : {}),
    ...(requestId ? { upstreamRequestId: requestId } : {}),
  };
}

/** Mencatat kegagalan upstream tanpa isi rahasia apa pun (AUD-02, SDD-8.5). */
function logUpstreamFailure(generationId: string, status: number, detail: UpstreamFailureDetail): void {
  logger.warn(
    { requestId: generationId, route: "chat.generate", latencyMs: 0, result: "upstream_error" },
    { upstreamStatus: status, ...detail },
  );
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
 * 429 dan 5xx layak diulang; sisanya (4xx lain) tidak akan berubah dengan
 * percobaan baru.
 */
function isTransient(status: number): boolean {
  return status === STATUS.TOO_MANY_REQUESTS || status >= 500;
}

/** Backoff eksponensial (1s, 2s) dengan jitter; `Retry-After` menang bila ada. */
function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  const base = 1000 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
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
  generationId: string;
  url: string;
  apiKey: string;
  body: unknown;
  outbound: OutboundPolicyOptions;
  signal: AbortSignal;
  /** Dipanggil sekali per potongan; `true` → pembatalan diminta pengguna. */
  shouldStop: () => Promise<boolean>;
  onDelta: (delta: { kind: string; text?: string; usage?: StreamUsage; finishReason?: string | null; toolCall?: ToolCallDelta }) => Promise<void>;
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

  // Batas waktu di sini adalah JEDA antar potongan, bukan durasi total: stream
  // panjang tidak boleh dipotong hanya karena modelnya lambat menjawab.
  const idle = new AbortController();
  let idleFired = false;
  const bumpIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleFired = true;
      idle.abort();
    }, OUTBOUND_LIMITS.streamIdleTimeoutMs);
  };
  let idleTimer = setTimeout(() => {
    idleFired = true;
    idle.abort();
  }, OUTBOUND_LIMITS.streamIdleTimeoutMs);

// Stop pengguna harus memutus koneksi SEGERA, bukan menunggu potongan
  // berikutnya: stream yang sedang diam akan menggantung sampai idle timeout.
  const stopSignal = new AbortController();
  const stopPoll = setInterval(() => {
    void input.shouldStop().then(
      (stop) => {
        if (stop) stopSignal.abort();
      },
      () => {},
    );
  }, 1000);

  const combined = AbortSignal.any([input.signal, idle.signal, stopSignal.signal]);

  // Retry HANYA untuk 429/5xx dan hanya sebelum ada potongan: mengulang setelah
  // streaming mulai akan menduplikasi teks. Backoff menghormati `Retry-After`.
  const MAX_ATTEMPTS = 3;

  // Satu tempat pembersihan untuk SEMUA jalur keluar (T13): timer idle, poll
  // stop, dan reader tidak boleh tertinggal saat galat non-2xx, retry, atau
  // sukses. Tanpa ini, timer idle tetap menyala setelah stream selesai.
  const cleanup = () => {
    clearTimeout(idleTimer);
    clearInterval(stopPoll);
  };

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    let response!: Response;
    for (let attempt = 1; ; attempt += 1) {
      try {
        // POST ber-body: redirect TIDAK diikuti (kredensial & isi tidak dikirim
        // ulang ke tujuan lain); `fetchOutbound` menolaknya sebagai BAD_URL.
        response = await fetchOutbound(
          url,
          {
            method: "POST",
            headers,
            body: JSON.stringify(input.body),
            signal: combined,
          },
          input.outbound,
        );
      } catch (err) {
        if (stopSignal.signal.aborted) throw new StopRequested();
        if (input.signal.aborted) throw err;
        if (idleFired) throw new GenerationError("TIMEOUT", PROVIDER_MESSAGES.TIMEOUT, true);
        throw transportError(err);
      }

      if (response.ok || attempt >= MAX_ATTEMPTS || !isTransient(response.status)) break;

      // Buang body percobaan gagal supaya koneksi tidak menggantung.
      await response.body?.cancel().catch(() => {});
      await sleep(retryDelayMs(response.headers.get("retry-after"), attempt), input.signal);
      if (input.signal.aborted) throw new Error("Dibatalkan saat menunggu retry.");
      idleFired = false;
      bumpIdle();
    }

    bumpIdle();

    if (!response.ok) {
      // 401/403 gateway BUKAN 401 akun: dipetakan jadi kode provider (SDD-5.4).
      const failure = fromUpstreamStatus(response.status);
      const detail = await readFailureDetail(response);
      logUpstreamFailure(input.generationId, response.status, detail);
      // 400/422 dapat dibedakan dari 5xx lewat kode diagnostik, tanpa mengubah
      // kosakata `reason` (AUD-02). Sisanya pakai `reason` apa adanya.
      const code =
        response.status === STATUS.BAD_REQUEST || response.status === STATUS.UNPROCESSABLE
          ? INVALID_REQUEST_CODE
          : failure.reason;
      throw new GenerationError(code, failure.message, failure.retryable);
    }
    if (!response.body) {
      throw new GenerationError("UPSTREAM_ERROR", DISCONNECTED_MESSAGE, true);
    }

    const parser = createStreamParser();
    reader = response.body.getReader();
    let usage: StreamUsage | null = null;
    let sawDone = false;
    let finishReason: string | null = null;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        bumpIdle();
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
            sawDone = true;
            finishReason = delta.finishReason ?? null;
            break;
          }
          if (delta.kind === "usage" && delta.usage) usage = delta.usage;
          await input.onDelta(delta);
        }
      }
      // Koneksi putus tanpa `[DONE]` maupun `finish_reason` berarti jawaban
      // terpotong (AUD-09). Tanpa ini, kalimat menggantung tercatat `complete`.
      if (!sawDone && finishReason === null)
        throw new GenerationError(
          "STREAM_INCOMPLETE",
          "Jawaban terputus sebelum selesai.",
          true,
        );
    } catch (err) {
      // Pembatalan (dari luar atau karena stop) bukan galat generasi: teruskan
      // apa adanya supaya pemanggil membedakannya dari kegagalan gateway.
      // `GenerationError` dari loop ini juga sudah berkode, jangan dibungkus.
      if (stopSignal.signal.aborted) throw new StopRequested();
      // `LeaseLost` bukan kegagalan provider: teruskan supaya worker berhenti
      // tanpa memetakannya jadi galat generasi.
      if (
        input.signal.aborted ||
        err instanceof StopRequested ||
        err instanceof GenerationError ||
        err instanceof LeaseLost
      )
        throw err;
      throw transportError(err);
    }

    return { usage, finishReason };
  } finally {
    cleanup();
    // Menutup koneksi ke gateway — juga jalur pembatalan (SDD-4.6).
    reader?.cancel().catch(() => {});
  }
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
  /**
   * Lease job yang memegang generasi ini. Bila diberikan, setiap tulisan
   * diperiksa terhadapnya; lease yang hilang menghentikan worker tanpa
   * menulis apa pun (FIX-02). Test yang memanggil langsung boleh melewatkannya.
   */
  fence?: FenceChecker,
): Promise<void> {
  const held = async () => {
    if (fence) await assertHeld(fence);
  };

  const generation = await db.generation.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      chatId: true,
      userMessageId: true,
      assistantMessageId: true,
      connectionId: true,
      connectionRevision: true,
      modelId: true,
    },
  });
  if (!generation) throw new GenerationSetupError(`Generation "${generationId}" tidak ditemukan.`);

  const chat = await db.chat.findUnique({
    where: { id: generation.chatId },
    select: { id: true, userId: true, modelRef: true, title: true },
  });
  if (!chat) throw new GenerationSetupError("Chat untuk generasi ini tidak ditemukan.");

  // FIX-05: koneksi yang dipin saat admission menang. Bila barisnya sudah
  // dihapus, generasi gagal dengan alasan jelas — tidak pindah ke koneksi aktif
  // lain yang mungkin milik konfigurasi berbeda. `connectionId` null hanya
  // terjadi pada generasi lama sebelum pinning ada.
  const active = generation.connectionId
    ? await db.connection.findFirst({
        where: { id: generation.connectionId, userId: chat.userId },
        select: { id: true, revision: true },
      })
    : await getActiveConnection(db, chat.userId);
  if (!active) {
    throw new GenerationSetupError(
      generation.connectionId
        ? "Koneksi yang dipakai generasi ini sudah dihapus atau bukan milik Anda."
        : "Belum ada koneksi aktif.",
    );
  }

  // FIX-05: konfigurasi koneksi dipin saat admission. Kalau kredensial atau
  // base URL berubah sebelum worker jalan, generasi ini TIDAK diam-diam memakai
  // konfigurasi baru — ia gagal dengan alasan yang bisa dibaca pengguna.
  if (
    generation.connectionRevision !== null &&
    "revision" in active &&
    active.revision !== generation.connectionRevision
  ) {
    await failGeneration(
      db,
      generationId,
      generation.assistantMessageId,
      new GenerationError(
        "CONNECTION_CHANGED",
        "Konfigurasi koneksi berubah setelah pesan dikirim. Kirim ulang pesan ini.",
        false,
      ),
      "",
      new Date(),
    );
    return;
  }

  // Model pilihan pengguna menang; model bawaan hanya bila chat belum memilih,
  // dan fallback itu DILAPORKAN, bukan disembunyikan (audit A01).
  const cached = config.modelCacheTtlSeconds
    ? await getCachedModels(db, {
        connectionId: active.id,
        ttlSeconds: config.modelCacheTtlSeconds,
        now: new Date(),
      })
    : null;
  const resolution = resolveModel({
    // FIX-05: model yang dipin saat admission menang atas `Chat.modelRef` yang
    // bisa berubah setelah pesan dikirim.
    modelRef: generation.modelId ?? chat.modelRef,
    available: cached ? cached.models : null,
    defaultModel: DEFAULT_MODEL,
  });
  if (!resolution.ok) {
    // Model tidak tersedia → galat jelas, bukan penggantian model diam-diam.
    await failGeneration(
      db,
      generationId,
      generation.assistantMessageId,
      new GenerationError("MODEL_UNAVAILABLE", resolution.message, false),
      "",
      new Date(),
    );
    return;
  }
  const model = resolution.model;

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
  const ancestry = buildAncestryPath(rows, generation.assistantMessageId);
  const messages = await buildMessages(db, chat.userId, ancestry, generation.assistantMessageId);
  const history = trimHistory(messages);

  // Pohon cacat (mis. assistant ber-`parentId` NULL) membuat ancestry kosong
  // dan gateway menolak `messages: []` dengan 400 yang tidak bisa didiagnosis
  // (AUD-01). Hentikan SEBELUM fetch dengan kode yang jelas.
  if (
    !ancestry.some((node) => node.id === generation.userMessageId) ||
    !messages.some((message) => message.role === "user")
  ) {
    await failGeneration(
      db,
      generationId,
      generation.assistantMessageId,
      new GenerationError(
        "INVALID_ANCESTRY",
        "Riwayat pesan untuk generasi ini tidak lengkap.",
        false,
      ),
      "",
      new Date(),
    );
    return;
  }

  // FIX-05 butir 2: budget per model, bukan satu konstanta global. Model besar
  // mendapat jendela penuh, model tak dikenal jatuh ke ceiling konservatif
  // berlabel "assumed" — angkanya tidak pernah diklaim sebagai token sebenarnya.
  const budget = modelBudget({
    modelId: resolution.model,
    gatewayEntry: cached?.models.find((model) => model.id === resolution.model),
  });

  // FIX-05: pesan terbaru yang sendirian melebihi budget ditolak dengan alasan
  // jelas, bukan dipangkas diam-diam. Estimasi token, bukan angka gateway.
  const latestUser = [...history.messages].reverse().find((message) => message.role === "user");
  const latestText =
    typeof latestUser?.content === "string"
      ? latestUser.content.length
      : (latestUser?.content ?? [])
          .reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
  if (
    overBudget({
      promptTokens: estimateTokens("x".repeat(latestText)).tokens,
      reserveTokens: budget.reserveTokens,
      budgetTokens: budget.contextTokens,
    })
  ) {
    await failGeneration(
      db,
      generationId,
      generation.assistantMessageId,
      new GenerationError(
        "INPUT_TOO_LARGE",
        "Pesan ini terlalu panjang untuk model yang dipilih. Pecah jadi beberapa pesan atau mulai chat baru.",
        false,
      ),
      "",
      new Date(),
    );
    return;
  }

  // Prompt pengguna per chat (REQ-NT-31). Baris sistem ber-`parentId` NULL
  // sehingga tak pernah masuk ancestry; ambil langsung di sini. Bila ancestry
  // sudah membawa role system, jangan kirim dua kali.
  const userSystem =
    ancestry.some((node) => node.role === "system") || messages.some((m) => m.role === "system")
      ? null
      : await getSystemPrompt(db, generation.chatId);

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
  // FIX-06: retrieval tidak menghasilkan apa pun / gagal — dilaporkan, bukan diam.
  let ragDegraded = false;
  if (query.trim() !== "") {
    // FIX-06: query retrieval = pesan terakhir + judul chat, bukan pesan saja.
    const retrievalQuery = chat.title ? `${query}\n${chat.title}` : query;
    const embedding = readEmbeddingConfig();
    try {
      const chunks = await retrieveChunks(db, {
        userId: chat.userId,
        chatId: chat.id,
        query: retrievalQuery,
        limit: 6,
        ...(embedding ? { embedding } : {}),
      });
      usedChunks = chunks;
      contextSystem = buildContext(chunks).system;
      keywordOnly = !embedding && chunks.length > 0;
      // FIX-06: degradasi tidak diam-diam (audit T09).
      if (chunks.length === 0) ragDegraded = true;
    } catch {
      // Provider embedding mati: ulangi tanpa vektor supaya dokumen tetap
      // terpakai lewat kata kunci, dan tandai mode degradasi di UI.
      try {
        const chunks = await retrieveChunks(db, {
          userId: chat.userId,
          chatId: chat.id,
          query: retrievalQuery,
          limit: 6,
        });
        usedChunks = chunks;
        contextSystem = buildContext(chunks).system;
        keywordOnly = chunks.length > 0;
        if (chunks.length === 0) ragDegraded = true;
      } catch {
        // Dokumen rusak: jawab tanpa rujukan, tapi tandai degradasi.
        ragDegraded = true;
      }
    }
  }

  // Pencarian web (WP-NT-P7-02/P7-03, REQ-NT-52/53). Kegagalan mesin pencari
  // TIDAK boleh menggagalkan generasi: tangkap, lanjut tanpa sumber.
  let sources: SearchResult[] = [];
  let enriched: EnrichedSource[] = [];
  let searchFailed = false;
  const lastUserRow = [...ancestry].reverse().find((row) => row.role === "user");
  if (query.trim() !== "" && webSearchRequested(lastUserRow?.contentJson)) {
    try {
      sources = await webSearch(query, {
        limit: 5,
        outbound: { allowInsecureHttp: config.allowInsecureHttp, allowlist: config.outboundAllowlist },
      });
      // FIX-10: baca halaman teratas supaya sitasi punya isi nyata; link mati
      // ditandai, bukan diaku hidup.
      enriched = await enrichSources(sources, {
        limit: 2,
        outbound: { allowInsecureHttp: config.allowInsecureHttp, allowlist: config.outboundAllowlist },
      });
    } catch {
      // Isi query tidak dicatat: hanya penanda bahwa pencarian gagal.
      searchFailed = true;
    }
  }
  const searchSystem = buildSearchSystem(enriched.length > 0 ? enriched : sources) ?? null;
  // FIX-13: memori eksplisit pengguna. Tidak ada penyimpanan otomatis di sini —
  // hanya membaca butir yang sudah disetujui pengguna.
  let memorySystem: string | null = null;
  try {
    const memory = await buildMemoryContext(db, { userId: chat.userId, chatId: chat.id });
    memorySystem = memory.system;
  } catch {
    // Memori gagal dibaca bukan alasan menggagalkan generasi.
    memorySystem = null;
  }
  if (resolution.fallback) {
    await publishEvent(db, generationId, "note", {
      code: "MODEL_FALLBACK",
      model,
      message: `Chat belum memilih model; dipakai model bawaan "${model}".`,
    });
  }

  const { baseUrl, apiKey } = await openApiKey(db, config, active.id, chat.userId);

  let text = "";
  let ordinal = 0;

  // FIX-11: potongan tool call disatukan per index setelah stream selesai.
  const toolsEnabled = true;
  const toolFragments = new Map<number, { id?: string; name?: string; arguments: string }>();

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

  // Stop yang masuk SEBELUM dispatch tidak boleh memulai panggilan provider
  // berbayar (FIX-02). Stop setelah dispatch hanya menjamin tidak ada token
  // baru yang ditulis, bukan pembatalan biaya di sisi gateway (SDD-4.6).
  if (await stopIfRequested(db, generationId)) {
    await stopGeneration(db, generationId, generation.assistantMessageId, text, new Date());
    return;
  }

  let usage: StreamUsage | null;
  let finishReason: string | null;
  try {
    ({ usage, finishReason } = await streamGateway({
      generationId,
      url: `${baseUrl.replace(/\/+$/, "")}${CHAT_COMPLETIONS_PATH}`,
      apiKey,
      body: {
        model,
        // FIX-18: satu pesan sistem dengan urutan otoritas tetap. Data dari
        // dokumen/web/memori dibungkus sebagai DATA, bukan instruksi; prompt
        // pengguna tidak dapat menimpa kebijakan.
        messages: [
          {
            role: "system",
            content: composeSystemPrompt({
              tools: toolsEnabled ? CHAT_TOOLS.map((tool) => tool.function.name) : [],
              webSearch: searchSystem !== null,
              canSeeImages: history.messages.some((message) => Array.isArray(message.content)),
              canRunCode: false,
              ...(userSystem ? { userSystemPrompt: userSystem } : {}),
              runtimeContext: buildRuntimeContext({
                now: new Date(),
                // shortcut: preferensi zona waktu per pengguna belum ada kolomnya
                // (`UserSetting.timezone`); tambahkan saat kolom itu menyusul.
                timezone: DEFAULT_TIMEZONE,
                chatTitle: chat.title,
                model,
              }),
              untrusted: [
                ...(memorySystem ? [{ source: "memori", content: memorySystem }] : []),
                ...(contextSystem ? [{ source: "dokumen", content: contextSystem }] : []),
                ...(searchSystem ? [{ source: "web", content: searchSystem }] : []),
              ],
            }).content,
          },
          ...history.messages,
        ],
        stream: true,
        ...(toolsEnabled ? { tools: CHAT_TOOLS } : {}),
      },
      outbound: {
        allowInsecureHttp: config.allowInsecureHttp,
        allowlist: config.outboundAllowlist,
      },
      signal,
      shouldStop: () => stopIfRequested(db, generationId),
      onDelta: async (delta) => {
        // Lease hilang → jangan tulis delta basi ke pesan yang mungkin sudah
        // dipegang worker lain.
        await held();
        if (delta.kind === "tool_call" && delta.toolCall) {
          const slot = toolFragments.get(delta.toolCall.index) ?? { arguments: "" };
          if (delta.toolCall.id) slot.id = delta.toolCall.id;
          if (delta.toolCall.name) slot.name = delta.toolCall.name;
          if (delta.toolCall.argumentsDelta) slot.arguments += delta.toolCall.argumentsDelta;
          toolFragments.set(delta.toolCall.index, slot);
          return;
        }
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
    // Lease hilang: worker lain yang berhak menutup generasi ini.
    if (err instanceof LeaseLost) return;
    // Pembatalan pengguna: simpan partial, tutup `stopped` (SDD-4.6).
    if (err instanceof StopRequested) {
      await held();
      await stopGeneration(db, generationId, generation.assistantMessageId, text, new Date());
      return;
    }
    if (err instanceof GenerationError) {
      await held();
      await failGeneration(db, generationId, generation.assistantMessageId, err, text, new Date());
      return;
    }
    throw err;
  }

  if (signal.aborted) return;
  // Tulisan final juga difencing: lease yang habis selama streaming tidak
  // boleh menutup generasi milik worker lain sebagai `complete`.
  await held();

  // FIX-11: satu ronde tool. Hasil berkas dicatat sebagai part `artifact` supaya
  // UI bisa menampilkan kartu unduhan. Kegagalan tool TIDAK menggagalkan jawaban.
  const artifactParts: { kind: "artifact"; artifactId: string; displayName: string; format: string; sizeBytes: number }[] = [];
  const toolCalls = assembleToolCalls(toolFragments);
  for (const call of toolCalls.slice(0, 3)) {
    if (call.name === GENERATE_DOCUMENT_TOOL_NAME) {
      try {
        const args = parseGenerateDocumentArgs(call.arguments);
        const artifact = await createArtifact(db, {
          userId: chat.userId,
          chatId: chat.id,
          messageId: generation.assistantMessageId,
          displayName: args.displayName,
          input: { format: args.format, doc: args.doc },
        });
        if (artifact.status === "ready") {
          artifactParts.push({
            kind: "artifact",
            artifactId: artifact.id,
            displayName: artifact.displayName,
            format: artifact.format,
            sizeBytes: artifact.sizeBytes,
          });
        }
      } catch {
        // Sama seperti generate_file: kegagalan tool tidak menggagalkan jawaban.
      }
      continue;
    }
    if (call.name !== GENERATE_FILE_TOOL_NAME) continue;
    try {
      const args = parseGenerateFileArgs(call.arguments);
      const artifact = await createArtifact(db, {
        userId: chat.userId,
        chatId: chat.id,
        messageId: generation.assistantMessageId,
        displayName: args.displayName,
        input:
          args.format === "csv"
            ? { format: "csv", rows: args.rows ?? [] }
            : args.format === "json"
              ? { format: "json", content: JSON.parse(args.content ?? "null") }
              : { format: args.format, content: args.content ?? "" },
      });
      if (artifact.status === "ready") {
        artifactParts.push({
          kind: "artifact",
          artifactId: artifact.id,
          displayName: artifact.displayName,
          format: artifact.format,
          sizeBytes: artifact.sizeBytes,
        });
      }
    } catch {
      // Argumen tidak sah atau render gagal: catat sebagai catatan, bukan galat.
    }
  }

  const now = new Date();
  // Catatan ikut di `contentJson` karena UI membacanya dari sana (bagian `note`).
  const notePart = [
    ...(keywordOnly ? [{ kind: "note", code: "keyword-only" }] : []),
    ...(history.trimmed
      ? [
          {
            kind: "note",
            code: "history-trimmed",
            // FIX-05 butir 3: provenance pemangkasan konteks — berapa pesan
            // dibuang, model apa, dan dari mana angka budgetnya. Tanpa ini
            // pengguna tidak bisa tahu konteks mana yang tidak terkirim.
            data: {
              droppedMessages: history.droppedMessages,
              model: resolution.model,
              budgetSource: budget.budgetSource,
              contextTokens: budget.contextTokens,
              reserveTokens: budget.reserveTokens,
            },
          },
        ]
      : []),
    ...(searchFailed ? [{ kind: "note", code: "web-search-unavailable" }] : []),
    // Jawaban kena batas token provider (AUD-10): tampilkan, jangan diam.
    ...(finishReason === "length" ? [{ kind: "note", code: "truncated" }] : []),
    ...(!artifactParts.length && toolFragments.size > 0 ? [{ kind: "note", code: "file-failed" }] : []),
    ...(ragDegraded ? [{ kind: "note", code: "rag-degraded" }] : []),
  ];
  // Sitasi hanya dari penanda yang benar-benar ditulis model (SDD-6.2).
  const citationParts = extractCitations(text, usedChunks).map((citation) => ({
    kind: "citation",
    ...citation,
  }));
  const sourceParts = (
    enriched.length > 0
      ? enriched
      : sources.map((source) => ({
          ...source,
          reach: "unchecked" as const,
          contentHash: null,
          text: null,
        }))
  ).map((source) => ({
    kind: "source" as const,
    title: source.title,
    url: source.url,
    // FIX-10: berita/harga wajib menyebut waktu pengambilan.
    fetchedAt: source.fetchedAt,
    reach: source.reach,
    contentHash: source.contentHash,
    ...("reason" in source && source.reason ? { reason: source.reason } : {}),
  }));
  const contentJson = JSON.stringify({
    parts: [
      ...notePart,
      ...artifactParts,
      ...(text === "" ? [] : [{ kind: "text", text }]),
      ...citationParts,
      ...sourceParts,
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
    usage,
  });
}