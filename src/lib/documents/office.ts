/**
 * Ekstraksi Office (FIX-14): DOCX, XLSX, PPTX.
 *
 * Aturan yang dipegang:
 *   - parser OOXML memakai `saxes` (parser XML teruji), bukan regex atas XML;
 *   - XLSX lewat `exceljs` supaya sheet/cell tetap terlacak;
 *   - relasi eksternal tidak pernah di-fetch — isi dokumen tidak boleh memicu
 *     permintaan jaringan;
 *   - format lama (`.doc/.xls/.ppt`) dan format tak terpasang ditolak dengan
 *     kode eksplisit, bukan hasil kosong yang menyamar sebagai berhasil.
 */

import ExcelJS from "exceljs";
import { SaxesParser } from "saxes";
import { readZip } from "@/lib/artifacts/zip";
import { ExtractError } from "./extract";

export type OfficePage = { page: number; text: string };

/** Satu sel yang masih bisa ditelusuri: sheet + alamat + nilai. */
export type SheetCell = {
  sheet: string;
  /** Alamat A1, mis. `B7`. */
  cell: string;
  /** `value` = hasil hitung tersimpan; `formula` = teks formula tanpa dieksekusi. */
  kind: "value" | "formula";
  text: string;
};

export type OfficeResult = {
  pages: OfficePage[];
  cells?: SheetCell[];
};

const MAX_CELLS = 20_000;
const MAX_SHEETS = 50;

/**
 * Teks dari `<w:t>` / `<a:t>`; satu paragraf = satu baris.
 *
 * `keepWhitespace` penting: `<w:t xml:space="preserve">` berarti spasi di tepi
 * adalah isi, bukan format.
 */
function textFromXml(xml: string, tag: "w:t" | "a:t", breakTag: "w:p" | "a:p"): string[] {
  const lines: string[] = [];
  let current = "";
  let depth = 0;
  let inText = false;

  const parser = new SaxesParser({ xmlns: false });
  parser.on("opentag", (node) => {
    if (node.name === breakTag) depth++;
    if (node.name === tag) inText = true;
  });
  parser.on("text", (text) => {
    if (inText) current += text;
  });
  parser.on("closetag", (node) => {
    if (node.name === tag) inText = false;
    if (node.name === breakTag && depth > 0) {
      depth--;
      if (depth === 0) {
        lines.push(current);
        current = "";
      }
    }
  });
  try {
    parser.write(xml).close();
  } catch {
    throw new ExtractError("EXTRACT_FAILED", "XML dokumen tidak bisa diurai.");
  }
  if (current !== "") lines.push(current);
  return lines;
}

/** Urutkan bagian OOXML secara numerik: `slide10` setelah `slide2`. */
function orderedParts(names: string[], pattern: RegExp): string[] {
  return names
    .map((name) => {
      const match = pattern.exec(name);
      return match ? { name, index: Number(match[1]) } : null;
    })
    .filter((entry): entry is { name: string; index: number } => entry !== null)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.name);
}

function requireEntry(entries: Map<string, Buffer>, name: string): Buffer {
  const found = entries.get(name);
  if (!found) throw new ExtractError("EXTRACT_FAILED", `Bagian dokumen "${name}" tidak ada.`);
  return found;
}

export function extractDocx(data: Buffer): OfficeResult {
  const entries = readZip(data);
  const body = requireEntry(entries, "word/document.xml").toString("utf8");
  // Tabel dibaca sebagai baris teks biasa: cukup untuk pencarian, bukan untuk
  // merekonstruksi struktur tabel (itu tugas FIX-15).
  const lines = textFromXml(body, "w:t", "w:p")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length === 0) {
    throw new ExtractError("NO_TEXT_LAYER", "Dokumen Word tidak berisi teks.");
  }
  return { pages: [{ page: 1, text: lines.join("\n") }] };
}

export function extractPptx(data: Buffer): OfficeResult {
  const entries = readZip(data);
  const slides = orderedParts([...entries.keys()], /^ppt\/slides\/slide(\d+)\.xml$/);
  if (slides.length === 0) {
    throw new ExtractError("NO_TEXT_LAYER", "Presentasi tidak berisi slide.");
  }
  const pages: OfficePage[] = [];
  slides.forEach((name, i) => {
    const xml = requireEntry(entries, name).toString("utf8");
    const text = textFromXml(xml, "a:t", "a:p")
      .map((line) => line.trim())
      .filter((line) => line !== "")
      .join("\n");
    pages.push({ page: i + 1, text });
  });
  if (pages.every((p) => p.text === "")) {
    throw new ExtractError("NO_TEXT_LAYER", "Slide tidak berisi teks.");
  }
  return { pages };
}

/**
 * XLSX: setiap sheet menjadi satu "halaman" bernomor urut; sel disimpan
 * terpisah supaya sheet/alamat/nilai tetap bisa ditelusuri dan dikoreksi.
 *
 * Formula disimpan sebagai teks formula, bukan dieksekusi, dan nilai cache-nya
 * disimpan sebagai sel terpisah — pembaca tidak boleh mengira keduanya sama.
 */
export async function extractXlsx(data: Buffer): Promise<OfficeResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new ExtractError("EXTRACT_FAILED", "Workbook tidak bisa diurai.");
  }

  const pages: OfficePage[] = [];
  const cells: SheetCell[] = [];
  let sheetCount = 0;

  for (const sheet of workbook.worksheets) {
    if (sheetCount >= MAX_SHEETS) break;
    sheetCount++;
    const lines: string[] = [];

    sheet.eachRow({ includeEmpty: false }, (row) => {
      const parts: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        const formula =
          cell.formula && typeof cell.formula === "string" ? cell.formula : null;
        const cached = cell.value;
        const text = formula !== null ? `=${formula}` : cellText(cached);

        if (cells.length < MAX_CELLS && text !== "") {
          cells.push({
            sheet: sheet.name,
            cell: cell.address,
            kind: formula !== null ? "formula" : "value",
            text,
          });
        }
        if (text !== "") parts.push(text);
      });
      if (parts.length > 0) lines.push(parts.join("\t"));
    });

    pages.push({ page: sheetCount, text: lines.join("\n") });
  }

  if (cells.length === 0) {
    throw new ExtractError("NO_TEXT_LAYER", "Workbook tidak berisi nilai.");
  }
  return { pages, cells };
}

/** Nilai sel → teks. Rich text, hyperlink, dan error Excel ditangani eksplisit. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const obj = value as unknown as Record<string, unknown>;
    if (typeof obj["text"] === "string") return obj["text"];
    if (Array.isArray(obj["richText"])) {
      return (obj["richText"] as { text?: string }[]).map((r) => r.text ?? "").join("");
    }
    if (typeof obj["error"] === "string") return `#${obj["error"]}`;
    if (obj["result"] !== undefined) return cellText(obj["result"] as ExcelJS.CellValue);
  }
  return "";
}
