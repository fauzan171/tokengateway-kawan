/**
 * Uji P8: katalog ToolDoc = satu sumber tiga pembaca.
 *
 * Kesesuaian 1:1 dengan registry (hanya tool terpasang; tidak ada yang
 * hilang/lebih), field wajib riset §5.3 (kapanDipakai 2..5, kapanJangan >= 2,
 * setiap kegagalan punya tindakanModel), dan docs/tools/<id>.md memuat
 * ringkas + kapanDipakai + kapanJangan + contoh + kegagalan.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_CATALOG, buildToolCatalogBlock, getToolDoc } from "./catalog";
import { listTools, requiresApproval } from "./registry";

describe("kesesuaian katalog vs registry", () => {
  it("setiap tool registry punya ToolDoc, dan tidak ada ToolDoc asing", () => {
    const registryNames = listTools().map((t) => t.name).sort();
    const docNames = TOOL_CATALOG.map((d) => d.id).sort();
    expect(docNames).toEqual(registryNames);
  });

  it("efek dan approval katalog cocok dengan registry", () => {
    for (const tool of listTools()) {
      const doc = getToolDoc(tool.name);
      expect(doc, tool.name).not.toBeNull();
      expect(doc?.efek).toBe(tool.effect);
      expect(doc?.approval).toBe(requiresApproval(tool.name));
    }
  });
});

describe("aturan isi ToolDoc (riset §5.3)", () => {
  it("kapanDipakai 2..5 butir dan kapanJangan minimal 2", () => {
    for (const doc of TOOL_CATALOG) {
      expect(doc.kapanDipakai.length).toBeGreaterThanOrEqual(2);
      expect(doc.kapanDipakai.length).toBeLessThanOrEqual(5);
      expect(doc.kapanJangan.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("ringkas <= 120 char; setiap kegagalan punya tindakanModel", () => {
    for (const doc of TOOL_CATALOG) {
      expect(doc.ringkas.length).toBeLessThanOrEqual(120);
      for (const gagal of doc.kegagalan) {
        expect(gagal.kode.trim()).not.toBe("");
        expect(gagal.arti.trim()).not.toBe("");
        expect(gagal.tindakanModel.trim()).not.toBe("");
      }
    }
  });

  it("contoh valid/tidakValid adalah JSON yang bisa di-parse", () => {
    for (const doc of TOOL_CATALOG) {
      expect(() => JSON.parse(doc.contoh.valid)).not.toThrow();
      expect(() => JSON.parse(doc.contoh.tidakValid)).not.toThrow();
    }
  });

  it("argumen: nama/keterangan terisi; wajib boolean atau 'bersyarat'", () => {
    for (const doc of TOOL_CATALOG) {
      for (const arg of doc.argumen) {
        expect(arg.nama.trim()).not.toBe("");
        expect(arg.keterangan.trim()).not.toBe("");
        expect(arg.wajib === true || arg.wajib === false || arg.wajib === "bersyarat").toBe(true);
      }
    }
  });
});

describe("docs/tools/<id>.md", () => {
  it("file ada untuk setiap tool dan memuat konten inti katalog", () => {
    for (const doc of TOOL_CATALOG) {
      const path = join(process.cwd(), "docs", "tools", doc.id + ".md");
      expect(existsSync(path), path).toBe(true);
      const text = readFileSync(path, "utf8");
      expect(text).toContain(doc.ringkas);
      for (const k of doc.kapanDipakai) expect(text).toContain(k);
      for (const k of doc.kapanJangan) expect(text).toContain(k);
      expect(text).toContain(doc.contoh.valid);
      for (const gagal of doc.kegagalan) expect(text).toContain(gagal.kode);
    }
  });
});

describe("buildToolCatalogBlock", () => {
  it("memuat nama tool, larangan, dan contoh valid", () => {
    const block = buildToolCatalogBlock();
    for (const doc of TOOL_CATALOG) {
      expect(block).toContain(doc.id);
      expect(block).toContain(doc.kapanJangan[0]);
      expect(block).toContain(doc.contoh.valid);
    }
  });
});
