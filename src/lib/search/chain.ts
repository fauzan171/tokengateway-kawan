/**
 * D3: chain pencarian riset Tavily → Jina → DDG → direct (failover fail-closed).
 *
 * Terpisah dari `web.ts` (SearXNG) supaya perilaku chat lama tidak berubah.
 * Kontrak provider seragam; kegagalan sebagian tidak dianggap gagal penuh dan
 * TIDAK PERNAH ada hasil fiktif — tanpa satu pun hasil valid, pemanggil menerima
 * `SearchError` supaya loop D1 mencatat gap, bukan mengarang jawaban.
 *
 * Semua request keluar lewat kebijakan egress (`fetchOutbound`); key hanya hidup
 * di memori proses ini dan tidak pernah masuk pesan galat, log, atau hasil.
 *
 * DDG (DuckDuckGo HTML) gratis tanpa key: fallback saat TAVILY/JINA kosong.
 * Limitasi kualitas: ekstrak `direct` memakai `readSource` existing (tanpa
 * Readability — dependensi sengaja tidak ditambah), jadi menu/footer bisa ikut
 * ke snippet pada halaman tanpa `<article>`/`<main>`.
 */

import { randomUUID } from "node:crypto";
import { assertOutboundAllowed, fetchOutbound, DEFAULT_OUTBOUND_OPTIONS, type OutboundPolicyOptions } from "@/lib/net";
import { loadConfig } from "@/lib/config/env";
import { decryptSecret } from "@/lib/secrets";
import { readSource } from "@/lib/sources/read";
import type { Db } from "@/lib/db";
import { SearchError, SNIPPET_MAX, type SearchResult } from "./web";
import { sanitizeSearchQuery } from "./egress";

export type SearchProviderName = "tavily" | "jina" | "duckduckgo" | "direct";

export interface SearchProvider {
  name: SearchProviderName;
  /** true bila key tersedia dan kuota harian belum habis. */
  ready(db: Db, userId: string): Promise<boolean>;
  search(query: string, limit: number, signal: AbortSignal): Promise<SearchResult[]>;
}

/** Kuota harian per user (buffer atas batas bulanan provider). Batas LUNAK:
 *  `ready` (baca) + `countSearch` (tulis) tidak atomik, jadi dua request paralel
 *  bisa overshoot sedikit (≤ derajat konkurensi). Hitungan tidak hilang (upsert
 *  atomik) dan angka ini buffer atas kuota provider, jadi overshoot kecil cukup. */
const QUOTA: Record<SearchProviderName, number> = { tavily: 100, jina: 50, duckduckgo: 100, direct: 40 };

/**
 * Tujuan AAD baris `ConnectorCredential` untuk key pencarian.
 *
 * Disamakan dengan `saveConnectorToken` ("connector.token") supaya baris BYOK
 * tavily/jina yang ditulis lewat jalur itu tetap bisa dibuka di sini.
 */
const SEARCH_KEY_PURPOSE = "connector.token";

const DEFAULT_LIMIT = 5;

/** Hari UTC "YYYY-MM-DD", kunci baris `SearchUsageDaily`. */
function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Hitungan hari ini; 0 bila provider belum dipakai. */
async function usedToday(db: Db, userId: string, provider: SearchProviderName): Promise<number> {
  const row = await db.searchUsageDaily.findUnique({
    where: { userId_provider_day: { userId, provider, day: utcDay() } },
    select: { count: true },
  });
  return row?.count ?? 0;
}

/**
 * Naikkan hitungan harian sekali. Dipanggil SEBELUM request keluar supaya
 * percobaan yang gagal pun tetap terhitung. Upsert atomik pada
 * `@@unique([userId, provider, day])`: lintas restart/worker barisnya sama dan
 * `count` naik 1, bukan baris ganda.
 */
