/**
 * Uji embedding (WP-NT-P6-05, REQ-NT-56).
 *
 * Jaringan dipalsukan total: `@/lib/net` di-mock agar tidak menjalankan
 * resolusi DNS, dan `fetch` diganti stub. Tidak ada permintaan keluar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChunkDraft } from "./chunk";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { EmbedError, decodeVector, embedChunks, encodeVector, readEmbeddingConfig } = await import("./embed");

const CONFIG = { baseUrl: "https://embed.test/v1", apiKey: "kunci-uji", model: "m" };

function chunk(ordinal: number, text: string): ChunkDraft {
  return { ordinal, text, page: 1, section: null };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodeVector / decodeVector", () => {
  it("bolak-balik mempertahankan nilai", () => {
    const values = [0, 1, -1, 0.5, 0.125];
    expect(decodeVector(encodeVector(values))).toEqual(values);
  });

  it("base64 rusak ditolak", () => {
    expect(() => decodeVector("abc")).toThrow(EmbedError);
  });
});

describe("readEmbeddingConfig", () => {
  it("undefined bila baseUrl atau model tidak diisi", () => {
    expect(readEmbeddingConfig({})).toBeUndefined();
    expect(readEmbeddingConfig({ EMBEDDING_BASE_URL: "https://x/v1" })).toBeUndefined();
  });

  it("membaca dimensi bila sah", () => {
    const config = readEmbeddingConfig({
      EMBEDDING_BASE_URL: "https://x/v1",
      EMBEDDING_MODEL: "m",
      EMBEDDING_DIMENSIONS: "1536",
    });
    expect(config?.dimensions).toBe(1536);
  });
});

describe("embedChunks", () => {
  it("mengirim teks dan mengembalikan vektor sesuai ordinal", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] },
        ],
      }),
    );

    const result = await embedChunks([chunk(0, "satu"), chunk(1, "dua")], CONFIG);

    expect(result.map((r) => r.ordinal)).toEqual([0, 1]);
    expect(decodeVector(result[0]!.embedding).map((v) => Number(v.toFixed(3)))).toEqual([0.1, 0.2]);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.authorization).toBe("Bearer kunci-uji");
    expect(JSON.parse(init.body).input).toEqual(["satu", "dua"]);
  });

  it("memecah batch dan mempertahankan urutan", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const texts = JSON.parse(String(init.body)).input as string[];
      return jsonResponse({
        data: texts.map((text, index) => ({ index, embedding: [text.length, 0] })),
      });
    });

    const chunks = Array.from({ length: 5 }, (_, i) => chunk(i, "x".repeat(i + 1)));
    const result = await embedChunks(chunks, CONFIG, { batchSize: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.map((r) => r.ordinal)).toEqual([0, 1, 2, 3, 4]);
    expect(result.map((r) => decodeVector(r.embedding)[0])).toEqual([1, 2, 3, 4, 5]);
  });

  it("mengulang pada 429 lalu berhasil", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "sibuk" }, 429))
      .mockResolvedValueOnce(jsonResponse({ data: [{ index: 0, embedding: [1, 2] }] }));

    const result = await embedChunks([chunk(0, "a")], CONFIG, { baseDelayMs: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(decodeVector(result[0]!.embedding)).toEqual([1, 2]);
  });

  it("menyerah setelah maxAttempts pada 429", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "sibuk" }, 429));

    await expect(embedChunks([chunk(0, "a")], CONFIG, { baseDelayMs: 1, maxAttempts: 2 })).rejects.toThrow(
      /menolak \(429\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tidak mengulang pada 400", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "model salah" }, 400));

    await expect(embedChunks([chunk(0, "a")], CONFIG, { baseDelayMs: 1 })).rejects.toThrow(/menolak \(400\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("menolak jumlah vektor yang tidak cocok", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [1] }] }));

    await expect(embedChunks([chunk(0, "a"), chunk(1, "b")], CONFIG, { baseDelayMs: 1 })).rejects.toThrow(
      /tidak cocok/,
    );
  });

  it("menolak dimensi yang tidak sesuai konfigurasi", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ index: 0, embedding: [1, 2] }] }));

    await expect(
      embedChunks([chunk(0, "a")], { ...CONFIG, dimensions: 3 }, { baseDelayMs: 1 }),
    ).rejects.toThrow(/Dimensi vektor 2/);
  });

  it("daftar kosong tidak memanggil provider", async () => {
    await expect(embedChunks([], CONFIG)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
