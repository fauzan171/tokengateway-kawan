/**
 * @vitest-environment jsdom
 *
 * REQ-NT-71 — `reported: false` harus tampil sebagai "tidak tersedia", bukan
 * deretan nol. `fetch` di-stub; hanya perilaku tampilan yang diuji.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UsageReport } from "./usage-report";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

let root: Root | null = null;
let container: HTMLElement;

function stubFetch(byGroup: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => json(byGroup[url.includes("groupBy=model") ? "model" : "day"])),
  );
}

async function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<UsageReport />);
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
});

describe("UsageReport", () => {
  it("reported=false → teks tidak tersedia, tanpa angka 0", async () => {
    stubFetch({ day: { reported: false, rows: [] }, model: { reported: false, rows: [] } });
    await render();

    expect(container.textContent).toContain(
      "Pemakaian tidak tersedia: gateway tidak melaporkan jumlah token.",
    );
    expect(container.querySelectorAll("table")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it("reported=true dengan baris → angka tampil", async () => {
    const rows = [{ day: "2026-01-02", promptTokens: 10, completionTokens: 20, totalTokens: 30, unreported: 0 }];
    stubFetch({ day: { reported: true, rows }, model: { reported: true, rows: [] } });
    await render();

    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.textContent).toContain("2026-01-02");
    expect(container.textContent).toContain("30");
    expect(container.textContent).toContain("Belum ada pemakaian pada rentang ini.");
  });

  it("tidak menampilkan klaim biaya", async () => {
    stubFetch({ day: { reported: false, rows: [] }, model: { reported: false, rows: [] } });
    await render();

    expect(container.textContent).not.toMatch(/Rp|harga|biaya|saldo|USD|\$/i);
  });
});
