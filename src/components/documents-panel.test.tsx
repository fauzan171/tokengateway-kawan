/**
 * @vitest-environment jsdom
 *
 * WP-NT-P6-10 — panel dokumen. `fetch` di-stub; yang diuji hanya perilaku
 * tampilan dan pemanggilan endpoint, bukan server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DocumentsPanel } from "./documents-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Doc = {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  createdAt: string;
};

function doc(overrides: Partial<Doc>): Doc {
  return {
    id: "doc_1",
    filename: "laporan.pdf",
    mime: "application/pdf",
    sizeBytes: 2048,
    status: "ready",
    errorCode: null,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

let root: Root | null = null;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

async function mount(documents: Doc[]): Promise<void> {
  fetchMock.mockResolvedValueOnce(json({ documents }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<DocumentsPanel />);
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
  vi.unstubAllGlobals();
});

describe("DocumentsPanel", () => {
  it("menampilkan keempat status dengan label Indonesia", async () => {
    await mount([
      doc({ id: "a", filename: "menunggu.pdf", status: "queued" }),
      doc({ id: "b", filename: "memproses.pdf", status: "processing" }),
      doc({ id: "c", filename: "siap.pdf", status: "ready" }),
      doc({ id: "d", filename: "gagal.pdf", status: "failed", errorCode: "EXTRACT_EMPTY" }),
    ]);

    const text = container.textContent ?? "";
    for (const label of ["Menunggu", "Memproses", "Siap", "Gagal"]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("siap.pdf");
    expect(text).toContain("2 KB");
  });

  it("status gagal menampilkan sebab dan tombol Coba lagi", async () => {
    await mount([doc({ id: "d", filename: "gagal.pdf", status: "failed", errorCode: "EXTRACT_EMPTY" })]);

    expect(container.textContent).toContain("EXTRACT_EMPTY");
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Coba lagi");
    expect(retry).toBeTruthy();

    fetchMock.mockResolvedValueOnce(json({ documentId: "d", status: "queued" }));
    await act(async () => retry!.click());
    expect(fetchMock).toHaveBeenLastCalledWith("/api/kawan/v1/documents/d/retry", { method: "POST" });
    expect(container.textContent).toContain("Menunggu");
  });

  it("status siap tidak menampilkan tombol Coba lagi", async () => {
    await mount([doc({ id: "c", filename: "siap.pdf", status: "ready" })]);

    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Coba lagi");
    expect(retry).toBeUndefined();
  });

  it("klik hapus memanggil DELETE lalu baris hilang dari daftar", async () => {
    await mount([doc({ id: "c", filename: "siap.pdf", status: "ready" })]);

    fetchMock.mockResolvedValueOnce(json({ documentId: "c", removed: true }));
    const remove = container.querySelector('button[aria-label="Hapus siap.pdf"]') as HTMLButtonElement;
    expect(remove).toBeTruthy();
    await act(async () => remove.click());

    expect(fetchMock).toHaveBeenLastCalledWith("/api/kawan/v1/documents/c", { method: "DELETE" });
    expect(container.textContent).not.toContain("siap.pdf");
  });
});
