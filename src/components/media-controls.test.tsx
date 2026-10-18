/**
 * @vitest-environment jsdom
 *
 * WP-NT-P8-01/03/04 — kontrol media. Yang diuji: hanya tombol yang punya
 * handler yang dirender, dan `busy` mematikan semuanya.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MediaControls } from "./media-controls";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

async function mount(node: React.ReactElement): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(node);
  });
}

function button(label: string): HTMLButtonElement | null {
  return container.querySelector(`button[aria-label="${label}"]`);
}

beforeEach(() => {
  vi.fn();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
});

describe("MediaControls", () => {
  it("tiga tombol ada saat ketiga handler diberikan", async () => {
    await mount(
      <MediaControls
        onImage={() => {}}
        onTranscribe={() => {}}
        onSpeak={() => {}}
        busy={false}
        prompt="kucing"
      />,
    );
    expect(button("Buat gambar")).not.toBeNull();
    expect(button("Transkripsi audio")).not.toBeNull();
    expect(button("Bacakan jawaban")).not.toBeNull();
  });

  it("hanya merender tombol yang handler-nya ada", async () => {
    await mount(<MediaControls onSpeak={() => {}} busy={false} />);
    expect(button("Buat gambar")).toBeNull();
    expect(button("Transkripsi audio")).toBeNull();
    expect(button("Bacakan jawaban")).not.toBeNull();
  });

  it("busy: true → semua tombol disabled", async () => {
    await mount(
      <MediaControls onImage={() => {}} onTranscribe={() => {}} onSpeak={() => {}} busy prompt="x" />,
    );
    for (const label of ["Buat gambar", "Transkripsi audio", "Bacakan jawaban"]) {
      expect((button(label) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("prompt kosong → tombol gambar disabled", async () => {
    await mount(<MediaControls onImage={() => {}} busy={false} prompt="   " />);
    expect((button("Buat gambar") as HTMLButtonElement).disabled).toBe(true);
  });

  it("klik tombol gambar memanggil onImage dengan prompt", async () => {
    const onImage = vi.fn();
    await mount(<MediaControls onImage={onImage} busy={false} prompt="kucing" />);
    await act(async () => button("Buat gambar")!.click());
    expect(onImage).toHaveBeenCalledWith("kucing");
  });

  it("pilih berkas audio memanggil onTranscribe dengan File", async () => {
    const onTranscribe = vi.fn();
    await mount(<MediaControls onTranscribe={onTranscribe} busy={false} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("audio/*");

    const file = new File(["abc"], "rekaman.webm", { type: "audio/webm" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onTranscribe).toHaveBeenCalledWith(file);
  });
});
