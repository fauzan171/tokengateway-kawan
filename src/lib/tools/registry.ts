/**
 * Registry tool tertutup (SDD-AG-4, tahap P1).
 *
 * Daftar tool adalah konstanta kode, bukan input model: tidak ada registrasi
 * dinamis, tidak ada nama yang diubah jadi shell. Setiap entri memasangkan
 * nama + schema JSON + validator + handler + batas waktu/byte, sehingga
 * pemanggil (loop agen, FIX-09) tidak perlu tahu bentuk internal tool.
 *
 * Aturan yang ditegakkan di sini:
 *   - nama asing ditolak dengan null, bukan lemparan atau tebakan;
 *   - argumen divalidasi sebelum handler; validator melempar ToolInputError
 *     berkode, jadi kegagalan bisa dibedakan dan dilaporkan;
 *   - handler TIDAK pernah melempar untuk masukan buruk — hasilnya ToolResult
 *     berstatus invalid/failed, bukan crash;
 *   - tool yang mengubah state (write) wajib lewat approval. Saat ini semua
 *     tool terdaftar read/local; app.* (FIX-19) didaftarkan menyusul.
 *
 * Tool di sini membungkus fungsi yang sudah ada (compute.ts, chart.ts, qr.ts)
 * tanpa mengubah perilakunya.
 */

import {
  CalcError,
  calculate,
  countText,
  describe as describeStats,
  type CalcOp,
  type CalcRequest,
  type RoundingMode,
  type StatsRequest,
} from "./compute";
import { CHART_LIMITS, ChartError, renderChart, type ChartRequest } from "./chart";
import { QR_LIMITS, QrError, makeQr } from "./qr";
import { ArtifactError } from "@/lib/artifacts/render";
import {
  GENERATE_DOCUMENT_TOOL,
  GENERATE_DOCUMENT_TOOL_NAME,
  GENERATE_FILE_TOOL,
  GENERATE_FILE_TOOL_NAME,
  parseGenerateDocumentArgs,
  parseGenerateFileArgs,
  type GenerateFileArgs,
} from "@/lib/chat/file-tool";

export const TOOL_SCHEMA_VERSION = 1 as const;

/** Efek tool: baca, efek lokal (artefak), atau tulis ke state pengguna. */
export type ToolEffect = "read" | "local" | "write";

export type ToolResult = {
  schemaVersion: typeof TOOL_SCHEMA_VERSION;
  /** ok = tuntas; invalid = argumen; denied = approval/kebijakan; failed = pelaksanaan. */
  status: "ok" | "invalid" | "denied" | "failed";
  /** Teks hasil untuk model — SELALU string bila ok (SDD: text wajib). */
  text?: string;
  /** Rujukan sumber (halaman/artefak) yang dipakai tool (SDD-AG-4). */
  sourceRefs?: { id: string; url?: string; artifactId?: string; locator?: string }[];
  /** Artefak yang dihasilkan (kartu unduhan UI). */
  artifactIds?: string[];
  data?: unknown;
  message?: string;
  errorCode?: string;
  truncated?: boolean;
};

export type ToolContext = {
  /** Dari sesi, tidak pernah dari argumen model. */
  userId: string;
  /** Identitas tugas/run/langkah (SDD-AG-4): audit + approval terikat langkah. */
  taskId?: string;
  runId?: string;
  stepId?: string;
  signal: AbortSignal;
  deadlineAt: Date;
  /** Revisi kebijakan saat pemanggilan; approval yang lebih lama tidak berlaku. */
  policyRevision: number;
  /** Digest approval satu-pakai bila tool write butuh persetujuan (SDD-AG-4). */
  approvedDigest: string | null;
};

export type ToolInputErrorCode =
  | "ARGUMENTS_NOT_OBJECT"
  | "INVALID_ARGUMENT"
  | "UNKNOWN_ARGUMENT"
  | "VALUE_REJECTED";

/** Argumen ditolak sebelum handler: terstruktur, bukan TypeError acak. */
export class ToolInputError extends Error {
  readonly code: ToolInputErrorCode;

  constructor(code: ToolInputErrorCode, message: string) {
    super(message);
    this.name = "ToolInputError";
    this.code = code;
  }
}

