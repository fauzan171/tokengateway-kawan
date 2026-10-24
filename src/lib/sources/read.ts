/**
 * `web.read` (FIX-10): ambil HTML/PDF yang diizinkan lewat kebijakan egress
 * FIX-07, ekstrak judul + teks + URL final + waktu ambil + hash.
 *
 * Tidak ada yang dijalankan dari halaman: tanpa script, tanpa cookie, tanpa
 * subresource. Ekstraksi gagal / login / paywall → `blocked`/`unsupported`,
 * BUKAN halaman kosong yang dianggap "sudah dibaca".
 */

import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import { extractText, ExtractError } from "@/lib/documents/extract";
import { canonicalUrl, sha256Hex, type SourceRecord } from "./record";

export const READ_LIMITS = {
  /** Batas byte mentah; halaman lebih besar dipotong, tidak digagalkan. */
  maxBytes: 2 * 1024 * 1024,
  maxTextChars: 200_000,
  timeoutMs: 10_000,
} as const;

export type ReadResult = {
  source: SourceRecord;
  text: string;
};

/** Kegagalan baca yang tidak boleh dianggap "kosong". Kode stabil untuk UI. */
export class ReadError extends Error {
  readonly code:
    | "BLOCKED"
    | "PAYWALL"
    | "UNSUPPORTED_TYPE"
    | "TOO_LARGE"
    | "UNREACHABLE"
    | "NO_TEXT";

  constructor(code: ReadError["code"], message: string) {
    super(message);
    this.name = "ReadError";
    this.code = code;
  }
}

/** Sinyal paywall/login yang umum; halaman seperti ini tidak "berhasil dibaca". */
const PAYWALL_MARKERS = [
  "subscribe to continue",
  "subscribers only",
  "sign in to read",
  "create a free account to continue",
  "this content is for members",
  "enable javascript",
];

const READABLE_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "application/pdf"];

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  if (og?.[1]) return decodeEntities(og[1]).trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeEntities(title[1]).replace(/\s+/g, " ").trim() : "";
}

function htmlToText(html: string): string {
  return decodeEntities(
    stripNoise(html)
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectPaywall(html: string): boolean {
  const lower = html.toLowerCase();
  return PAYWALL_MARKERS.some((marker) => lower.includes(marker));
}

function mimeOf(header: string | null): string {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Baca satu URL. `throws ReadError` untuk kegagalan yang tidak boleh disamarkan
 * sebagai halaman kosong; kegagalan jaringan mengembalikan record `dead`.
 */
export async function readSource(
  input: string,
  options: { outbound?: OutboundPolicyOptions; signal?: AbortSignal } = {},
): Promise<ReadResult> {
  const url = canonicalUrl(input);
  const outbound = options.outbound ?? DEFAULT_OUTBOUND_OPTIONS;
  const signal = options.signal ?? AbortSignal.timeout(READ_LIMITS.timeoutMs);
  const fetchedAt = new Date().toISOString();

  const target = await assertOutboundAllowed(url, outbound);

  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      {
        method: "GET",
        redirect: "follow",
        // Tanpa cookie, tanpa referer: tidak ada sesi pengguna yang bocor ke situs.
        headers: { accept: "text/html,application/pdf;q=0.9,text/plain;q=0.8" },
        signal,
      },
      outbound,
    );
  } catch {
    throw new ReadError("UNREACHABLE", "Situs tidak dapat dihubungi.");
  }

  const finalUrl = response.url ? canonicalUrl(response.url) : url;
  const base = {
    url: finalUrl,
    title: finalUrl,
    fetchedAt,
    contentHash: null,
    locator: null,
  };

  if (response.status === 401 || response.status === 402 || response.status === 403) {
    throw new ReadError("BLOCKED", `Situs menolak akses (${response.status}).`);
  }
  if (!response.ok) throw new ReadError("UNREACHABLE", `Situs membalas ${response.status}.`);

  const type = mimeOf(response.headers.get("content-type"));
  if (!READABLE_TYPES.includes(type)) {
    throw new ReadError("UNSUPPORTED_TYPE", `Tipe konten ${type || "tidak dikenal"} tidak didukung.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > READ_LIMITS.maxBytes) {
    throw new ReadError("TOO_LARGE", "Halaman melebihi batas ukuran baca.");
  }

  let text: string;
  let title = "";
  if (type === "application/pdf") {
    try {
      const extracted = await extractText("application/pdf", buffer);
      text = extracted.text;
    } catch (err) {
      if (err instanceof ExtractError) throw new ReadError("NO_TEXT", "PDF tidak punya lapisan teks.");
      throw new ReadError("UNREACHABLE", "PDF gagal diurai.");
    }
  } else {
    const html = buffer.toString("utf8");
    if (type !== "text/plain" && detectPaywall(html)) {
      throw new ReadError("PAYWALL", "Halaman di balik paywall/login.");
    }
    title = type === "text/plain" ? "" : extractTitle(html);
    text = type === "text/plain" ? html.trim() : htmlToText(html);
  }

  if (text === "") throw new ReadError("NO_TEXT", "Halaman tidak berisi teks yang dapat dibaca.");

  const trimmed = text.slice(0, READ_LIMITS.maxTextChars);
  return {
    source: {
      ...base,
      title: title || finalUrl,
      contentHash: sha256Hex(buffer),
      reach: "reachable",
      metadata: "unknown",
    },
    text: trimmed,
  };
}

/** Jumlah halaman yang benar-benar dibaca per jawaban; sisanya tetap snippet. */
const ENRICH_LIMIT = 2;

export type EnrichedSource = {
  title: string;
  url: string;
  snippet: string;
  fetchedAt: string;
  reach: SourceRecord["reach"];
  contentHash: string | null;
  /** Teks halaman hasil baca; null bila tidak dibaca/gagal. */
  text: string | null;
  reason?: string;
};

/**
 * Baca halaman teratas dari hasil pencarian supaya sitasi punya isi nyata, dan
 * link mati/terblokir tidak diklaim hidup. Kegagalan satu URL tidak
 * menggagalkan yang lain dan tidak menggagalkan generasi.
 */
export async function enrichSources(
  results: readonly { title: string; url: string; snippet: string; fetchedAt: string }[],
  options: { outbound?: OutboundPolicyOptions; limit?: number } = {},
): Promise<EnrichedSource[]> {
  const limit = Math.min(options.limit ?? ENRICH_LIMIT, results.length);
  const enriched: EnrichedSource[] = [];

  for (const [index, result] of results.entries()) {
    if (index >= limit) {
      enriched.push({ ...result, reach: "unchecked", contentHash: null, text: null });
      continue;
    }
    try {
      const read = await readSource(result.url, { outbound: options.outbound });
      enriched.push({
        title: read.source.title,
        url: read.source.url,
        snippet: result.snippet,
        fetchedAt: read.source.fetchedAt,
        reach: "reachable",
        contentHash: read.source.contentHash,
        text: read.text,
      });
    } catch (err) {
      const code = err instanceof ReadError ? err.code : "UNREACHABLE";
      enriched.push({
        ...result,
        reach: code === "BLOCKED" || code === "PAYWALL" ? "blocked" : "dead",
        contentHash: null,
        text: null,
        reason: code,
      });
    }
  }

  return enriched;
}
