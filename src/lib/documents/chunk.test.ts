/**
 * Uji chunking (WP-NT-P6-04, REQ-NT-55, SDD-6.1 butir 4).
 *
 * Teks uji dibangun dari token utuh (`w0001`, `x0001`, ...) supaya potongan
 * di tengah kata langsung terlihat: setiap token dalam chunk harus utuh.
 */

import { describe, expect, it } from "vitest";
import { chunkPages, MAX_CHUNKS_PER_DOCUMENT } from "./chunk";

/** Token berurutan dengan prefiks; spasi tunggal sebagai pemisah. */
function tokens(prefix: string, count: number, from = 1): string {
  return Array.from({ length: count }, (_, i) => `${prefix}${String(from + i).padStart(4, "0")}`).join(" ");
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

describe("chunkPages", () => {
  it("teks 2500 karakter: beberapa chunk, masing-masing 800–1200 karakter", () => {
    const text = tokens("w", 450); // 450 × 5 + 449 = 2699 karakter
    expect(text.length).toBeGreaterThan(2500);

    const chunks = chunkPages([{ page: 1, text }]);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThanOrEqual(800);
      expect(chunk.text.length).toBeLessThanOrEqual(1200);
    }
  });

  it("chunk bersambung: ekor chunk n muncul di awal chunk n+1", () => {
    const chunks = chunkPages([{ page: 1, text: tokens("w", 450) }]);

    for (let i = 1; i < chunks.length; i += 1) {
      const previousTail = words(chunks[i - 1]!.text).slice(-40);
      const currentHead = words(chunks[i]!.text).slice(0, 40);
      // Setidaknya beberapa kata terakhir chunk sebelumnya diulang di awal
      // chunk berikutnya — itu bukti overlap, bukan sekadar pemotongan.
      expect(currentHead.some((word) => previousTail.includes(word))).toBe(true);
    }
  });

  it("tidak memotong di tengah kata", () => {
    const chunks = chunkPages([{ page: 1, text: tokens("w", 450) }]);

    for (const chunk of chunks) {
      for (const word of words(chunk.text)) {
        expect(word).toMatch(/^w\d{4}$/);
      }
    }
  });

  it("tidak menyeberangi halaman; page tiap chunk benar", () => {
    const chunks = chunkPages([
      { page: 1, text: tokens("w", 300) },
      { page: 2, text: tokens("x", 300) },
    ]);

    const page1 = chunks.filter((c) => c.page === 1);
    const page2 = chunks.filter((c) => c.page === 2);
    expect(page1.length).toBeGreaterThan(0);
    expect(page2.length).toBeGreaterThan(0);
    for (const chunk of page1) expect(chunk.text).not.toMatch(/x\d{4}/);
    for (const chunk of page2) expect(chunk.text).not.toMatch(/w\d{4}/);
  });

  it("ordinal berurutan 0..n-1 tanpa lubang", () => {
    const chunks = chunkPages([
      { page: 1, text: tokens("w", 300) },
      { page: 2, text: tokens("x", 300) },
    ]);

    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it("halaman kosong tidak menghasilkan chunk kosong", () => {
    const chunks = chunkPages([
      { page: 1, text: "   \n\n  " },
      { page: 2, text: "isi nyata" },
      { page: 3, text: "" },
    ]);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ ordinal: 0, page: 2, text: "isi nyata", section: null });
  });

  it("melebihi batas chunk: melempar, bukan diam", () => {
    // ~6 juta karakter → jauh di atas 5000 chunk.
    const text = "kata ".repeat(1_200_000);
    expect(() => chunkPages([{ page: 1, text }])).toThrow(/lebih dari 5000 chunk/);
    expect(MAX_CHUNKS_PER_DOCUMENT).toBe(5000);
  });
});
