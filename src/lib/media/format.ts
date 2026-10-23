/**
 * Deteksi kontainer media dari magic bytes + batas kerasnya (FIX-16).
 *
 * Seperti FIX-14, label klien tidak dipercaya: berkas bernama .mp4 yang isinya
 * WebM tidak boleh dikirim ke gateway dengan model yang tidak mendukungnya.
 * Deteksi di sini hanya memutuskan "kontainer apa" — bukan "codec-nya didukung".
 */

export type MediaKind = "audio" | "video" | "unknown";

export type MediaContainer = {
  kind: MediaKind;
  container: string;
  /** MIME yang cocok dengan isi; dipakai sebagai `content-type` ke gateway. */
  mime: string;
};

/** Batas berkas media yang boleh masuk. Sama untuk unggah dan rekaman. */
export const MEDIA_LIMITS = {
  maxAudioBytes: 25 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
} as const;

function at(buf: Uint8Array, offset: number, ascii: string): boolean {
  if (buf.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i += 1) {
    if (buf[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Kontainer dari byte awal. Sengaja daftar tertutup: format di luar daftar
 * dilaporkan `unknown`, bukan ditebak lalu dikirim ke gateway.
 */
export function detectContainer(buf: Uint8Array): MediaContainer {
  // ISO-BMFF (mp4/m4a/mov): kotak `ftyp` dengan brand setelahnya.
  if (at(buf, 4, "ftyp")) {
    const brand = String.fromCharCode(...buf.subarray(8, 12));
    const audioOnly = brand.startsWith("M4A") || brand.startsWith("M4B");
    return {
      kind: audioOnly ? "audio" : "video",
      container: brand.startsWith("qt") ? "mov" : "mp4",
      mime: audioOnly ? "audio/mp4" : "video/mp4",
    };
  }
  // Matroska/WebM: EBML header 1A 45 DF A3.
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { kind: "video", container: "webm", mime: "video/webm" };
  }
  if (at(buf, 0, "OggS")) return { kind: "audio", container: "ogg", mime: "audio/ogg" };
  if (at(buf, 0, "RIFF") && at(buf, 8, "WAVE")) {
    return { kind: "audio", container: "wav", mime: "audio/wav" };
  }
  if (at(buf, 0, "#!AMR")) return { kind: "audio", container: "amr", mime: "audio/amr" };
  if (at(buf, 0, "ID3") || (buf[0] === 0xff && (buf[1] ?? 0) >= 0xe0)) {
    return { kind: "audio", container: "mp3", mime: "audio/mpeg" };
  }
  // WebM hasil rekaman MediaRecorder kadang hanya EBML tanpa video; tetap video.
  return { kind: "unknown", container: "unknown", mime: "application/octet-stream" };
}

/** Ukuran maksimum untuk jenis yang terdeteksi; `unknown` memakai batas audio. */
export function limitFor(kind: MediaKind): number {
  return kind === "video" ? MEDIA_LIMITS.maxVideoBytes : MEDIA_LIMITS.maxAudioBytes;
}
