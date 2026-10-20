/**
 * Penanda permintaan pencarian web + system prompt sumber (WP-NT-P7-02, REQ-NT-52).
 *
 * Penanda disimpan sebagai bagian `web-search` pada `contentJson` pesan user,
 * bukan kolom baru: satu-satunya pembaca adalah generasi, dan skema tidak perlu
 * berubah. Awalan `[S1]` dipakai untuk sumber web supaya tidak bertabrakan
 * dengan penanda dokumen `[1]` dari `context.ts`.
 */

import type { SearchResult } from "./web";

const SNIPPET_MAX = 300;

/** Apakah pesan user meminta pencarian web. Input rusak → `false`. */
export function webSearchRequested(contentJson: string | null | undefined): boolean {
  if (typeof contentJson !== "string" || contentJson === "") return false;
  let data: unknown;
  try {
    data = JSON.parse(contentJson);
  } catch {
    return false;
  }
  if (data === null || typeof data !== "object") return false;
  const parts = (data as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return false;
  return parts.some(
    (part) => part !== null && typeof part === "object" && (part as { kind?: unknown }).kind === "web-search",
  );
}

/** System prompt berisi hasil pencarian. `undefined` bila tidak ada hasil. */
export function buildSearchSystem(results: readonly SearchResult[]): string | undefined {
  if (results.length === 0) return undefined;

  const lines = results.map((result, index) => {
    const snippet = result.snippet.slice(0, SNIPPET_MAX).trim();
    const head = `[S${index + 1}] ${result.title} — ${result.url}`;
    return snippet === "" ? head : `${head}\n${snippet}`;
  });

  return [
    "Hasil pencarian web berikut disediakan untuk menjawab pertanyaan pengguna.",
    "",
    ...lines,
    "",
    "Kutip penanda sumber, misalnya [S1], bila memakai isi salah satu sumber di atas.",
    "Jangan mengarang URL atau sumber yang tidak ada di daftar ini.",
  ].join("\n");
}
