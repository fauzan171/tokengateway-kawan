/**
 * Bridge engine: render task + overlay builder.
 */
import { describe, expect, it } from "vitest";
import { renderEngineTask } from "./harness-bridge";

describe("renderEngineTask", () => {
  it("renders system, history and user turn as labeled sections", () => {
    const out = renderEngineTask([
      { role: "system", content: "aturan utama" },
      { role: "user", content: "halo" },
      { role: "assistant", content: "hai juga" },
      { role: "user", content: "siapa kamu?" },
    ]);
    expect(out).toContain("# Instruksi sistem");
    expect(out).toContain("# Pengguna");
    expect(out).toContain("# Jawaban sebelumnya");
    expect(out).toContain("siapa kamu?");
  });

  it("flattens array content blocks to text", () => {
    const out = renderEngineTask([
      { role: "user", content: [{ type: "text", text: "lihat gambar" }, { type: "image_url", image_url: { url: "x" } }] },
    ]);
    expect(out).toContain("lihat gambar");
    expect(out).not.toContain("image_url");
  });
});