export async function countSearch(
  db: Db,
  userId: string,
  provider: SearchProviderName,
): Promise<void> {
  const day = utcDay();
  await db.searchUsageDaily.upsert({
    where: { userId_provider_day: { userId, provider, day } },
    create: { id: randomUUID(), userId, provider, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}

/**
 * Resolusi key: kredensial user (ConnectorCredential tavily/jina) dulu, lalu env
 * admin. Kredensial user yang gagal dibuka DIABAIKAN (jatuh ke env), supaya satu
 * baris rusak tidak melumpuhkan pencarian.
 */
export async function resolveSearchKeys(
  db: Db,
  userId: string,
): Promise<{ tavily?: string; jina?: string }> {
  const out: { tavily?: string; jina?: string } = {};

  const rows = await db.connectorCredential.findMany({
    // Terbaru menang: bila user punya >1 kredensial provider sama, pilihannya
    // deterministik (yang paling akhir diperbarui), bukan acak.
    where: { userId, provider: { in: ["tavily", "jina"] }, revokedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, provider: true, tokenEncrypted: true },
  });
  if (rows.length > 0) {
    const { encryptionKey } = loadConfig();
    for (const row of rows) {
      if (row.provider !== "tavily" && row.provider !== "jina") continue;
      if (out[row.provider]) continue;
      try {
        const token = decryptSecret({
          envelope: row.tokenEncrypted,
          key: encryptionKey,
          aad: { rowId: row.id, userId, purpose: SEARCH_KEY_PURPOSE },
        });
        // Hasil kosong dianggap TIDAK ADA, supaya fallback env tetap jalan.
        if (token.trim() !== "") out[row.provider] = token;
      } catch {
        // Kredensial rusak / AAD tak cocok: pakai key env admin bila ada.
      }
    }
  }

  out.tavily ??= (process.env["TAVILY_API_KEY"] ?? "").trim() || undefined;
  out.jina ??= (process.env["JINA_API_KEY"] ?? "").trim() || undefined;
  return out;
}

/** Ambil JSON dari penyedia; status non-2xx jadi SearchError dengan kode stabil. */
async function fetchJson(
  url: URL,
  init: RequestInit,
  outbound: OutboundPolicyOptions,
): Promise<Record<string, unknown>> {
  const target = await assertOutboundAllowed(url.toString(), outbound);
  const response = await fetchOutbound(target, { ...init, redirect: "follow" }, outbound);
  if (!response.ok) {
    throw new SearchError(
      `Penyedia pencarian membalas ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

/** Petakan hasil mentah penyedia ke `SearchResult`; snippet ≤ SNIPPET_MAX. */
function mapHits(rows: unknown, limit: number): SearchResult[] {
  const list = Array.isArray(rows) ? rows : [];
  const fetchedAt = new Date().toISOString();
  const out: SearchResult[] = [];
  for (const item of list) {
    const row = item as Record<string, unknown>;
    const url = typeof row["url"] === "string" ? (row["url"] as string) : "";
    if (!url.startsWith("http")) continue;
    const rawSnippet =
      typeof row["content"] === "string"
        ? (row["content"] as string)
        : typeof row["description"] === "string"
          ? (row["description"] as string)
          : "";
    const title = typeof row["title"] === "string" && row["title"] ? (row["title"] as string) : url;
    out.push({ title, url, snippet: rawSnippet.slice(0, SNIPPET_MAX), fetchedAt });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Satu objek per provider (bukan hierarki kelas). `key` undefined menandai
 * provider tanpa key (duckduckgo/direct); `ready` menolaknya untuk provider berkey.
 */
function provider(
  name: SearchProviderName,
  key: string | undefined,
  run: (query: string, limit: number, signal: AbortSignal) => Promise<SearchResult[]>,
): SearchProvider {
  return {
    name,
    ready: async (db, userId) => {
      if ((name === "tavily" || name === "jina") && !key) return false;
      return (await usedToday(db, userId, name)) < QUOTA[name];
    },
    search: run,
  };
}

/** Decode entitas HTML umum tanpa dependensi. */
function decodeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** Petakan HTML DuckDuckGo (`result__a` + `result__snippet`) ke `SearchResult`. */
function mapDuckHits(html: string, limit: number): SearchResult[] {
  const fetchedAt = new Date().toISOString();
  const out: SearchResult[] = [];
  // shortcut: pola anchor DDG stabil; upgrade ke DOM parser bila DDG ubah markup.
  const re =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let url = decodeHtml(m[1] ?? "").trim();
    // DDG membungkus tautan luar lewat redirect `/l/?uddg=<url-asli>`.
    if (url.includes("uddg=")) {
      try {
        url = new URL(url, "https://duckduckgo.com").searchParams.get("uddg") ?? url;
      } catch {
        // Pertahankan URL mentah; filter http di bawah yang memutuskan.
      }
    }
    if (url.startsWith("//")) url = `https:${url}`;
    if (!url.startsWith("http")) continue;
    const title = decodeHtml((m[2] ?? "").replace(/<[^>]*>/g, "").trim()) || url;
    const snippet = decodeHtml((m[3] ?? "").replace(/<[^>]*>/g, "").trim()).slice(0, SNIPPET_MAX);
    out.push({ title, url, snippet, fetchedAt });
    if (out.length >= limit) break;
  }
  return out;
}

/** Susun provider dengan key sudah teresolusi dan kebijakan egress terkunci. */
function makeProviders(
  keys: { tavily?: string; jina?: string },
  outbound: OutboundPolicyOptions,
): SearchProvider[] {
  return [
    provider("tavily", keys.tavily, async (query, limit, signal) => {
      if (!keys.tavily) throw new SearchError("Penyedia pencarian tidak siap.", false);
      const payload = await fetchJson(
        new URL("https://api.tavily.com/search"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            authorization: `Bearer ${keys.tavily}`,
          },
          body: JSON.stringify({ query, max_results: limit }),
          signal,
        },
        outbound,
      );
      return mapHits(payload["results"], limit);
    }),
    provider("jina", keys.jina, async (query, limit, signal) => {
      if (!keys.jina) throw new SearchError("Penyedia pencarian tidak siap.", false);
      const url = new URL(`https://s.jina.ai/${encodeURIComponent(query)}`);
      const payload = await fetchJson(
        url,
        {
          method: "GET",
          headers: { accept: "application/json", authorization: `Bearer ${keys.jina}` },
          signal,
        },
        outbound,
      );
      return mapHits(payload["data"], limit);
    }),
    // duckduckgo: fallback gratis tanpa key (HTML lite, bukan API).
    // Selalu ready; kegagalan (blokir/captcha/bukan HTML) → failover ke direct.
    provider("duckduckgo", undefined, async (query, limit, signal) => {
      const url = new URL("https://html.duckduckgo.com/html/");
      url.searchParams.set("q", query);
      const target = await assertOutboundAllowed(url.toString(), outbound);
      const response = await fetchOutbound(
        target,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            accept: "text/html",
            "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
          },
          body: new URLSearchParams({ q: query }).toString(),
          signal,
          redirect: "follow",
        },
        outbound,
      );
      if (!response.ok) {
        throw new SearchError(
          `Penyedia pencarian membalas ${response.status}.`,
          response.status === 429 || response.status >= 500,
        );
      }
      return mapDuckHits(await response.text(), limit);
    }),
    // direct: baca satu URL yang sudah diketahui lewat readSource existing,
    // bukan mesin scraping. Query non-URL gagal → chain fail-closed.
    provider("direct", undefined, async (query, _limit, signal) => {
      const read = await readSource(query, { outbound, signal });
      return [
        {
          title: read.source.title,
          url: read.source.url,
          snippet: read.text.slice(0, SNIPPET_MAX),
          fetchedAt: read.source.fetchedAt,
        },
      ];
    }),
  ];
}

