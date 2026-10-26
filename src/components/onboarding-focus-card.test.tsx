/**
 * @vitest-environment jsdom
 *
 * WO-F1 / SDD §D4 — kartu fokus onboarding. Komponen controlled penuh, jadi
 * yang diuji hanya perilaku tampilan dan pemanggilan `onChange`; tanpa fetch,
 * tanpa penyimpanan.
 *
 * Pola mount mengikuti `task-view.test.tsx` (createRoot + act) karena proyek
 * belum memakai @testing-library.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { OnboardingFocusCard } from "./onboarding-focus-card";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

async function mount(value = "", compact = false): Promise<ReturnType<typeof vi.fn>> {
  const onChange = vi.fn();
  await act(async () => {
    root = createRoot(container);
    root.render(<OnboardingFocusCard value={value} onChange={onChange} compact={compact} />);
  });
  return onChange;
}

/** Pilih radio berdasarkan teks labelnya. */
async function choose(label: string): Promise<void> {
  const found = [...container.querySelectorAll<HTMLLabelElement>("label")].find(
    (item) => item.textContent?.includes(label),
  );
  const radio = found?.querySelector("input");
  if (!radio) throw new Error(`radio "${label}" tidak ditemukan`);
  await act(async () => {
    radio.click();
  });
}

async function rerender(value: string): Promise<void> {
  await act(async () => {
    root!.render(<OnboardingFocusCard value={value} onChange={vi.fn()} />);
  });
}

async function save(): Promise<void> {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === "Simpan",
  )!;
  await act(async () => {
    button.click();
  });
}

/** Ketik ke input teks (satu-satunya input non-radio saat "Lainnya" dipilih). */
async function type(text: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setValue.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("OnboardingFocusCard", () => {
  it("pilih Riset lalu Simpan → onChange('riset') sekali", async () => {
    const onChange = await mount();
    await choose("Riset");
    await save();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("riset");
  });

  it("pilih Lainnya → input muncul; ketik lalu Simpan → onChange('custom:…')", async () => {
    const onChange = await mount();
    expect(container.querySelector('input[type="text"]')).toBeNull();
    await choose("Lainnya");
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    await type("ojek online");
    await save();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("custom:ojek online");
  });

  it("custom kosong → Simpan tidak memanggil onChange", async () => {
    const onChange = await mount();
    await choose("Lainnya");
    await save();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("compact → opsi satu kolom penuh (mobile)", async () => {
    await mount("", true);
    const wrapper = container.querySelector('[data-testid="onboarding-options"]')!;
    expect(wrapper.getAttribute("data-compact")).toBe("true");
  });

  it("value='riset' → radio Riset ter-centang", async () => {
    await mount("riset");
    const checked = container.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    expect(checked?.value).toBe("riset");
  });

  it("value='custom:x' → input custom muncul berisi x", async () => {
    await mount("custom:x");
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    expect(input?.value).toBe("x");
    const checked = container.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    expect(checked?.value).toBe("custom");
  });

  it("prop value berubah setelah mount → tampilan ikut berubah (controlled)", async () => {
    await mount("");
    expect(container.querySelector('input[type="radio"]:checked')).toBeNull();
    await rerender("custom:x");
    expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe("x");
    await rerender("riset");
    expect(container.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value).toBe(
      "riset",
    );
  });
});