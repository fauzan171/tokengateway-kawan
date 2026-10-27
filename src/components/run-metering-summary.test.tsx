/**
 * @vitest-environment jsdom
 *
 * SDD-FRONTEND §D6 — ringkasan metering run. Komponen murni tampil; tanpa
 * fetch, jadi tidak ada stub global.
 */

import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RunMeteringSummary, type RunMetering } from "./run-metering-summary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(metering?: RunMetering | null): { root: Root; container: HTMLDivElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<RunMeteringSummary metering={metering} />));
  return { root, container };
}

const full: RunMetering = {
  usage: { reported: true, promptTokens: 1200, completionTokens: 340, totalTokens: 1540 },
  consumed: { promptTokens: 1200, completionTokens: 340, totalTokens: 1540, searches: 2, reads: 5, toolCalls: 7 },
  sourcesRead: 5,
};

describe("RunMeteringSummary", () => {
  it("reported=true → angka id-ID dan sumber, tanpa catatan estimasi", () => {
    const { root, container } = render(full);
    expect(container.textContent).toContain("1.200");
    expect(container.textContent).toContain("5 sumber dibaca");
    expect(container.textContent).not.toContain("Angka estimasi");
    act(() => root.unmount());
  });

  it("sourcesRead 0 (run non-riset) → segmen sumber tidak dirender", () => {
    const { root, container } = render({ ...full, sourcesRead: 0 });
    expect(container.textContent).not.toContain("sumber dibaca");
    act(() => root.unmount());
  });

  it("reported=false → catatan estimasi tampil", () => {
    const { root, container } = render({ ...full, usage: { ...full.usage, reported: false } });
    expect(container.textContent).toContain("Angka estimasi, bukan tagihan.");
    act(() => root.unmount());
  });

  it("angka null → 'tidak dilaporkan', bukan 0", () => {
    const { root, container } = render({
      ...full,
      usage: { reported: false, promptTokens: null, completionTokens: null, totalTokens: null },
    });
    expect(container.textContent).toContain("tidak dilaporkan");
    // `Intl.NumberFormat.format(null)` = "0" — itu klaim pemakaian nol.
    expect(container.textContent).not.toContain("0 token");
    // Frasa tak dilaporkan tidak boleh disisipkan ke "{n} token masuk".
    expect(container.textContent).not.toContain("tidak dilaporkan token");
    act(() => root.unmount());
  });

  it("metering null → return null (run pra-D6)", () => {
    const { root, container } = render(null);
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });

  it("metering undefined → return null", () => {
    const { root, container } = render(undefined);
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });

  it("1200 diformat id-ID menjadi 1.200, bukan 1,200", () => {
    const { root, container } = render(full);
    expect(container.textContent).toContain("1.200");
    expect(container.textContent).not.toContain("1,200");
    act(() => root.unmount());
  });

  it("tidak pernah menampilkan klaim biaya", () => {
    const { root, container } = render(full);
    expect(container.textContent).not.toMatch(/Rp|biaya|USD|\$|cost/i);
    act(() => root.unmount());
  });
});