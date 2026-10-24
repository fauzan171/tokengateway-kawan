/**
 * WP-NT-P7-02 — penanda permintaan pencarian dan system prompt sumber.
 */

import { describe, expect, it } from "vitest";
import { buildSearchSystem, wantsFreshData, webSearchRequested } from "./prompt";

describe("webSearchRequested", () => {
  it("true bila ada bagian web-search", () => {
    const json = JSON.stringify({
      parts: [{ kind: "text", text: "halo" }, { kind: "web-search" }],
    });
    expect(webSearchRequested(json)).toBe(true);
  });

  it("false bila tidak ada bagian web-search", () => {
    expect(webSearchRequested(JSON.stringify({ parts: [{ kind: "text", text: "halo" }] }))).toBe(
      false,
    );
  });

  it("false untuk masukan rusak tanpa melempar", () => {
    expect(webSearchRequested(null)).toBe(false);
    expect(webSearchRequested(undefined)).toBe(false);
    expect(webSearchRequested("")).toBe(false);
    expect(webSearchRequested("bukan json")).toBe(false);
    expect(webSearchRequested("{}")).toBe(false);
    expect(webSearchRequested('{"parts":"x"}')).toBe(false);
  });
});

describe("buildSearchSystem", () => {
  it("undefined untuk hasil kosong", () => {
    expect(buildSearchSystem([])).toBeUndefined();
  });

  it("memberi nomor S dan menyertakan URL tanpa bertabrakan dengan [1]", () => {
    const system = buildSearchSystem([
      { title: "Satu", url: "https://a.test/1", snippet: "isi satu" },
      { title: "Dua", url: "https://b.test/2", snippet: "isi dua" },
    ]);
    expect(system).toBeDefined();
    expect(system).toContain("[S1] Satu — https://a.test/1");
    expect(system).toContain("[S2] Dua — https://b.test/2");
    expect(system).not.toContain("[1]");
    expect(system).toContain("isi satu");
  });

  it("memotong snippet panjang", () => {
    const system = buildSearchSystem([
      { title: "Panjang", url: "https://c.test/3", snippet: "x".repeat(1000) },
    ]);
    expect(system).toBeDefined();
    expect(system?.includes("x".repeat(300))).toBe(true);
    expect(system?.includes("x".repeat(301))).toBe(false);
  });

  it("FIX-10: menyertakan teks halaman nyata, waktu ambil, dan hash", () => {
    const system = buildSearchSystem([
      {
        title: "Berita",
        url: "https://d.test/4",
        snippet: "ringkasan pencarian",
        fetchedAt: "2026-10-23T08:00:00.000Z",
        reach: "reachable",
        contentHash: "abcdef0123456789",
        text: "Paragraf penuh hasil baca halaman.",
      },
    ]);
    expect(system).toContain("Paragraf penuh hasil baca halaman.");
    expect(system).toContain("diambil 2026-10-23T08:00:00.000Z");
    expect(system).toContain("hash abcdef012345");
  });

  it("FIX-10: menandai sumber mati/terblokir agar tidak dikutip", () => {
    const system = buildSearchSystem([
      {
        title: "Mati",
        url: "https://e.test/5",
        snippet: "s",
        fetchedAt: "2026-10-23T08:00:00.000Z",
        reach: "dead",
        contentHash: null,
        text: null,
        reason: "UNREACHABLE",
      },
      { title: "Blok", url: "https://f.test/6", snippet: "s", reach: "blocked", text: null },
    ]);
    expect(system).toContain("TAUTAN MATI");
    expect(system).toContain("TERBLOKIR/PAYWALL");
  });

  it("FIX-10: memotong teks halaman panjang dan jatuh ke snippet bila teks null", () => {
    const long = buildSearchSystem([
      { title: "L", url: "https://g.test/7", snippet: "s", text: "y".repeat(5000) },
    ]);
    expect(long?.includes("y".repeat(2000))).toBe(true);
    expect(long?.includes("y".repeat(2001))).toBe(false);

    const noText = buildSearchSystem([
      { title: "N", url: "https://h.test/8", snippet: "snippet cadangan", text: null },
    ]);
    expect(noText).toContain("snippet cadangan");
  });
});

describe("wantsFreshData (UX-1 auto-search)", () => {
  it.each([
    "berapa harga Bitcoin hari ini?",
    "berita terbaru tentang pemilu",
    "cuaca Jakarta sekarang",
    "jadwal bioskop tahun ini",
  ])("%s terdeteksi butuh data terkini", (q) => {
    expect(wantsFreshData(q)).toBe(true);
  });

  it.each([
    "apa itu fotosintesis?",
    "tolong ringkas paragraf ini",
    "",
  ])("%s tidak memicu pencarian", (q) => {
    expect(wantsFreshData(q)).toBe(false);
  });
});
