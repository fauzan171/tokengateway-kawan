/**
 * Uji pencarian web (WP-NT-P7-01, REQ-NT-51).
 *
 * Jaringan dipalsukan total: `@/lib/net` di-mock agar tidak menjalankan
 * resolusi DNS, dan `fetch` diganti stub. Tidak ada permintaan keluar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const outboundSeen = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string, options?: unknown) => {
    outboundSeen.push(options);
    return url;
  },
  // Tanpa ini modul yang memakai fetchOutbound akan gagal sebelum stub dipanggil.
  fetchOutbound: (url: string, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { SearchError, readWebSearchConfig, webSearch } = await import("./web");

const ENV_KEYS = ["WEBSEARCH_BASE_URL", "WEBSEARCH_API_KEY", "WEBSEARCH_LIMIT"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

describe("readWebSearchConfig", () => {
  it("undefined tanpa WEBSEARCH_BASE_URL", () => {
    expect(readWebSearchConfig({})).toBeUndefined();
    expect(readWebSearchConfig({ WEBSEARCH_BASE_URL: "   " })).toBeUndefined();
  });

  it("limit default 5", () => {
    const config = readWebSearchConfig({ WEBSEARCH_BASE_URL: "https://searx.test" });
    expect(config).toEqual({ baseUrl: "https://searx.test", limit: 5 });
  });

  it("limit tidak sah jatuh ke default, tidak melempar", () => {
    const at = (limit: string) =>
      readWebSearchConfig({ WEBSEARCH_BASE_URL: "https://searx.test", WEBSEARCH_LIMIT: limit })?.limit;
    expect(at("99")).toBe(5);
    expect(at("abc")).toBe(5);
    expect(at("0")).toBe(5);
    expect(at("3")).toBe(3);
  });

  it("kunci opsional ikut terbaca", () => {
    expect(
      readWebSearchConfig({ WEBSEARCH_BASE_URL: "https://searx.test", WEBSEARCH_API_KEY: "kunci" }),
    ).toEqual({ baseUrl: "https://searx.test", limit: 5, apiKey: "kunci" });
  });
});

describe("webSearch", () => {
  it("tanpa konfigurasi melempar SearchError permanen", async () => {
    await expect(webSearch("apa itu")).rejects.toMatchObject({
      name: "SearchError",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("query kosong menghasilkan [] tanpa jaringan", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "https://searx.test";
    expect(await webSearch("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("memetakan hasil dan memotong snippet", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "https://searx.test";
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { title: "Satu", url: "https://a.test/1", content: "ringkas satu" },
          { title: "Dua", url: "https://b.test/2", content: "x".repeat(400) },
        ],
      }),
    );

    const results = await webSearch("apa itu");
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ title: "Satu", url: "https://a.test/1", snippet: "ringkas satu" });
    expect(results[1]?.snippet).toHaveLength(300);

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.pathname).toBe("/search");
    expect(calledUrl.searchParams.get("q")).toBe("apa itu");
    expect(calledUrl.searchParams.get("format")).toBe("json");
  });

  it("membuang hasil tanpa url http", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "https://searx.test";
    fetchMock.mockResolvedValue(
      jsonResponse({
        results: [
          { title: "Relatif", url: "/lokal", content: "a" },
          { title: "Tanpa url", content: "b" },
          { title: "Sah", url: "https://c.test/3", content: "c" },
        ],
      }),
    );
    expect(await webSearch("q")).toEqual([{ title: "Sah", url: "https://c.test/3", snippet: "c" }]);
  });

  it("5xx bisa diulang, 4xx tidak", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "https://searx.test";
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(webSearch("q")).rejects.toMatchObject({ name: "SearchError", retryable: true });

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 400));
    await expect(webSearch("q")).rejects.toMatchObject({ name: "SearchError", retryable: false });
  });

  it("galat jaringan dibungkus SearchError yang bisa diulang", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "https://searx.test";
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:8080"));
    const error = await webSearch("q").catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SearchError);
    expect(error).toMatchObject({ retryable: true });
    // Alamat internal tidak boleh ikut ke pesan galat.
    expect((error as Error).message).not.toContain("10.0.0.1");
  });

  it("meneruskan kebijakan outbound dari pemanggil, bukan konstanta statis", async () => {
    process.env["WEBSEARCH_BASE_URL"] = "http://127.0.0.1:8888";
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const outbound = { allowInsecureHttp: true, allowlist: ["127.0.0.1:8888"] };

    await webSearch("q", { outbound });

    expect(outboundSeen.at(-1)).toEqual(outbound);
  });
});