/**
 * Schema JSON objek.
 *
 * Entri baru menutup argumen dengan `additionalProperties: false`. Entri chat
 * (`generate_file`/`generate_document`) memakai schema dari `file-tool.ts`
 * apa adanya — menambah kunci di sana berarti mengubah perilaku model, dan itu
 * bukan tugas registry.
 */
export type ToolParameters = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolEntry = {
  name: string;
  description: string;
  parameters: ToolParameters;
  effect: ToolEffect;
  /**
   * Dikirim ke gateway chat sebagai tool yang boleh dipanggil model. Hanya
   * tool yang benar-benar dieksekusi loop chat; sisanya (compute/chart/qr)
   * menunggu konsumen penuh FIX-09.
   */
  chatExposed?: true;
  /** Lempar ToolInputError bila argumen tidak sah; kembalikan argumen ternormalisasi. */
  validate(args: unknown): unknown;
  /** Selalu menghasilkan ToolResult; tidak melempar untuk masukan buruk. */
  handler(ctx: ToolContext, args: unknown): Promise<ToolResult>;
  timeoutMs: number;
  byteCap: number;
};

/** Batas per tool; angka dipakai pemanggil, bukan ditebak ulang di loop. */
export const TOOL_LIMITS = {
  computeTimeoutMs: 2_000,
  chartTimeoutMs: 5_000,
  qrTimeoutMs: 5_000,
  computeByteCap: 8_192,
  chartByteCap: 65_536,
  qrByteCap: 65_536,
  maxTextChars: 20_000,
  maxTitleChars: 200,
  maxLabelChars: 60,
  maxLocaleChars: 35,
  /** Artefak dibuat setelah stream selesai; render biner (pdf/docx/xlsx) paling lama. */
  artifactTimeoutMs: 15_000,
  /**
   * Batas byte mengikuti batas artefak yang sesungguhnya
   * (`MAX_ARTIFACT_BYTES` = 25 MiB di artifacts/format.ts). Angka 65.536 yang
   * dipakai sebelumnya lebih KECIL dari PDF sah (terukur 103.174 byte), jadi
   * angka itu akan menolak dokumen yang sebenarnya boleh.
   */
  artifactByteCap: 25 * 1024 * 1024,
} as const;

// ---------------------------------------------------------------------------
// Validasi argumen
// ---------------------------------------------------------------------------

function asRecord(args: unknown): Record<string, unknown> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    throw new ToolInputError("ARGUMENTS_NOT_OBJECT", "Argumen tool harus objek.");
  }
  return args as Record<string, unknown>;
}

/** Daftar argumen tertutup: kunci asing ditolak, bukan diabaikan diam-diam. */
function onlyKeys(args: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) {
      throw new ToolInputError("UNKNOWN_ARGUMENT", 'Argumen "' + key + '" tidak dikenal.');
    }
  }
}

function text(args: Record<string, unknown>, key: string, max: number): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new ToolInputError("INVALID_ARGUMENT", "'" + key + "' harus string.");
  }
  if (value.length > max) {
    throw new ToolInputError("INVALID_ARGUMENT", "'" + key + "' melebihi " + max + " karakter.");
  }
  return value;
}

function nonEmptyText(args: Record<string, unknown>, key: string, max: number): string {
  const value = text(args, key, max);
  if (value.trim() === "") {
    throw new ToolInputError("INVALID_ARGUMENT", "'" + key + "' tidak boleh kosong.");
  }
  return value;
}

/** undefined = tidak dikirim, null = sengaja kosong; keduanya berbeda arti. */
function optionalText(
  args: Record<string, unknown>,
  key: string,
  max: number,
): string | null | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ToolInputError("INVALID_ARGUMENT", "'" + key + "' harus string atau null.");
  }
  if (value.length > max) {
    throw new ToolInputError("INVALID_ARGUMENT", "'" + key + "' melebihi " + max + " karakter.");
  }
  return value;
}

/** Galat domain (Calc/Chart/Qr) = argumen yang ditolak, bukan kerusakan server. */
function rejection(err: unknown): ToolInputError {
  if (err instanceof CalcError || err instanceof ChartError || err instanceof QrError) {
    return new ToolInputError("VALUE_REJECTED", err.message);
  }
  return new ToolInputError(
    "VALUE_REJECTED",
    err instanceof Error ? err.message : "Argumen ditolak.",
  );
}

