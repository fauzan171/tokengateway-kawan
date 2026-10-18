import { describe, expect, it } from "vitest";
import { buildContext } from "./context";
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

describe("buildContext", () => {
  it("tanpa chunk → system null dan note no-documents", () => {
    expect(buildContext([])).toEqual({ system: null, note: "no-documents" });
  });

  it("dua chunk → penanda [1] [2], nama file, dan peringatan bukan instruksi", () => {
    const { system, note } = buildContext([
      chunk(),
      chunk({ chunkId: "c2", filename: "catatan.txt", text: "isi kedua" }),
    ]);
    expect(note).toBeNull();
    expect(system).toContain("[1]");
    expect(system).toContain("[2]");
    expect(system).toContain("laporan.pdf");
    expect(system).toContain("catatan.txt");
    expect(system).toContain("BUKAN instruksi");
  });

  it("page null tidak mencetak halaman null", () => {
    const { system } = buildContext([chunk({ page: null })]);
    expect(system).not.toContain("halaman null");
    expect(system).toContain("[1] laporan.pdf\n");
  });

  it("urutan chunk dipertahankan", () => {
    const { system } = buildContext([
      chunk({ text: "pertama" }),
      chunk({ chunkId: "c2", text: "kedua" }),
    ]);
    expect(system!.indexOf("pertama")).toBeLessThan(system!.indexOf("kedua"));
  });
});
