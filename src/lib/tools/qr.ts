/**
 * QR (FIX-15): buat, lalu **decode ulang** untuk membuktikan hasilnya terbaca.
 *
 * Matriks QR dibangun `qrcode`, lalu dirasterisasi sendiri (skala + quiet zone)
 * dan dibaca kembali oleh `jsqr` — decoder independen. Kalau hasil decode tidak
 * sama dengan payload, gambar ditolak. Tanpa langkah ini "QR berhasil dibuat"
 * hanya berarti "fungsi tidak melempar".
 *
 * Barcode 1D tidak diimplementasikan: tidak ada encoder/decoder terpasang, dan
 * menulis tabel pola Code128 dari ingatan berarti mengarang. Permintaan barcode
 * dijawab `UNSUPPORTED_SYMBOLOGY` alih-alih gambar yang tidak bisa diverifikasi.
 */

import jsQR from "jsqr";
import QRCode from "qrcode";

export const QR_LIMITS = {
  /** Panjang payload; QR versi tinggi dengan data raksasa tidak berguna di chat. */
  maxPayloadChars: 1_200,
  /** Skala modul → piksel. */
  scale: 4,
  /** Quiet zone wajib 4 modul (spesifikasi QR). */
  quietZone: 4,
} as const;

export class QrError extends Error {
  readonly code: "INVALID_PAYLOAD" | "ENCODE_FAILED" | "DECODE_MISMATCH" | "UNSUPPORTED_SYMBOLOGY";

  constructor(code: QrError["code"], message: string) {
    super(message);
    this.name = "QrError";
    this.code = code;
  }
}

export type QrResult = {
  /** SVG siap tempel; tidak memuat script. */
  svg: string;
  /** Teks yang benar-benar terbaca kembali dari gambar. */
  decoded: string;
  /** Payload yang ditampilkan ke pengguna sebelum dikirim. */
  preview: string;
  modules: number;
};

/** Rasterisasi matriks → RGBA. Dipakai untuk verifikasi decode. */
function rasterize(matrix: { size: number; data: Uint8Array }): {
  pixels: Uint8ClampedArray;
  width: number;
} {
  const scale = QR_LIMITS.scale;
  const quiet = QR_LIMITS.quietZone;
  const width = (matrix.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);

  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.data[y * matrix.size + x] === 0) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (x + quiet) * scale + dx;
          const py = (y + quiet) * scale + dy;
          const offset = (py * width + px) * 4;
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        }
      }
    }
  }
  return { pixels, width };
}

/** Matriks → SVG (satu `<path>`, tanpa script). */
function toSvg(matrix: { size: number; data: Uint8Array }): string {
  const quiet = QR_LIMITS.quietZone;
  const total = matrix.size + quiet * 2;
  const segments: string[] = [];
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.data[y * matrix.size + x] === 0) continue;
      segments.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="Kode QR">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${segments.join("")}" fill="#000"/>` +
    `</svg>`
  );
}

/**
 * Buat QR dan buktikan bisa dibaca kembali. Payload kosong, terlalu panjang,
 * atau yang gagal diverifikasi → `QrError`, bukan gambar diam-diam rusak.
 */
export function makeQr(payload: string): QrResult {
  if (typeof payload !== "string" || payload.trim() === "") {
    throw new QrError("INVALID_PAYLOAD", "Payload QR tidak boleh kosong.");
  }
  if (payload.length > QR_LIMITS.maxPayloadChars) {
    throw new QrError(
      "INVALID_PAYLOAD",
      `Payload QR melebihi ${QR_LIMITS.maxPayloadChars} karakter.`,
    );
  }

  let matrix: { size: number; data: Uint8Array };
  try {
    const created = QRCode.create(payload, { errorCorrectionLevel: "M" });
    matrix = { size: created.modules.size, data: created.modules.data as Uint8Array };
  } catch (err) {
    throw new QrError("ENCODE_FAILED", `QR tidak bisa dibuat: ${err instanceof Error ? err.message : "gagal"}`);
  }

  const { pixels, width } = rasterize(matrix);
  const decoded = jsQR(pixels, width, width);
  if (!decoded || decoded.data !== payload) {
    throw new QrError("DECODE_MISMATCH", "QR yang dibuat tidak terbaca kembali dengan isi yang sama.");
  }

  return { svg: toSvg(matrix), decoded: decoded.data, preview: payload, modules: matrix.size };
}

/** Barcode 1D belum didukung — jawab eksplisit, jangan gambar tanpa verifikasi. */
export function makeBarcode(): never {
  throw new QrError(
    "UNSUPPORTED_SYMBOLOGY",
    "Barcode 1D belum tersedia: tidak ada encoder/decoder yang terpasang dan terverifikasi.",
  );
}