function validateCalculate(args: unknown): CalcRequest {
  const record = asRecord(args);
  onlyKeys(record, ["op", "operands", "precision", "rounding"]);

  const op = record["op"];
  if (typeof op !== "string") {
    throw new ToolInputError("INVALID_ARGUMENT", "'op' harus string.");
  }
  const rawOperands = record["operands"];
  if (!Array.isArray(rawOperands)) {
    throw new ToolInputError("INVALID_ARGUMENT", "'operands' harus array string desimal.");
  }
  const operands = rawOperands.map((value, index) => {
    if (typeof value !== "string") {
      throw new ToolInputError(
        "INVALID_ARGUMENT",
        "Operand " + (index + 1) + " harus string desimal.",
      );
    }
    return value;
  });

  const rawPrecision = record["precision"];
  if (rawPrecision !== undefined && typeof rawPrecision !== "number") {
    throw new ToolInputError("INVALID_ARGUMENT", "'precision' harus angka.");
  }
  const rawRounding = record["rounding"];
  if (rawRounding !== undefined && typeof rawRounding !== "string") {
    throw new ToolInputError("INVALID_ARGUMENT", "'rounding' harus string.");
  }

  const request: CalcRequest = {
    op: op as CalcOp,
    operands,
    ...(rawPrecision !== undefined ? { precision: rawPrecision as number } : {}),
    ...(rawRounding !== undefined ? { rounding: rawRounding as RoundingMode } : {}),
  };
  // Semantik (arity, presisi, pembagian nol) tetap milik calculate.
  try {
    calculate(request);
  } catch (err) {
    throw rejection(err);
  }
  return request;
}

function validateStats(args: unknown): StatsRequest {
  const record = asRecord(args);
  onlyKeys(record, ["values", "kind", "unit"]);

  const rawValues = record["values"];
  if (!Array.isArray(rawValues)) {
    throw new ToolInputError("INVALID_ARGUMENT", "'values' harus array angka/null.");
  }
  const values = rawValues.map((value, index) => {
    if (value === null || typeof value === "number") return value;
    throw new ToolInputError(
      "INVALID_ARGUMENT",
      "Nilai ke-" + (index + 1) + " harus angka atau null.",
    );
  });

  const rawKind = record["kind"];
  if (rawKind !== undefined && typeof rawKind !== "string") {
    throw new ToolInputError("INVALID_ARGUMENT", "'kind' harus string.");
  }
  const unit = optionalText(record, "unit", TOOL_LIMITS.maxLabelChars);

  const request: StatsRequest = {
    values,
    ...(rawKind !== undefined ? { kind: rawKind as StatsRequest["kind"] } : {}),
    ...(unit !== undefined ? { unit } : {}),
  };
  try {
    describeStats(request);
  } catch (err) {
    throw rejection(err);
  }
  return request;
}

function validateCount(args: unknown): { text: string; locale: string } {
  const record = asRecord(args);
  onlyKeys(record, ["text", "locale"]);
  // Teks kosong sah: hasilnya nol, bukan galat.
  const value = text(record, "text", TOOL_LIMITS.maxTextChars);
  const locale =
    record["locale"] === undefined
      ? "id"
      : nonEmptyText(record, "locale", TOOL_LIMITS.maxLocaleChars);
  try {
    countText(value, locale);
  } catch (err) {
    throw rejection(err);
  }
  return { text: value, locale };
}

function withOptional(
  record: Record<string, unknown>,
  key: "unit" | "xLabel" | "yLabel",
): Record<string, string | null> {
  const value = optionalText(record, key, TOOL_LIMITS.maxLabelChars);
  return value === undefined ? {} : { [key]: value };
}

