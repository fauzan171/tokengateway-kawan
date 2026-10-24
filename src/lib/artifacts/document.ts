/** Skema dokumen terstruktur (FIX-12): satu-satunya bentuk yang boleh dikirim model. */

import { ArtifactError } from "./render";

export type DocBlock =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[]; ordered?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string; language?: string }
  // D3: blok baru. pageBreak/divider presentasi murni; image hanya rujukan
  // artifactId milik user — byte tidak pernah masuk skema (tanpa base64).
  | { type: "pageBreak" }
  | { type: "divider" }
  | { type: "image"; artifactId: string; alt: string; caption?: string; widthPct?: number };

export type DocSchema = { title: string; blocks: DocBlock[] };

export const DOC_SCHEMA_VERSION = 1;

/** Batas kanonik: lewat batas dipotong + dilaporkan lewat truncated/unknownBlocks. */
export const DOC_LIMITS = {
  blocks: 500,
  text: 20_000,
  totalChars: 200_000,
  tableColumns: 12,
  tableRows: 2_000,
  bullets: 100,
  cell: 500,
  // D3: gambar per dokumen dan teks pendek (alt/caption).
  images: 20,
  shortText: 200,
} as const;

export type ParsedDocSchema = DocSchema & {
  schemaVersion: typeof DOC_SCHEMA_VERSION;
  truncated: boolean;
  unknownBlocks: number;
};

/** Bentuk salah (bukan objek, judul kosong, blocks bukan array) dilempar; kelebihan jumlah/panjang dipotong dan dilaporkan lewat `truncated`. */
export function parseDocSchema(value: unknown): ParsedDocSchema {
  if (typeof value !== "object" || value === null) throw new ArtifactError("INVALID_DOC_SCHEMA");
  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string" || !raw.title.trim()) throw new ArtifactError("INVALID_DOC_SCHEMA");
  if (!Array.isArray(raw.blocks)) throw new ArtifactError("INVALID_DOC_SCHEMA");
  // >500 blok DIPOTONG, bukan ditolak. Menolak berarti model yang mengirim 600
  // paragraf membuat tool gagal total dan pengguna hanya melihat "berkas gagal
  // dibuat" — kehilangan seluruh dokumen karena 100 blok lebih. Bentuk salah
  // tetap dilempar; kelebihan jumlah adalah batas, bukan kesalahan bentuk.

  const blocks: DocBlock[] = [];
  let unknownBlocks = 0;
  let truncated = false;
  let images = 0;
  let remaining = DOC_LIMITS.totalChars;

  const clip = (text: string, max: number): string => {
    const limit = Math.max(0, Math.min(max, remaining));
    if (text.length > limit) truncated = true;
    const out = text.slice(0, limit);
    remaining -= out.length;
    return out;
  };

  const title = clip(raw.title.trim(), DOC_LIMITS.text);

  for (const item of raw.blocks) {
    if (blocks.length >= DOC_LIMITS.blocks) {
      truncated = true;
      break;
    }
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    if (typeof item !== "object" || item === null) {
      unknownBlocks += 1;
      continue;
    }
    const b = item as Record<string, unknown>;
    switch (b.type) {
      case "heading":
        if (typeof b.text !== "string") {
          unknownBlocks += 1;
          break;
        }
        blocks.push({ type: "heading", text: clip(b.text, DOC_LIMITS.text), level: b.level === 2 || b.level === 3 ? b.level : 1 });
        break;
      case "paragraph":
        if (typeof b.text !== "string") {
          unknownBlocks += 1;
          break;
        }
        blocks.push({ type: "paragraph", text: clip(b.text, DOC_LIMITS.text) });
        break;
      case "bullets": {
        if (!Array.isArray(b.items)) {
          unknownBlocks += 1;
          break;
        }
        const all = b.items.filter((i): i is string => typeof i === "string");
        if (!all.length) {
          unknownBlocks += 1;
          break;
        }
        if (all.length > DOC_LIMITS.bullets) truncated = true;
        const items = all.slice(0, DOC_LIMITS.bullets).map((i) => clip(i, DOC_LIMITS.text));
        // D3: ordered membuka daftar bernomor tanpa tipe blok baru.
        blocks.push({ type: "bullets", items, ...(b.ordered === true ? { ordered: true } : {}) });
        break;
      }
      case "table": {
        if (!Array.isArray(b.headers) || !Array.isArray(b.rows)) {
          unknownBlocks += 1;
          break;
        }
        const rawHeaders = b.headers.filter((h): h is string => typeof h === "string");
        if (!rawHeaders.length) {
          unknownBlocks += 1;
          break;
        }
        const width = Math.min(rawHeaders.length, DOC_LIMITS.tableColumns);
        if (rawHeaders.length > width) truncated = true;
        const headers = rawHeaders.slice(0, width).map((h) => clip(h, DOC_LIMITS.cell));
        const validRows = (b.rows as unknown[]).filter(
          (r): r is unknown[] => Array.isArray(r) && r.length >= width,
        );
        if (validRows.length > DOC_LIMITS.tableRows) truncated = true;
        const rows = validRows.slice(0, DOC_LIMITS.tableRows).map((r) =>
          headers.map((_, i) => {
            const cell = r[i];
            return clip(typeof cell === "string" ? cell : cell === null || cell === undefined ? "" : String(cell), DOC_LIMITS.cell);
          }),
        );
        blocks.push({ type: "table", headers, rows });
        break;
      }
      case "code":
        if (typeof b.text !== "string") {
          unknownBlocks += 1;
          break;
        }
        blocks.push({
          type: "code",
          text: clip(b.text, DOC_LIMITS.text),
          ...(typeof b.language === "string" ? { language: b.language } : {}),
        });
        break;
      // D3: pageBreak/divider tidak membawa payload — cukup tipe yang benar.
      case "pageBreak":
        blocks.push({ type: "pageBreak" });
        break;
      case "divider":
        blocks.push({ type: "divider" });
        break;
      case "image": {
        // Syarat minimal: artifactId string tidak kosong + alt untuk
        // aksesibilitas. Byte dan validasi mime/ukuran tetap di jalur render,
        // bukan di skema — skema tidak boleh jadi validator byte.
        if (typeof b.artifactId !== "string" || !b.artifactId.trim() || typeof b.alt !== "string") {
          unknownBlocks += 1;
          break;
        }
        // 20 gambar per dokumen: sisanya dibuang + truncated, bukan ditolak.
        if (images >= DOC_LIMITS.images) {
          truncated = true;
          break;
        }
        images += 1;
        blocks.push({
          type: "image",
          artifactId: b.artifactId.trim(),
          alt: clip(b.alt, DOC_LIMITS.shortText),
          ...(typeof b.caption === "string" ? { caption: clip(b.caption, DOC_LIMITS.shortText) } : {}),
          ...(typeof b.widthPct === "number" && Number.isFinite(b.widthPct)
            ? { widthPct: Math.min(100, Math.max(10, Math.round(b.widthPct))) }
            : {}),
        });
        break;
      }
      default:
        unknownBlocks += 1;
        break;
    }
  }
  return { schemaVersion: DOC_SCHEMA_VERSION, title, blocks, truncated, unknownBlocks };
}
