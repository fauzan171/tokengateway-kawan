/**
 * Manifest plugin deklaratif (P2, riset-plugin §4): JSON data berversi,
 * BUKAN kode. Tidak ada eval/import/URL — executor tetap kode repo yang
 * sudah teruji; manifest hanya boleh menyetel tool yang sudah terdaftar di
 * registry (P1).
 *
 * Aturan yang ditegakkan di sini:
 *   - `manifestVersion` wajib tepat 1 (yang dikenal implementasi ini);
 *   - subset JSON-Schema dibekukan: hanya type/enum/required/properties/items;
 *     `oneOf`/`allOf`/`$ref` dan kata kunci lain DITOLAK — zona "nanti",
 *     karena `$ref` membuka lubang SSRF/logic (rencana §P2);
 *   - nama tool harus terdaftar di registry; nama asing ditolak;
 *   - `effect` di manifest harus SAMA dengan effect registry — plugin tidak
 *     boleh menurunkan tingkat bahaya tool;
 *   - `enabled` selalu false saat install; menyalakan wajib review manusia.
 */

import { getTool, type ToolEffect } from "@/lib/tools/registry";

/** Subset JSON-Schema yang dibekukan untuk parameter tool plugin. */
export const MANIFEST_SCHEMA_VERSION = 1 as const;

/** Kunci schema yang diizinkan (dibekukan; penambahan = breaking change). */
const ALLOWED_SCHEMA_KEYS = new Set(["type", "enum", "required", "properties", "items"]);
/** Kata kunci yang eksplisit ditolak supaya pesannya spesifik. */
const REJECTED_SCHEMA_HINTS: Record<string, string> = {
  $ref: "$ref membuka resolusi referensi eksternal (SSRF/logic) — tidak didukung.",
  oneOf: "oneOf di luar subset yang dibekukan; validasi gabungan tidak didukung.",
  allOf: "allOf di luar subset yang dibekukan; validasi gabungan tidak didukung.",
  anyOf: "anyOf di luar subset yang dibekukan; validasi gabungan tidak didukung.",
  $defs: "$defs hanya berguna bersama $ref; keduanya ditolak.",
  definitions: "definitions hanya berguna bersama $ref; keduanya ditolak.",
};

export class ManifestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ManifestError";
    this.code = code;
  }
}

export type ManifestTool = {
  name: string;
  effect: ToolEffect;
  parameters?: Record<string, unknown>;
};

export type ManifestPrompt = {
  title: string;
  body: string;
};

export type PluginManifest = {
  manifestVersion: typeof MANIFEST_SCHEMA_VERSION;
  id: string;
  version: string;
  displayName: string;
  description: string;
  tools: ManifestTool[];
  prompts: ManifestPrompt[];
  capabilityNeeds: string[];
};

/** Batas manifest: kecil dan terbatas — manifest bukan wadah data besar. */
export const MANIFEST_LIMITS = {
  idMax: 64,
  displayNameMax: 80,
  descriptionMax: 400,
  toolsMax: 20,
  promptsMax: 20,
  capabilityNeedsMax: 20,
  titleMax: 80,
  bodyMax: 8_000,
  parametersDepthMax: 8,
  manifestBytesMax: 128 * 1024,
} as const;

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function reject(code: string, message: string): never {
  throw new ManifestError(code, message);
}

