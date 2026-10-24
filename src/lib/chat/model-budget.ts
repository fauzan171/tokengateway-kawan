/**
 * FIX-05 butir 2: budget per model.
 *
 * Sebelum ini seluruh model memakai satu konstanta `CONTEXT_BUDGET_TOKENS`
 * (30k). Model besar punya jendela konteks jauh lebih lebar, dan model kecil
 * ada yang lebih sempit; satu angka untuk semuanya berarti model besar dipangkas
 * sia-sia sementara model kecil bisa melewati batasnya.
 *
 * Sumber angka, berurutan menurut kekuatan:
 *   1. `context_length`/`context_window` yang diumumkan gateway pada daftar
 *      model — angka sebenarnya dari penyedia.
 *   2. Tabel bawaan untuk keluarga model yang dikenal.
 *   3. Ceiling konservatif `UNKNOWN_MODEL_BUDGET_TOKENS` bila model tidak
 *      dikenal, dengan label `budgetSource: "assumed"` supaya pemanggil bisa
 *      memberi tahu pengguna bahwa angkanya perkiraan.
 *
 * Tidak ada angka di modul ini yang diklaim sebagai token sebenarnya kecuali
 * yang datang dari gateway (`source: "gateway"`).
 */

export type BudgetSource = "gateway" | "known-family" | "assumed";

export type ModelBudget = {
  /** Jendela konteks model, dalam token. */
  contextTokens: number;
  /** Token yang disisihkan untuk output; sisanya milik prompt. */
  reserveTokens: number;
  budgetSource: BudgetSource;
};

/** Dipakai saat model tidak dikenal sama sekali. Sengaja kecil. */
export const UNKNOWN_MODEL_BUDGET_TOKENS = 8_192;

/** Bagian jendela konteks yang disisihkan untuk output. */
const RESERVE_RATIO = 0.25;

/**
 * Jendela konteks per keluarga model yang dikenal. Kunci dicocokkan sebagai
 * awalan id model (case-insensitive), dari yang paling spesifik ke paling umum.
 * Angka diambil dari dokumentasi publik penyedia; nilai yang berubah drastis
 * tidak diperbarui otomatis — kesalahan di sini hanya membuat budget lebih
 * konservatif, tidak membuat permintaan gagal.
 */
const KNOWN_FAMILIES: ReadonlyArray<readonly [prefix: string, contextTokens: number]> = [
  ["gpt-4o", 128_000],
  ["gpt-4-turbo", 128_000],
  ["gpt-4", 8_192],
  ["gpt-3.5", 16_385],
  ["o1", 200_000],
  ["o3", 200_000],
  ["claude", 200_000],
  ["gemini-1.5", 1_000_000],
  ["gemini-2", 1_000_000],
  ["llama-3", 128_000],
  ["qwen", 32_768],
  ["deepseek", 64_000],
  ["mistral", 32_768],
];

function fromGateway(entry: unknown): number | null {
  if (entry === null || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  for (const key of ["context_length", "context_window", "contextWindow", "max_context_tokens"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }
  return null;
}

function fromFamily(modelId: string): number | null {
  const lowered = modelId.toLowerCase();
  for (const [prefix, tokens] of KNOWN_FAMILIES) {
    if (lowered.startsWith(prefix)) return tokens;
  }
  return null;
}

/**
 * Menentukan budget konteks untuk satu model.
 *
 * `gatewayEntry` adalah entri mentah dari daftar model gateway (opsional). Bila
 * gateway mengumumkan jendela konteks, angka itulah yang dipakai.
 */
export function modelBudget(input: {
  modelId: string;
  gatewayEntry?: unknown;
  /** True bila entri berasal dari tabel bawaan, bukan pengumuman gateway. */
  gatewayEntryIsFallback?: boolean;
}): ModelBudget {
  const announced = input.gatewayEntryIsFallback ? null : fromGateway(input.gatewayEntry);
  const contextTokens = announced ?? fromFamily(input.modelId) ?? UNKNOWN_MODEL_BUDGET_TOKENS;
  const budgetSource: BudgetSource =
    announced !== null ? "gateway" : fromFamily(input.modelId) !== null ? "known-family" : "assumed";

  return {
    contextTokens,
    // Model kecil pun butuh ruang output yang layak; pembulatan ke bawah dengan
    // lantai 1024 mencegah reserve jadi nol untuk jendela sangat sempit.
    reserveTokens: Math.max(1_024, Math.floor(contextTokens * RESERVE_RATIO)),
    budgetSource,
  };
}