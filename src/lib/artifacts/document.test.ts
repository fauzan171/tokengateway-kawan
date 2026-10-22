/**
 * Uji FIX-12 (bagian 1/2): parseDocSchema + renderer biner via magic bytes.
 */

import { describe, expect, it } from "vitest";
import { parseDocSchema, type DocSchema } from "./document";
import { renderDocxBytes, renderPdfBytes, renderPptxBytes, renderXlsxBytes } from "./render-binary";
import { renderArtifactBytesAsync } from "./render";

const SAMPLE: DocSchema = {
  title: "Laporan Bulanan",
  blocks: [
    { type: "heading", text: "Ringkasan", level: 1 },
    { type: "paragraph", text: "Penjualan naik 12%." },
    { type: "bullets", items: ["Satu", "Dua"] },
    { type: "table", headers: ["Bulan", "Nilai"], rows: [["Jan", "10"], ["Feb", "12"]] },
    { type: "code", text: "SELECT 1;" },
  ],
};

describe("parseDocSchema", () => {
  it("lima tipe blok sah lolos apa adanya", () => {
    expect(parseDocSchema(SAMPLE)).toEqual(SAMPLE);
  });

  it("blok tak dikenal dibuang, blok lain tetap ada", () => {
    const doc = parseDocSchema({
      title: "Laporan",
      blocks: [{ type: "video", src: "x.mp4" }, { type: "paragraph", text: "hai" }],
    });
    expect(doc.blocks).toEqual([{ type: "paragraph", text: "hai" }]);
  });

  it("baris table yang panjangnya tidak cocok dibuang, headers utuh", () => {
    const doc = parseDocSchema({
      title: "L",
      blocks: [{ type: "table", headers: ["a", "b"], rows: [["1", "2"], ["3"]] }],
    });
    expect(doc.blocks[0]).toMatchObject({ headers: ["a", "b"], rows: [["1", "2"]] });
  });

  it("title kosong dan blocks bukan array ditolak", () => {
    expect(() => parseDocSchema({ title: "", blocks: [] })).toThrowError(/INVALID_DOC_SCHEMA/);
    expect(() => parseDocSchema({ title: "x", blocks: "bukan" })).toThrowError(/INVALID_DOC_SCHEMA/);
    expect(() => parseDocSchema("string")).toThrowError(/INVALID_DOC_SCHEMA/);
  });

  it("501 blok ditolak, 500 lolos", () => {
    const blocks = Array.from({ length: 501 }, () => ({ type: "paragraph", text: "x" }));
    expect(() => parseDocSchema({ title: "t", blocks })).toThrowError(/INVALID_DOC_SCHEMA/);
    expect(parseDocSchema({ title: "t", blocks: blocks.slice(0, 500) }).blocks.length).toBe(500);
  });

  it("level selain 1/2/3 dianggap 1, teks dipotong 20.000", () => {
    const doc = parseDocSchema({
      title: "t",
      blocks: [{ type: "heading", text: "h", level: 9 }, { type: "paragraph", text: "a".repeat(20_001) }],
    });
    expect(doc.blocks[0]).toMatchObject({ level: 1 });
    expect((doc.blocks[1] as { text: string }).text.length).toBe(20_000);
  });
});

describe("renderer biner (magic bytes)", () => {
  it("pdf diawali %PDF-", async () => {
    const bytes = await renderPdfBytes(SAMPLE);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("docx diawali PK dan memuat word/document.xml", async () => {
    const bytes = await renderDocxBytes(SAMPLE);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.toString("latin1")).toContain("word/document.xml");
  });

  it("xlsx diawali PK dan memuat nama internal xl/", async () => {
    const bytes = await renderXlsxBytes(SAMPLE);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.toString("latin1")).toContain("xl/");
  });

  it("pptx diawali PK dan memuat ppt/", async () => {
    const bytes = await renderPptxBytes(SAMPLE);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    expect(bytes.length).toBeGreaterThan(1000);
    expect(bytes.toString("latin1")).toContain("ppt/");
  });

  it("renderArtifactBytesAsync: format biner terisi, varian teks untuk biner ditolak", async () => {
    await expect(renderArtifactBytesAsync({ format: "pdf", doc: SAMPLE })).resolves.toBeInstanceOf(Buffer);
    await expect(
      renderArtifactBytesAsync({ format: "pdf", content: "teks" } as never),
    ).rejects.toThrowError(/INVALID_DOC_SCHEMA/);
  });
});
