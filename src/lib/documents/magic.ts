/**
 * Deteksi format dari magic bytes (FIX-14).
 *
 * `Content-Type` dari klien tidak dipercaya: berkas `.docx` berisi skrip bisa
 * dikirim dengan label `application/pdf`. Yang menentukan parser adalah byte
 * yang benar-benar diterima.
 */

import { readZip } from "@/lib/artifacts/zip";

export type DetectedFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "zip"
  | "jpeg"
  | "png"
  | "text"
  | "unknown";

/** MIME yang diterima untuk tiap format terdeteksi. */
export const FORMAT_MIME: Record<DetectedFormat, string | null> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  jpeg: "image/jpeg",
  png: "image/png",
  text: "text/plain",
  unknown: null,
};

/** Format lama bermakro — ditolak, bukan ditebak. */
export function legacyOfficeFormat(data: Buffer): "doc" | "xls" | "ppt" | null {
  // OLE2 compound file: semua `.doc/.xls/.ppt` lama berbagi magic ini.
  const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (data.length >= 8 && data.subarray(0, 8).equals(ole)) return "doc";
  return null;
}

/**
 * Format dari byte awal. OOXML dibedakan dengan membaca daftar entri ZIP
 * (`word/`, `xl/`, `ppt/`), bukan dari nama berkas.
 */
export function detectFormat(data: Buffer): DetectedFormat {
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data.subarray(1, 4).toString("latin1") === "PNG"
  ) {
    return "png";
  }
  if (data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b) {
    return detectOoxml(data);
  }
  if (legacyOfficeFormat(data)) return "unknown";
  if (looksLikeText(data)) return "text";
  return "unknown";
}

function detectOoxml(data: Buffer): DetectedFormat {
  let entries: Map<string, Buffer>;
  try {
    entries = readZip(data);
  } catch {
    // ZIP rusak / tidak aman: bukan OOXML yang bisa diproses.
    return "zip";
  }
  const names = [...entries.keys()];
  if (names.some((n) => n.startsWith("word/"))) return "docx";
  if (names.some((n) => n.startsWith("xl/"))) return "xlsx";
  if (names.some((n) => n.startsWith("ppt/"))) return "pptx";
  return "zip";
}

/** Teks = tidak ada byte NUL di 8 KiB pertama dan mayoritas byte tercetak. */
function looksLikeText(data: Buffer): boolean {
  const head = data.subarray(0, Math.min(data.length, 8_192));
  if (head.includes(0x00)) return false;
  let printable = 0;
  for (const byte of head) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f)) {
      printable++;
    }
  }
  return head.length > 0 && printable / head.length > 0.9;
}

/** Apakah byte cocok dengan MIME yang diklaim klien. */
export function matchesClaimedMime(claimed: string, detected: DetectedFormat): boolean {
  if (detected === "unknown") return false;
  const expected = FORMAT_MIME[detected];
  if (expected === claimed) return true;
  // `text/markdown` dan `text/plain` sama-sama teks; tidak ada cara membedakan
  // dari byte, jadi keduanya diterima untuk format `text`.
  if (detected === "text") return claimed === "text/plain" || claimed === "text/markdown";
  return false;
}
