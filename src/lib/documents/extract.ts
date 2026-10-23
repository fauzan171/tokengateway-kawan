/**
 * Ekstraksi teks dari berkas dokumen (SDD-6.1 butir 3).
 *
 * Server-only: `pdf-parse` memuat `pdfjs-dist` yang butuh Node. Teks biasa
 * dibaca langsung; PDF diurai per halaman supaya P6-04 bisa menyimpan
 * metadata halaman untuk sitasi (REQ-NT-57).
 */

import { PDFParse } from "pdf-parse";
import { detectFormat, matchesClaimedMime, type DetectedFormat } from "./magic";
import { extractDocx, extractPptx, extractXlsx, type SheetCell } from "./office";

/** Batas teks per dokumen (SDD-6.1 butir 4): dokumen raksasa tidak boleh
 *  menghabiskan memori saat di-chunk atau di-embed. */
export const MAX_TEXT_CHARS = 2_000_000;

export type ExtractCode =
  | "NO_TEXT_LAYER"
  | "EXTRACT_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "MIME_MISMATCH"
  | "OCR_UNAVAILABLE";

/** Kegagalan karena isi berkas, bukan karena IO/DB. Permanen: job tidak
 *  perlu diulang. */
export class ExtractError extends Error {
  readonly code: ExtractCode;

  constructor(code: ExtractCode, message: string) {
    super(message);
    this.name = "ExtractError";
    this.code = code;
  }
}

export type ExtractResult = {
  text: string;
  pages: { page: number; text: string }[];
  /** Format hasil deteksi magic bytes, bukan label klien. */
  format?: DetectedFormat;
  /** Sel Excel yang masih terlacak (FIX-14). */
  cells?: SheetCell[];
  /** Status pindai: `scanned` bila PDF tanpa lapisan teks. */
  scan?: "text" | "scanned";
};

const MARKER_TRUNCATED = "\n\n[teks dipotong: melebihi batas 2.000.000 karakter]";

/** Buang `\r`, rapikan baris kosong beruntun. Isi kata tidak diubah. */
function normalize(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function fromText(data: Buffer): ExtractResult {
  const text = normalize(data.toString("utf8"));
  if (text === "") throw new ExtractError("NO_TEXT_LAYER", "Berkas tidak berisi teks.");
  return { text, pages: [{ page: 1, text }] };
}

async function fromPdf(data: Buffer): Promise<ExtractResult> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  let pages: { page: number; text: string }[];
  try {
    const result = await parser.getText();
    pages = result.pages.map((p) => ({ page: p.num, text: normalize(p.text) }));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new ExtractError("EXTRACT_FAILED", `PDF tidak bisa dibaca: ${detail}`);
  } finally {
    await parser.destroy();
  }

  if (pages.every((p) => p.text === "")) {
    // FIX-14: PDF hasil pindai tidak punya lapisan teks. Ini bukan "dokumen
    // kosong": pengguna harus tahu berkasnya butuh OCR, dan OCR tidak
    // dijalankan diam-diam di dalam proses web.
    throw new ExtractError(
      "OCR_UNAVAILABLE",
      "PDF tidak memiliki lapisan teks (kemungkinan hasil pindai); OCR belum dikonfigurasi di server ini.",
    );
  }
  return { text: "", pages, scan: "text" };
}

/** Potong per halaman supaya sisa halaman tidak ikut dihitung setelah batas. */
function capText(
  pages: { page: number; text: string }[],
  extra: { format?: DetectedFormat; cells?: SheetCell[] } = {},
): ExtractResult {
  let remaining = MAX_TEXT_CHARS;
  let truncated = false;
  const kept: { page: number; text: string }[] = [];

  for (const page of pages) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    if (page.text.length > remaining) {
      kept.push({ page: page.page, text: page.text.slice(0, remaining) });
      remaining = 0;
      truncated = true;
      break;
    }
    kept.push(page);
    remaining -= page.text.length;
  }

  const text = kept.map((p) => p.text).join("\n\n") + (truncated ? MARKER_TRUNCATED : "");
  return { text, pages: kept, ...extra };
}

/**
 * Ekstrak teks per halaman. Melempar `ExtractError` untuk kegagalan isi
 * berkas (PDF rusak, tanpa lapisan teks, format tidak didukung); galat lain
 * diteruskan apa adanya.
 *
 * FIX-14: format ditentukan dari magic bytes. `mime` dari klien hanya dipakai
 * untuk mendeteksi ketidakcocokan (`MIME_MISMATCH`), bukan untuk memilih parser.
 */
export async function extractText(mime: string, data: Buffer): Promise<ExtractResult> {
  const format = detectFormat(data);

  if (format === "unknown") {
    throw new ExtractError(
      "UNSUPPORTED_FORMAT",
      "Format berkas tidak dikenali dari isinya. Format lama .doc/.xls/.ppt tidak didukung.",
    );
  }
  if (format === "zip") {
    throw new ExtractError(
      "UNSUPPORTED_FORMAT",
      "Arsip ZIP tidak bisa dibaca sebagai dokumen; unggah berkas di dalamnya.",
    );
  }
  if (format === "jpeg" || format === "png") {
    throw new ExtractError(
      "UNSUPPORTED_FORMAT",
      "Gambar tidak punya lapisan teks; kirim sebagai lampiran chat, bukan dokumen.",
    );
  }
  if (!matchesClaimedMime(mime, format)) {
    throw new ExtractError(
      "MIME_MISMATCH",
      `Jenis berkas yang dikirim (${mime}) tidak cocok dengan isinya (${format}).`,
    );
  }

  const result = await extractByFormat(format, data);
  return capText(result.pages, { format, ...(result.cells ? { cells: result.cells } : {}) });
}

async function extractByFormat(
  format: DetectedFormat,
  data: Buffer,
): Promise<ExtractResult> {
  switch (format) {
    case "pdf":
      return fromPdf(data);
    case "docx":
      return { ...extractDocx(data), format, text: "" };
    case "pptx":
      return { ...extractPptx(data), format, text: "" };
    case "xlsx":
      return { ...(await extractXlsx(data)), format, text: "" };
    case "text":
      return { ...fromText(data), format };
    default:
      throw new ExtractError("UNSUPPORTED_FORMAT", `Format ${format} tidak didukung.`);
  }
}
