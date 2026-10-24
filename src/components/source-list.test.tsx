/**
 * @vitest-environment jsdom
 *
 * WP-NT-P7-02 — daftar sumber web (REQ-NT-52).
 */

import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SourceList } from "./source-list";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(sources: { title: string; url: string }[]): { root: Root; container: HTMLDivElement } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<SourceList sources={sources} />));
  return { root, container };
}

describe("SourceList", () => {
  it("tidak merender apa pun untuk daftar kosong", () => {
    const { root, container } = render([]);
    expect(container.innerHTML).toBe("");
    act(() => root.unmount());
  });

  it("merender tautan tab baru tanpa opener", () => {
    const { root, container } = render([{ title: "Contoh", url: "https://contoh.test/a" }]);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://contoh.test/a");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.textContent).toBe("Contoh");
    act(() => root.unmount());
  });

  it("memakai url sebagai teks bila judul kosong", () => {
    const { root, container } = render([{ title: "", url: "https://contoh.test/b" }]);
    expect(container.querySelector("a")?.textContent).toBe("https://contoh.test/b");
    act(() => root.unmount());
  });
});
