/**
 * Uji chain pencarian D3 (failover Tavily → Jina → direct, fail-closed).
 *
 * Jaringan dipalsukan: `@/lib/net` dan `@/lib/sources/read` di-mock, `fetch`
 * diganti stub. Tidak ada permintaan keluar.
 */

import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => new URL(url),
  fetchOutbound: (url: URL, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

// Bisa dikendalikan tiap tes supaya cabang `direct` (sukses maupun gagal) teruji.
const readSourceMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sources/read", () => ({ readSource: readSourceMock }));

const { chainSearch, countSearch } = await import("./chain");
const { SearchError } = await import("./web");

const KEY_TAVILY = "tvly-RAHASIA-jangan-bocor-123";
const KEY_JINA = "jina-RAHASIA-jangan-bocor-456";
const ENV_KEYS = ["TAVILY_API_KEY", "JINA_API_KEY"];

let temp: TempDb;
let db: Db;
let fetchMock: ReturnType<typeof vi.fn>;
let savedEnv: Record<string, string | undefined>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env["TAVILY_API_KEY"] = KEY_TAVILY;
  process.env["JINA_API_KEY"] = KEY_JINA;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Bawaan: `direct` gagal, supaya tes failover tidak diam-diam lewat direct.
  readSourceMock.mockReset();
  readSourceMock.mockRejectedValue(new Error("direct gagal"));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await temp.cleanup();
});

const signal = () => AbortSignal.timeout(8_000);

it("failover tavily gagal ke jina — attempts tercatat, hasil dari jina", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({}, 500)) // tavily 5xx
    .mockResolvedValueOnce(
      jsonResponse({ data: [{ title: "J", url: "https://j.test/1", description: "isi jina" }] }),
    );

  const out = await chainSearch(db, "u1", "apa itu", { signal: signal() });

  expect(out.provider).toBe("jina");
  expect(out.results).toHaveLength(1);
  expect(out.results[0]).toMatchObject({ url: "https://j.test/1", snippet: "isi jina" });
  expect(out.attempts.some((a) => a.provider === "tavily")).toBe(true);

  // attempts dilaporkan lewat jalur sukses; key tidak boleh ikut ke sana.
  const dump = JSON.stringify(out.attempts);
  expect(dump).not.toContain(KEY_TAVILY);
  expect(dump).not.toContain(KEY_JINA);
});

it("direct sukses — readSource dipakai apa adanya saat tavily/jina gagal", async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 500)); // tavily + jina gagal
  readSourceMock.mockResolvedValue({
    source: { title: "Halaman", url: "https://d.test/1", fetchedAt: "2026-10-26T00:00:00.000Z" },
    text: "isi halaman utama",
  });

  const out = await chainSearch(db, "u1", "https://d.test/1", { signal: signal() });

  expect(out.provider).toBe("direct");
  expect(out.results[0]).toMatchObject({ url: "https://d.test/1", snippet: "isi halaman utama" });
  expect(readSourceMock).toHaveBeenCalledOnce();
});

it("direct gagal / query non-URL → tetap SEARCH_UNAVAILABLE, bukan sukses kosong", async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 500));
  readSourceMock.mockRejectedValue(new Error("bukan URL"));

  const error = await chainSearch(db, "u1", "bukan url sama sekali", { signal: signal() }).catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SearchError);
  expect(error).toMatchObject({ message: "SEARCH_UNAVAILABLE", retryable: false });
});

it("semua provider gagal → SEARCH_UNAVAILABLE, tanpa hasil, retryable:false", async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 500));

  const error = await chainSearch(db, "u1", "apa itu", { signal: signal() }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SearchError);
  expect(error).toMatchObject({ message: "SEARCH_UNAVAILABLE", retryable: false });
});

it("kuota harian habis → provider dilewati, bukan error", async () => {
  // tavily habis (100), jina masih ada kuota.
  await db.searchUsageDaily.create({
    data: { id: "r1", userId: "u1", provider: "tavily", day: new Date().toISOString().slice(0, 10), count: 100 },
  });
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ data: [{ title: "J", url: "https://j.test/1", description: "d" }] }),
  );

  const out = await chainSearch(db, "u1", "q", { signal: signal() });

  expect(out.provider).toBe("jina");
  expect(out.attempts.some((a) => a.provider === "tavily")).toBe(false);
  // tavily tidak pernah dipanggil karena dilewati sebelum request.
  expect(String(fetchMock.mock.calls[0]?.[0])).toContain("s.jina.ai");
});

it("key tidak bocor ke pesan galat maupun attempts", async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 500));

  const error = (await chainSearch(db, "u1", "q", { signal: signal() }).catch(
    (e: unknown) => e,
  )) as InstanceType<typeof SearchError>;
  const dump = [
    error.message,
    JSON.stringify(error, Object.getOwnPropertyNames(error)),
    JSON.stringify(error),
  ].join("\n");

  expect(dump).not.toContain(KEY_TAVILY);
  expect(dump).not.toContain(KEY_JINA);
});

it("query murni-PII → fail-closed, TIDAK ada request keluar sama sekali", async () => {
  const error = await chainSearch(db, "u1", "budi@example.com", { signal: signal() }).catch(
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SearchError);
  expect(error).toMatchObject({ message: "SEARCH_UNAVAILABLE", retryable: false });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(readSourceMock).not.toHaveBeenCalled();
});

it("PII di antara kata lain dibuang sebelum dikirim ke provider", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse({ results: [{ title: "T", url: "https://t.test/1", content: "isi" }] }),
  );

  await chainSearch(db, "u1", "info harga budi@example.com kopi", { signal: signal() });

  // tavily kirim query lewat body POST, bukan URL — periksa badan permintaan.
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  const body = String(init.body);
  expect(body).not.toContain("budi@example.com");
  expect(body).toContain("harga");
  expect(body).toContain("kopi");
});

it("countSearch idempotent lintas restart — upsert naik 1, bukan baris ganda", async () => {
  await countSearch(db, "u1", "tavily");
  await countSearch(db, "u1", "tavily"); // "restart" memanggil ulang

  const rows = await db.searchUsageDaily.findMany({ where: { userId: "u1", provider: "tavily" } });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.count).toBe(2);
});

it("timeout provider (AbortSignal 8s) memicu failover", async () => {
  let calls = 0;
  fetchMock.mockImplementation((_url: unknown, init: RequestInit) => {
    calls += 1;
    if (calls === 1) {
      // Panggilan tavily "timeout": promise-nya ditolak dengan AbortError,
      // persis seperti fetch saat signal dibatalkan.
      expect((init.signal as AbortSignal).aborted).toBe(false);
      return Promise.reject(new DOMException("aborted", "AbortError"));
    }
    return Promise.resolve(
      jsonResponse({ data: [{ title: "J", url: "https://j.test/1", description: "d" }] }),
    );
  });

  const out = await chainSearch(db, "u1", "q", { signal: AbortSignal.timeout(8_000) });
  expect(out.provider).toBe("jina");
  expect(out.attempts.some((a) => a.provider === "tavily")).toBe(true);
});