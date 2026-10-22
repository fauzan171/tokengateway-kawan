/** Tipe hasil estimasi token. SELALU estimasi, tidak pernah angka gateway. */
export type TokenEstimate = { tokens: number; source: "estimated" };

// 4 karakter = 1 token, dibulatkan ke atas: konservatif untuk bahasa Indonesia,
// bukan tokenizer sebenarnya.
export function estimateTokens(text: string): TokenEstimate {
  return { tokens: Math.ceil(text.length / 4), source: "estimated" };
}

/** `true` bila prompt + reserve output melewati budget. Semua nilai dalam token. */
export function overBudget(input: {
  promptTokens: number;
  reserveTokens: number;
  budgetTokens: number;
}): boolean {
  return input.promptTokens + input.reserveTokens > input.budgetTokens;
}
