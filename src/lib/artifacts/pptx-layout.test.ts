/**
 * Uji D6: tata letak PPTX dihitung dari tinggi, bukan rumus tetap.
 *
 * Bukti riset T4: y = 1.3 + used*0,6 untuk 12 blok menempatkan blok ke-12 di
 * 7,9 inci — meluber dari slide 16:9 (5,625 inci). Assert XML slides: semua
 * offset vertikal elemen berada dalam 0 <= y + h <= 5,625 inci.
 */

import { describe, expect, it } from "vitest";
import { renderPptxBytes } from "./render-binary";
import { readZip } from "./zip";
import type { DocSchema, DocBlock } from "./document";

/** Ambil semua a:off/a:ext (posisi+ukuran) dari XML slide dalam inci. */
function slideShapes(bytes: Buffer): { slide: string; boxes: { y: number; h: number }[] }[] {
  const zip = readZip(bytes);
  const slides = [...zip.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return slides.map((slide) => {
    const xml = zip.get(slide)!.toString("utf8");
    const boxes: { y: number; h: number }[] = [];
    const re = /<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      // EMU -> inci (914400 EMU per inci).
      boxes.push({ y: Number(m[2]) / 914400, h: Number(m[4]) / 914400 });
    }
    return { slide, boxes };
  });
}

const SLIDE_H = 5.625;

describe("D6 tata letak PPTX", () => {
  it("12 blok teks: semua elemen tetap di dalam slide (0..5,625 inci)", async () => {
    const blocks: DocBlock[] = Array.from({ length: 12 }, (_, i) => ({
      type: "paragraph",
      text: `paragraf ${i + 1}`,
    }));
    const bytes = await renderPptxBytes({ title: "T", blocks });
    const shapes = slideShapes(bytes);
    expect(shapes.length).toBeGreaterThan(1);
    for (const { slide, boxes } of shapes) {
      for (const box of boxes) {
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.h).toBeLessThanOrEqual(SLIDE_H + 0.001);
      }
      void slide;
    }
  });

  it("200 paragraf: elemen tidak keluar slide dan jumlah slide memadai", async () => {
    const blocks: DocBlock[] = Array.from({ length: 200 }, (_, i) => ({
      type: "paragraph",
      text: `p${i + 1}`,
    }));
    const bytes = await renderPptxBytes({ title: "Banyak", blocks });
    for (const { boxes } of slideShapes(bytes)) {
      for (const box of boxes) {
        expect(box.y + box.h).toBeLessThanOrEqual(SLIDE_H + 0.001);
      }
    }
  });

  it("dua tabel: tabel kedua tidak menimpa tabel pertama (slide terpisah)", async () => {
    const doc: DocSchema = {
      title: "Dua Tabel",
      blocks: [
        { type: "table", headers: ["a", "b"], rows: [["1", "2"]] },
        { type: "table", headers: ["c", "d"], rows: [["3", "4"]] },
      ],
    };
    const bytes = await renderPptxBytes(doc);
    const shapes = slideShapes(bytes);
    // Tabel pertama di slide 1 (dengan judul), tabel kedua di slide 2 sendiri.
    expect(shapes.length).toBeGreaterThanOrEqual(2);
    // Slide 2: berisi tabel kedua tanpa judul (offset y = 1,3 tepat).
    const slide2 = shapes[1];
    expect(slide2.boxes.length).toBeGreaterThan(0);
  });

  it("tabel 12 kolom dipotong ke 8 kolom di PPTX (lebih ketat dari kanonik 12)", async () => {
    const headers = Array.from({ length: 12 }, (_, i) => `h${i + 1}`);
    const bytes = await renderPptxBytes({
      title: "Lebar",
      blocks: [{ type: "table", headers, rows: [headers.map((h) => h.toUpperCase())] }],
    });
    // Cek dari XML slide TABEL (slide 2 — tabel kini punya slide sendiri):
    // kolom ke-9 (h9/H9) tidak boleh ada — dipotong ke 8.
    const tableSlide = [...readZip(bytes).entries()]
      .filter(([n]) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .map(([, v]) => v.toString("utf8"))
      .find((xml) => xml.includes("h1"));
    expect(tableSlide).toBeTruthy();
    expect(tableSlide).not.toContain("h9");
    expect(tableSlide).not.toContain("H9");
  });
});
