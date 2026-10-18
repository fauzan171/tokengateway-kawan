/**
 * Embedding chunk dokumen (WP-NT-P6-05, REQ-NT-56, SDD-6.1 butir 5).
 *
 * Vektor disimpan sebagai teks base64 (`DocumentChunk.embedding`), bukan
 * `Bytes`, karena migrasi harus identik di SQLite dan PostgreSQL.
 *
 * Modul ini TIDAK menulis ke database: ia menerima chunk dan mengembalikan
 * vektor. Penulisan dilakukan pemanggil (job `document.embed`), supaya batas
 * modul tetap satu tugas dan mudah diuji tanpa DB.
 *
 * Server-only: memakai `fetch` ke provider embedding.
 */

import { assertOutboundAllowed, DEFAULT_OUTBOUND_OPTIONS, type OutboundPolicyOptions } from "@/lib/net";
import type { ChunkDraft } from "./chunk";

/** Konfigurasi provider embedding. Tanpa ini, fitur jatuh ke pencarian kata
 *  kunci (REQ-NT-61) — bukan galat. */
export type EmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Dimensi vektor yang diharapkan. Bila provider mengembalikan dimensi lain,
   *  hasilnya ditolak: vektor beda dimensi tidak bisa dibandingkan. */
  dimensions?: number;
};

export type EmbeddedChunk = {
  ordinal: number;
  /** Vektor sebagai base64 (float32 little-endian), siap simpan ke kolom. */
  embedding: string;
};

export type EmbedOptions = {
  /** Jumlah teks per permintaan. Bawaan 32. */
  batchSize?: number;
  /** Percobaan maksimum per batch saat 429/5xx. Bawaan 3. */
  maxAttempts?: number;
  /** Jeda dasar backoff dalam ms. Bawaan 500, digandakan tiap percobaan. */
  baseDelayMs?: number;
  outbound?: OutboundPolicyOptions;
  signal?: AbortSignal;
};

const DEFAULT_BATCH = 32;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_DELAY_MS = 500;
const TIMEOUT_MS = 60_000;

/** Galat permanen: permintaan tidak akan berhasil bila diulang apa adanya. */
export class EmbedError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "EmbedError";
    this.retryable = retryable;
  }
}

/** Membaca konfigurasi dari env. `undefined` bila belum lengkap. */
export function readEmbeddingConfig(
  env: Record<string, string | undefined> = process.env,
): EmbeddingConfig | undefined {
  const baseUrl = env["EMBEDDING_BASE_URL"]?.trim();
  const model = env["EMBEDDING_MODEL"]?.trim();
  if (!baseUrl || !model) return undefined;
  const rawDimensions = env["EMBEDDING_DIMENSIONS"]?.trim();
  const dimensions = rawDimensions ? Number(rawDimensions) : undefined;
  return {
    baseUrl,
    model,
    apiKey: env["EMBEDDING_API_KEY"]?.trim() ?? "",
    ...(dimensions && Number.isInteger(dimensions) && dimensions > 0 ? { dimensions } : {}),
  };
}

/** Float32 → base64. Float32 dipilih karena itu yang dipakai sebagian besar
 *  model embedding; penghematan setengah ukuran tidak sepadan dengan
 *  kehilangan presisi untuk pencarian kemiripan. */
export function encodeVector(values: readonly number[]): string {
  const buffer = Buffer.allocUnsafe(values.length * 4);
  values.forEach((value, index) => buffer.writeFloatLE(value, index * 4));
  return buffer.toString("base64");
}

/** Kebalikan `encodeVector`; dipakai retrieval (P6-06) dan uji. */
export function decodeVector(encoded: string): number[] {
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length % 4 !== 0) throw new EmbedError("Vektor base64 tidak sah.", false);
  const out: number[] = [];
  for (let offset = 0; offset < buffer.length; offset += 4) out.push(buffer.readFloatLE(offset));
  return out;
}

type EmbeddingResponse = {
  data?: { index?: number; embedding?: unknown }[];
  error?: { message?: string };
};

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new EmbedError("Permintaan dibatalkan.", false));
    const timer = setTimeout(done, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new EmbedError("Permintaan dibatalkan.", false));
      },
      { once: true },
    );
    function done() {
      resolve();
    }
  });
}

