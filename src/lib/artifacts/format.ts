/** Konstanta & util format artefak (FIX-11, bagian 1/4). */

export const ARTIFACT_FORMATS = ["md", "txt", "json", "csv", "html", "xlsx", "docx", "pdf", "zip", "png"] as const;
export type ArtifactFormat = (typeof ARTIFACT_FORMATS)[number];
export const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
export const MAX_ARTIFACTS_PER_RUN = 10;

export function isArtifactFormat(value: unknown): value is ArtifactFormat {
  return ARTIFACT_FORMATS.includes(value as ArtifactFormat);
}

/** MIME per format. `html` → "text/html; charset=utf-8" (TIDAK dipratinjau inline). */
export function mimeForFormat(format: ArtifactFormat): string {
  switch (format) {
    case "md": return "text/markdown; charset=utf-8";
    case "txt": return "text/plain; charset=utf-8";
    case "json": return "application/json";
    case "csv": return "text/csv; charset=utf-8";
    case "html": return "text/html; charset=utf-8";
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pdf": return "application/pdf";
    case "zip": return "application/zip";
    // FIX-16: hasil image generation disimpan sebagai artefak, bukan data URL.
    case "png": return "image/png";
  }
}

/**
 * Membersihkan nama tampilan. Buang pemisah path (`/`, `\`), karakter kontrol,
 * dan `..`; batasi 120 karakter; tambahkan ekstensi format bila belum cocok.
 * Nama kosong → `berkas.<format>`. TIDAK dipakai sebagai path berkas.
 */
export function sanitizeDisplayName(raw: string, format: ArtifactFormat): string {
  const stripped = raw.replace(/[\\/]/g, " ").replace(/[..]+/g, " ").replace(/\p{C}/gu, "").trim();
  const ext = `.${format}`;
  let base = stripped.slice(0, 120).trim();
  if (!base) base = `berkas${ext}`;
  return base.toLowerCase().endsWith(ext) ? base.slice(0, 120) : base.slice(0, 120 - ext.length).trimEnd() + ext;
}