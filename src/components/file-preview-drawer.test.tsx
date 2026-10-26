/**
 * @vitest-environment jsdom
 *
 * Panel kanan pratinjau berkas: markdown dirender, CSV jadi tabel, format
 * biner jatuh ke unduhan, dan berkas gagal memberi tahu tanpa merender apa
 * pun. Diuji lewat DOM dan `fetch` palsu — bukan snapshot.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FilePreviewDrawer, type PreviewTarget } from "./file-preview-drawer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

function target(overrides: Partial<PreviewTarget> = {}): PreviewTarget {
  return { artifactId: "a1", displayName: "laporan.md", format: "md", sizeBytes: 120, ...overrides };
}

function stubFetch(body: string, ok = true) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status: ok ? 200 : 500, text: async () => body }) as unknown as Response));
}

async function mount(t: PreviewTarget) {
  await act(async () => {
    root!.render(<FilePreviewDrawer target={t} open onOpenChange={() => {}} />);
  });
  // Satu putaran microtask untuk efek fetch.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FilePreviewDrawer", () => {
  it("merender markdown sebagai isi, bukan teks mentah", async () => {
    stubFetch("# Judul\n\nisi laporan");
    await mount(target());
    expect(document.querySelector("h1")?.textContent).toBe("Judul");
  });

  it("CSV jadi tabel dengan header", async () => {
    stubFetch("nama,nilai\na,1\nb,2");
    await mount(target({ displayName: "data.csv", format: "csv" }));
    const headers = [...document.querySelectorAll("th")].map((th) => th.textContent);
    expect(headers).toEqual(["nama", "nilai"]);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("format biner menawarkan unduhan, tidak merender byte", async () => {
    stubFetch("");
    await mount(target({ displayName: "data.xlsx", format: "xlsx" }));
    const link = document.querySelector('a[download="data.xlsx"]');
    expect(link?.getAttribute("href")).toBe("/api/kawan/v1/artifacts/a1");
  });

  it("galat unduh diberitahukan, bukan layar kosong", async () => {
    stubFetch("", false);
    await mount(target());
    expect(document.body.textContent).toContain("Pratinjau tidak tersedia");
  });
});
