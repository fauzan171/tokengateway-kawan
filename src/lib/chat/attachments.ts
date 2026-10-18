/**
 * Validasi lampiran gambar dari body klien (REQ-NT-46).
 *
 * Server-only: `ApiError` menarik `node:crypto`, jadi modul ini tidak boleh
 * diimpor komponen klien. Pembacaan bagian ada di `./content`.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import { IMAGE_MIMES, MAX_IMAGE_BYTES, MAX_IMAGES, type ImagePart } from "./content";

/**
 * Batas ukuran dihitung dari base64 yang didekode, bukan panjang string — gambar
 * 4 MB menjadi ~5,3 MB teks. `shortcut:` gambar ditanam sebagai data URL di
 * `contentJson`; pindah ke penyimpanan objek bila pesan bergambar membebani DB.
 */
export function validateAttachments(raw: unknown): ImagePart[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw invalid("Lampiran harus berupa array.");
  if (raw.length > MAX_IMAGES) throw invalid(`Maksimal ${MAX_IMAGES} gambar per pesan.`);

  return raw.map((entry) => {
    const item = entry as { mime?: unknown; dataUrl?: unknown };
    const mime = typeof item?.mime === "string" ? item.mime : "";
    const dataUrl = typeof item?.dataUrl === "string" ? item.dataUrl : "";
    if (!(IMAGE_MIMES as readonly string[]).includes(mime)) {
      throw invalid("Jenis gambar tidak didukung.");
    }
    // Prefiks harus cocok dengan mime yang diklaim, kalau tidak data URL berbohong.
    if (!dataUrl.startsWith(`data:${mime};base64,`)) {
      throw invalid("Data gambar tidak cocok dengan jenisnya.");
    }
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    if (Buffer.byteLength(base64, "base64") > MAX_IMAGE_BYTES) {
      throw invalid("Ukuran gambar melebihi 4 MB.");
    }
    return { kind: "image", mime, dataUrl };
  });
}

function invalid(message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_ATTACHMENT", message });
}
