/**
 * Uji FIX-14: deteksi format dari magic bytes, ekstraksi Office, metadata,
 * dan batas OCR/vision.
 *
 * Fixture OOXML dibangun dengan `writeZip` supaya isi XML benar-benar diurai
 * parser, bukan di-mock.
 */

import { describe, expect, it } from "vitest";
import { writeZip } from "@/lib/artifacts/zip";
import { detectFormat, legacyOfficeFormat, matchesClaimedMime } from "./magic";
import { extractDocx, extractPptx, extractXlsx } from "./office";
import { extractText, ExtractError } from "./extract";
import { readMetadata } from "./metadata";
import { ocrCapability, parseTsv, probeVision, OcrUnavailable, ocrImage } from "./ocr";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function docxBytes(body: string, core?: string): Buffer {
  const entries = [
    {
      name: "word/document.xml",
      content: `<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`,
    },
  ];
  if (core) entries.push({ name: "docProps/core.xml", content: core });
  return writeZip(entries);
}

function pptxBytes(slides: string[]): Buffer {
  return writeZip(
    slides.map((body, i) => ({
      name: `ppt/slides/slide${i + 1}.xml`,
      content: `<?xml version="1.0"?><p:sld xmlns:a="a"><a:p>${body}</a:p></p:sld>`,
    })),
  );
}

describe("detectFormat", () => {
  it("mengenali PDF, teks, dan OOXML dari byte", () => {
    expect(detectFormat(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(detectFormat(Buffer.from("halo dunia\nbaris dua"))).toBe("text");
    expect(detectFormat(docxBytes("<w:p><w:t>x</w:t></w:p>"))).toBe("docx");
    expect(detectFormat(pptxBytes(["<a:t>x</a:t>"]))).toBe("pptx");
  });

  it("membedakan docx/xlsx/pptx lewat entri ZIP, bukan nama berkas", () => {
    expect(detectFormat(docxBytes("<w:p><w:t>a</w:t></w:p>"))).toBe("docx");
    expect(
      detectFormat(writeZip([{ name: "xl/workbook.xml", content: "<workbook/>" }])),
    ).toBe("xlsx");
  });

  it("ZIP biasa tidak dianggap OOXML", () => {
    expect(detectFormat(writeZip([{ name: "a.txt", content: "x" }]))).toBe("zip");
  });

  it("format Office lama dan biner asing ditolak sebagai unknown", () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(64),
    ]);
    expect(legacyOfficeFormat(ole)).toBe("doc");
    expect(detectFormat(ole)).toBe("unknown");
    expect(detectFormat(Buffer.from([0x00, 0x01, 0x02, 0x03]))).toBe("unknown");
  });

  it("negatif: klaim MIME yang tidak cocok ditolak", () => {
    expect(matchesClaimedMime("application/pdf", "docx")).toBe(false);
    expect(matchesClaimedMime(DOCX_MIME, "docx")).toBe(true);
    expect(matchesClaimedMime("text/markdown", "text")).toBe(true);
    expect(matchesClaimedMime("text/plain", "unknown")).toBe(false);
  });
});

describe("extractDocx", () => {
  it("menggabungkan paragraf jadi baris dan membuang yang kosong", () => {
    const result = extractDocx(
      docxBytes(
        "<w:p><w:t>Judul</w:t></w:p><w:p></w:p><w:p><w:t>Isi </w:t><w:t>paragraf</w:t></w:p>",
      ),
    );
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.text).toBe("Judul\nIsi paragraf");
  });

  it("negatif: DOCX tanpa teks → NO_TEXT_LAYER", () => {
    expect(() => extractDocx(docxBytes("<w:p></w:p>"))).toThrow(ExtractError);
    try {
      extractDocx(docxBytes("<w:p></w:p>"));
    } catch (err) {
      expect((err as ExtractError).code).toBe("NO_TEXT_LAYER");
    }
  });

  it("negatif: DOCX tanpa word/document.xml → EXTRACT_FAILED", () => {
    const bytes = writeZip([{ name: "docProps/core.xml", content: "<x/>" }]);
    expect(() => extractDocx(bytes)).toThrow(/word\/document\.xml/);
  });
});

