/**
 * Uji FIX-10: catatan sumber, `web.read`, dan verifikasi DOI.
 * Jaringan dipalsukan total — tidak ada permintaan keluar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  fetchOutbound: (url: string, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { canonicalUrl, locateQuote, sha256Hex, sourceVerdict } = await import("./record");
const { ReadError, readSource, enrichSources } = await import("./read");
const { canonicalDoi, verifyDoi } = await import("./crossref");

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

function html(body: string, status = 200, url = "https://contoh.test/artikel"): Response {
  const response = new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

function crossref(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("record: URL kanonik & verdict", () => {
  it("membuang fragment, parameter pelacak, dan menormalkan host", () => {
    expect(canonicalUrl("https://Contoh.TEST/a?utm_source=x&id=7#bagian")).toBe(
      "https://contoh.test/a?id=7",
    );
  });

  it("menolak skema selain http/https", () => {
    expect(() => canonicalUrl("file:///etc/passwd")).toThrow(/http/);
  });

  it("locateQuote memberi paragraf dan rentang; kutipan hilang → null", () => {
    const text = "Satu.\n\nDua berisi kutipan penting.\n\nTiga.";
    const locator = locateQuote(text, "kutipan penting");
    expect(locator?.paragraph).toBe(2);
    expect(locator?.start).toBe(text.indexOf("kutipan penting"));
    expect(locateQuote(text, "tidak ada")).toBeNull();
  });

  it("hanya reachable + metadata verified yang disebut verified", () => {
    expect(sourceVerdict({ reach: "reachable", metadata: "verified" })).toBe("verified");
    expect(sourceVerdict({ reach: "reachable", metadata: "mismatch" })).toBe("unverified");
    expect(sourceVerdict({ reach: "blocked", metadata: "unknown" })).toBe("unverified");
    expect(sourceVerdict({ reach: "dead", metadata: "verified" })).toBe("dead");
  });

  it("sha256Hex stabil dan berbeda untuk isi berbeda", () => {
    expect(sha256Hex("a")).toBe(sha256Hex("a"));
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});

describe("web.read", () => {
  it("positif: judul, teks, hash, fetchedAt, URL final", async () => {
    fetchMock.mockResolvedValue(
      html(
        "<html><head><title>Judul Halaman</title><style>x{}</style></head><body><p>Isi pertama.</p><script>alert(1)</script><p>Isi kedua.</p></body></html>",
      ),
    );
    const result = await readSource("https://contoh.test/artikel");
    expect(result.source.title).toBe("Judul Halaman");
    expect(result.source.reach).toBe("reachable");
    expect(result.source.contentHash).toHaveLength(64);
    expect(result.source.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.text).toContain("Isi pertama.");
    expect(result.text).not.toContain("alert(1)");
    expect(result.text).not.toContain("x{}");
  });

  it("negatif: 403 → BLOCKED, bukan halaman kosong", async () => {
    fetchMock.mockResolvedValue(html("nope", 403));
    await expect(readSource("https://contoh.test/a")).rejects.toMatchObject({ code: "BLOCKED" });
  });

  it("negatif: paywall terdeteksi → PAYWALL", async () => {
    fetchMock.mockResolvedValue(html("<html><body>Subscribe to continue reading</body></html>"));
    await expect(readSource("https://contoh.test/a")).rejects.toMatchObject({ code: "PAYWALL" });
  });

  it("negatif: tipe tidak didukung ditolak", async () => {
    const response = new Response("PK", {
      status: 200,
      headers: { "content-type": "application/zip" },
    });
    fetchMock.mockResolvedValue(response);
    await expect(readSource("https://contoh.test/a")).rejects.toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
  });

  it("negatif: jaringan gagal → UNREACHABLE", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(readSource("https://contoh.test/a")).rejects.toBeInstanceOf(ReadError);
    await expect(readSource("https://contoh.test/a")).rejects.toMatchObject({
      code: "UNREACHABLE",
    });
  });

  it("negatif: halaman tanpa teks → NO_TEXT", async () => {
    fetchMock.mockResolvedValue(html("<html><body>   </body></html>"));
    await expect(readSource("https://contoh.test/a")).rejects.toMatchObject({ code: "NO_TEXT" });
  });
});

describe("enrichSources", () => {
  const base = (n: number) => ({
    title: `T${n}`,
    url: `https://contoh.test/${n}`,
    snippet: `snippet ${n}`,
    fetchedAt: "2026-10-23T00:00:00.000Z",
  });

  it("hanya `limit` URL teratas dibaca penuh; sisanya unchecked tanpa request", async () => {
    fetchMock.mockImplementation(async (url: string) => html(`<p>isi ${url}</p>`, 200, url));
    const rows = await enrichSources([base(1), base(2), base(3), base(4)], { limit: 2 });

    expect(rows).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rows[0]?.reach).toBe("reachable");
    expect(rows[0]?.text).toContain("isi https://contoh.test/1");
    expect(rows[1]?.reach).toBe("reachable");
    expect(rows[2]).toMatchObject({ reach: "unchecked", text: null, contentHash: null });
    expect(rows[3]?.reach).toBe("unchecked");
  });

  it("menandai dead untuk tautan mati dan blocked untuk 403/paywall", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(html("nope", 403));
    const rows = await enrichSources([base(1), base(2), base(3)], { limit: 2 });

    expect(rows[0]).toMatchObject({ reach: "dead", reason: "UNREACHABLE", text: null });
    expect(rows[1]).toMatchObject({ reach: "blocked", reason: "BLOCKED" });
    expect(rows[2]?.reach).toBe("unchecked");
  });

  it("sumber terbaca menyimpan hash isi dan waktu ambil dari hasil baca", async () => {
    fetchMock.mockResolvedValue(html("<title>Nyata</title><p>isi</p>"));
    const rows = await enrichSources([base(1)], { limit: 1 });

    expect(rows[0]?.title).toBe("Nyata");
    expect(rows[0]?.contentHash).toHaveLength(64);
    expect(rows[0]?.fetchedAt).not.toBe("2026-10-23T00:00:00.000Z");
    expect(rows[0]?.reach).toBe("reachable");
  });

  it("kegagalan satu URL tidak menggagalkan yang lain", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(html("<p>hidup</p>"));
    const rows = await enrichSources([base(1), base(2)], { limit: 2 });

    expect(rows[0]?.reach).toBe("dead");
    expect(rows[1]?.reach).toBe("reachable");
    expect(rows[1]?.text).toContain("hidup");
  });

  it("limit tidak melebihi jumlah hasil", async () => {
    fetchMock.mockResolvedValue(html("<p>x</p>"));
    const rows = await enrichSources([base(1)], { limit: 5 });
    expect(rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("verifikasi DOI", () => {
  it("DOI kanonik: prefix doi.org/ dan doi: dibuang", () => {
    expect(canonicalDoi("https://doi.org/10.1234/ABC.Def")).toBe("10.1234/abc.def");
    expect(canonicalDoi("doi: 10.1000/xyz")).toBe("10.1000/xyz");
    expect(canonicalDoi("bukan-doi")).toBeNull();
  });

  it("positif: metadata cocok → verified", async () => {
    fetchMock.mockResolvedValue(
      crossref({
        message: { title: ["Deep Learning for Token Gateways"], issued: { "date-parts": [[2023]] } },
      }),
    );
    const verdict = await verifyDoi("10.1234/abc", {
      title: "Deep learning for token gateways",
      year: 2023,
    });
    expect(verdict.state).toBe("verified");
    expect(verdict.foundTitle).toContain("Deep Learning");
  });

  it("negatif: DOI fiktif (404 Crossref) → mismatch", async () => {
    fetchMock.mockResolvedValue(crossref({}, 404));
    const verdict = await verifyDoi("10.9999/palsu", { title: "Apa saja" });
    expect(verdict.state).toBe("mismatch");
    expect(verdict.reason).toBe("DOI_NOT_FOUND");
  });

  it("negatif: DOI hidup tapi karya lain → mismatch TITLE_MISMATCH", async () => {
    fetchMock.mockResolvedValue(crossref({ message: { title: ["Studi Tentang Tanah"] } }));
    const verdict = await verifyDoi("10.1234/abc", { title: "Quantum Computing Survey" });
    expect(verdict.state).toBe("mismatch");
    expect(verdict.reason).toBe("TITLE_MISMATCH");
  });

  it("negatif: tahun meleset → mismatch YEAR_MISMATCH", async () => {
    fetchMock.mockResolvedValue(
      crossref({
        message: { title: ["Token Gateway Performance"], issued: { "date-parts": [[2015]] } },
      }),
    );
    const verdict = await verifyDoi("10.1234/abc", {
      title: "Token gateway performance",
      year: 2024,
    });
    expect(verdict.state).toBe("mismatch");
    expect(verdict.reason).toBe("YEAR_MISMATCH");
  });

  it("negatif: Crossref tidak terjangkau → unreachable, bukan verified", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const verdict = await verifyDoi("10.1234/abc", { title: "Token gateway" });
    expect(verdict.state).toBe("unreachable");
  });

  it("tanpa DOI → unknown, tanpa jaringan", async () => {
    const verdict = await verifyDoi("bukan-doi", { title: "X" });
    expect(verdict.state).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
