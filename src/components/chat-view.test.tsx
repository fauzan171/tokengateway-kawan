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

describe("preferensi Enter (UX-10)", () => {
  it("sendOnEnter=false: Enter membuat baris baru, Shift+Enter mengirim", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/settings") return json({ settings: { sendOnEnter: false } });
      if (url === "/api/kawan/v1/models") return json({ models: [] });
      if (url === "/api/kawan/v1/capabilities") return json(NONE);
      return json({}, 404);
    });
    await mount();

    const textarea = container.querySelector("textarea")!;
    expect(textarea.getAttribute("placeholder")).toContain("Shift+Enter untuk kirim");

    // Isi draf lewat setter native supaya state React ikut berubah.
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(textarea, "halo");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    let sent = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/chat") {
        sent += 1;
        return json({ chat: { id: "c1" } });
      }
      return json({}, 404);
    });

    await act(async () => {
      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(sent).toBe(0);

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(sent).toBe(1);
  });
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

/**
 * FIX-03 — idempotensi kiriman. Dua klik sebelum balasan server tiba tidak
 * boleh menghasilkan dua job: satu action ID, satu permintaan POST.
 */
describe("UX-1: skeleton pemuatan chat", () => {
  it("fetch chat tertunda → skeleton tampil, bukan judul kosong", async () => {
    let release: (() => void) | null = null;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/kawan/v1/models") return json({ models: [] });
      if (url === "/api/kawan/v1/capabilities") return json(NONE);
      if (url === "/api/kawan/v1/documents") return json({ documents: [] });
      if (url === "/api/kawan/v1/chat/chat_1") {
        await new Promise<void>((resolve) => { release = resolve; });
        return json({ chat: { id: "chat_1" }, messages: [] });
      }
      return json({}, 404);
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(<ChatView initialChatId="chat_1" />);
    });
    await act(async () => {});
    expect(container.querySelector('[data-testid="chat-loading-skeleton"]')).not.toBeNull();
    act(() => release?.());
    await act(async () => {});
    expect(container.querySelector('[data-testid="chat-loading-skeleton"]')).toBeNull();
  });
});

describe("idempotensi kiriman (FIX-03)", () => {
  function typeInto(textarea: HTMLTextAreaElement, text: string) {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(textarea, text);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("dua klik cepat → satu POST pesan, satu Idempotency-Key", async () => {
    stub({ caps: NONE });
    await mount();

    const posts: { url: string; key: string | null }[] = [];
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/kawan/v1/chat" && init?.method === "POST") {
        return json({ id: "c1" });
      }
      if (url === "/api/kawan/v1/chat/c1/messages") {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        posts.push({ url, key: headers["Idempotency-Key"] ?? null });
        // Tahan balasan supaya klik kedua jatuh sebelum `isStreaming` menyala.
        await new Promise((r) => setTimeout(r, 20));
        return json({ generationId: "g1", assistantMessageId: "a1", userMessageId: "u1" });
      }
      if (url.startsWith("/api/kawan/v1/chat/c1/stream")) {
        return { ok: false, status: 500, body: null } as unknown as Response;
      }
      if (url.startsWith("/api/kawan/v1/chat/")) return json({ messages: [] });
      return json({}, 404);
    });

    const textarea = container.querySelector("textarea")!;
    typeInto(textarea, "halo");

    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(posts.length).toBe(1);
    expect(posts[0].key).toBeTruthy();
  });
});
