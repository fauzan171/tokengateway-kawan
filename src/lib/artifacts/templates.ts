/**
 * Template dokumen (D4): tiga fungsi yang menghasilkan DocSchema, bukan mesin
 * template. Riset §4.2 — template = data, layout tetap urusan renderer.
 *
 * Yang SENGAJA tidak dibangun di sini: cover berhalaman sendiri, daftar isi
 * otomatis, nomor halaman, header/footer berjalan, kop berlogo. Semuanya
 * butuh mesin tata letak yang belum ada kebutuhan nyatanya.
 */

import { ArtifactError } from "./render";
import { parseDocSchema, type DocSchema } from "./document";

/** ID template yang sah; satu-satunya pintu masuk buildDocFromTemplate. */
export const DOC_TEMPLATE_IDS = ["laporan", "surat", "rekap"] as const;
export type DocTemplateId = (typeof DOC_TEMPLATE_IDS)[number];

type Parsed = { title: string; blocks: DocSchema["blocks"]; truncated: boolean; unknownBlocks: number };

/** String wajib: typeof string + tidak kosong; galat menyebut field-nya. */
function requireString(container: Record<string, unknown>, field: string, ctx: string): string {
  const value = container[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ArtifactError("INVALID_TOOL_ARGS", `${ctx} membutuhkan \`${field}\` berupa teks tidak kosong.`);
  }
  return value.trim();
}

/** Array wajib; galat menyebut field-nya. */
function requireArray(container: Record<string, unknown>, field: string, ctx: string): unknown[] {
  const value = container[field];
  if (!Array.isArray(value) || value.length === 0) {
    throw new ArtifactError("INVALID_TOOL_ARGS", `${ctx} membutuhkan \`${field}\` berupa daftar tidak kosong.`);
  }
  return value;
}

/** Array of string: entri non-string dibuang; kosong → galat. */
function stringItems(value: unknown, field: string, ctx: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ArtifactError("INVALID_TOOL_ARGS", `${ctx} membutuhkan \`${field}\` berupa daftar teks.`);
  }
  const items = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  if (!items.length) {
    throw new ArtifactError("INVALID_TOOL_ARGS", `${ctx}: \`${field}\` tidak memuat satu pun teks sah.`);
  }
  return items;
}

/**
 * Template `laporan`: judul + subtitle + ringkasan + bab berisi paragraf,
 * bullets opsional, tabel opsional ber-caption + penutup.
 */
export function templateLaporan(data: unknown): Parsed {
  if (typeof data !== "object" || data === null) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Data template laporan harus objek.");
  }
  const d = data as Record<string, unknown>;
  const judul = requireString(d, "judul", "Template laporan");
  const blocks: DocSchema["blocks"] = [];
  if (typeof d.subtitle === "string" && d.subtitle.trim()) blocks.push({ type: "paragraph", text: d.subtitle.trim() });
  if (typeof d.ringkasan === "string" && d.ringkasan.trim()) {
    blocks.push({ type: "heading", text: "Ringkasan", level: 2 });
    blocks.push({ type: "paragraph", text: d.ringkasan.trim() });
  }
  for (const raw of requireArray(d, "bab", "Template laporan")) {
    if (typeof raw !== "object" || raw === null) continue;
    const bab = raw as Record<string, unknown>;
    blocks.push({ type: "heading", text: requireString(bab, "judul", "Setiap bab"), level: 1 });
    for (const text of stringItems(bab.paragraf ?? [], "paragraf", "Setiap bab")) {
      blocks.push({ type: "paragraph", text });
    }
    const bullets = bab.bullets;
    if (Array.isArray(bullets) && bullets.length > 0) {
      const items = bullets.filter((b): b is string => typeof b === "string" && b.trim() !== "");
      if (items.length) blocks.push({ type: "bullets", items });
    }
    if (typeof bab.tabel === "object" && bab.tabel !== null) {
      const tabel = bab.tabel as Record<string, unknown>;
      const headers = stringItems(tabel.headers, "headers", "Tabel bab");
      const rows = (Array.isArray(tabel.rows) ? tabel.rows : []).filter(
        (r): r is string[] => Array.isArray(r) && r.every((c) => typeof c === "string"),
      );
      if (rows.length) {
        blocks.push({ type: "table", headers, rows });
        // Caption tabel: blok terpisah karena DocSchema belum punya field
        // caption di table (riset menunda DocBlockV2).
        if (typeof tabel.caption === "string" && tabel.caption.trim()) {
          blocks.push({ type: "paragraph", text: tabel.caption.trim() });
        }
      }
    }
  }
  if (typeof d.penutup === "string" && d.penutup.trim()) blocks.push({ type: "paragraph", text: d.penutup.trim() });
  return finalize({ title: judul, blocks });
}

