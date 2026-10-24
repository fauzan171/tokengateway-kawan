import { describe, expect, it } from "vitest";
import { UNKNOWN_MODEL_BUDGET_TOKENS, modelBudget } from "./model-budget";

describe("modelBudget (FIX-05 butir 2)", () => {
  it("memakai jendela konteks yang diumumkan gateway, reserve 25%", () => {
    const budget = modelBudget({
      modelId: "entah-apa",
      gatewayEntry: { id: "entah-apa", context_length: 64_000 },
    });
    expect(budget.contextTokens).toBe(64_000);
    expect(budget.reserveTokens).toBe(16_000);
    expect(budget.budgetSource).toBe("gateway");
  });

  it("jatuh ke tabel keluarga model saat gateway tidak mengumumkan", () => {
    const budget = modelBudget({ modelId: "gpt-4o-mini" });
    expect(budget.contextTokens).toBe(128_000);
    expect(budget.reserveTokens).toBe(32_000);
    expect(budget.budgetSource).toBe("known-family");
  });

  it("model tak dikenal → ceiling konservatif berlabel assumed", () => {
    const budget = modelBudget({ modelId: "model-misterius-v9" });
    expect(budget.contextTokens).toBe(UNKNOWN_MODEL_BUDGET_TOKENS);
    expect(budget.reserveTokens).toBe(2_048);
    expect(budget.budgetSource).toBe("assumed");
  });

  it("entri gateway yang ditandai fallback tidak dipercaya sebagai angka sebenarnya", () => {
    const budget = modelBudget({
      modelId: "model-misterius-v9",
      gatewayEntry: { id: "model-misterius-v9", context_length: 999_999 },
      gatewayEntryIsFallback: true,
    });
    expect(budget.budgetSource).toBe("assumed");
    expect(budget.contextTokens).toBe(UNKNOWN_MODEL_BUDGET_TOKENS);
  });
});