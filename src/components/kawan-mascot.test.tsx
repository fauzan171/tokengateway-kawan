/**
 * @vitest-environment jsdom
 *
 * UX-1 — maskot Kawan: tiga mood dirender sebagai SVG terpisah dengan
 * data-testid sesuai mood, ukuran mengikuti prop, dan tetap aria-hidden.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { KawanMascot } from "./kawan-mascot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(props: { mood?: "idle" | "thinking" | "sad"; size?: number }): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(<KawanMascot {...props} />);
  });
  return container;
}

describe("KawanMascot", () => {
  it.each(["idle", "thinking", "sad"] as const)("mood %s dirender", (mood) => {
    const container = render({ mood });
    expect(container.querySelector(`[data-testid="mascot-${mood}"]`)).not.toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    container.remove();
  });

  it("ukuran mengikuti prop size", () => {
    const container = render({ size: 40 });
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("40");
    container.remove();
  });
});
