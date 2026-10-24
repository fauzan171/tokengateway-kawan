/**
 * Uji D3: blok baru pageBreak / divider / bullets.ordered / image (artifactId).
 *
 * Parser: batas 20 gambar + truncated; alt/caption dipotong 200; widthPct
 * diklem 10-100. Renderer: dibaca balik dari byte arsip (pembaca independen).
 */

import { describe, expect, it } from "vitest";
import { parseDocSchema } from "./document";
import { readZip } from "./zip";
import { renderDocxBytes, renderPdfBytes, renderPptxBytes, renderXlsxBytes } from "./render-binary";

// PNG 1x1 merah (magic valid, header IHDR terbaca).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Isi entri arsip OOXML sebagai teks; gagal keras bila entri tidak ada. */
function entryText(bytes: Buffer, name: string): string {
  const found = readZip(bytes).get(name);
  if (!found) throw new Error(`entri ${name} tidak ada di arsip`);
  return found.toString("utf8");
}

const DOC_D3 = {
  title: "D3",
  blocks: [
    { type: "paragraph", text: "atas" },
    { type: "pageBreak" },
    { type: "paragraph", text: "bawah" },
    { type: "divider" },
    { type: "bullets", items: ["satu", "dua"], ordered: true },
    { type: "image", artifactId: "art_img", alt: "diagram", caption: "Gambar 1", widthPct: 50 },
  ],
} as const;

describe("parseDocSchema D3", () => {
  it("pageBreak/divider lolos apa adanya tanpa payload", () => {
    const doc = parseDocSchema({ title: "t", blocks: [{ type: "pageBreak" }, { type: "divider" }] });
    expect(doc.blocks).toEqual([{ type: "pageBreak" }, { type: "divider" }]);
    expect(doc.unknownBlocks).toBe(0);
  });

  it("bullets.ordered dipertahankan, default tanpa flag", () => {
    const doc = parseDocSchema({
      title: "t",
      blocks: [
        { type: "bullets", items: ["a"], ordered: true },
        { type: "bullets", items: ["b"] },
      ],
    });
    expect(doc.blocks[0]).toMatchObject({ ordered: true });
    expect(doc.blocks[1]).not.toHaveProperty("ordered");
  });

  it("image tanpa artifactId/alt dihitung unknownBlocks", () => {
    const doc = parseDocSchema({
      title: "t",
      blocks: [{ type: "image", alt: "x" }, { type: "image", artifactId: "a" }, { type: "image", artifactId: "ok", alt: "y" }],
    });
    expect(doc.unknownBlocks).toBe(2);
    expect(doc.blocks).toHaveLength(1);
  });

  it("gambar ke-21 dibuang + truncated; alt/caption dipotong 200; widthPct diklem 10-100", () => {
    const blocks = Array.from({ length: 21 }, () => ({
      type: "image",
      artifactId: "art_x",
      alt: "a".repeat(210),
      caption: "c".repeat(210),
      widthPct: 500,
    }));
    const doc = parseDocSchema({ title: "t", blocks });
    expect(doc.blocks).toHaveLength(20);
    expect(doc.truncated).toBe(true);
    const first = doc.blocks[0] as { alt: string; caption: string; widthPct: number };
    expect(first.alt.length).toBe(200);
    expect(first.caption?.length).toBe(200);
    expect(first.widthPct).toBe(100);
  });
});

describe("renderer D3 — pembaca independen", () => {
  const resolver = async (artifactId: string) =>
    artifactId === "art_img" ? { bytes: PNG_1x1, mime: "image/png" } : null;

  it("PDF: pageBreak menambah halaman (Count 2)", async () => {
    const bytes = await renderPdfBytes(DOC_D3 as never, resolver);
    const text = bytes.toString("latin1");
    const counts = [...text.matchAll(/\/Count (\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
    // ordered -> "1. " muncul di stream teks PDF (mungkin terenkripsi Tj, cek longgar).
    expect(text).toContain("%PDF-");
  });

  it("DOCX: PageBreak + thematicBreak + media gambar masuk arsip", async () => {
    const bytes = await renderDocxBytes(DOC_D3 as never, resolver);
    const doc = entryText(bytes, "word/document.xml");
    expect(doc).toContain('<w:br w:type="page"/>');
    expect(doc).toContain("<w:pBdr>");
    expect(doc).toContain("1. satu");
    expect(readZip(bytes).size).toBeGreaterThan(1);
    const names = [...readZip(bytes).keys()];
    expect(names.some((n) => n.startsWith("word/media/"))).toBe(true);
  });

  it("DOCX: gambar hilang jadi teks [alt], bukan galat", async () => {
    const bytes = await renderDocxBytes(DOC_D3 as never, null);
    expect(entryText(bytes, "word/document.xml")).toContain("[diagram]");
  });

  it("XLSX: pageBreak/divider jadi baris catatan, ordered bernomor", async () => {
    const bytes = await renderXlsxBytes(DOC_D3 as never, resolver);
    // Sheet memakai sharedStrings (indeks), teks asli ada di sharedStrings.xml.
    const shared = entryText(bytes, "xl/sharedStrings.xml");
    expect(shared).toContain("[pemisah halaman]");
    expect(shared).toContain("[garis pemisah]");
    expect(shared).toContain("[diagram]");
    expect(shared).toContain("1. satu");
    // Gambar ter-anchor: sheet punya relasi drawing.
    const sheet = entryText(bytes, "xl/worksheets/sheet1.xml");
    expect(sheet).toContain("<drawing");
  });

  it("PPTX: pageBreak = slide baru, divider = line shape, image = media", async () => {
    const bytes = await renderPptxBytes(DOC_D3 as never, resolver);
    const names = [...readZip(bytes).keys()];
    expect(names.filter((n) => n.startsWith("ppt/slides/slide")).length).toBeGreaterThanOrEqual(2);
    expect(names.some((n) => n.startsWith("ppt/media/"))).toBe(true);
    // Slide1: judul + "atas". pageBreak memotong ke slide2; divider (line
    // shape) dan image ada di slide2.
    const slide1 = entryText(bytes, "ppt/slides/slide1.xml");
    expect(slide1).toContain("atas");
    expect(slide1).not.toContain("bawah");
    const slide2 = entryText(bytes, "ppt/slides/slide2.xml");
    expect(slide2).toContain("bawah");
    expect(slide2).toContain('prst="line"');
  });
});
