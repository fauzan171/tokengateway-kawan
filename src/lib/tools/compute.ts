/**
 * Tool deterministik (FIX-15): aritmetika desimal, statistik, hitung teks.
 *
 * Aturan: angka TIDAK pernah dihitung oleh model. Operasi diterima sebagai
 * string desimal, dihitung dengan `decimal.js`, dan hasilnya dikembalikan
 * sebagai string — tidak ada `eval`, `Function`, shell, atau SQL.
 *
 * Pembulatan eksplisit: `precision` + `rounding` wajib disebut di keluaran
 * supaya pembaca tahu aturannya, bukan menebak.
 */

import Decimal from "decimal.js";

export const CALC_LIMITS = {
  /** Panjang satu operand; mencegah string raksasa jadi bilangan raksasa. */
  maxOperandChars: 40,
  maxOperandDigits: 30,
  maxExponent: 1_000,
  maxOperations: 200,
} as const;

export type RoundingMode =
  | "half-up"
  | "half-even"
  | "up"
  | "down"
  | "ceil"
  | "floor";

const ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  "half-up": Decimal.ROUND_HALF_UP,
  "half-even": Decimal.ROUND_HALF_EVEN,
  up: Decimal.ROUND_UP,
  down: Decimal.ROUND_DOWN,
  ceil: Decimal.ROUND_CEIL,
  floor: Decimal.ROUND_FLOOR,
};

export type CalcOp =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "pow"
  | "mod"
  | "sqrt"
  | "abs"
  | "round"
  | "compare";

export type CalcRequest = {
  op: CalcOp;
  operands: string[];
  /** Angka di belakang koma untuk `round`. */
  precision?: number;
  rounding?: RoundingMode;
};

export type CalcResult = {
  /** Hasil sebagai string desimal; tidak pernah `number` JS. */
  value: string;
  op: CalcOp;
  /** Aturan yang benar-benar dipakai, dikutip balik ke pembaca. */
  rule: string;
  /** Benar bila hasil dibulatkan. */
  rounded: boolean;
};

export class CalcError extends Error {
  readonly code: "INVALID_OPERAND" | "INVALID_REQUEST" | "DIVISION_BY_ZERO" | "NONFINITE";

  constructor(code: CalcError["code"], message: string) {
    super(message);
    this.name = "CalcError";
    this.code = code;
  }
}

/** Operand → Decimal, dengan batas panjang/digit/eksponen yang ditegakkan. */
function operand(raw: unknown, index: number): Decimal {
  if (typeof raw !== "string") {
    throw new CalcError("INVALID_OPERAND", `Operand ${index + 1} harus berupa string desimal.`);
  }
  const text = raw.trim();
  if (text === "") {
    throw new CalcError("INVALID_OPERAND", `Operand ${index + 1} kosong.`);
  }
  if (text.length > CALC_LIMITS.maxOperandChars) {
    throw new CalcError("INVALID_OPERAND", `Operand ${index + 1} terlalu panjang.`);
  }
  // Hanya bentuk desimal/ilmiah yang diterima — bukan ekspresi.
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d{1,4})?$/.test(text)) {
    throw new CalcError("INVALID_OPERAND", `Operand ${index + 1} bukan angka desimal.`);
  }
  const value = new Decimal(text);
  if (!value.isFinite()) {
    throw new CalcError("NONFINITE", `Operand ${index + 1} bukan bilangan hingga.`);
  }
  if (value.precision() > CALC_LIMITS.maxOperandDigits) {
    throw new CalcError("INVALID_OPERAND", `Operand ${index + 1} melebihi ${CALC_LIMITS.maxOperandDigits} digit.`);
  }
  if (value.e !== null && Math.abs(value.e) > CALC_LIMITS.maxExponent) {
    throw new CalcError("NONFINITE", `Operand ${index + 1} eksponennya di luar batas.`);
  }
  return value;
}

const ARITY: Record<CalcOp, number> = {
  add: 2,
  sub: 2,
  mul: 2,
  div: 2,
  pow: 2,
  mod: 2,
  sqrt: 1,
  abs: 1,
  round: 1,
  compare: 2,
};

