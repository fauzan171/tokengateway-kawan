import { describe, expect, it } from "vitest";
import { extractCitations } from "./citations";
import type { RetrievedChunk } from "./retrieve";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "c1",
    documentId: "d1",
    filename: "laporan.pdf",
    page: 3,
    ordinal: 0,
    text: "isi potongan",
    score: 1,
    ...overrides,
  };
}

describe("extractCitations", () => {
  it("jawaban tanpa penanda → [] (anti sitasi palsu)", () => {
    expect(extractCitations("Jawaban biasa tanpa rujukan.", [chunk()])).toEqual([]);
  });

  it("dua penanda → dua sitasi urut dengan metadata benar", () => {
    const citations = extractCitations("Menurut [1] dan [2]", [
      chunk(),
      chunk({ chunkId: "c2", documentId: "d2", filename: "catatan.txt", page: null }),
    ]);
    expect(citations).toEqual([
      { index: 1, chunkId: "c1", documentId: "d1", filename: "laporan.pdf", page: 3 },
      { index: 2, chunkId: "c2", documentId: "d2", filename: "catatan.txt", page: null },
    ]);
  });

  it("penanda di luar jangkauan diabaikan, tidak melempar", () => {
    expect(() => extractCitations("Lihat [9].", [chunk()])).not.toThrow();
    expect(extractCitations("Lihat [9].", [chunk()])).toEqual([]);
  });

  it("penanda berulang → satu sitasi", () => {
    expect(extractCitations("[1] lalu [1]", [chunk()])).toHaveLength(1);
  });

  it("[12] dengan 12 chunk terpetakan ke index 12", () => {
    const chunks = Array.from({ length: 12 }, (_, i) =>
      chunk({ chunkId: `c${i + 1}`, filename: `berkas-${i + 1}.pdf` }),
    );
    expect(extractCitations("Sumber [12]", chunks)).toEqual([
      { index: 12, chunkId: "c12", documentId: "d1", filename: "berkas-12.pdf", page: 3 },
    ]);
  });
});
