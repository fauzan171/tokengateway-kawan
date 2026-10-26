/** Tool `generate_file` + `generate_document` untuk gateway dan penyatuan potongan tool call. */

import { ArtifactError, type ArtifactInput } from "@/lib/artifacts/render";
import { parseDocSchema, type DocSchema } from "@/lib/artifacts/document";
import { DOC_TEMPLATE_IDS, buildDocFromTemplate } from "@/lib/artifacts/templates";

export const GENERATE_FILE_TOOL_NAME = "generate_file";

/** Format `generate_file`: md/txt/json/csv (teks) + xlsx/docx (biner, D2). */
const SUPPORTED_FORMATS = ["md", "txt", "json", "csv", "xlsx", "docx"] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/** Batas bersama schema + parser (D2 §5): satu angka, bukan dua yang bisa beda. */
const FILE_LIMITS = {
  displayName: 120,
  content: 200_000,
  rows: 2_000,
  columns: 100,
  cell: 500,
  sheets: 5,
  sheetName: 60,
} as const;

/** Baris grid bersama varian csv/xlsx; isi tak dipercaya, divalidasi sebelum render. */
const GRID_SCHEMA = {
  type: "array",
  items: { type: "array", maxItems: FILE_LIMITS.columns, items: { type: "string", maxLength: FILE_LIMITS.cell } },
  maxItems: FILE_LIMITS.rows,
} as const;

/** Satu bentuk per tipe blok DocSchema; selaras `DOC_LIMITS` di document.ts. */
const DOC_BLOCK_FORMS = [
  {
    type: "object",
    properties: {
      type: { const: "heading" },
      text: { type: "string", maxLength: 20_000 },
      level: { type: "integer", enum: [1, 2, 3] },
    },
    required: ["type", "text"],
  },
  {
    type: "object",
    properties: {
      type: { const: "paragraph" },
      text: { type: "string", maxLength: 20_000 },
    },
    required: ["type", "text"],
  },
  {
    type: "object",
    properties: {
      type: { const: "bullets" },
      items: { type: "array", items: { type: "string", maxLength: 20_000 }, maxItems: 100 },
      ordered: { type: "boolean", description: "true = daftar bernomor" },
    },
    required: ["type", "items"],
  },
  {
    type: "object",
    properties: {
      type: { const: "table" },
      headers: { type: "array", items: { type: "string", maxLength: 500 }, maxItems: 12 },
      rows: { type: "array", items: { type: "array", items: { type: "string", maxLength: 500 } }, maxItems: 2_000 },
    },
    required: ["type", "headers", "rows"],
  },
  {
    type: "object",
    properties: {
      type: { const: "code" },
      text: { type: "string", maxLength: 20_000 },
      language: { type: "string", maxLength: 32 },
    },
    required: ["type", "text"],
  },
  // D3: blok presentasi + gambar via rujukan artifactId (bukan base64).
  {
    type: "object",
    properties: { type: { const: "pageBreak" } },
    required: ["type"],
  },
  {
    type: "object",
    properties: { type: { const: "divider" } },
    required: ["type"],
  },
  {
    type: "object",
    properties: {
      type: { const: "image" },
      artifactId: { type: "string", description: "ID artefak gambar milik pengguna (PNG/JPEG)" },
      alt: { type: "string", maxLength: 200, description: "Teks pengganti untuk aksesibilitas" },
      caption: { type: "string", maxLength: 200 },
      widthPct: { type: "integer", minimum: 10, maximum: 100 },
    },
    required: ["type", "artifactId", "alt"],
  },
] as const;

