/**
 * Uji D2: satu tema dokumen, satu ukuran halaman untuk semua jalur PDF.
 *
 * Temuan riset: renderPdfBytes (PDFKit) memakai default US Letter 612x792
 * sementara exportChatPdfBytes menulis MediaBox 612x842. Keduanya kini A4.
 */

import { describe, expect, it } from "vitest";
import { TEMA } from "./theme";
import { renderPdfBytes } from "./render-binary";
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
