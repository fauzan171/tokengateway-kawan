/**
 * Analisis video (FIX-16).
 *
 * `POST /api/kawan/v1/media/video` — `multipart/form-data` field `file`.
 *
 * Metadata → sampling frame → audio → STT (bila `MEDIA_STT_MODEL` ada) di
 * runner. Respons selalu memuat `coverage` yang menyebut berapa frame benar-
 * benar diambil, jadi rangkuman tidak dapat mengklaim "menonton semua frame".
 * Tanpa ffprobe/ffmpeg jawabannya 503 `ENGINE_MISSING`, bukan video kosong.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { resolveMediaTarget } from "@/lib/media/config";
import { transcribeAudio } from "@/lib/media/audio";
import { detectContainer, limitFor } from "@/lib/media/format";
import { VideoUnavailable, analyzeVideo } from "@/lib/media/video";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/media/video";
/** Batas pratinjau frame yang dikirim balik; sisanya hanya metadata. */
const MAX_PREVIEW_FRAMES = 12;
const MAX_PREVIEW_BYTES = 256 * 1024;

/** Alasan mesin → status HTTP jujur; tidak ada yang dipoles jadi 200. */
const STATUS_BY_REASON: Record<string, (typeof STATUS)[keyof typeof STATUS]> = {
  ENGINE_MISSING: STATUS.SERVICE_UNAVAILABLE,
  TIMEOUT: STATUS.BAD_GATEWAY,
  TOO_LARGE: STATUS.PAYLOAD_TOO_LARGE,
  UNSUPPORTED: STATUS.UNSUPPORTED_MEDIA_TYPE,
  ENGINE_FAILED: STATUS.BAD_GATEWAY,
};

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();

    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      file = null;
    }
    if (!(file instanceof File)) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_UPLOAD",
        message: "Berkas video tidak ditemukan pada permintaan.",
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectContainer(bytes.subarray(0, 64));
    if (detected.kind !== "video") {
      throw new ApiError({
        status: STATUS.UNSUPPORTED_MEDIA_TYPE,
        code: "UNSUPPORTED_CODEC",
        message: "Berkas itu bukan video yang dikenali (MP4/WebM).",
      });
    }
    if (bytes.byteLength > limitFor("video")) {
      throw new ApiError({
        status: STATUS.PAYLOAD_TOO_LARGE,
        code: "VIDEO_TOO_LARGE",
        message: "Berkas video melebihi 100 MB.",
      });
    }

    const target = await resolveMediaTarget(db, userId);
    const analysis = await analyzeVideo(bytes);

    // Transkrip hanya bila STT dikonfigurasi; kegagalannya dicatat sebagai
    // peringatan, tidak membatalkan analisis visual.
    const warnings: string[] = [];
    let transcript: { start: number; end: number; text: string; speaker?: "A" | "B" }[] = [];
    let fullText: string | null = null;
    const sttModel = process.env["MEDIA_STT_MODEL"]?.trim();
    if (analysis.audio && sttModel) {
      try {
        const result = await transcribeAudio({
          ...target,
          model: sttModel,
          file: new File([new Uint8Array(analysis.audio.bytes)], "audio.wav", { type: "audio/wav" }),
          filename: "audio.wav",
        });
        transcript = result.segments;
        fullText = result.text;
      } catch (err) {
        warnings.push(
          err instanceof ApiError ? err.message : "Transkripsi video gagal; hanya frame yang dianalisis.",
        );
      }
    } else if (analysis.audio && !sttModel) {
      warnings.push("STT belum dikonfigurasi; audio video tidak ditranskripsi.");
    }

    const previewable = analysis.frames
      .filter((frame) => frame.bytes.byteLength <= MAX_PREVIEW_BYTES)
      .slice(0, MAX_PREVIEW_FRAMES);

    return jsonOk(
      {
        metadata: analysis.metadata,
        coverage: analysis.coverage,
        limits: analysis.limits,
        frames: analysis.frames.map((frame) => {
          const preview = previewable.includes(frame);
          return {
            seconds: frame.seconds,
            mime: frame.mime,
            bytes: frame.bytes.byteLength,
            ...(preview
              ? { dataUrl: `data:image/jpeg;base64,${Buffer.from(frame.bytes).toString("base64")}` }
              : {}),
          };
        }),
        failedFrames: analysis.failedFrames,
        transcript,
        text: fullText,
        warnings,
      },
      reqId,
    );
  } catch (err) {
    if (err instanceof VideoUnavailable) {
      return handleRouteError(
        new ApiError({
          status: STATUS_BY_REASON[err.reason] ?? STATUS.BAD_GATEWAY,
          code: err.reason,
          message: err.message,
        }),
        reqId,
        ROUTE,
        started,
      );
    }
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
