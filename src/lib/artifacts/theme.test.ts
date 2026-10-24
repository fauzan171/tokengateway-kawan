/**
 * Uji D2: satu tema dokumen, satu ukuran halaman untuk semua jalur PDF.
 *
 * Temuan riset: renderPdfBytes (PDFKit) memakai default US Letter 612x792
 * sementara exportChatPdfBytes menulis MediaBox 612x842. Keduanya kini A4.
 */

import { describe, expect, it } from "vitest";
import { TEMA } from "./theme";
import { readZip } from "./zip";
import {
  renderDocxBytes,
  renderPdfBytes,
  renderPptxBytes,
  renderXlsxBytes,
} from "./render-binary";
import { exportChatPdfBytes } from "@/lib/chat/document-export";
import type { DocSchema } from "./document";

const SAMPLE: DocSchema = {
  title: "Laporan",
  blocks: [
    { type: "heading", text: "Ringkasan", level: 1 },
    { type: "paragraph", text: "Isi." },
    { type: "table", headers: ["a", "b"], rows: [["1", "2"]] },
    { type: "code", text: "SELECT 1;" },
  ],
};

/** Isi satu entri arsip OOXML sebagai teks; gagal keras bila entri tidak ada. */
function entryText(bytes: Buffer, name: string): string {
  const found = readZip(bytes).get(name);
  if (!found) throw new Error(`entri ${name} tidak ada di arsip`);
  return found.toString("utf8");
}

/** Ambil MediaBox pertama dari byte PDF (objek /Page tidak dikompres). */
function mediaBox(bytes: Buffer): string {
  const match = /\/MediaBox\s*\[([^\]]*)\]/.exec(bytes.toString("latin1"));
  if (!match) throw new Error("MediaBox tidak ditemukan di PDF");
  return match[1].trim().replace(/\s+/g, " ");
}

describe("TEMA", () => {
  it("dibekukan dalam dan setiap nilai positif", () => {
    const values: unknown[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "number") values.push(value);
      else if (typeof value === "object" && value !== null) {
        expect(Object.isFrozen(value)).toBe(true);
        for (const nested of Object.values(value)) walk(nested);
      }
    };
    walk(TEMA);
    expect(Object.isFrozen(TEMA)).toBe(true);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value as number).toBeGreaterThan(0);
  });

  it("heading 1 > 2 > 3", () => {
    expect(TEMA.font.heading[1]).toBeGreaterThan(TEMA.font.heading[2]);
    expect(TEMA.font.heading[2]).toBeGreaterThan(TEMA.font.heading[3]);
  });

  it("halaman A4 595x842", () => {
    expect(TEMA.page).toEqual({ width: 595, height: 842 });
  });
});

describe("ukuran halaman PDF", () => {
  it("kedua jalur PDF menghasilkan MediaBox identik", async () => {
    const structured = await renderPdfBytes(SAMPLE);
    const chat = exportChatPdfBytes({ title: "Obrolan", messages: [{ role: "user", text: "hai" }] });
    const expected = `0 0 ${TEMA.page.width} ${TEMA.page.height}`;
    expect(mediaBox(structured)).toBe(expected);
    expect(mediaBox(chat)).toBe(expected);
  });
});

/**
 * W2-1: TEMA dulu hanya dipakai jalur PDF, sehingga DOCX/XLSX/PPTX menyimpan
 * ukuran font dan warna hardcode sendiri. Tes ini mengunci bahwa ketiga renderer
 * benar-benar membaca TEMA — bukan sekadar mengimpornya.
 */
describe("renderer biner memakai TEMA (W2-1)", () => {
  it("DOCX tidak lagi memakai font hardcode, memakai TEMA.font.mono", async () => {
    const bytes = await renderDocxBytes(SAMPLE);
    const xml = entryText(bytes, "word/document.xml");
    expect(TEMA.font.mono).toBe("Courier");
    expect(xml).toContain(`w:ascii="${TEMA.font.mono}"`);
    expect(xml).not.toContain("Courier New");
  });

  it("XLSX memakai warna teks TEMA pada header tabel", async () => {
    const bytes = await renderXlsxBytes(SAMPLE);
    // Excel menyimpan warna di xl/styles.xml tanpa "#"; TEMA memakai hex berkode "#".
    const styles = entryText(bytes, "xl/styles.xml");
    const argb = "FF" + TEMA.color.text.slice(1).toUpperCase();
    expect(styles.toUpperCase()).toContain(argb);
    // Header tabel memakai gaya itu (atribut gaya huruf kecil: s="1").
    expect(entryText(bytes, "xl/worksheets/sheet1.xml")).toContain('s="1"');
  });

  it("PPTX memakai ukuran font TEMA, bukan angka literal", async () => {
    const bytes = await renderPptxBytes(SAMPLE);
    const slide = entryText(bytes, "ppt/slides/slide1.xml");
    // PDF/PPTX menyimpan ukuran dalam 1/100 pt (24pt -> sz="2400").
    expect(slide).toContain(`sz="${TEMA.ptx.title * 100}"`);
    expect(slide).toContain(`sz="${TEMA.ptx.body * 100}"`);
  });
});
