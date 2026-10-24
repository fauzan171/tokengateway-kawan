/**
 * Pencarian web opsional (WP-NT-P7-01, REQ-NT-51, SDD-1.5).
 *
 * Satu protokol saja: SearXNG JSON API. Bisa di-self-host dan tidak wajib
 * kunci, jadi tidak ada adapter kedua sampai ada mesin yang benar-benar
 * dibutuhkan.
 *
 * Server-only: `WEBSEARCH_*` tidak pernah dikirim ke klien. Klien hanya
 * menerima boolean dari `GET /api/kawan/v1/capabilities`.
 */

import { ApiError } from "@/lib/api/errors";
import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";

export type WebSearchConfig = {
  baseUrl: string;
  apiKey?: string;
  /** Jumlah hasil maksimum; default 5. */
  limit: number;
};

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  /** Waktu hasil diambil (ISO-8601); berita/harga wajib menyebutnya. */
  fetchedAt: string;
};

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const TIMEOUT_MS = 8_000;
const SNIPPET_MAX = 300;

/** Galat pencarian. `retryable` menandai galat yang layak diulang apa adanya. */
export class SearchError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "SearchError";
    this.retryable = retryable;
  }
}

/** Membaca konfigurasi dari env. `undefined` bila mesin belum dikonfigurasi —
 *  satu-satunya syarat adalah `WEBSEARCH_BASE_URL`. */
export function readWebSearchConfig(
  env: Record<string, string | undefined> = process.env,
): WebSearchConfig | undefined {
  const baseUrl = env["WEBSEARCH_BASE_URL"]?.trim();
  if (!baseUrl) return undefined;

  const rawLimit = Number(env["WEBSEARCH_LIMIT"]?.trim());
  const limit =
    Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= MAX_LIMIT ? rawLimit : DEFAULT_LIMIT;

  const apiKey = env["WEBSEARCH_API_KEY"]?.trim();
  return { baseUrl, limit, ...(apiKey ? { apiKey } : {}) };
}

type SearxngResponse = {
  results?: { title?: unknown; url?: unknown; content?: unknown }[];
};

/** Mencari di web. Mengembalikan `[]` untuk query kosong, tanpa jaringan. */
export async function webSearch(
  query: string,
  options: { limit?: number; signal?: AbortSignal; outbound?: OutboundPolicyOptions } = {},
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const config = readWebSearchConfig();
  if (!config) throw new SearchError("Pencarian web belum dikonfigurasi.", false);

  const limit = options.limit ?? config.limit;
  const url = new URL(`${config.baseUrl.replace(/\/+$/, "")}/search`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  const outbound = options.outbound ?? DEFAULT_OUTBOUND_OPTIONS;
  const target = await assertOutboundAllowed(url.toString(), outbound);
  const signal = options.signal ?? AbortSignal.timeout(TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        signal,
      },
      outbound,
    );
  } catch (err) {
    // Penolakan redirect tetap BAD_URL: itu keputusan kebijakan, bukan gangguan.
    if (err instanceof ApiError) throw err;
    // Detail galat jaringan tidak diteruskan: bisa memuat alamat internal.
    throw new SearchError("Mesin pencari tidak dapat dihubungi.", true);
  }

  if (!response.ok) {
    throw new SearchError(
      `Mesin pencari membalas ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }

  let payload: SearxngResponse;
  try {
    payload = (await response.json()) as SearxngResponse;
  } catch {
    throw new SearchError("Respons mesin pencari bukan JSON.", false);
  }

  const rows = Array.isArray(payload.results) ? payload.results : [];
  const fetchedAt = new Date().toISOString();
  const results: SearchResult[] = [];
  for (const row of rows) {
    const href = typeof row.url === "string" ? row.url : "";
    if (!href.startsWith("http")) continue;
    const snippet = typeof row.content === "string" ? row.content : "";
    results.push({
      title: typeof row.title === "string" && row.title ? row.title : href,
      url: href,
      snippet: snippet.slice(0, SNIPPET_MAX),
      fetchedAt,
    });
    if (results.length >= limit) break;
  }
  return results;
}