/**
 * Template `surat`: kop, nomor, tanggal, tujuan, isi, penutup, penanda tangan.
 * Kop dipetakan heading 1 (tebal-besar) — DocSchema tidak punya paragraf tebal.
 */
export function templateSurat(data: unknown): Parsed {
  if (typeof data !== "object" || data === null) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Data template surat harus objek.");
  }
  const d = data as Record<string, unknown>;
  const kop = requireString(d, "kop", "Template surat");
  const blocks: DocSchema["blocks"] = [
    { type: "heading", text: kop, level: 1 },
    { type: "divider" },
  ];
  const nomor = typeof d.nomor === "string" && d.nomor.trim() ? `Nomor: ${d.nomor.trim()}` : null;
  const tanggal = typeof d.tanggal === "string" && d.tanggal.trim() ? d.tanggal.trim() : null;
  if (nomor || tanggal) blocks.push({ type: "paragraph", text: [nomor, tanggal].filter(Boolean).join(" · ") });
  blocks.push({ type: "paragraph", text: requireString(d, "tujuan", "Template surat") });
  for (const text of stringItems(d.isi, "isi", "Template surat")) {
    blocks.push({ type: "paragraph", text });
  }
  blocks.push({ type: "paragraph", text: requireString(d, "penutup", "Template surat") });
  blocks.push({ type: "paragraph", text: requireString(d, "penandaTangan", "Template surat") });
  if (typeof d.jabatan === "string" && d.jabatan.trim()) blocks.push({ type: "paragraph", text: d.jabatan.trim() });
  return finalize({ title: kop, blocks });
}

/**
 * Template `rekap`: pembuka + satu tabel + caption. Untuk data tabular yang
 * paling sering dibuka sebagai XLSX.
 */
export function templateRekap(data: unknown): Parsed {
  if (typeof data !== "object" || data === null) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Data template rekap harus objek.");
  }
  const d = data as Record<string, unknown>;
  const judul = requireString(d, "judul", "Template rekap");
  const headers = stringItems(d.headers, "headers", "Template rekap");
  const rows = requireArray(d, "rows", "Template rekap").filter(
    (r): r is string[] => Array.isArray(r) && r.every((c) => typeof c === "string"),
  );
  if (!rows.length) {
    throw new ArtifactError("INVALID_TOOL_ARGS", "Template rekap: \`rows\` tidak memuat satu pun baris sah.");
  }
  const blocks: DocSchema["blocks"] = [];
  if (typeof d.pembuka === "string" && d.pembuka.trim()) blocks.push({ type: "paragraph", text: d.pembuka.trim() });
  blocks.push({ type: "table", headers, rows });
  if (typeof d.caption === "string" && d.caption.trim()) blocks.push({ type: "paragraph", text: d.caption.trim() });
  return finalize({ title: judul, blocks });
}

/**
 * Pintu utama: ID template + data → DocSchema tervalidasi penuh. Output SELALU
 * dilewatkan parseDocSchema supaya batas kanonik (500 blok, 200.000 char, …)
 * ditegakkan di satu titik yang sama dengan jalur doc mentah.
 */
export function buildDocFromTemplate(template: string, data: unknown): Parsed {
  if (template === "laporan") return templateLaporan(data);
  if (template === "surat") return templateSurat(data);
  if (template === "rekap") return templateRekap(data);
  throw new ArtifactError(
    "INVALID_TOOL_ARGS",
    `Template tidak dikenal: \`${template}\`. Yang tersedia: laporan, surat, rekap.`,
  );
}

/** Enforce batas kanonik lewat parseDocSchema dan bawa flag potongannya. */
function finalize(doc: DocSchema): Parsed {
  const parsed = parseDocSchema(doc);
  return { title: parsed.title, blocks: parsed.blocks, truncated: parsed.truncated, unknownBlocks: parsed.unknownBlocks };
}
