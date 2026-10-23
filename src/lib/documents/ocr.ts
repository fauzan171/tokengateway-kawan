/**
 * OCR dan probe vision (FIX-14).
 *
 * PDF hasil pindai tidak punya lapisan teks. Dua jawaban yang benar:
 *   - OCR berjalan dan hasilnya diberi label keyakinan, atau
 *   - OCR tidak tersedia dan pengguna diberi ALASAN, bukan halaman kosong.
 *
 * Yang dilarang: menyajikan tebakan OCR sebagai teks pasti. Karena itu
 * `confidence` selalu ikut, dan `needsReview` menandai bagian meragukan.
 *
 * Mesin OCR dijalankan sebagai proses terpisah di runner yang tidak memegang
 * secret atau mount host — tidak ada evaluasi di dalam proses web.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/** Tesseract membaca berkas dari stdin; `execFile` tidak bisa mengalirkan input. */
function runTesseract(engine: string, args: string[], data: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(engine, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("OCR_TIMEOUT"));
    }, OCR_LIMITS.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`OCR_EXIT_${code}:${stderr.slice(0, 200)}`));
    });
    child.stdin.on("error", () => {
      // Pipe ditutup mesin yang sudah keluar; kegagalan dilaporkan lewat `close`.
    });
    child.stdin.end(data);
  });
}

export const OCR_LIMITS = {
  /** Halaman per dokumen; sisanya dilaporkan, bukan diproses diam-diam. */
  maxPages: 50,
  /** Di bawah ini hasil dianggap perlu ditinjau manusia. */
  reviewBelowConfidence: 70,
  timeoutMs: 60_000,
} as const;

export type OcrUnavailableReason =
  | "ENGINE_MISSING"
  | "PAGES_EXCEEDED"
  | "ENGINE_FAILED"
  | "TIMEOUT";

export class OcrUnavailable extends Error {
  readonly reason: OcrUnavailableReason;

  constructor(reason: OcrUnavailableReason, message: string) {
    super(message);
    this.name = "OcrUnavailable";
    this.reason = reason;
  }
}

export type OcrPage = {
  page: number;
  text: string;
  /** Rata-rata keyakinan 0–100. BUKAN probabilitas jawaban benar. */
  confidence: number;
  needsReview: boolean;
};

export type OcrResult = {
  engine: "tesseract";
  languages: string[];
  pages: OcrPage[];
  /** Halaman yang tidak diproses karena batas. */
  skippedPages: number;
};

/** Jalur biner OCR; `null` bila tidak terpasang. Tidak menebak dari PATH saja. */
export function ocrEnginePath(): string | null {
  const configured = process.env["KAWAN_TESSERACT_PATH"];
  if (configured && existsSync(configured)) return configured;
  for (const candidate of ["/usr/bin/tesseract", "/usr/local/bin/tesseract"]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function ocrCapability(): { available: boolean; reason: OcrUnavailableReason | null } {
  return ocrEnginePath()
    ? { available: true, reason: null }
    : { available: false, reason: "ENGINE_MISSING" };
}

/** Bahasa OCR: Indonesia + Inggris, sesuai isi dokumen pengguna di sini. */
export const OCR_LANGUAGES = ["ind", "eng"] as const;

/**
 * OCR satu berkas gambar. Melempar `OcrUnavailable` dengan alasan eksplisit
 * bila mesin tidak ada, batas halaman terlampaui, atau mesin gagal.
 */
export async function ocrImage(
  data: Buffer,
  input: { page?: number; languages?: readonly string[] } = {},
): Promise<OcrResult> {
  const engine = ocrEnginePath();
  if (!engine) {
    throw new OcrUnavailable(
      "ENGINE_MISSING",
      "OCR tidak tersedia di server ini (mesin Tesseract tidak terpasang).",
    );
  }
  const page = input.page ?? 1;
  if (page > OCR_LIMITS.maxPages) {
    throw new OcrUnavailable(
      "PAGES_EXCEEDED",
      `Batas OCR ${OCR_LIMITS.maxPages} halaman terlampaui.`,
    );
  }

  const languages = (input.languages ?? OCR_LANGUAGES).join("+");
  try {
    const stdout = await runTesseract(engine, ["stdin", "stdout", "-l", languages, "tsv"], data);
    const { text, confidence } = parseTsv(stdout);
    return {
      engine: "tesseract",
      languages: [...(input.languages ?? OCR_LANGUAGES)],
      pages: [
        {
          page,
          text,
          confidence,
          needsReview: confidence < OCR_LIMITS.reviewBelowConfidence,
        },
      ],
      skippedPages: 0,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OcrUnavailable("TIMEOUT", "OCR melebihi batas waktu.");
    }
    throw new OcrUnavailable("ENGINE_FAILED", "Mesin OCR gagal memproses berkas.");
  }
}

/** TSV Tesseract: kolom ke-12 teks, kolom ke-11 confidence (-1 untuk baris non-kata). */
export function parseTsv(tsv: string): { text: string; confidence: number } {
  const lines = tsv.split("\n").slice(1);
  const words: string[] = [];
  const scores: number[] = [];
  let lastLine = "";

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;
    const conf = Number(cols[10]);
    const word = (cols[11] ?? "").trim();
    if (!word || Number.isNaN(conf) || conf < 0) continue;
    const lineKey = `${cols[1]}:${cols[2]}:${cols[3]}:${cols[4]}`;
    if (lastLine !== "" && lineKey !== lastLine) words.push("\n");
    lastLine = lineKey;
    words.push(word);
    scores.push(conf);
  }

  const confidence =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  return { text: words.join(" ").replace(/ ?\n ?/g, "\n").trim(), confidence };
}

export type VisionProbe = {
  /** Apakah model yang dipilih bisa menerima gambar. */
  supported: boolean;
  /** Batas piksel sisi terpanjang setelah resize. */
  maxPixels: number;
  /** Gambar lebih besar dari ini harus diperkecil sebelum dikirim. */
  requiresConsent: boolean;
  reason: string | null;
};

export const VISION_LIMITS = {
  /** 1568 px sisi terpanjang: batas umum model vision sebelum di-resize. */
  maxPixels: 1568,
  /** Di atas ini gambar dikirim ke penyedia pihak ketiga → butuh izin. */
  requiresConsent: true,
} as const;

/**
 * Probe kemampuan vision untuk satu model. Tidak mengirim gambar ke mana pun:
 * ini hanya menjawab "boleh/tidak" sebelum pengguna menyetujui pengiriman.
 */
export function probeVision(model: string | null | undefined): VisionProbe {
  if (!model) {
    return {
      supported: false,
      maxPixels: VISION_LIMITS.maxPixels,
      requiresConsent: VISION_LIMITS.requiresConsent,
      reason: "Model belum dipilih.",
    };
  }
  const lowered = model.toLowerCase();
  const vision = ["gpt-4o", "gpt-4.1", "claude", "gemini", "llava", "qwen2-vl", "pixtral"].some(
    (needle) => lowered.includes(needle),
  );
  return {
    supported: vision,
    maxPixels: VISION_LIMITS.maxPixels,
    requiresConsent: VISION_LIMITS.requiresConsent,
    reason: vision ? null : `Model "${model}" tidak menyatakan dukungan gambar.`,
  };
}
