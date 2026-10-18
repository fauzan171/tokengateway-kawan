/**
 * Pembuatan gambar (WP-NT-P8-01, REQ-NT-65).
 *
 * `POST /api/kawan/v1/media/images` body `{ prompt, size? }` → `{ image }`.
 * Memakai koneksi aktif pengguna; kuncinya tidak pernah masuk respons.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { generateImage } from "@/lib/media/images";
import { resolveMediaTarget } from "@/lib/media/config";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/media/images";

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);

    const prompt = typeof body["prompt"] === "string" ? body["prompt"] : "";
    if (!prompt.trim()) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_PROMPT",
        message: "Prompt gambar tidak boleh kosong.",
      });
    }
    const size = typeof body["size"] === "string" ? body["size"] : undefined;

    const target = await resolveMediaTarget(db, userId);
    const image = await generateImage({ ...target, prompt, ...(size ? { size } : {}) });
    return jsonOk({ image: image.dataUrl }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
