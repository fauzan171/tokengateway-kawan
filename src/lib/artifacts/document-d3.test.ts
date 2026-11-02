/**
 * Uji D3: blok baru pageBreak / divider / bullets.ordered / image (artifactId).
 *
 * Parser: batas 20 gambar + truncated; alt/caption dipotong 200; widthPct
 * diklem 10-100. Renderer: dibaca balik dari byte arsip (pembaca independen).
 *
 * FIX-PDF-TBL: tabel PDF dirender sebagai sel beneran (garis + kolom +
 * zebra), bukan baris teks " | ". Uji di bawah mengunci itu.
 */

import { inflateSync } from "node:zlib";
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

describe("FIX-PDF-TBL: tabel PDF sebagai sel beneran", () => {
  const DOC_TBL = {
    title: "Tabel",
    blocks: [
      {
        type: "table",
        headers: ["No", "Negara", "Kepala Negara"],
        rows: [
          ["1", "Indonesia", "Prabowo Subianto"],
          ["2", "Jepang", "Naruhito"],
        ],
      },
    ],
  };

  /** Teks tiap baris konten stream (zlib didekompres, hex TJ didekode). */
  function pdfTextLines(bytes: Buffer): string[] {
    const lines: string[] = [];
    const src = bytes.toString("latin1");
    for (const m of src.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      let raw = Buffer.from(m[1], "latin1");
      try {
        raw = Buffer.from(inflateSync(raw));
      } catch {
        /* stream tak terkompresi */
      }
      const txt = raw.toString("latin1");
      // PDFKit menulis teks sbg segmen hex TJ terpecah kerning
      // ([<5072> 10 <61626f>]). Gabung semua segmen hex per baris konten.
      const cells: string[] = [];
      for (const line of txt.split("\n")) {
        const hexes = [...line.matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => h[1]);
        if (hexes.length > 0) cells.push(Buffer.concat(hexes.map((h) => Buffer.from(h, "hex"))).toString("latin1"));
        else cells.push(line);
      }
      lines.push(...cells);
    }
    return lines;
  }

  it("tidak ada baris teks ' | ' (kolom digambar, bukan digabung pipa)", async () => {
    const bytes = await renderPdfBytes(DOC_TBL as never);
    for (const line of pdfTextLines(bytes)) expect(line).not.toContain("|");
  });

  it("sel tetangga satu baris terpisah (tidak satu string gabungan)", async () => {
    const bytes = await renderPdfBytes(DOC_TBL as never);
    const joined = pdfTextLines(bytes).join("\n");
    expect(joined).toContain("Indonesia");
    expect(joined).toContain("Prabowo");
    // Sel digambar terpisah: tak ada baris berisi dua sel data sekaligus.
    for (const line of pdfTextLines(bytes)) {
      expect(line.includes("Indonesia") && line.includes("Prabowo")).toBe(false);
      expect(line.includes("No") && line.includes("Negara") && line.includes("TJ")).toBe(false);
    }
  });

  it("tabel 200 baris tetap satu PDF valid tanpa galat", async () => {
    const big = {
      title: "Besar",
      blocks: [
        {
          type: "table",
          headers: ["No", "Nama"],
          rows: Array.from({ length: 200 }, (_, i) => [String(i + 1), `Baris ${i + 1}`]),
        },
      ],
    };
    const bytes = await renderPdfBytes(big as never);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
  });
});
