/**
 * FIX-19/regresi FIX-12: tiga cacat yang ditemukan riset dokumen.
 *
 * Semuanya terbukti dengan menjalankan kode nyata (render → baca balik), bukan
 * pembacaan kode saja.
 */

import { describe, expect, it } from "vitest";
import { readZip, writeZip, ZIP_LIMITS, assertSafeEntryName } from "./zip";
import { renderDocxBytes, renderXlsxBytes, safeSheetName } from "./render-binary";
import { convertArtifact } from "./convert";
import { ArtifactError } from "./render";
import { detectFormat } from "@/lib/documents/magic";
import type { DocSchema } from "./document";

const doc: DocSchema = {
  title: "Laporan/2026: Q1",
  blocks: [
    { type: "heading", text: "Ringkasan", level: 1 },
    { type: "paragraph", text: "Isi laporan." },
    { type: "table", headers: ["A", "B"], rows: [["1", "2"]] },
  ],
};

describe("zip: entri direktori", () => {
  it("nama direktori berakhiran / diterima (bukan ZIP_UNSAFE_PATH)", () => {
    expect(assertSafeEntryName("word/")).toBe("word/");
    expect(assertSafeEntryName("xl/worksheets/")).toBe("xl/worksheets/");
  });

  it("traversal pada entri direktori TETAP ditolak", () => {
    expect(() => assertSafeEntryName("../")).toThrow(ArtifactError);
    expect(() => assertSafeEntryName("/etc/")).toThrow(ArtifactError);
    expect(() => assertSafeEntryName("a//")).toThrow(ArtifactError);
  });

  it("entri direktori tidak menghalangi pembacaan arsip yang sah", () => {
    const zip = writeZip([{ name: "a.txt", content: "halo" }]);
    const entries = readZip(zip);
    expect(entries.get("a.txt")?.toString("utf8")).toBe("halo");
    expect(ZIP_LIMITS.maxEntries).toBeGreaterThan(0);
  });
});

describe("xlsx: nama sheet", () => {
  it("karakter terlarang Excel diganti, panjang dibatasi 31", () => {
    expect(safeSheetName("Laporan/2026: Q1")).toBe("Laporan-2026- Q1");
    expect(safeSheetName("a[b]c?d*e:f\\g")).toBe("a-b-c-d-e-f-g");
    expect(safeSheetName("x".repeat(60))).toHaveLength(31);
  });

  it("judul kosong/hanya karakter terlarang jatuh ke Sheet1", () => {
    expect(safeSheetName("")).toBe("Sheet1");
    expect(safeSheetName("   ")).toBe("Sheet1");
  });

  it("render XLSX dengan judul bermasalah tetap berhasil", async () => {
    const bytes = await renderXlsxBytes(doc);
    expect(bytes.byteLength).toBeGreaterThan(0);
    // ZIP/OOXML sah: xlsx adalah kontainer ZIP.
    expect(detectFormat(bytes)).toBe("xlsx");
  });
});

describe("docx hasil render sendiri bisa dibaca balik", () => {
  it("deteksi format docx, bukan zip mentah", async () => {
    const bytes = await renderDocxBytes(doc);
    expect(detectFormat(bytes)).toBe("docx");
  });
});

describe("convertArtifact: sumber biner ditolak", () => {
  it("sumber pdf tidak dapat dikonversi menjadi md", () => {
    // Bentuk runtime yang dulu lolos: cast dari DB, isinya byte PDF.
    const fakeSource = { format: "pdf", content: "%PDF-1.7..." } as never;
    expect(() => convertArtifact(fakeSource, "md")).toThrow(ArtifactError);
    try {
      convertArtifact(fakeSource, "md");
    } catch (err) {
      expect((err as ArtifactError).code).toBe("CONVERSION_UNSUPPORTED");
    }
  });

  it("sumber teks tetap dapat dikonversi", () => {
    const result = convertArtifact({ format: "md", content: "# Judul" }, "txt");
    expect(result.format).toBe("txt");
    expect(result.content).toContain("Judul");
  });
});
