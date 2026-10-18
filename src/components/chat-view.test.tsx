/**
 * @vitest-environment jsdom
 *
 * WP-NT-P8-05 — matriks kapabilitas. Yang diuji: tombol mana yang muncul di
 * DOM untuk tiap jawaban `GET /capabilities` dan `GET /models`. Tidak ada
 * tombol "mati": yang tidak diumumkan tidak dirender sama sekali (REQ-NT-69).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ChatView } from "./chat-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Caps = { webSearch: boolean; imageGen: boolean; stt: boolean; tts: boolean };

const NONE: Caps = { webSearch: false, imageGen: false, stt: false, tts: false };

let root: Root | null = null;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

/** `fetch` dijawab per URL; endpoint tak dikenal → 404. */
function stub(handlers: { models?: unknown; caps?: Caps | number }) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/kawan/v1/models") {
      return json(handlers.models ?? { models: [{ id: "deepseek-v4.1-flash" }] });
    }
    if (url === "/api/kawan/v1/capabilities") {
      if (handlers.caps === undefined) return json(NONE);
      if (typeof handlers.caps === "number") return json({}, handlers.caps);
      return json(handlers.caps);
    }
    if (url === "/api/kawan/v1/documents") return json({ documents: [] });
    return json({}, 404);
  });
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<ChatView />);
  });
  // Beri kesempatan efek fetch selesai.
  await act(async () => {});
}

function has(label: string): boolean {
  return container.querySelector(`[aria-label="${label}"]`) !== null;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom tidak punya scrollIntoView; efek gulir tidak relevan untuk uji ini.
  Element.prototype.scrollIntoView = () => {};
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
  vi.unstubAllGlobals();
});

describe("matriks kapabilitas ChatView", () => {
  it("semua kapabilitas false → tidak ada tombol media mana pun", async () => {
    stub({ caps: NONE });
    await mount();

    for (const label of [
      "Lampirkan gambar",
      "Pencarian web",
      "Buat gambar",
      "Transkripsi audio",
      "Bacakan jawaban",
    ]) {
      expect(container.querySelector(`[aria-label="${label}"]`)).toBeNull();
    }
    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("vision: true → tombol lampiran gambar muncul", async () => {
    stub({
      caps: NONE,
      models: { models: [{ id: "deepseek-v4.1-flash", capabilities: { vision: true } }] },
    });
    await mount();
    expect(has("Lampirkan gambar")).toBe(true);
    expect(has("Buat gambar")).toBe(false);
  });

  it("imageGen: true → tombol gambar muncul", async () => {
    stub({ caps: { ...NONE, imageGen: true } });
    await mount();
    expect(has("Buat gambar")).toBe(true);
    expect(has("Transkripsi audio")).toBe(false);
    expect(has("Bacakan jawaban")).toBe(false);
  });

  it("stt + tts: true → tombol keduanya muncul", async () => {
    stub({ caps: { ...NONE, stt: true, tts: true } });
    await mount();
    expect(has("Transkripsi audio")).toBe(true);
    expect(has("Bacakan jawaban")).toBe(true);
    expect(has("Buat gambar")).toBe(false);
  });

  it("capabilities gagal (500) → tidak ada tombol media, composer tetap ada", async () => {
    stub({ caps: 500 });
    await mount();

    for (const label of ["Buat gambar", "Transkripsi audio", "Bacakan jawaban", "Pencarian web"]) {
      expect(container.querySelector(`[aria-label="${label}"]`)).toBeNull();
    }
    expect(container.querySelector("textarea")).not.toBeNull();
  });
});
