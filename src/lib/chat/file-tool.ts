/** Tool `generate_file` untuk gateway + penyatuan potongan tool call (FIX-11 3/4). */

import { ArtifactError } from "@/lib/artifacts/render";
import { isArtifactFormat, type ArtifactFormat } from "@/lib/artifacts/format";

export const GENERATE_FILE_TOOL_NAME = "generate_file";

/** Himpunan format yang benar-benar punya renderer (pdf/docx/xlsx/zip menyusul FIX-12). */
const SUPPORTED_FORMATS: readonly ArtifactFormat[] = ["md", "txt", "json", "csv"];

/** Schema tool untuk gateway (format [OI] tools). */
export const GENERATE_FILE_TOOL: {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
} = {
  type: "function",
  function: {
    name: GENERATE_FILE_TOOL_NAME,
    description:
      "Membuat berkas yang dapat diunduh pengguna (markdown, teks, JSON, atau CSV) dari konten yang Anda berikan.",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: [...SUPPORTED_FORMATS] },
        displayName: { type: "string", description: "Nama berkas yang ditampilkan" },
        content: { type: "string", description: "Isi berkas (wajib untuk md/txt/json)" },
        rows: {
          type: "array",
          items: { type: "array" },
          description: "Baris data CSV (wajib untuk csv)",
        },
      },
      required: ["format", "displayName"],
    },
  },
};

/**
 * Menyatukan potongan `arguments` per index, lalu parse JSON-nya.
 * Entri tanpa `name` dibuang; JSON rusak → `arguments: null` (bukan lempar).
 */
export function assembleToolCalls(
  fragments: Map<number, { id?: string; name?: string; arguments: string }>,
): { id: string; name: string; arguments: unknown }[] {
  return [...fragments.entries()]
    .filter(([, slot]) => typeof slot.name === "string" && slot.name !== "")
    .sort(([a], [b]) => a - b)
    .map(([index, slot]) => {
      let arguments_: unknown = null;
      try {
        arguments_ = JSON.parse(slot.arguments);
      } catch {
        // Argumen tidak utuh/rusak: dilaporkan null, tidak menggagalkan stream.
      }
      return {
        id: slot.id ?? `call_${index}`,
        name: slot.name as string,
        arguments: arguments_,
      };
    });
}

/** Argumen tervalidasi; union sempit agar pemanggil dapat narrowing per format. */
export type GenerateFileArgs =
  | { format: "md" | "txt"; displayName: string; content: string }
  | { format: "json"; displayName: string; content: string }
  | { format: "csv"; displayName: string; rows: unknown[][] };

/** Validasi argumen tool; lempar ArtifactError berkode bila tidak sah. */
export function parseGenerateFileArgs(args: unknown): GenerateFileArgs {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Argumen tool harus objek.");
  }
  const record = args as Record<string, unknown>;
  if (!isArtifactFormat(record.format) || !SUPPORTED_FORMATS.includes(record.format)) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Format berkas tidak didukung.");
  }
  const format = record.format as "md" | "txt" | "json" | "csv";  if (typeof record.displayName !== "string" || record.displayName === "") {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Nama berkas wajib diisi.");
  }
  if (format === "csv") {
    if (!Array.isArray(record.rows)) {
      throw new ArtifactError("INVALID_TOOL_ARGS", "CSV membutuhkan rows.");
    }
    return { format, displayName: record.displayName, rows: record.rows as unknown[][] };
  }
  if (format === "json") {
    if (typeof record.content !== "string") {
      throw new ArtifactError("INVALID_TOOL_ARGS", "JSON membutuhkan content.");
    }
    return { format, displayName: record.displayName, content: record.content };
  }
  if (typeof record.content !== "string") {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Isi berkas wajib string.");
  }
  return { format, displayName: record.displayName, content: record.content };
}
