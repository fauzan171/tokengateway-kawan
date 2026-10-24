/**
 * Klien HTTP keluar untuk gateway provider.
 *
 * Semua kegagalan diterjemahkan ke `ApiError` (SDD-3.1): timeout jadi 504,
 * balasan tidak sah jadi 502, ketergantungan tidak tersedia jadi 503.
 *
 * Pemeriksaan alamat didelegasikan ke modul kebijakan keluar
 * (`src/lib/net`, SDD-5.3): ia me-resolve nama sebelum koneksi, sehingga
 * hostname yang menunjuk ke alamat privat ikut tertolak — bukan hanya literal.
 */

import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  OUTBOUND_LIMITS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import { ApiError, STATUS } from "./errors";

export type FetchJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Kebijakan keluar (SDD-5.3). Pemanggil yang punya akses `Config`
   * mengisinya dengan `allowInsecureHttp` dan `outboundAllowlist`. Bila
   * dihilangkan, dipakai kebijakan paling ketat (`DEFAULT_OUTBOUND_OPTIONS`):
   * hanya `https`, tanpa allowlist.
   */
  outbound?: OutboundPolicyOptions;
};

const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchJsonResult<T> = { status: number; data: T };

export async function fetchJson<T>(
  rawUrl: string,
  options: FetchJsonOptions = {},
): Promise<FetchJsonResult<T>> {
  const url = await assertOutboundAllowed(rawUrl, options.outbound ?? DEFAULT_OUTBOUND_OPTIONS);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetchOutbound(
      url,
      {
        method: options.method ?? "GET",
        headers: options.headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal,
      },
      options.outbound ?? DEFAULT_OUTBOUND_OPTIONS,
    );
  } catch (err) {
    // Penolakan redirect (BAD_URL) sudah punya kode dan pesan sendiri; jangan
    // ditimpa jadi "gateway tidak dapat dihubungi".
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new ApiError({
        status: STATUS.GATEWAY_TIMEOUT,
        code: "UPSTREAM_TIMEOUT",
        message: "Gateway tidak merespons tepat waktu.",
        retryable: true,
      });
    }
    if (options.signal?.aborted) throw err;
    throw new ApiError({
      status: STATUS.SERVICE_UNAVAILABLE,
      code: "UPSTREAM_UNAVAILABLE",
      message: "Gateway tidak dapat dihubungi.",
      retryable: true,
    });
  }

  const text = await readCapped(response, OUTBOUND_LIMITS.maxResponseBytes);
  let data: T;
  try {
    data = (text === "" ? {} : JSON.parse(text)) as T;
  } catch {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "UPSTREAM_BAD_RESPONSE",
      message: "Gateway membalas dengan isi yang tidak dapat dibaca.",
      details: { upstreamStatus: response.status },
    });
  }

  return { status: response.status, data };
}

/**
 * Membaca body dengan batas byte. `response.text()` tidak dibatasi, dan ia
 * menghitung byte SETELAH dekompresi — gzip bomb lolos. Reader dibatalkan
 * begitu batas terlampaui supaya soket tidak menahan memori lebih lama.
 */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "UPSTREAM_TOO_LARGE",
      message: "Balasan gateway melebihi batas ukuran.",
      details: { declaredBytes: declared, maxBytes },
    });
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new ApiError({
          status: STATUS.BAD_GATEWAY,
          code: "UPSTREAM_TOO_LARGE",
          message: "Balasan gateway melebihi batas ukuran.",
          details: { maxBytes },
        });
      }
      chunks.push(value);
    }
  } finally {
    // Batalkan juga saat sukses: stream yang sudah `done` aman, dan ini
    // memastikan soket dilepas bila kita keluar lebih awal karena galat.
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
