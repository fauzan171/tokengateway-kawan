/**
 * Bagian isi pesan (SDD-2.2) — pembacaan murni, aman diimpor komponen klien.
 *
 * Bentuk kanonik `contentJson`: `{ parts: [{ kind: "text", text }] }`, ditambah
 * `{ kind: "image", mime, dataUrl }` bila pesan membawa gambar (REQ-NT-46).
 * Nilai rusak tidak boleh menjatuhkan pembacaan riwayat, jadi bagian yang tidak
 * dikenali dilewati. Validasi lampiran ada di `./attachments` (server-only).
 */

export type ContentPart = { kind?: string; text?: string };

/** Bagian gambar: data URL ditanam di `contentJson`, tanpa tabel atau disk baru. */
export type ImagePart = { kind: "image"; mime: string; dataUrl: string };

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
  return parseParts(contentJson).filter(
    (part): part is ImagePart =>
      part.kind === "image" &&
      typeof (part as ImagePart).dataUrl === "string" &&
      typeof (part as ImagePart).mime === "string",
  );
}