/** Bentuk `doc` DocSchema; dipakai bersama oleh generate_file (docx) dan generate_document (pdf/docx/xlsx). */
const DOC_SCHEMA_PARAM = {
  type: "object",
  properties: {
    title: { type: "string", maxLength: 200 },
    blocks: { type: "array", items: { oneOf: [...DOC_BLOCK_FORMS] }, maxItems: 500 },
  },
  required: ["title", "blocks"],
  additionalProperties: false,
} as const;

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
      "Membuat berkas yang dapat diunduh pengguna (markdown, teks, JSON, CSV, Excel, atau Word) dari konten yang Anda berikan.",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: [...SUPPORTED_FORMATS] },
        displayName: { type: "string", maxLength: FILE_LIMITS.displayName, description: "Nama berkas yang ditampilkan" },
        content: {
          type: "string",
          maxLength: FILE_LIMITS.content,
          description: "Isi berkas (wajib untuk md/txt/json)",
        },
        rows: { ...GRID_SCHEMA, description: "Baris data CSV (wajib untuk csv)" },
        sheets: {
          type: "array",
          minItems: 1,
          maxItems: FILE_LIMITS.sheets,
          description: "Lembar Excel (wajib untuk xlsx)",
          items: {
            type: "object",
            properties: {
              name: { type: "string", maxLength: FILE_LIMITS.sheetName },
              rows: GRID_SCHEMA,
            },
            required: ["name", "rows"],
            additionalProperties: false,
          },
        },
        doc: { ...DOC_SCHEMA_PARAM, description: "Dokumen terstruktur (wajib untuk docx)" },
      },
      required: ["format", "displayName"],
      additionalProperties: false,
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

/** Argumen grid bersama csv/xlsx; union sempit agar pemanggil bisa narrowing per format. */
export type SheetArgs = { name: string; rows: string[][] };

export type GenerateFileArgs =
  | { format: "md" | "txt" | "json"; displayName: string; content: string }
  | { format: "csv"; displayName: string; rows: string[][] }
  | { format: "xlsx"; displayName: string; sheets: SheetArgs[] }
  | { format: "docx"; displayName: string; doc: DocSchema; truncated: boolean; unknownBlocks: number };

function invalid(message: string): never {
  throw new ArtifactError("INVALID_TOOL_ARGS", message);
}

/** Kunci yang sah per format: varian saling eksklusif, sisanya = field asing. */
const VARIANT_KEYS: Record<SupportedFormat, readonly string[]> = {
  md: ["format", "displayName", "content"],
  txt: ["format", "displayName", "content"],
  json: ["format", "displayName", "content"],
  csv: ["format", "displayName", "rows"],
  xlsx: ["format", "displayName", "sheets"],
  docx: ["format", "displayName", "doc"],
};

/** Grid string[][] dari input tak dipercaya; cap ditegakkan di sini, bukan hanya JSON Schema. */
function parseGrid(value: unknown, what: string): string[][] {
  if (!Array.isArray(value)) invalid(`${what} harus berupa larik baris.`);
  if (value.length > FILE_LIMITS.rows) invalid(`${what} melebihi ${FILE_LIMITS.rows} baris.`);
  return value.map((row, index) => {
    if (!Array.isArray(row)) invalid(`Baris ${index + 1} ${what} harus larik.`);
    if (row.length > FILE_LIMITS.columns) invalid(`Baris ${index + 1} melebihi ${FILE_LIMITS.columns} kolom.`);
    return row.map((cell) => {
      // Sel primitif (angka/bool) diterima dan dijadikan teks seperti renderer CSV;
      // objek/larik ditolak karena tak punya bentuk sel tunggal.
      if (cell !== null && typeof cell === "object") invalid(`Sel baris ${index + 1} harus teks.`);
      const text = cell === null || cell === undefined ? "" : String(cell);
      if (text.length > FILE_LIMITS.cell) invalid(`Sel baris ${index + 1} melebihi ${FILE_LIMITS.cell} karakter.`);
      return text;
    });
  });
}

/**
 * Validasi argumen `generate_file`; lempar ArtifactError INVALID_TOOL_ARGS.
 * Union sempit, varian saling eksklusif: field asing atau kunci varian lain
 * ditolak, jadi `format:"xlsx"` + `content` tidak pernah lolos.
 */