/** Validasi rekursif subset schema parameter; tolak kunci di luar subset. */
function assertSchemaSubset(node: unknown, path: string, depth: number): void {
  if (depth > MANIFEST_LIMITS.parametersDepthMax) {
    reject("SCHEMA_TOO_DEEP", `${path}: kedalaman > ${MANIFEST_LIMITS.parametersDepthMax}.`);
  }
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    reject("SCHEMA_NOT_OBJECT", `${path}: simpul schema harus objek.`);
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const hint = REJECTED_SCHEMA_HINTS[key];
    if (hint) reject("SCHEMA_KEYWORD_REJECTED", `${path}.${key}: ${hint}`);
    if (!ALLOWED_SCHEMA_KEYS.has(key)) {
      reject("SCHEMA_KEYWORD_REJECTED", `${path}.${key}: di luar subset yang dibekukan (${[...ALLOWED_SCHEMA_KEYS].join("/")}).`);
    }
    if (key === "properties" && typeof value === "object" && value !== null) {
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        assertSchemaSubset(child, `${path}.properties.${name}`, depth + 1);
      }
    } else if (key === "items") {
      assertSchemaSubset(value, `${path}.items`, depth + 1);
    } else if (key === "enum" && !Array.isArray(value)) {
      reject("SCHEMA_ENUM_NOT_ARRAY", `${path}.enum harus array.`);
    } else if (key === "required" && !Array.isArray(value)) {
      reject("SCHEMA_REQUIRED_NOT_ARRAY", `${path}.required harus array.`);
    } else if (key === "type" && typeof value !== "string") {
      reject("SCHEMA_TYPE_NOT_STRING", `${path}.type harus string.`);
    }
  }
}

/**
 * Parse + validasi manifest mentah. Melempar ManifestError berkode untuk
 * setiap pelanggaran — pemanggil (route/install) menerjemahkan ke 400.
 */
