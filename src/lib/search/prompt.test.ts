/**
 * WP-NT-P7-02 — penanda permintaan pencarian dan system prompt sumber.
 */

import { describe, expect, it } from "vitest";
import { buildSearchSystem, webSearchRequested } from "./prompt";

describe("webSearchRequested", () => {
  it("true bila ada bagian web-search", () => {
    const json = JSON.stringify({
      parts: [{ kind: "text", text: "halo" }, { kind: "web-search" }],
    });
    expect(webSearchRequested(json)).toBe(true);
  });

  it("false bila tidak ada bagian web-search", () => {
    expect(webSearchRequested(JSON.stringify({ parts: [{ kind: "text", text: "halo" }] }))).toBe(
      false,
    );
  });

  it("false untuk masukan rusak tanpa melempar", () => {
    expect(webSearchRequested(null)).toBe(false);
    expect(webSearchRequested(undefined)).toBe(false);
    expect(webSearchRequested("")).toBe(false);
    expect(webSearchRequested("bukan json")).toBe(false);
    expect(webSearchRequested("{}")).toBe(false);
    expect(webSearchRequested('{"parts":"x"}')).toBe(false);
  });
});

describe("buildSearchSystem", () => {
  it("undefined untuk hasil kosong", () => {
    expect(buildSearchSystem([])).toBeUndefined();
  });

  it("memberi nomor S dan menyertakan URL tanpa bertabrakan dengan [1]", () => {
    const system = buildSearchSystem([
      { title: "Satu", url: "https://a.test/1", snippet: "isi satu" },
      { title: "Dua", url: "https://b.test/2", snippet: "isi dua" },
    ]);
    expect(system).toBeDefined();
    expect(system).toContain("[S1] Satu — https://a.test/1");
    expect(system).toContain("[S2] Dua — https://b.test/2");
    expect(system).not.toContain("[1]");
    expect(system).toContain("isi satu");
  });

  it("memotong snippet panjang", () => {
    const system = buildSearchSystem([
      { title: "Panjang", url: "https://c.test/3", snippet: "x".repeat(1000) },
    ]);
    expect(system).toBeDefined();
    expect(system?.includes("x".repeat(300))).toBe(true);
    expect(system?.includes("x".repeat(301))).toBe(false);
  });
});