/** Hitung satu operasi. Melempar `CalcError` untuk setiap masukan tidak sah. */
export function calculate(request: CalcRequest): CalcResult {
  const op = request.op;
  if (!(op in ARITY)) {
    throw new CalcError("INVALID_REQUEST", `Operasi "${String(op)}" tidak dikenal.`);
  }
  const operands = request.operands;
  if (!Array.isArray(operands) || operands.length !== ARITY[op]) {
    throw new CalcError("INVALID_REQUEST", `Operasi ${op} membutuhkan ${ARITY[op]} operand.`);
  }
  if (operands.length > CALC_LIMITS.maxOperations) {
    throw new CalcError("INVALID_REQUEST", "Terlalu banyak operand.");
  }

  const [a, b] = operands.map((raw, i) => operand(raw, i));

  switch (op) {
    case "add":
      return plain(op, a!.plus(b!));
    case "sub":
      return plain(op, a!.minus(b!));
    case "mul":
      return plain(op, a!.times(b!));
    case "div":
      if (b!.isZero()) {
        throw new CalcError("DIVISION_BY_ZERO", "Pembagian dengan nol ditolak.");
      }
      return plain(op, a!.div(b!));
    case "pow": {
      if (!b!.isInteger()) {
        throw new CalcError("INVALID_REQUEST", "Eksponen pangkat harus bilangan bulat.");
      }
      if (b!.abs().greaterThan(CALC_LIMITS.maxExponent)) {
        throw new CalcError("NONFINITE", "Eksponen pangkat di luar batas.");
      }
      return plain(op, a!.pow(b!));
    }
    case "mod":
      if (b!.isZero()) {
        throw new CalcError("DIVISION_BY_ZERO", "Modulo dengan nol ditolak.");
      }
      return plain(op, a!.mod(b!));
    case "sqrt":
      if (a!.isNegative()) {
        throw new CalcError("INVALID_OPERAND", "Akar kuadrat bilangan negatif tidak real.");
      }
      return plain(op, a!.sqrt());
    case "abs":
      return plain(op, a!.abs());
    case "round": {
      const precision = request.precision;
      if (precision === undefined || !Number.isInteger(precision) || precision < 0 || precision > 20) {
        throw new CalcError("INVALID_REQUEST", "`precision` wajib bilangan bulat 0–20 untuk round.");
      }
      const rounding = request.rounding ?? "half-up";
      const mode = ROUNDING[rounding];
      if (mode === undefined) {
        throw new CalcError("INVALID_REQUEST", `Mode pembulatan "${String(rounding)}" tidak dikenal.`);
      }
      const value = a!.toDecimalPlaces(precision, mode);
      return {
        value: value.toFixed(),
        op,
        rule: `round(${precision}, ${rounding})`,
        rounded: !value.equals(a!),
      };
    }
    case "compare": {
      const cmp = a!.comparedTo(b!);
      return {
        value: cmp === 0 ? "0" : cmp > 0 ? "1" : "-1",
        op,
        rule: "compare: -1 = lebih kecil, 0 = sama, 1 = lebih besar",
        rounded: false,
      };
    }
  }
}

/** Normalisasi keluaran: `0.1+0.2` harus `0.3`, bukan `0.30000000000000004`. */
function plain(op: CalcOp, value: Decimal): CalcResult {
  if (!value.isFinite()) {
    throw new CalcError("NONFINITE", "Hasil bukan bilangan hingga.");
  }
  return { value: value.toFixed(), op, rule: "aritmetika desimal eksak (decimal.js)", rounded: false };
}

// ---------------------------------------------------------------------------
// Statistik
// ---------------------------------------------------------------------------

export type StatsRequest = {
  values: (number | null)[];
  /** `sample` (n-1) atau `population` (n). Default `sample`. */
  kind?: "sample" | "population";
  unit?: string | null;
};

export type StatsResult = {
  n: number;
  missing: number;
  kind: "sample" | "population";
  unit: string | null;
  mean: number | null;
  median: number | null;
  /** Standar deviasi; `null` bila n terlalu kecil untuk jenis yang diminta. */
  stdDev: number | null;
  min: number | null;
  max: number | null;
  /** Definisi metode yang dipakai — wajib ikut supaya angka bisa ditafsirkan. */
  method: string;
};

/**
 * Statistik deskriptif. `null`/non-finite dihitung sebagai data hilang dan
 * dilaporkan di `missing`, bukan dibuang diam-diam.
 */
export function describe(request: StatsRequest): StatsResult {
  const kind = request.kind ?? "sample";
  if (kind !== "sample" && kind !== "population") {
    throw new CalcError("INVALID_REQUEST", `Jenis statistik "${String(kind)}" tidak dikenal.`);
  }
  const raw = request.values;
  if (!Array.isArray(raw)) {
    throw new CalcError("INVALID_REQUEST", "`values` harus array.");
  }
  const present = raw.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const missing = raw.length - present.length;
  const n = present.length;

  const sorted = [...present].sort((x, y) => x - y);
  const mean = n === 0 ? null : present.reduce((sum, v) => sum + v, 0) / n;
  const median =
    n === 0
      ? null
      : n % 2 === 1
        ? sorted[(n - 1) / 2]!
        : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;

  const divisor = kind === "sample" ? n - 1 : n;
  const stdDev =
    mean === null || divisor <= 0
      ? null
      : Math.sqrt(present.reduce((sum, v) => sum + (v - mean) ** 2, 0) / divisor);

  return {
    n,
    missing,
    kind,
    unit: request.unit ?? null,
    mean,
    median,
    stdDev,
    min: n === 0 ? null : sorted[0]!,
    max: n === 0 ? null : sorted[n - 1]!,
    method:
      kind === "sample"
        ? "standar deviasi sampel (pembagi n-1); data hilang tidak diimputasi"
        : "standar deviasi populasi (pembagi n); data hilang tidak diimputasi",
  };
}

// ---------------------------------------------------------------------------
// Hitung teks
// ---------------------------------------------------------------------------

export type TextCount = {
  /** Segmen kata menurut `Intl.Segmenter` — definisi, bukan tebakan. */
  words: number;
  characters: number;
  /** Code point (bukan unit UTF-16). */
  codePoints: number;
  bytes: number;
  graphemes: number;
  locale: string;
  method: string;
};

/**
 * Empat angka "jumlah karakter" yang berbeda dan sering dicampur:
 * `characters` = unit UTF-16 (`String.length`), `codePoints`, `graphemes`
 * (yang dilihat pembaca), dan `bytes` UTF-8.
 */
export function countText(text: string, locale = "id"): TextCount {
  if (typeof text !== "string") {
    throw new CalcError("INVALID_REQUEST", "`text` harus string.");
  }
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  let words = 0;
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) words++;
  }
  const graphemes = [...new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(text)].length;

  return {
    words,
    characters: text.length,
    codePoints: [...text].length,
    bytes: Buffer.byteLength(text, "utf8"),
    graphemes,
    locale,
    method: `Intl.Segmenter(${locale}) word-like segments; characters = unit UTF-16`,
  };
}
