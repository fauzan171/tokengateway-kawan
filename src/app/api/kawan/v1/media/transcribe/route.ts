/**
 * Transkripsi audio (WP-NT-P8-03, REQ-NT-67).
 *
 * `POST /api/kawan/v1/media/transcribe` — `multipart/form-data` field `file`.
 * Hanya `audio/*` yang diterima; tipe lain ditolak sebelum menyentuh gateway.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { resolveMediaTarget } from "@/lib/media/config";
import { transcribeAudio } from "@/lib/media/audio";

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
    if (!file.type.startsWith("audio/")) {
      throw new ApiError({
        status: STATUS.UNSUPPORTED_MEDIA_TYPE,
        code: "UNSUPPORTED_AUDIO",
        message: "Hanya berkas audio yang dapat ditranskripsi.",
      });
    }

    const target = await resolveMediaTarget(db, userId);
    const result = await transcribeAudio({
      ...target,
      file,
      filename: file.name || "audio",
    });
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