/** Satu batch: kirim teks, terima vektor. Mengulang pada 429/5xx. */
async function embedBatch(
  texts: string[],
  config: EmbeddingConfig,
  options: Required<Pick<EmbedOptions, "maxAttempts" | "baseDelayMs">> & EmbedOptions,
): Promise<number[][]> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/embeddings`;
  const target = await assertOutboundAllowed(url, options.outbound ?? DEFAULT_OUTBOUND_OPTIONS);

  let lastError: EmbedError | undefined;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw new EmbedError("Permintaan dibatalkan.", false);

    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, input: texts }),
        signal,
      });
    } catch (err) {
      // Jaringan putus/timeout: bisa dipulihkan, coba lagi dengan jeda.
      lastError = new EmbedError(
        `Provider embedding tidak terjangkau: ${err instanceof Error ? err.message : String(err)}`,
        true,
      );
      if (attempt < options.maxAttempts) {
        await sleep(options.baseDelayMs * 2 ** (attempt - 1), options.signal);
        continue;
      }
      throw lastError;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const retryable = isRetryableStatus(response.status);
      lastError = new EmbedError(
        `Provider embedding menolak (${response.status}): ${body.slice(0, 200)}`,
        retryable,
      );
      if (retryable && attempt < options.maxAttempts) {
        await sleep(options.baseDelayMs * 2 ** (attempt - 1), options.signal);
        continue;
      }
      throw lastError;
    }

    let payload: EmbeddingResponse;
    try {
      payload = (await response.json()) as EmbeddingResponse;
    } catch {
      throw new EmbedError("Respons embedding bukan JSON.", false);
    }

    if (payload.error?.message) throw new EmbedError(payload.error.message, false);
    const rows = payload.data;
    if (!Array.isArray(rows) || rows.length !== texts.length) {
      throw new EmbedError("Jumlah vektor tidak cocok dengan jumlah teks yang dikirim.", false);
    }

    // Urutan tidak dijamin provider; `index` dipakai bila ada.
    const ordered: number[][] = new Array(texts.length);
    rows.forEach((row, fallbackIndex) => {
      const index = typeof row.index === "number" ? row.index : fallbackIndex;
      const vector = row.embedding;
      if (!Array.isArray(vector) || vector.some((v) => typeof v !== "number")) {
        throw new EmbedError("Vektor embedding berisi nilai bukan angka.", false);
      }
      if (config.dimensions && vector.length !== config.dimensions) {
        throw new EmbedError(
          `Dimensi vektor ${vector.length} tidak sesuai EMBEDDING_DIMENSIONS=${config.dimensions}.`,
          false,
        );
      }
      ordered[index] = vector as number[];
    });

    return ordered;
  }

  throw lastError ?? new EmbedError("Embedding gagal tanpa sebab yang tercatat.", true);
}

/**
 * Embed semua chunk, berurutan sesuai `ordinal`.
 *
 * Batch dipisah supaya satu dokumen besar tidak mengirim ribuan teks dalam satu
 * permintaan (batas provider), dan supaya kegagalan satu batch tidak membuang
 * hasil batch sebelumnya.
 */
export async function embedChunks(
  chunks: readonly ChunkDraft[],
  config: EmbeddingConfig,
  options: EmbedOptions = {},
): Promise<EmbeddedChunk[]> {
  if (chunks.length === 0) return [];

  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new EmbedError("batchSize harus bilangan bulat positif.", false);
  }

  const settings = {
    ...options,
    maxAttempts: options.maxAttempts ?? DEFAULT_ATTEMPTS,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_DELAY_MS,
  };

  const out: EmbeddedChunk[] = [];
  for (let start = 0; start < chunks.length; start += batchSize) {
    const batch = chunks.slice(start, start + batchSize);
    const vectors = await embedBatch(
      batch.map((chunk) => chunk.text),
      config,
      settings,
    );
    batch.forEach((chunk, index) => {
      out.push({ ordinal: chunk.ordinal, embedding: encodeVector(vectors[index] ?? []) });
    });
  }
  return out;
}
