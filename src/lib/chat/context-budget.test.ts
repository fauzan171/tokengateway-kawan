import { describe, expect, it } from "vitest";
import { estimateTokens, overBudget } from "./context-budget";

describe("estimateTokens", () => {
  it("string kosong → 0 token", () => {
    expect(estimateTokens("")).toEqual({ tokens: 0, source: "estimated" });
  });

  it("pembulatan ke atas: 4 char → 1 token, 5 char → 2 token", () => {
    expect(estimateTokens("abcd").tokens).toBe(1);
    expect(estimateTokens("abcde").tokens).toBe(2);
  });
});

describe("overBudget", () => {
  it("false saat pas budget, true saat lewat 1 token", () => {
    expect(overBudget({ promptTokens: 3, reserveTokens: 2, budgetTokens: 5 })).toBe(false);
    expect(overBudget({ promptTokens: 4, reserveTokens: 2, budgetTokens: 5 })).toBe(true);
  });

  it("reserve ikut dihitung: prompt kecil + reserve besar → over", () => {
    expect(overBudget({ promptTokens: 1, reserveTokens: 100, budgetTokens: 50 })).toBe(true);
  });
});