export function parseGenerateFileArgs(args: unknown): GenerateFileArgs {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    invalid("Argumen tool harus objek.");
  }
  const record = args as Record<string, unknown>;
  if (!SUPPORTED_FORMATS.includes(record.format as SupportedFormat)) {
    invalid("Format berkas tidak didukung.");
  }
  const format = record.format as SupportedFormat;

  const allowed = VARIANT_KEYS[format];
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) invalid(`Field '${key}' tidak sah untuk format ${format}.`);
  }

  const displayName = record.displayName;
  if (typeof displayName !== "string" || displayName === "") invalid("Nama berkas wajib diisi.");
  if (displayName.length > FILE_LIMITS.displayName) invalid(`Nama berkas melebihi ${FILE_LIMITS.displayName} karakter.`);

  if (format === "csv") {
    if (!Array.isArray(record.rows)) invalid("CSV membutuhkan rows.");
    return { format, displayName, rows: parseGrid(record.rows, "data CSV") };
  }

  if (format === "xlsx") {
    const sheets = record.sheets;
    if (!Array.isArray(sheets) || sheets.length === 0) invalid("XLSX membutuhkan sheets.");
    if (sheets.length > FILE_LIMITS.sheets) invalid(`XLSX maksimal ${FILE_LIMITS.sheets} sheet.`);
    return {
      format,
      displayName,
      sheets: sheets.map((sheet, index) => {
        if (typeof sheet !== "object" || sheet === null || Array.isArray(sheet)) {
          invalid(`Sheet ${index + 1} harus objek.`);
        }
        const entry = sheet as Record<string, unknown>;
        if (typeof entry.name !== "string" || entry.name.trim() === "") invalid(`Sheet ${index + 1} butuh nama.`);
        if (entry.name.length > FILE_LIMITS.sheetName) {
          invalid(`Nama sheet ${index + 1} melebihi ${FILE_LIMITS.sheetName} karakter.`);
        }
        return { name: entry.name, rows: parseGrid(entry.rows, `sheet ${entry.name}`) };
      }),
    };
  }

  if (format === "docx") {
    try {
      const parsed = parseDocSchema(record.doc);
      // R5/FIX-19: pemotongan harus terlihat — teruskan flag, jangan dibuang.
      return {
        format,
        displayName,
        doc: { title: parsed.title, blocks: parsed.blocks },
        truncated: parsed.truncated,
        unknownBlocks: parsed.unknownBlocks,
      };
    } catch (err) {
      // Pelanggaran skema doc dari tool model tetap INVALID_TOOL_ARGS (bukan INVALID_DOC_SCHEMA).
      if (err instanceof ArtifactError && err.code === "INVALID_DOC_SCHEMA") invalid(err.message);
      throw err;
    }
  }

  if (typeof record.content !== "string") invalid(format === "json" ? "JSON membutuhkan content." : "Isi berkas wajib string.");
  if (record.content.length > FILE_LIMITS.content) invalid(`Isi berkas melebihi ${FILE_LIMITS.content} karakter.`);
  return { format, displayName, content: record.content };
}

/**
 * Argumen `generate_file` tervalidasi → `ArtifactInput` untuk `createArtifact`.
 *
 * Satu peta dipakai bersama oleh loop chat dan run task (D2): xlsx/docx tidak
 * lagi "format tak dikenal", jadi jalur tulis artefak tetap satu, bukan dua yang
 * bisa menyimpang.
 */
export function toArtifactInput(args: GenerateFileArgs): ArtifactInput {
  if (args.format === "csv") return { format: "csv", rows: args.rows };
  if (args.format === "xlsx") return { format: "xlsx", sheets: args.sheets.map((sheet) => ({ name: sheet.name, rows: sheet.rows })) };
  if (args.format === "docx") return { format: "docx", doc: args.doc };
  if (args.format === "json") {
    let content: unknown;
    try {
      content = JSON.parse(args.content);
    } catch {
      invalid("Isi JSON tidak dapat dibaca.");
    }
    return { format: "json", content };
  }
  return { format: args.format, content: args.content };
}