export function parsePluginManifest(raw: string | unknown): PluginManifest {
  if (typeof raw === "string" && raw.length > MANIFEST_LIMITS.manifestBytesMax) {
    reject("MANIFEST_TOO_LARGE", "Manifest melebihi 128 KiB.");
  }
  let value: unknown;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      reject("MANIFEST_NOT_JSON", "Manifest bukan JSON yang sah.");
    }
  } else {
    value = raw;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    reject("MANIFEST_NOT_OBJECT", "Manifest harus objek JSON.");
  }
  const m = value as Record<string, unknown>;

  if (m.manifestVersion !== MANIFEST_SCHEMA_VERSION) {
    reject("MANIFEST_VERSION_UNKNOWN", `manifestVersion harus ${MANIFEST_SCHEMA_VERSION}; diterima: ${String(m.manifestVersion)}.`);
  }
  const id = typeof m.id === "string" ? m.id : "";
  if (!KEBAB.test(id)) {
    reject("INVALID_PLUGIN_ID", "id harus kebab-case (contoh: laporan-kuartalan).");
  }
  if (id.length > MANIFEST_LIMITS.idMax) {
    reject("INVALID_PLUGIN_ID", `id maksimal ${MANIFEST_LIMITS.idMax} karakter.`);
  }
  const version = typeof m.version === "string" ? m.version : "";
  if (!SEMVER.test(version)) {
    reject("INVALID_PLUGIN_VERSION", "version harus semver (contoh: 1.2.0).");
  }
  const displayName = typeof m.displayName === "string" ? m.displayName : "";
  if (!displayName.trim() || displayName.length > MANIFEST_LIMITS.displayNameMax) {
    reject("INVALID_DISPLAY_NAME", `displayName wajib 1-${MANIFEST_LIMITS.displayNameMax} karakter.`);
  }
  const description = typeof m.description === "string" ? m.description : "";
  if (!description.trim() || description.length > MANIFEST_LIMITS.descriptionMax) {
    reject("INVALID_DESCRIPTION", `description wajib 1-${MANIFEST_LIMITS.descriptionMax} karakter.`);
  }

  if (!Array.isArray(m.tools) || m.tools.length === 0) {
    reject("TOOLS_EMPTY", "tools wajib array tidak kosong.");
  }
  if (m.tools.length > MANIFEST_LIMITS.toolsMax) {
    reject("TOOLS_TOO_MANY", `tools maksimal ${MANIFEST_LIMITS.toolsMax}.`);
  }
  const tools: ManifestTool[] = [];
  const seen = new Set<string>();
  for (const entry of m.tools) {
    if (typeof entry !== "object" || entry === null) {
      reject("TOOL_NOT_OBJECT", "Setiap entri tools harus objek.");
    }
    const t = entry as Record<string, unknown>;
    const name = typeof t.name === "string" ? t.name : "";
    const registered = getTool(name);
    if (!registered) {
      reject("UNKNOWN_TOOL", `Tool "${name}" tidak terdaftar di registry server; plugin tidak menambah executor.`);
    }
    if (seen.has(name)) {
      reject("DUPLICATE_TOOL", `Tool "${name}" dideklarasikan dua kali.`);
    }
    seen.add(name);
    // Effect manifest HARUS sama dengan registry: plugin tidak boleh
    // menurunkan tingkat bahaya (write dibungkus jadi read).
    if (t.effect !== registered.effect) {
      reject("EFFECT_MISMATCH", `Tool "${name}": effect "${String(t.effect)}" tidak cocok dengan registry ("${registered.effect}").`);
    }
    if ("parameters" in t && t.parameters !== undefined) {
      assertSchemaSubset(t.parameters, `tools[${name}].parameters`, 0);
    }
    tools.push({
      name,
      effect: registered.effect,
      ...(t.parameters !== undefined ? { parameters: t.parameters as Record<string, unknown> } : {}),
    });
  }

  const prompts: ManifestPrompt[] = [];
  if (Array.isArray(m.prompts)) {
    if (m.prompts.length > MANIFEST_LIMITS.promptsMax) {
      reject("PROMPTS_TOO_MANY", `prompts maksimal ${MANIFEST_LIMITS.promptsMax}.`);
    }
    for (const entry of m.prompts) {
      if (typeof entry !== "object" || entry === null) {
        reject("PROMPT_NOT_OBJECT", "Setiap entri prompts harus objek.");
      }
      const p = entry as Record<string, unknown>;
      const title = typeof p.title === "string" ? p.title : "";
      const body = typeof p.body === "string" ? p.body : "";
      if (!title.trim() || title.length > MANIFEST_LIMITS.titleMax) {
        reject("INVALID_PROMPT_TITLE", `prompt.title wajib 1-${MANIFEST_LIMITS.titleMax} karakter.`);
      }
      if (!body.trim() || body.length > MANIFEST_LIMITS.bodyMax) {
        reject("INVALID_PROMPT_BODY", `prompt.body wajib 1-${MANIFEST_LIMITS.bodyMax} karakter.`);
      }
      prompts.push({ title, body });
    }
  } else if (m.prompts !== undefined) {
    reject("PROMPTS_NOT_ARRAY", "prompts harus array bila ada.");
  }

  const capabilityNeeds: string[] = [];
  if (Array.isArray(m.capabilityNeeds)) {
    if (m.capabilityNeeds.length > MANIFEST_LIMITS.capabilityNeedsMax) {
      reject("CAPABILITY_NEEDS_TOO_MANY", `capabilityNeeds maksimal ${MANIFEST_LIMITS.capabilityNeedsMax}.`);
    }
    for (const need of m.capabilityNeeds) {
      if (typeof need !== "string" || !/^[a-z][a-z0-9_.-]*$/.test(need)) {
        reject("INVALID_CAPABILITY_NEED", `capabilityNeeds berisi entri tidak sah: ${String(need)}.`);
      }
      capabilityNeeds.push(need);
    }
  } else if (m.capabilityNeeds !== undefined) {
    reject("CAPABILITY_NEEDS_NOT_ARRAY", "capabilityNeeds harus array bila ada.");
  }

  return {
    manifestVersion: MANIFEST_SCHEMA_VERSION,
    id,
    version,
    displayName,
    description,
    tools,
    prompts,
    capabilityNeeds,
  };
}

/**
 * Kanonikalisasi untuk hash: JSON dengan kunci terurut + tanpa spasi, jadi
 * hash manifest yang sama secara semantik selalu identik.
 */
export function canonicalManifestJson(manifest: PluginManifest): string {
  return JSON.stringify(sortKeys(manifest));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