describe("extractPptx", () => {
  it("satu slide = satu halaman, urut numerik (slide10 setelah slide2)", () => {
    const bytes = writeZip([
      { name: "ppt/slides/slide10.xml", content: "<s><a:p><a:t>sepuluh</a:t></a:p></s>" },
      { name: "ppt/slides/slide2.xml", content: "<s><a:p><a:t>dua</a:t></a:p></s>" },
    ]);
    const result = extractPptx(bytes);
    expect(result.pages.map((p) => p.text)).toEqual(["dua", "sepuluh"]);
    expect(result.pages.map((p) => p.page)).toEqual([1, 2]);
  });

  it("negatif: presentasi tanpa slide → NO_TEXT_LAYER", () => {
    expect(() => extractPptx(writeZip([{ name: "ppt/presentation.xml", content: "<p/>" }]))).toThrow(
      ExtractError,
    );
  });
});

describe("extractXlsx", () => {
  async function buildWorkbook(): Promise<Buffer> {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Penjualan");
    sheet.addRow(["Bulan", "Total"]);
    sheet.addRow(["Januari", 1500]);
    sheet.getCell("C3").value = { formula: "SUM(B2:B2)", result: 1500 } as never;
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  it("sheet jadi halaman, sel tetap punya sheet + alamat + nilai", async () => {
    const result = await extractXlsx(await buildWorkbook());
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.text).toContain("Bulan\tTotal");
    expect(result.pages[0]?.text).toContain("Januari\t1500");

    const cells = result.cells ?? [];
    expect(cells.find((c) => c.cell === "B2")).toMatchObject({
      sheet: "Penjualan",
      kind: "value",
      text: "1500",
    });
  });

  it("formula disimpan sebagai teks formula, bukan dieksekusi", async () => {
    const result = await extractXlsx(await buildWorkbook());
    const formula = (result.cells ?? []).find((c) => c.cell === "C3");
    expect(formula).toMatchObject({ kind: "formula", text: "=SUM(B2:B2)" });
  });

  it("negatif: workbook rusak → EXTRACT_FAILED", async () => {
    await expect(extractXlsx(Buffer.from("bukan xlsx"))).rejects.toThrow(ExtractError);
  });
});

describe("extractText dispatch", () => {
  it("menolak ketidakcocokan MIME sebelum mengurai", async () => {
    await expect(extractText("application/pdf", docxBytes("<w:p><w:t>a</w:t></w:p>"))).rejects.toMatchObject(
      { code: "MIME_MISMATCH" },
    );
  });

  it("negatif: format Office lama dan gambar ditolak eksplisit", async () => {
    const ole = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(32),
    ]);
    await expect(extractText(DOCX_MIME, ole)).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      extractText("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("DOCX lewat dispatcher membawa format hasil deteksi", async () => {
    const result = await extractText(DOCX_MIME, docxBytes("<w:p><w:t>halo</w:t></w:p>"));
    expect(result.format).toBe("docx");
    expect(result.text).toBe("halo");
  });

  it("teks biasa tetap berjalan", async () => {
    const result = await extractText("text/plain", Buffer.from("halo\n\ndunia"));
    expect(result.text).toBe("halo\n\ndunia");
    expect(result.format).toBe("text");
  });
});