// ---------------------------------------------------------------------------
// generate_document (FIX-12): dokumen terstruktur → PDF/DOCX/XLSX.
// ---------------------------------------------------------------------------

export const GENERATE_DOCUMENT_TOOL_NAME = "generate_document";

/** Tool dokumen terstruktur: satu-satunya jalan ke PDF/DOCX/XLSX. */
export const GENERATE_DOCUMENT_TOOL: {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
} = {
  type: "function",
  function: {
    name: GENERATE_DOCUMENT_TOOL_NAME,
    description:
      "Gunakan tool ini bila pengguna minta dokumen rapi (PDF, Word, Excel) dengan judul, bab, daftar bernomor, tabel, gambar (artifactId), atau pemisah halaman. Untuk laporan/surat/rekap, kirim \`template\` + \`data\` — hasilnya konsisten tanpa menyusun blok manual.",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["pdf", "docx", "xlsx"] },
        displayName: { type: "string", description: "Nama dokumen yang ditampilkan" },
        doc: { ...DOC_SCHEMA_PARAM },
        // D4: jalur template — model mengisi data, struktur dibangun fungsi.
        template: { type: "string", enum: [...DOC_TEMPLATE_IDS] },
        data: { type: "object", description: "Isi sesuai template (laporan/surat/rekap)" },
      },
      required: ["format", "displayName"],
      anyOf: [{ required: ["doc"] }, { required: ["template", "data"] }],
    },
  },
};

/**
 * Validasi argumen `generate_document`; lempar ArtifactError INVALID_TOOL_ARGS.
 *
 * `truncated`/`unknownBlocks` WAJIB diteruskan ke pemanggil: dokumen yang
 * dipotong 490 dari 500 blok tanpa catatan adalah kehilangan data yang tidak
 * terlihat (temuan review R5).
 */
export function parseGenerateDocumentArgs(args: unknown): {
  format: "pdf" | "docx" | "xlsx";
  displayName: string;
  doc: DocSchema;
  truncated: boolean;
  unknownBlocks: number;
} {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Argumen tool harus objek.");
  }
  const record = args as Record<string, unknown>;
  if (record.format !== "pdf" && record.format !== "docx" && record.format !== "xlsx") {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Format dokumen harus pdf, docx, atau xlsx.");
  }
  if (typeof record.displayName !== "string" || record.displayName === "") {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Nama dokumen wajib diisi.");
  }
  // Pelanggaran skema doc dari tool model tetap INVALID_TOOL_ARGS (bukan INVALID_DOC_SCHEMA).
  let doc: DocSchema;
  let truncated = false;
  let unknownBlocks = 0;
  // D4: jalur template menang atas doc mentah bila keduanya dikirim — template
  // menegakkan struktur, doc mentah dari model tidak konsisten.
  if (typeof record.template === "string" && record.template !== "") {
    const built = buildDocFromTemplate(record.template, record.data);
    doc = { title: built.title, blocks: built.blocks };
    truncated = built.truncated;
    unknownBlocks = built.unknownBlocks;
  } else {
    try {
      const parsed = parseDocSchema(record.doc);
      doc = { title: parsed.title, blocks: parsed.blocks };
      truncated = parsed.truncated;
      unknownBlocks = parsed.unknownBlocks;
    } catch (err) {
      if (err instanceof ArtifactError && err.code === "INVALID_DOC_SCHEMA") {
        throw new ArtifactError("INVALID_TOOL_ARGS", err.message);
      }
      throw err;
    }
  }
  return {
    format: record.format,
    displayName: record.displayName,
    doc,
    truncated,
    unknownBlocks,
  };
}

/** Daftar tool chat untuk gateway. */
export const CHAT_TOOLS = [GENERATE_FILE_TOOL, GENERATE_DOCUMENT_TOOL];
