/**
 * Klien HTTP keluar untuk gateway provider.
 *
 * Semua kegagalan diterjemahkan ke `ApiError` (SDD-3.1): timeout jadi 504,
 * balasan tidak sah jadi 502, ketergantungan tidak tersedia jadi 503.
 */

import { ApiError, STATUS } from "./errors";

export type FetchJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/** Alamat yang tidak pernah boleh jadi tujuan permintaan keluar: metadata
 *  cloud, loopback, dan rentang privat. ponytail: cek literal saja, DNS
 *  yang menunjuk ke alamat privat belum tertangkap; pindah ke pemeriksaan
 *  alamat hasil resolusi bila endpoint provider jadi bisa diisi pengguna. */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
  "fd00:ec2::254",
]);

function assertAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "BAD_URL",
      message: "Alamat tidak valid.",
    });
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "BAD_URL",
      message: "Hanya http dan https yang didukung.",
    });
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const blocked =
    BLOCKED_HOSTS.has(host) ||
    host.startsWith("127.") ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (blocked) {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "BAD_URL",
      message: "Alamat tujuan tidak diizinkan.",
    });
  }

  return url;
}

export type FetchJsonResult<T> = { status: number; data: T };

export async function fetchJson<T>(
  rawUrl: string,
  options: FetchJsonOptions = {},
): Promise<FetchJsonResult<T>> {
  const url = assertAllowedUrl(rawUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    });
  } catch (err) {
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

  const text = await response.text();
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
