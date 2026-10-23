/**
 * Konversi artefak antar-format teks (FIX-12).
 *
 * Cakupan sengaja sempit: hanya format yang punya representasi kanonik teks.
 * PDF/DOCX/XLSX/PPTX tidak dikonversi balik — itu rekonstruksi best-effort yang
 * butuh LibreOffice headless, di luar lingkup ini (lihat reports/FIX-12.md).
 */

import { ArtifactError } from "./render";
import type { ArtifactFormat } from "./format";

const TEXT_FORMATS = ["md", "txt", "html"] as const;
type TextFormat = (typeof TEXT_FORMATS)[number];

export type ConversionSource =
  | { format: "md" | "txt" | "html"; content: string }
  | { format: "json"; content: unknown }
  | { format: "csv"; rows: unknown[][] };

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);

/** Markdown → teks biasa: buang penanda sintaks, pertahankan isi. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/^```.*$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(`)(.*?)\1/g, "$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Teks biasa → Markdown: paragraf dipisah baris kosong, tidak menambah markup. */
export function textToMarkdown(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Teks → HTML aman: seluruh isi di-escape, hanya paragraf & baris yang ditata. */
export function textToHtml(text: string): string {
  const body = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
  return `<!doctype html>\n<html><head><meta charset="utf-8"></head><body>\n${body}\n</body></html>`;
}

/** HTML → teks biasa: buang tag & script/style, decode entitas dasar. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Baris tabel → CSV RFC 4180 (formula injection sudah ditangani renderer CSV). */
export function rowsToCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export type ConvertedContent = { format: ArtifactFormat; content: string };

/**
 * Konversi ke format target. Sumber dan target harus sama-sama format teks;
 * pasangan lain ditolak eksplisit, bukan dikembalikan sebagai byte mentah.
 */
export function convertArtifact(source: ConversionSource, target: ArtifactFormat): ConvertedContent {
  if (source.format === "json") {
    if (target !== "json") {
      // JSON hanya punya representasi teks yang jujur sebagai JSON itu sendiri.
      throw new ArtifactError("CONVERSION_UNSUPPORTED", "JSON hanya dapat disimpan sebagai JSON.");
    }
    let text: string;
    try {
      text = JSON.stringify(source.content, null, 2);
    } catch {
      throw new ArtifactError("UNSERIALIZABLE_JSON");
    }
    if (text === undefined) throw new ArtifactError("UNSERIALIZABLE_JSON");
    return { format: "json", content: text };
  }

  if (source.format === "csv") {
    if (target === "md") return { format: "md", content: rowsToCsv(source.rows) };
    throw new ArtifactError("CONVERSION_UNSUPPORTED", "CSV hanya dapat dikonversi ke Markdown.");
  }

  if (!(TEXT_FORMATS as readonly string[]).includes(target)) {
    throw new ArtifactError("CONVERSION_UNSUPPORTED", `Konversi ke ${target} belum didukung.`);
  }
  const to = target as TextFormat;
  if (source.format === to) return { format: to, content: source.content };
  if (source.format === "html") {
    const plain = htmlToText(source.content);
    return to === "txt"
      ? { format: "txt", content: plain }
      : { format: "md", content: textToMarkdown(plain) };
  }
  if (to === "html") return { format: "html", content: textToHtml(source.content) };
  if (to === "txt") {
    return {
      format: "txt",
      content: source.format === "md" ? markdownToText(source.content) : source.content,
    };
  }
  return {
    format: "md",
    content: source.format === "txt" ? textToMarkdown(source.content) : source.content,
  };
}
