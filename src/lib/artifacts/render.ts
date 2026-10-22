/**
 * Renderer format teks artefak (FIX-11). Varian biner (FIX-12) lewat
 * renderArtifactBytesAsync di bawah; renderer biner ada di render-binary.ts.
 */

import { renderDocxBytes, renderPdfBytes, renderPptxBytes, renderXlsxBytes } from "./render-binary";
import type { DocSchema } from "./document";

export class ArtifactError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ArtifactError";
    this.code = code;
  }
}

export type ArtifactInput =
  | { format: "md" | "txt" | "html"; content: string }
  | { format: "json"; content: unknown }
  | { format: "csv"; rows: unknown[][] }
  | { format: "pdf" | "docx" | "xlsx"; doc: DocSchema }
  | { format: "pptx"; doc: DocSchema };

/** Varian biner: format dokumen, bukan konten teks dari tool model. */
export type BinaryArtifactInput = Extract<ArtifactInput, { doc: DocSchema }>;
export type TextArtifactInput = Exclude<ArtifactInput, BinaryArtifactInput>;

/** Format biner tapi diberi varian teks → salah skema, bukan render sebagian. */
function asDoc(input: ArtifactInput): DocSchema {
  if ("doc" in input && input.doc) return input.doc;
  throw new ArtifactError("INVALID_DOC_SCHEMA");
}

/** Renderer asinkron: varian teks pakai renderArtifactBytes, biner pakai render-binary. */
export async function renderArtifactBytesAsync(input: ArtifactInput): Promise<Buffer> {
  switch (input.format) {
    case "pdf":
      return renderPdfBytes(asDoc(input));
    case "docx":
      return renderDocxBytes(asDoc(input));
    case "xlsx":
      return renderXlsxBytes(asDoc(input));
    case "pptx":
      return renderPptxBytes(asDoc(input));
    default:
      return renderArtifactBytes(input as TextArtifactInput);
  }
}

/** Awalan yang membuat Excel/LibreOffice mengeksekusi sel sebagai formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Formula injection: dinetralkan SEBELUM escaping RFC 4180.
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix) || text.trimStart().startsWith(prefix))) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function renderArtifactBytes(input: TextArtifactInput): Buffer {
  switch (input.format) {
    case "md":
    case "txt":
    case "html":
      return Buffer.from(input.content, "utf8");
    case "json": {
      let text: string;
      try {
        text = JSON.stringify(input.content, null, 2);
      } catch {
        throw new ArtifactError("UNSERIALIZABLE_JSON");
      }
      if (text === undefined) throw new ArtifactError("UNSERIALIZABLE_JSON");
      return Buffer.from(text, "utf8");
    }
    case "csv":
      return Buffer.from(input.rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "utf8");
  }
}
