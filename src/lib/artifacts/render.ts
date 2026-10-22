/**
 * Renderer format teks artefak (FIX-11). PDF/DOCX/XLSX/PPTX ada di FIX-12.
 */

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
  | { format: "csv"; rows: unknown[][] };

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

export function renderArtifactBytes(input: ArtifactInput): Buffer {
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