function validateChart(args: unknown): ChartRequest {
  const record = asRecord(args);
  onlyKeys(record, ["kind", "points", "title", "unit", "xLabel", "yLabel"]);

  const kind = nonEmptyText(record, "kind", 8);
  if (kind !== "bar" && kind !== "line") {
    throw new ToolInputError("VALUE_REJECTED", 'Jenis grafik "' + kind + '" tidak didukung.');
  }

  const rawPoints = record["points"];
  if (!Array.isArray(rawPoints)) {
    throw new ToolInputError("INVALID_ARGUMENT", "'points' harus array {label, value}.");
  }
  const points = rawPoints.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ToolInputError(
        "INVALID_ARGUMENT",
        "Titik ke-" + (index + 1) + " harus objek {label, value}.",
      );
    }
    const point = value as Record<string, unknown>;
    onlyKeys(point, ["label", "value"]);
    const label = nonEmptyText(point, "label", TOOL_LIMITS.maxLabelChars);
    const raw = point["value"];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      throw new ToolInputError(
        "INVALID_ARGUMENT",
        'Nilai untuk "' + label + '" harus angka hingga.',
      );
    }
    return { label, value: raw };
  });

  const request: ChartRequest = {
    kind,
    points,
    title: nonEmptyText(record, "title", TOOL_LIMITS.maxTitleChars),
    ...withOptional(record, "unit"),
    ...withOptional(record, "xLabel"),
    ...withOptional(record, "yLabel"),
  };
  try {
    renderChart(request);
  } catch (err) {
    throw rejection(err);
  }
  return request;
}

function validateQr(args: unknown): string {
  const record = asRecord(args);
  onlyKeys(record, ["payload"]);
  // Hanya bentuk argumen yang diperiksa di sini; encode+decode verifikasi
  // (mahal) dijalankan handler sekali, bukan dua kali.
  return nonEmptyText(record, "payload", QR_LIMITS.maxPayloadChars);
}

/**
 * Tool chat: validasi TIDAK ditulis ulang di sini. `parseGenerateFileArgs`
 * dan `parseGenerateDocumentArgs` sudah menjadi kontraknya; registry hanya
 * menerjemahkan `ArtifactError` menjadi `ToolInputError` berkode supaya
 * pemanggil melihat satu jenis galat. Pesan aslinya dipertahankan.
 */
function fromArtifactError(err: unknown): ToolInputError {
  if (err instanceof ArtifactError) {
    return new ToolInputError("VALUE_REJECTED", err.message);
  }
  return err instanceof Error
    ? new ToolInputError("VALUE_REJECTED", err.message)
    : new ToolInputError("VALUE_REJECTED", "Argumen tool ditolak.");
}

function validateGenerateFile(args: unknown): GenerateFileArgs {
  try {
    return parseGenerateFileArgs(args);
  } catch (err) {
    throw fromArtifactError(err);
  }
}

function validateGenerateDocument(args: unknown) {
  try {
    return parseGenerateDocumentArgs(args);
  } catch (err) {
    throw fromArtifactError(err);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function ok(data: unknown): ToolResult {
  return { schemaVersion: TOOL_SCHEMA_VERSION, status: "ok", data };
}

function invalid(message: string): ToolResult {
  return { schemaVersion: TOOL_SCHEMA_VERSION, status: "invalid", message };
}

function denied(message: string): ToolResult {
  return { schemaVersion: TOOL_SCHEMA_VERSION, status: "denied", message };
}

function failed(message: string): ToolResult {
  return { schemaVersion: TOOL_SCHEMA_VERSION, status: "failed", message };
}

/** Run batal atau lewat tenggat: jangan mulai kerja yang hasilnya dibuang. */
function stopReason(ctx: ToolContext): ToolResult | null {
  if (ctx.signal.aborted) return denied("Tool dibatalkan sebelum dijalankan.");
  if (ctx.deadlineAt.getTime() <= Date.now()) return failed("Tenggat run sudah lewat.");
  return null;
}

/** Galat tak terduga jadi failed, bukan pengecualian yang mematikan run. */
function resultOf(err: unknown): ToolResult {
  if (
    err instanceof CalcError ||
    err instanceof ChartError ||
    err instanceof QrError ||
    err instanceof ArtifactError
  ) {
    return invalid(err.message);
  }
  return failed(err instanceof Error ? err.message : "Tool gagal tanpa keterangan.");
}

async function handleCalculate(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(calculate(args as CalcRequest));
  } catch (err) {
    return resultOf(err);
  }
}

async function handleStats(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(describeStats(args as StatsRequest));
  } catch (err) {
    return resultOf(err);
  }
}

async function handleCount(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    const request = args as { text: string; locale: string };
    return ok(countText(request.text, request.locale));
  } catch (err) {
    return resultOf(err);
  }
}

