import { describe, expect, it } from "vitest";
import { renderDocxBytes, renderPdfBytes, renderPptxBytes, renderXlsxBytes } from "@/lib/artifacts/render-binary";
import { readZip } from "@/lib/artifacts/zip";
import type { DocSchema } from "@/lib/artifacts/document";
import { inflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// DUMP-DOC: dump artefak styling baru untuk inspeksi visual (dihapus setelah verifikasi).
const DOC: DocSchema = {
  title: "Laporan Visual",
  blocks: [
    { type: "heading", text: "Tabel Contoh", level: 1 },
    {
      type: "table",
      headers: ["No", "Negara", "Kepala Negara"],
      rows: [
        ["1", "Indonesia", "Prabowo Subianto"],
        ["2", "Jepang", "Naruhito"],
        ["3", "Jerman", "Frank-Walter Steinmeier"],
      ],
    },
  ],
};

function pdfText(bytes: Buffer): string {
  const out: string[] = [];
  const str = bytes.toString("latin1");
  for (const m of str.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    try {
      out.push(inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"));
    } catch {
      /* stream non-kompresi dilewati */
    }
  }
  return out.join("\n");
}

describe("dump doc", () => {
  it("tulis semua format", async () => {
    writeFileSync("/tmp/v.docx", await renderDocxBytes(DOC));
    writeFileSync("/tmp/v.xlsx", await renderXlsxBytes(DOC));
    writeFileSync("/tmp/v.pdf", await renderPdfBytes(DOC));
    writeFileSync("/tmp/v.pptx", await renderPptxBytes(DOC));

    // DOCX: header shading + bold terlihat di document.xml.
    const dx = readZip(await renderDocxBytes(DOC)).get("word/document.xml")?.toString("utf8") ?? "";
    expect(dx).toContain('w:fill="F1F3F5"');
    expect(dx).toContain("<w:b/>");
    // Zebra: fill baris ganjil.
    expect(dx).toContain('w:fill="F8F9FB"');

    // XLSX: fill header + zebra ada di xl/styles.xml (via referensi style), bukan inline di sheet.
    const xl = readZip(await renderXlsxBytes(DOC));
    const styles = xl.get("xl/styles.xml")?.toString("utf8") ?? "";
    expect(styles).toContain("F1F3F5");
    expect(styles).toContain("F8F9FB");
    // Sheet memakai style index yang merujuk fill tersebut.
    const sheetName = [...xl.keys()].find((k) => k.startsWith("xl/worksheets/sheet")) ?? "";
    const sheet = sheetName ? (xl.get(sheetName)?.toString("utf8") ?? "") : "";
    expect(sheet).toMatch(/s="\d+"/);

    // PPTX: fill header di slide mana pun (slide1 bisa hanya judul).
    const pt = readZip(await renderPptxBytes(DOC));
    const slides = [...pt.keys()].filter((k) => /ppt\/slides\/slide\d+\.xml$/.test(k));
    const all = slides.map((k) => pt.get(k)?.toString("utf8") ?? "").join("\n");
    expect(all).toContain("F1F3F5");
    expect(all.toUpperCase()).toContain("F3F4F6");

    // PDF: garis grid + zebra (rect fill) tetap ada.
    const pdf = pdfText(await renderPdfBytes(DOC));
    expect(pdf).toContain("re");
  });
});
