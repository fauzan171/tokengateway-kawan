/**
 * Analisis video di runner (FIX-16).
 *
 * Alurnya: ffprobe metadata → rencana sampling frame → FFmpeg ekstrak frame
 * bertimestamp + audio → STT (opsional). Semua batas (durasi, FPS sample,
 * jumlah frame, piksel, ukuran output) ditegakkan di sini, bukan diserahkan ke
 * pemanggil.
 *
 * Dua klaim yang dilarang dan karena itu tidak punya API-nya:
 *   - "sudah menonton semua frame" — `coverage` selalu menyebut jumlah frame
 *     yang BENAR-BENAR diambil dan berapa yang dilewati;
 *   - "pembicara itu Budi" — diarization hanya label A/B.
 *
 * Bila ffmpeg/ffprobe tidak terpasang, hasilnya `ENGINE_MISSING` (bukan video
 * kosong). Tidak ada eksekusi di proses web: semuanya lewat `spawn`.
 */

import { spawn } from "node:child_process";

export const VIDEO_LIMITS = {
  maxDurationSeconds: 600,
  sampleEverySeconds: 5,
  maxFrames: 120,
  maxWidth: 1280,
  maxHeight: 720,
  /** Byte video yang diterima. */
  maxBytes: 100 * 1024 * 1024,
  /** Batas satu proses ffmpeg/ffprobe. */
  timeoutMs: 120_000,
  /** Byte audio yang dikirim ke STT. */
  maxAudioBytes: 25 * 1024 * 1024,
} as const;

export type VideoUnavailableReason =
  | "ENGINE_MISSING"
  | "UNSUPPORTED"
  | "TOO_LARGE"
  | "TIMEOUT"
  | "ENGINE_FAILED";

export class VideoUnavailable extends Error {
  readonly reason: VideoUnavailableReason;

  constructor(reason: VideoUnavailableReason, message: string) {
    super(message);
    this.name = "VideoUnavailable";
    this.reason = reason;
  }
}

export type VideoMetadata = {
  durationSeconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  codec: string | null;
  /** Estimasi dari durasi × fps; bukan jumlah frame yang diperiksa. */
  totalFramesEstimate: number | null;
  truncatedDuration: boolean;
};

export type SampledFrame = { seconds: number; mime: string; bytes: Uint8Array };

export type TranscriptSegment = { start: number; end: number; text: string; speaker?: "A" | "B" };

export type VideoAnalysis = {
  metadata: VideoMetadata;
  frames: SampledFrame[];
  /** Frame yang direncanakan tetapi gagal diambil — dilaporkan, tidak disembunyikan. */
  failedFrames: number[];
  audio: { bytes: Uint8Array } | null;
  transcript: TranscriptSegment[];
  /** Kalimat jujur tentang cakupan; dipakai UI dan prompt. */
  coverage: string;
  limits: typeof VIDEO_LIMITS;
};

function run(binary: string, args: string[], stdin: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new VideoUnavailable("TIMEOUT", "Pemrosesan video melebihi batas waktu."));
    }, VIDEO_LIMITS.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8").slice(0, 400);
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new VideoUnavailable(
          err.code === "ENOENT" ? "ENGINE_MISSING" : "ENGINE_FAILED",
          err.code === "ENOENT"
            ? "ffmpeg/ffprobe tidak tersedia di runner ini."
            : "Pemrosesan video gagal dijalankan.",
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new VideoUnavailable("ENGINE_FAILED", stderr.trim() || `kode keluar ${code}`));
    });
    child.stdin.on("error", () => {
      // Pipe ditutup proses yang sudah keluar; kegagalan dilaporkan lewat close.
    });
    child.stdin.end(stdin);
  });
}

/** Parse JSON ffprobe; bentuk tak dikenal → `UNSUPPORTED`, bukan metadata karangan. */
export function parseProbeJson(raw: string): VideoMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VideoUnavailable("ENGINE_FAILED", "Metadata video tidak terbaca.");
  }
  const record = (parsed ?? {}) as { format?: { duration?: unknown }; streams?: unknown };
  const streams = Array.isArray(record.streams) ? (record.streams as Record<string, unknown>[]) : [];
  const video = streams.find((stream) => stream["codec_type"] === "video");
  const audio = streams.find((stream) => stream["codec_type"] === "audio");
  if (!video) throw new VideoUnavailable("UNSUPPORTED", "Berkas tidak memuat aliran video.");

  const rawDuration = Number(record.format?.duration ?? video["duration"]);
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;
  const width = Number(video["width"]);
  const height = Number(video["height"]);
  const fpsText = String(video["avg_frame_rate"] ?? "");
  const [num, den] = fpsText.split("/").map((part) => Number(part));
  const fps = Number.isFinite(num) && Number.isFinite(den) && den > 0 ? (num as number) / (den as number) : null;

  return {
    durationSeconds,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    fps: fps !== null && Number.isFinite(fps) ? fps : null,
    hasAudio: audio !== undefined,
    codec: typeof video["codec_name"] === "string" ? video["codec_name"] : null,
    totalFramesEstimate:
      fps !== null && durationSeconds > 0 ? Math.round(fps * durationSeconds) : null,
    truncatedDuration: durationSeconds > VIDEO_LIMITS.maxDurationSeconds,
  };
}

