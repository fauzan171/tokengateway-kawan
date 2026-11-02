/**
 * @vitest-environment jsdom
 *
 * DESIGN.md §6 — maskot Kawan: engine SVG prosedural 6 agen x 8 state.
 * Cek: testid mascot-{agent}-{state}, ukuran prop, aria-hidden, fallback
 * agent asing ke default, pose statis saat animated=false.
 */

import { describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { KawanMascot, AGENT_ROSTER } from "./kawan-mascot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(props: { agent?: string; state?: string; size?: number; animated?: boolean }): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- props dinamis uji
    createRoot(container).render(<KawanMascot {...(props as any)} />);
  });
  return container;
}

const STATES = ["idle", "listening", "thinking", "speaking", "happy", "error", "sleepy", "alert"] as const;

describe("KawanMascot", () => {
  it.each(STATES)("state %s dirender", (state) => {
    const container = render({ state });
    expect(container.querySelector(`[data-testid="mascot-default-${state}"]`)).not.toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    container.remove();
  });

  it.each(AGENT_ROSTER)("agent %s punya testid sendiri", (a) => {
    const container = render({ agent: a.id, state: "idle" });
    expect(container.querySelector(`[data-testid="mascot-${a.id}-idle"]`)).not.toBeNull();
    container.remove();
  });

  it("agent asing jatuh ke default", () => {
    const container = render({ agent: "tidak-ada", state: "idle" });
    expect(container.querySelector('[data-testid="mascot-default-idle"]')).not.toBeNull();
    container.remove();
  });

  it("ukuran mengikuti prop size", () => {
    const container = render({ size: 40 });
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("40");
    container.remove();
  });

  it("animated=false tidak memasang class animasi", () => {
    const container = render({ state: "thinking", animated: false });
    expect(container.querySelector("svg")?.className.baseVal).not.toContain("kawan-mascot-bob");
    container.remove();
  });
});