describe("readMetadata", () => {
  it("membedakan nama klien, waktu unggah, dan tanggal tertanam", () => {
    const core =
      '<cp:coreProperties xmlns:cp="cp" xmlns:dc="dc" xmlns:dcterms="d">' +
      "<dc:creator>Andi</dc:creator>" +
      "<dcterms:created>2024-03-05T10:00:00Z</dcterms:created>" +
      "</cp:coreProperties>";
    const meta = readMetadata({
      clientFilename: "laporan.docx",
      uploadedAt: new Date("2026-10-23T00:00:00Z"),
      data: docxBytes("<w:p><w:t>x</w:t></w:p>", core),
      format: "docx",
    });
    expect(meta.clientFilename).toBe("laporan.docx");
    expect(meta.uploadedAt).toBe("2026-10-23T00:00:00.000Z");
    expect(meta.embeddedCreated).toBe("2024-03-05T10:00:00.000Z");
    expect(meta.embeddedAuthor).toBe("Andi");
    expect(meta.unknown.join(" ")).toMatch(/tidak diverifikasi/);
  });

  it("metadata hilang dilaporkan sebagai unknown, bukan dikarang", () => {
    const meta = readMetadata({
      clientFilename: "polos.txt",
      uploadedAt: new Date("2026-10-23T00:00:00Z"),
      data: Buffer.from("halo"),
      format: "text",
    });
    expect(meta.embeddedCreated).toBeNull();
    expect(meta.embeddedAuthor).toBeNull();
    expect(meta.unknown.length).toBeGreaterThan(0);
  });

  it("EXIF/GPS tidak dipertahankan pada gambar", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
      Buffer.from("Exif\0\0"),
      Buffer.alloc(32),
    ]);
    const meta = readMetadata({
      clientFilename: "foto.jpg",
      uploadedAt: new Date("2026-10-23T00:00:00Z"),
      data: jpeg,
      format: "jpeg",
    });
    expect(meta.locationRetained).toBe(false);
    expect(meta.strippedFields).toContain("gps");
    expect(meta.unknown.join(" ")).toMatch(/lokasi tidak disimpulkan/);
  });

  it("PDF: CreationDate terbaca, tidak valid → null", () => {
    const pdf = Buffer.from("%PDF-1.7\n/Author (Budi) /CreationDate (D:20230115...)");
    const meta = readMetadata({
      clientFilename: "a.pdf",
      uploadedAt: new Date("2026-10-23T00:00:00Z"),
      data: pdf,
      format: "pdf",
    });
    expect(meta.embeddedAuthor).toBe("Budi");
    expect(meta.embeddedCreated).toBe("2023-01-15T00:00:00.000Z");
  });
});

describe("OCR & vision", () => {
  it("parseTsv menghitung keyakinan rata-rata dan memisahkan baris", () => {
    const tsv = [
      "level\tpage\tblock\tpar\tline\tword\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t10\t10\t20\t10\t90\tHalo",
      "5\t1\t1\t1\t1\t2\t40\t10\t20\t10\t80\tdunia",
      "5\t1\t1\t1\t2\t1\t10\t40\t20\t10\t40\ttambahan",
    ].join("\n");
    const result = parseTsv(tsv);
    expect(result.text).toBe("Halo dunia\ntambahan");
    expect(result.confidence).toBe(70);
  });

  it("keyakinan rendah ditandai needsReview, bukan disajikan pasti", async () => {
    const tsv = [
      "level\tpage\tblock\tpar\tline\tword\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t10\t10\t20\t10\t30\tsamar",
    ].join("\n");
    const { parseTsv: parse } = await import("./ocr");
    const parsed = parse(tsv);
    expect(parsed.confidence).toBeLessThan(70);
  });

  it("mesin OCR tidak ada → alasan ENGINE_MISSING, bukan hasil kosong", async () => {
    const previous = process.env["KAWAN_TESSERACT_PATH"];
    delete process.env["KAWAN_TESSERACT_PATH"];
    const capability = ocrCapability();
    if (previous !== undefined) process.env["KAWAN_TESSERACT_PATH"] = previous;

    if (!capability.available) {
      expect(capability.reason).toBe("ENGINE_MISSING");
      await expect(ocrImage(Buffer.from("x"))).rejects.toBeInstanceOf(OcrUnavailable);
    } else {
      expect(capability.available).toBe(true);
    }
  });

  it("negatif: halaman melebihi batas ditolak sebelum menjalankan mesin", async () => {
    const previous = process.env["KAWAN_TESSERACT_PATH"];
    process.env["KAWAN_TESSERACT_PATH"] = "/bin/true";
    try {
      await expect(ocrImage(Buffer.from("x"), { page: 999 })).rejects.toMatchObject({
        reason: "PAGES_EXCEEDED",
      });
    } finally {
      if (previous === undefined) delete process.env["KAWAN_TESSERACT_PATH"];
      else process.env["KAWAN_TESSERACT_PATH"] = previous;
    }
  });

  it("probe vision menolak model tanpa dukungan gambar dan menandai consent", () => {
    expect(probeVision("gpt-4o-mini")).toMatchObject({ supported: true, requiresConsent: true });
    expect(probeVision("deepseek-chat").supported).toBe(false);
    expect(probeVision(null)).toMatchObject({ supported: false, reason: "Model belum dipilih." });
    expect(probeVision("gpt-4o").maxPixels).toBe(1568);
  });
});
