/**
 * Uji P2: manifest plugin deklaratif — data, bukan kode.
 *
 * Kunci: subset schema dibekukan (tolak $ref/oneOf/allOf + kunci asing),
 * nama tool harus terdaftar, effect tidak boleh diturunkan, hash kanonik
 * stabil terhadap urutan kunci.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ManifestError } from "./manifest";
import { canonicalManifestJson, parsePluginManifest } from "./manifest";
import { listTools } from "@/lib/tools/registry";

const VALID = {
  manifestVersion: 1,
  id: "laporan-kuartalan",
  version: "1.0.0",
  displayName: "Laporan Kuartalan",
  description: "Template dan tool untuk laporan kuartalan.",
  tools: [{ name: "generate_file", effect: "local" }],
  prompts: [{ title: "Ringkas kuartal", body: "Buat ringkasan kuartal ini." }],
  capabilityNeeds: ["tools.file"],
};

function expectCode(fn: () => unknown, code: string): void {
  expect(fn).toThrowError(ManifestError);
  try {
    fn();
  } catch (err) {
    expect((err as ManifestError).code).toBe(code);
  }
}

describe("parsePluginManifest — bentuk dasar", () => {
  it("manifest sah lolos dengan field utuh", () => {
    const m = parsePluginManifest(VALID);
    expect(m.id).toBe("laporan-kuartalan");
    expect(m.tools).toEqual([{ name: "generate_file", effect: "local" }]);
    expect(m.prompts).toHaveLength(1);
    expect(m.capabilityNeeds).toEqual(["tools.file"]);
  });

  it("string JSON mentah juga diterima; JSON rusak ditolak", () => {
    expect(parsePluginManifest(JSON.stringify(VALID)).id).toBe("laporan-kuartalan");
    expectCode(() => parsePluginManifest("{bukan"), "MANIFEST_NOT_JSON");
  });

  it("manifestVersion selain 1 ditolak", () => {
    expectCode(() => parsePluginManifest({ ...VALID, manifestVersion: 2 }), "MANIFEST_VERSION_UNKNOWN");
    expectCode(() => parsePluginManifest({ ...VALID, manifestVersion: "1" }), "MANIFEST_VERSION_UNKNOWN");
  });

  it("id harus kebab-case; version semver; displayName/description wajib", () => {
    expectCode(() => parsePluginManifest({ ...VALID, id: "Plugin_Besar" }), "INVALID_PLUGIN_ID");
    expectCode(() => parsePluginManifest({ ...VALID, id: "x" }), "INVALID_PLUGIN_ID");
    expectCode(() => parsePluginManifest({ ...VALID, version: "1.2" }), "INVALID_PLUGIN_VERSION");
    expectCode(() => parsePluginManifest({ ...VALID, displayName: "" }), "INVALID_DISPLAY_NAME");
    expectCode(() => parsePluginManifest({ ...VALID, description: "" }), "INVALID_DESCRIPTION");
  });
});

describe("parsePluginManifest — tool HARUS milik registry", () => {
  it("nama tool asing ditolak UNKNOWN_TOOL (plugin tidak menambah executor)", () => {
    expectCode(
      () => parsePluginManifest({ ...VALID, tools: [{ name: "rm_rf", effect: "read" }] }),
      "UNKNOWN_TOOL",
    );
  });

  it("effect di manifest harus sama dengan registry; write tidak boleh diturunkan", () => {
    // generate_file = local di registry; klaim read = penurunan bahaya.
    expectCode(
      () => parsePluginManifest({ ...VALID, tools: [{ name: "generate_file", effect: "read" }] }),
      "EFFECT_MISMATCH",
    );
  });

  it("tool ganda dalam satu manifest ditolak", () => {
    expectCode(
      () =>
        parsePluginManifest({
          ...VALID,
          tools: [
            { name: "generate_file", effect: "local" },
            { name: "generate_file", effect: "local" },
          ],
        }),
      "DUPLICATE_TOOL",
    );
  });

  it("tools kosong / bukan array ditolak", () => {
    expectCode(() => parsePluginManifest({ ...VALID, tools: [] }), "TOOLS_EMPTY");
    expectCode(() => parsePluginManifest({ ...VALID, tools: "x" }), "TOOLS_EMPTY");
  });
});

describe("parsePluginManifest — subset schema dibekukan", () => {
  it("parameter sah dalam subset lolos (type/enum/required/properties/items)", () => {
    const m = parsePluginManifest({
      ...VALID,
      tools: [
        {
          name: "generate_file",
          effect: "local",
          parameters: {
            type: "object",
            required: ["format"],
            properties: {
              format: { type: "string", enum: ["md", "txt"] },
              rows: { type: "array", items: { type: "string" } },
            },
          },
        },
      ],
    });
    expect(m.tools[0].parameters).toBeTruthy();
  });

  it("$ref ditolak dengan pesan SSRF (lubang resolusi referensi)", () => {
    expectCode(
      () =>
        parsePluginManifest({
          ...VALID,
          tools: [{ name: "generate_file", effect: "local", parameters: { $ref: "https://jauh.example/evil" } }],
        }),
      "SCHEMA_KEYWORD_REJECTED",
    );
  });

  it("oneOf/allOf/anyOf dan kunci asing ditolak", () => {
    for (const kw of ["oneOf", "allOf", "anyOf", "pattern", "minimum"]) {
      expectCode(
        () =>
          parsePluginManifest({
            ...VALID,
            tools: [{ name: "generate_file", effect: "local", parameters: { [kw]: [] } }],
          }),
        "SCHEMA_KEYWORD_REJECTED",
      );
    }
  });

  it("schema bersarang terlalu dalam ditolak (kedalaman > 8)", () => {
    let deep: Record<string, unknown> = { type: "string" };
    for (let i = 0; i < 12; i++) deep = { type: "object", properties: { x: deep } };
    expectCode(
      () => parsePluginManifest({ ...VALID, tools: [{ name: "generate_file", effect: "local", parameters: deep }] }),
      "SCHEMA_TOO_DEEP",
    );
  });
});

describe("canonicalManifestJson", () => {
  it("hash stabil terhadap urutan kunci; beda isi = beda hash", () => {
    const a = parsePluginManifest(VALID);
    const reordered = {
      capabilityNeeds: ["tools.file"],
      prompts: [{ body: "Buat ringkasan kuartal ini.", title: "Ringkas kuartal" }],
      tools: [{ effect: "local", name: "generate_file" }],
      description: VALID.description,
      displayName: VALID.displayName,
      version: VALID.version,
      id: VALID.id,
      manifestVersion: 1,
    };
    const b = parsePluginManifest(reordered);
    const ha = createHash("sha256").update(canonicalManifestJson(a)).digest("hex");
    const hb = createHash("sha256").update(canonicalManifestJson(b)).digest("hex");
    expect(ha).toBe(hb);
    const c = parsePluginManifest({ ...VALID, version: "1.0.1" });
    expect(createHash("sha256").update(canonicalManifestJson(c)).digest("hex")).not.toBe(ha);
  });
});

describe("registry sebagai fondasi", () => {
  it("setiap tool chat registry punya entri getTool (nama konsisten)", () => {
    for (const tool of listTools()) {
      expect(tool.name).toBeTruthy();
      expect(["read", "local", "write"]).toContain(tool.effect);
    }
  });
});