async function handleChart(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(renderChart(args as ChartRequest));
  } catch (err) {
    return resultOf(err);
  }
}

async function handleQr(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(makeQr(args as string));
  } catch (err) {
    return resultOf(err);
  }
}

/**
 * Handler chat hanya MEMVALIDASI dan mengembalikan argumen ternormalisasi.
 *
 * Penulisan artefak tetap di loop chat (`generate.ts`): ia butuh `db`,
 * `chatId`, dan `messageId` yang bukan bagian `ToolContext`. Memindahkannya
 * ke sini berarti mengubah perilaku, dan itu bukan tujuan P3.
 */
async function handleGenerateFile(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(parseGenerateFileArgs(args));
  } catch (err) {
    return resultOf(err);
  }
}

async function handleGenerateDocument(ctx: ToolContext, args: unknown): Promise<ToolResult> {
  const stop = stopReason(ctx);
  if (stop) return stop;
  try {
    return ok(parseGenerateDocumentArgs(args));
  } catch (err) {
    return resultOf(err);
  }
}

// ---------------------------------------------------------------------------
// Daftar tool (tertutup)
// ---------------------------------------------------------------------------

/**
 * Tool yang SUDAH ada dan berfungsi. app.* (FIX-19) sengaja tidak ada di sini:
 * didaftarkan mendatar saat FIX-19 punya registry-nya sendiri.
 */
const TOOLS: readonly ToolEntry[] = Object.freeze(
  ([

  {
    name: "compute.calculate",
    description:
      "Hitung aritmetika desimal eksak (add, sub, mul, div, pow, mod, sqrt, abs, round, compare). Operand berupa string desimal.",
    effect: "read",
    parameters: {
      type: "object",
      properties: {
        op: {
          type: "string",
          enum: ["add", "sub", "mul", "div", "pow", "mod", "sqrt", "abs", "round", "compare"],
        },
        operands: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
        precision: { type: "integer", minimum: 0, maximum: 20 },
        rounding: {
          type: "string",
          enum: ["half-up", "half-even", "up", "down", "ceil", "floor"],
        },
      },
      required: ["op", "operands"],
      additionalProperties: false,
    },
    validate: validateCalculate,
    handler: handleCalculate,
    timeoutMs: TOOL_LIMITS.computeTimeoutMs,
    byteCap: TOOL_LIMITS.computeByteCap,
  },
  {
    name: "compute.stats",
    description:
      "Statistik deskriptif (n, mean, median, stdDev, min, max) untuk daftar angka; data hilang dilaporkan, tidak diimputasi.",
    effect: "read",
    parameters: {
      type: "object",
      properties: {
        values: { type: "array", items: { type: ["number", "null"] } },
        kind: { type: "string", enum: ["sample", "population"] },
        unit: { type: ["string", "null"] },
      },
      required: ["values"],
      additionalProperties: false,
    },
    validate: validateStats,
    handler: handleStats,
    timeoutMs: TOOL_LIMITS.computeTimeoutMs,
    byteCap: TOOL_LIMITS.computeByteCap,
  },
  {
    name: "compute.count",
    description:
      "Hitung teks: kata, karakter UTF-16, code point, grafem, dan byte UTF-8 — empat angka yang berbeda.",
    effect: "read",
    parameters: {
      type: "object",
      properties: { text: { type: "string" }, locale: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    validate: validateCount,
    handler: handleCount,
    timeoutMs: TOOL_LIMITS.computeTimeoutMs,
    byteCap: TOOL_LIMITS.computeByteCap,
  },
  {
    name: "chart.render",
    description:
      "Buat grafik SVG (bar/line) dari data tervalidasi, dengan tabel alternatif untuk pembaca layar.",
    effect: "local",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["bar", "line"] },
        points: {
          type: "array",
          minItems: 1,
          maxItems: CHART_LIMITS.maxPoints,
          items: {
            type: "object",
            properties: { label: { type: "string" }, value: { type: "number" } },
            required: ["label", "value"],
            additionalProperties: false,
          },
        },
        title: { type: "string" },
        unit: { type: ["string", "null"] },
        xLabel: { type: ["string", "null"] },
        yLabel: { type: ["string", "null"] },
      },
      required: ["kind", "points", "title"],
      additionalProperties: false,
    },
    validate: validateChart,
    handler: handleChart,
    timeoutMs: TOOL_LIMITS.chartTimeoutMs,
    byteCap: TOOL_LIMITS.chartByteCap,
  },
  {
    name: "qr.make",
    description:
      "Buat kode QR dan buktikan terbaca kembali (decode ulang); gambar ditolak bila isi tidak cocok.",
    effect: "local",
    parameters: {
      type: "object",
      properties: { payload: { type: "string", maxLength: QR_LIMITS.maxPayloadChars } },
      required: ["payload"],
      additionalProperties: false,
    },
    validate: validateQr,
    handler: handleQr,
    timeoutMs: TOOL_LIMITS.qrTimeoutMs,
    byteCap: TOOL_LIMITS.qrByteCap,
  },
  // Tool chat (FIX-11/FIX-12). `effect: "local"`: menulis artefak milik
  // pengguna sendiri, bukan state bersama — jadi tidak butuh approval.
  // Schema diambil dari `file-tool.ts` apa adanya; menggandakannya di sini
  // akan membuat dua sumber kebenaran untuk satu kontrak model.
  {
    name: GENERATE_FILE_TOOL_NAME,
    description: GENERATE_FILE_TOOL.function.description,
    effect: "local",
    chatExposed: true,
    parameters: GENERATE_FILE_TOOL.function.parameters as ToolParameters,
    validate: validateGenerateFile,
    handler: handleGenerateFile,
    timeoutMs: TOOL_LIMITS.artifactTimeoutMs,
    byteCap: TOOL_LIMITS.artifactByteCap,
  },
  {
    name: GENERATE_DOCUMENT_TOOL_NAME,
    description: GENERATE_DOCUMENT_TOOL.function.description,
    effect: "local",
    chatExposed: true,
    parameters: GENERATE_DOCUMENT_TOOL.function.parameters as ToolParameters,
    validate: validateGenerateDocument,
    handler: handleGenerateDocument,
    timeoutMs: TOOL_LIMITS.artifactTimeoutMs,
    byteCap: TOOL_LIMITS.artifactByteCap,
  },
  // Setiap entri dibekukan: `Object.freeze` pada array saja tidak mencegah
  // `tool.handler = ...` menimpa perilaku saat runtime.
  ] as ToolEntry[]).map((tool) => Object.freeze(tool)),
);

