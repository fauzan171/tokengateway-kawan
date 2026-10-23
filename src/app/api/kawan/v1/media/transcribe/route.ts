/**
 * Transkripsi audio (WP-NT-P8-03, REQ-NT-67; FIX-16).
 *
 * `POST /api/kawan/v1/media/transcribe` — `multipart/form-data` field `file`.
 *
 * FIX-16: format ditentukan dari magic bytes, bukan dari label klien; kontainer
 * di luar allowlist ditolak dengan kode eksplisit. Hasil memuat transkrip dan
 * timestamp per segmen bila gateway menyediakannya — segmen kosong berarti
 * gateway tidak mendukung, bukan timestamp karangan. `speaker` hanya label A/B.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { resolveMediaTarget } from "@/lib/media/config";
import { transcribeAudio } from "@/lib/media/audio";
import { detectContainer, limitFor } from "@/lib/media/format";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/media/transcribe";

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
        message: "Berkas audio tidak ditemukan pada permintaan.",
      });
    }

    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const detected = detectContainer(head);
    if (detected.kind === "unknown") {
      throw new ApiError({
        status: STATUS.UNSUPPORTED_MEDIA_TYPE,
        code: "UNSUPPORTED_CODEC",
        message: "Format audio tidak dikenali. Gunakan WAV, MP3, M4A, OGG, atau WebM.",
      });
    }
    if (detected.kind !== "audio") {
      throw new ApiError({
        status: STATUS.UNSUPPORTED_MEDIA_TYPE,
        code: "UNSUPPORTED_CODEC",
        message: "Berkas itu video. Transkripsi video belum didukung.",
      });
    }
    if (file.size > limitFor("audio")) {
      throw new ApiError({
        status: STATUS.PAYLOAD_TOO_LARGE,
        code: "AUDIO_TOO_LARGE",
        message: "Berkas audio melebihi 25 MB.",
      });
    }

    const target = await resolveMediaTarget(db, userId);
    // Nama berkas dari klien dipakai untuk ekstensi saja; isinya sudah diperiksa
    // dari byte, jadi tidak ada parser yang dipilih dari label.
    const result = await transcribeAudio({
      ...target,
      file: new File([await file.arrayBuffer()], `rekaman.${detected.container}`, {
        type: detected.mime,
      }),
      filename: `rekaman.${detected.container}`,
    });
    return jsonOk({ ...result, container: detected.container }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