/**
 * Timestamp frame yang akan diambil. Dibatasi durasi, jumlah frame, dan
 * kepadatan sample — video 3 jam tidak menghasilkan 2.160 frame.
 */
export function planFrameTimestamps(metadata: VideoMetadata): number[] {
  if (metadata.durationSeconds <= 0) return [];
  const usable = Math.min(metadata.durationSeconds, VIDEO_LIMITS.maxDurationSeconds);
  const stamps: number[] = [];
  for (
    let seconds = 0;
    seconds < usable && stamps.length < VIDEO_LIMITS.maxFrames;
    seconds += VIDEO_LIMITS.sampleEverySeconds
  ) {
    stamps.push(seconds);
  }
  return stamps;
}

/** Cakupan yang boleh diklaim; tidak pernah menyiratkan seluruh frame diperiksa. */
export function coverageText(metadata: VideoMetadata, sampled: number, failed: number): string {
  const parts = [
    `${sampled} frame diambil setiap ${VIDEO_LIMITS.sampleEverySeconds} detik`,
  ];
  if (metadata.totalFramesEstimate !== null) {
    parts.push(`dari estimasi ${metadata.totalFramesEstimate} frame total`);
  }
  if (metadata.truncatedDuration) {
    parts.push(`hanya ${VIDEO_LIMITS.maxDurationSeconds} detik pertama yang diproses`);
  }
  if (failed > 0) parts.push(`${failed} frame gagal diambil`);
  parts.push("frame di antaranya TIDAK diperiksa");
  return `${parts.join("; ")}.`;
}

export async function probeVideo(bytes: Uint8Array): Promise<VideoMetadata> {
  if (bytes.byteLength > VIDEO_LIMITS.maxBytes) {
    throw new VideoUnavailable("TOO_LARGE", "Berkas video melebihi 100 MB.");
  }
  const raw = await run(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-i", "pipe:0"],
    bytes,
  );
  return parseProbeJson(raw.toString("utf8"));
}

/** Satu frame JPEG pada `seconds`; `null` bila gagal — pemanggil mencatatnya. */
export async function extractFrame(bytes: Uint8Array, seconds: number): Promise<Uint8Array | null> {
  try {
    const frame = await run(
      "ffmpeg",
      [
        "-v", "error",
        "-ss", String(seconds),
        "-i", "pipe:0",
        "-frames:v", "1",
        "-vf", `scale='min(${VIDEO_LIMITS.maxWidth},iw)':'min(${VIDEO_LIMITS.maxHeight},ih)':force_original_aspect_ratio=decrease`,
        "-f", "image2pipe",
        "-vcodec", "mjpeg",
        "pipe:1",
      ],
      bytes,
    );
    return frame.byteLength > 0 ? new Uint8Array(frame) : null;
  } catch {
    return null;
  }
}

/** Audio mono 16 kHz untuk STT; `null` bila tidak ada audio atau terlalu besar. */
export async function extractAudio(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const audio = await run(
      "ffmpeg",
      ["-v", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
      bytes,
    );
    if (audio.byteLength === 0 || audio.byteLength > VIDEO_LIMITS.maxAudioBytes) return null;
    return new Uint8Array(audio);
  } catch {
    return null;
  }
}

/**
 * Metadata → sampling → audio. STT dijalankan pemanggil (route) karena butuh
 * koneksi pengguna; modul ini hanya menyiapkan bahannya.
 */
export async function analyzeVideo(
  bytes: Uint8Array,
  options: { sample?: boolean } = {},
): Promise<Omit<VideoAnalysis, "transcript">> {
  const metadata = await probeVideo(bytes);
  const frames: SampledFrame[] = [];
  const failedFrames: number[] = [];

  if (options.sample !== false) {
    for (const seconds of planFrameTimestamps(metadata)) {
      const frame = await extractFrame(bytes, seconds);
      if (frame) frames.push({ seconds, mime: "image/jpeg", bytes: frame });
      else failedFrames.push(seconds);
    }
  }

  const audio = metadata.hasAudio ? await extractAudio(bytes) : null;
  return {
    metadata,
    frames,
    failedFrames,
    audio: audio ? { bytes: audio } : null,
    coverage: coverageText(metadata, frames.length, failedFrames.length),
    limits: VIDEO_LIMITS,
  };
}
