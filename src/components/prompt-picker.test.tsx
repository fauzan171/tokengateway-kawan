/**
 * @vitest-environment jsdom
 *
 * WP-NT-P7-04 — pemilih prompt. `fetch` di-stub; yang diuji hanya perilaku
 * tampilan dan pemanggilan endpoint.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PromptPicker } from "./prompt-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Prompt = {
  id: string;
  title: string;
  body: string;
  variables: string[];
  isDefault: boolean;
  enabled: boolean;
};

function prompt(overrides: Partial<Prompt>): Prompt {
  return {
    id: "prompt_1",
    title: "Ringkas",
    body: "Ringkas {{isi}}",
    variables: ["isi"],
    isDefault: false,
    enabled: true,
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

let root: Root | null = null;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;
let applied: string[];

async function mount(prompts: Prompt[]): Promise<void> {
  fetchMock.mockResolvedValueOnce(json({ prompts }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<PromptPicker onApply={(body) => applied.push(body)} />);
  });
  const toggle = [...container.querySelectorAll("button")].find((b) => b.textContent === "Prompt");
  await act(async () => toggle!.click());
}

beforeEach(() => {
  applied = [];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
  vi.unstubAllGlobals();
});

describe("PromptPicker", () => {
  it("merender daftar dari respons GET", async () => {
    await mount([prompt({ id: "a", title: "Ringkas" }), prompt({ id: "b", title: "Terjemah" })]);

    expect(fetchMock).toHaveBeenCalledWith("/api/kawan/v1/prompts");
    expect(container.textContent).toContain("Ringkas");
    expect(container.textContent).toContain("Terjemah");
  });

  it("klik prompt memanggil onApply dengan body", async () => {
    await mount([prompt({ title: "Ringkas", body: "Ringkas {{isi}}" })]);

    const item = [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Ringkas"));
    await act(async () => item!.click());

    expect(applied).toEqual(["Ringkas {{isi}}"]);
  });

  it("Escape menutup popup dan fokus kembali ke pemicu (UX-07)", async () => {
    await mount([prompt({ title: "Ringkas" })]);

    const trigger = [...container.querySelectorAll("button")].find((b) => b.textContent === "Prompt")!;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector("textarea")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("prompt bawaan tidak punya tombol hapus", async () => {
    await mount([
      prompt({ id: "bawaan", title: "Bawaan", isDefault: true }),
      prompt({ id: "pribadi", title: "Pribadi", isDefault: false }),
    ]);

    expect(container.querySelector('button[aria-label="Hapus prompt Bawaan"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Hapus prompt Pribadi"]')).not.toBeNull();
  });
});
