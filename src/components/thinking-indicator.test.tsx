/**
 * @vitest-environment jsdom
 *
 * Indikator proses: fase nyata dari server dirender sebagai timeline, dan
 * fase "membaca" menampilkan host sumber yang sedang dibuka (bukan animasi
 * tanpa isi). Diuji di DOM, bukan snapshot.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PhaseTimeline, ThinkingDots } from "./thinking-indicator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

describe("PhaseTimeline", () => {
  it("menampilkan host sumber pada fase membaca", () => {
    act(() =>
      root!.render(
        <PhaseTimeline
          active
          phases={[
            { phase: "searching", label: "Mencari di web" },
            {
              phase: "reading",
              label: "Membaca 2 halaman sumber",
              urls: ["https://www.github.com/a/b", "https://example.com/doc"],
            },
          ]}
        />,
      ),
    );
    const items = [...container.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(items.join(" ")).toContain("github.com");
    expect(items.join(" ")).toContain("example.com");
    // Fase lama tetap terlihat sebagai riwayat.
    expect(items.join(" ")).toContain("Mencari di web");
  });

  it("ThinkingDots mengumumkan label ke pembaca layar", () => {
    act(() => root!.render(<ThinkingDots label="Menulis jawaban" />));
    expect(container.textContent).toContain("Menulis jawaban");
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