const BY_NAME: ReadonlyMap<string, ToolEntry> = (() => {
  const map = new Map<string, ToolEntry>();
  for (const tool of TOOLS) {
    if (map.has(tool.name)) {
      throw new Error("Nama tool ganda di registry: " + tool.name);
    }
    map.set(tool.name, tool);
  }
  return map;
})();

/** Daftar tool dalam urutan deklarasi — deterministik, tidak bergantung waktu. */
export function listTools(): readonly ToolEntry[] {
  return TOOLS;
}

/** Nama asing menjadi null; bukan lemparan, bukan tool dinamis. */
export function getTool(name: string): ToolEntry | null {
  if (typeof name !== "string") return null;
  return BY_NAME.get(name) ?? null;
}

export function effectOf(name: string): ToolEffect | null {
  return getTool(name)?.effect ?? null;
}

/** Hanya write yang butuh approval; read/local tidak. */
export function requiresApproval(name: string): boolean {
  return getTool(name)?.effect === "write";
}

/**
 * Entri yang dikirim ke gateway chat, dalam bentuk schema provider.
 *
 * Satu-satunya sumber daftar tool chat: hardcode di `generate.ts` sudah
 * dihapus. Urutan mengikuti deklarasi registry, jadi payload stabil.
 */
export function chatTools(): { type: "function"; function: { name: string; description: string; parameters: ToolParameters } }[] {
  return TOOLS.filter((tool) => tool.chatExposed === true).map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      // Beku: pemanggil tidak boleh mengubah schema milik tool sumber lewat
      // objek hasil (payload gateway dibangun dari referensi ini).
      parameters: deepFreeze(structuredClone(tool.parameters)),
    },
  }));
}

/** Beku rekursif untuk nilai JSON murni; aman untuk schema. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

/** Nama tool chat untuk baris prompt sistem. */
export function chatToolNames(): string[] {
  return TOOLS.filter((tool) => tool.chatExposed === true).map((tool) => tool.name);
}