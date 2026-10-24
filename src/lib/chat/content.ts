/**
 * Bagian isi pesan (SDD-2.2) — pembacaan murni, aman diimpor komponen klien.
 *
 * Bentuk kanonik `contentJson`: `{ parts: [{ kind: "text", text }] }`, ditambah
 * `{ kind: "image", mime, dataUrl }` untuk gambar unggahan (REQ-NT-46) dan
 * `{ kind: "image", mime, artifactId }` untuk gambar hasil pembuatan (FIX-16).
 *
 * Gambar hasil pembuatan TIDAK disimpan sebagai base64 di riwayat: byte-nya ada
 * di artefak (retention 7 hari), riwayat hanya menyimpan rujukannya.
 */

export type ContentPart = { kind?: string; text?: string };

/**
 * Bagian gambar. `dataUrl` untuk unggahan pengguna; `artifactId` untuk hasil
 * pembuatan yang byte-nya hidup di penyimpanan artefak.
 */
export type ImagePart = {
  kind: "image";
  mime: string;
  dataUrl?: string;
  artifactId?: string;
};

/** Jenis gambar yang boleh dilampirkan; SVG sengaja tidak ada (bisa memuat skrip). */
export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGES = 4;

export function parseParts(contentJson: string): ContentPart[] {
  try {
    const data = JSON.parse(contentJson);
    if (Array.isArray(data?.parts)) return data.parts as ContentPart[];
  } catch {
    // fall through
  }
  return [];
}

/** Gabungan teks semua bagian `text`; bagian lain (gambar, tool, kutipan) diabaikan. */
export function messageText(contentJson: string): string {
  return parseParts(contentJson)
    .map((part) => (part.kind !== "image" && typeof part.text === "string" ? part.text : ""))
    .join("");
}

/** Bagian gambar pada satu pesan, untuk membangun permintaan ke gateway. */
export function imageParts(contentJson: string): ImagePart[] {
  return parseParts(contentJson).filter((part): part is ImagePart => {
    if (part.kind !== "image") return false;
    const candidate = part as ImagePart;
    return (
      typeof candidate.mime === "string" &&
      (typeof candidate.dataUrl === "string" || typeof candidate.artifactId === "string")
    );
  });
}
