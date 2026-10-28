/**
 * Registry agent berbasis Markdown (Langkah 2): `agents/*.md`.
 *
 * Satu berkas = satu agen. YAML frontmatter memuat metadata, badan markdown
 * menjadi system prompt. Memisahkan keduanya di sini penting: metadata boleh
 * keluar ke katalog publik, badan TIDAK — kalau bocor, orang bisa menulis prompt
 * yang menimpa kebijakan server.
 *
 * Parser frontmatter ditulis sendiri (~40 baris) dan sengaja hanya menerima
 * bentuk sempit yang dipakai berkas agen: `kunci: nilai`, string dikutip, dan
 * array inline `[a, b]`. Menambah dependensi YAML untuk ini tidak sepadan.
 * Parser mengembalikan galat, bukan menebak: berkas agen yang salah bentuk
 * harus ketahuan saat load, bukan menghasilkan prompt setengah jadi.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type AgentFile = {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  greeting: string;
  allowedSubAgents: readonly string[];
  /** Badan markdown — system prompt server. Jangan pernah dikirim ke klien. */
  body: string;
};

/** Nama field frontmatter yang wajib ada; sisanya opsional. */
const REQUIRED = ["id", "name", "role", "description", "greeting"] as const;

class FrontmatterError extends Error {}

/** Buang kutip pembungkus dan escape minimal (`\"`, `\\`, `\n`). */
function unquote(raw: string): string {
  const text = raw.trim();
  const quoted =
    (text.startsWith('"') && text.endsWith('"') && text.length > 1) ||
    (text.startsWith("'") && text.endsWith("'") && text.length > 1);
  if (!quoted) return text;
  const inner = text.slice(1, -1);
  if (text[0] === "'") return inner.replace(/''/g, "'");
  return inner.replace(/\\(["\\n])/g, (_match, ch: string) =>
    ch === "n" ? "\n" : ch,
  );
}

/** `[a, "b"]` → ["a", "b"]. Bentuk lain (array blok `-`) tidak didukung. */
function parseInlineArray(raw: string, key: string): string[] {
  const text = raw.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) {
    throw new FrontmatterError(`frontmatter "${key}" harus array inline, mis. ["a", "b"].`);
  }
  const inner = text.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((item) => unquote(item));
}

/**
 * Parse berkas agen. Melempar `Error` dengan nama berkas bila bentuknya salah,
 * supaya masalahnya terlihat saat load/CI, bukan saat pengguna mengetik.
 */
export function parseAgentFile(fileName: string, source: string): AgentFile {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new FrontmatterError(`${fileName}: frontmatter tidak ditemukan (harus diawali "---").`);
  }
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    throw new FrontmatterError(`${fileName}: frontmatter tidak ditutup "---".`);
  }

  const head = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n+/, "").trim();
  if (body === "") {
    throw new FrontmatterError(`${fileName}: badan markdown (system prompt) kosong.`);
  }

  const fields: Record<string, string> = {};
  for (const line of head.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      throw new FrontmatterError(`${fileName}: baris frontmatter tidak valid: ${line}`);
    }
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  for (const key of REQUIRED) {
    if (!fields[key]) throw new FrontmatterError(`${fileName}: field "${key}" wajib ada.`);
  }

  const allowed = fields["allowed_sub_agents"]
    ? parseInlineArray(fields["allowed_sub_agents"] as string, "allowed_sub_agents")
    : [];

  return {
    id: unquote(fields["id"] as string),
    name: unquote(fields["name"] as string),
    role: unquote(fields["role"] as string),
    description: unquote(fields["description"] as string),
    model: unquote(fields["model"] ?? "deepseek-v4.1-flash"),
    greeting: unquote(fields["greeting"] as string),
    allowedSubAgents: allowed,
    body,
  };
}

/** Direktori agen; bisa ditimpa pengujian lewat parameter. */
export const AGENTS_DIR = join(process.cwd(), "agents");

let cache: AgentFile[] | null = null;

/** Semua agen, urut nama berkas. Hasil di-cache per proses (berkas statis). */
export function listAgentFiles(dir: string = AGENTS_DIR): AgentFile[] {
  if (dir === AGENTS_DIR && cache !== null) return cache;
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const agents = files.map((name) =>
    parseAgentFile(name, readFileSync(join(dir, name), "utf8")),
  );

  const seen = new Set<string>();
  for (const agent of agents) {
    if (seen.has(agent.id)) {
      throw new FrontmatterError(`id agen ganda: "${agent.id}".`);
    }
    seen.add(agent.id);
  }
  for (const agent of agents) {
    for (const target of agent.allowedSubAgents) {
      if (!seen.has(target)) {
        throw new FrontmatterError(
          `${agent.id}: allowed_sub_agents memuat "${target}" yang tidak ada di agents/.`,
        );
      }
    }
  }

  if (dir === AGENTS_DIR) cache = agents;
  return agents;
}

/** Agen berdasarkan id; null bila asing. */
export function getAgentFile(id: string, dir: string = AGENTS_DIR): AgentFile | null {
  return listAgentFiles(dir).find((agent) => agent.id === id) ?? null;
}