/**
 * Failover berurutan: tavily → jina → duckduckgo → direct. Provider yang
 * kuotanya habis atau keynya tak ada dilewati (bukan error). Sukses sebagian dilaporkan lewat
 * `attempts`. Semua gagal/habis → `SearchError("SEARCH_UNAVAILABLE", false)`,
 * tanpa hasil apa pun.
 */
export async function chainSearch(
  db: Db,
  userId: string,
  query: string,
  opts: { limit?: number; signal: AbortSignal; outbound?: OutboundPolicyOptions },
): Promise<{
  results: SearchResult[];
  provider: SearchProviderName;
  attempts: { provider: SearchProviderName; error?: string }[];
}> {
  // Egress gate: sanitasi SEBELUM hitung kuota dan sebelum request provider mana
  // pun. Kosong/murni-PII → fail-closed, tidak ada fetch keluar sama sekali.
  const { query: safeQuery } = sanitizeSearchQuery(query);
  if (!safeQuery) throw new SearchError("SEARCH_UNAVAILABLE", false);

  const limit = opts.limit ?? DEFAULT_LIMIT;
  const outbound = opts.outbound ?? DEFAULT_OUTBOUND_OPTIONS;
  const keys = await resolveSearchKeys(db, userId);
  const providers = makeProviders(keys, outbound);

  const attempts: { provider: SearchProviderName; error?: string }[] = [];
  for (const p of providers) {
    if (!(await p.ready(db, userId))) continue;
    // Dihitung sebelum request keluar: percobaan gagal tetap memakai jatah.
    await countSearch(db, userId, p.name);
    try {
      const results = await p.search(safeQuery, limit, opts.signal);
      if (results.length > 0) return { results, provider: p.name, attempts };
      attempts.push({ provider: p.name, error: "EMPTY_RESULT" });
    } catch (err) {
      // Pesan upstream disanitasi: hanya SearchError yang sudah generik yang
      // diteruskan, sisanya jadi kode stabil. Key tidak pernah ikut.
      attempts.push({
        provider: p.name,
        error: err instanceof SearchError ? err.message : "UPSTREAM_ERROR",
      });
    }
  }

  throw new SearchError("SEARCH_UNAVAILABLE", false);
}