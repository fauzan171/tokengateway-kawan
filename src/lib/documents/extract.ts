/**
 * Ekstraksi teks dari berkas dokumen (SDD-6.1 butir 3).
 *
 * Server-only: `pdf-parse` memuat `pdfjs-dist` yang butuh Node. Teks biasa
 * dibaca langsung; PDF diurai per halaman supaya P6-04 bisa menyimpan
 * metadata halaman untuk sitasi (REQ-NT-57).
 */

import { PDFParse } from "pdf-parse";

/** Batas teks per dokumen (SDD-6.1 butir 4): dokumen raksasa tidak boleh
 *  menghabiskan memori saat di-chunk atau di-embed. */
export const MAX_TEXT_CHARS = 2_000_000;

export type ExtractCode = "NO_TEXT_LAYER" | "EXTRACT_FAILED";

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
    // PDF hasil pindai tidak punya lapisan teks. Ini bukan "dokumen kosong":
    // pengguna perlu tahu berkasnya tidak bisa dicari, bukan diam-diam kosong.
    throw new ExtractError("NO_TEXT_LAYER", "PDF tidak memiliki lapisan teks (kemungkinan hasil pindai).");
  }
  return { text: "", pages };
}

/** Potong per halaman supaya sisa halaman tidak ikut dihitung setelah batas. */
function capText(pages: { page: number; text: string }[]): ExtractResult {
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
  return { text, pages: kept };
}

/**
 * Ekstrak teks per halaman. Melempar `ExtractError` untuk kegagalan isi
 * berkas (PDF rusak, tanpa lapisan teks); galat lain diteruskan apa adanya.
 */
export async function extractText(mime: string, data: Buffer): Promise<ExtractResult> {
  const result = mime === "application/pdf" ? await fromPdf(data) : fromText(data);
  return capText(result.pages);
}
