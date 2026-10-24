/**
 * Pembuatan gambar (WP-NT-P8-01, REQ-NT-65; FIX-16).
 *
 * `POST /api/kawan/v1/media/images` body `{ prompt, size? }` → `{ artifact }`.
 *
 * FIX-16: hasil TIDAK dikembalikan sebagai data URL base64. Byte-nya disimpan
 * sebagai `Artifact` (format `png`) dengan retention/kuota/owner-check yang
 * sudah ada, lalu klien hanya menerima metadata + id unduhan. Riwayat
 * percakapan menyimpan rujukan artefak, bukan gambar 8 MB yang menetap.
 *
 * Memakai koneksi aktif pengguna; kuncinya tidak pernah masuk respons.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createArtifact } from "@/lib/artifacts/create";
import { generateImage } from "@/lib/media/images";
import { resolveMediaTarget } from "@/lib/media/config";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/media/images";
/** Artefak PNG selalu berekstensi .png; nama dari prompt dipotong 60 karakter. */
const MAX_NAME_CHARS = 60;

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
    const chatId = typeof body["chatId"] === "string" ? body["chatId"] : null;

    const target = await resolveMediaTarget(db, userId);
    const image = await generateImage({ ...target, prompt, ...(size ? { size } : {}) });

    const artifact = await createArtifact(db, {
      userId,
      chatId,
      displayName: `${prompt.trim().slice(0, MAX_NAME_CHARS)}.png`,
      input: { format: "png", bytes: image.bytes },
    });
    if (artifact.status !== "ready") {
      throw new ApiError({
        status: STATUS.INTERNAL,
        code: "ARTIFACT_WRITE_FAILED",
        message: "Gambar berhasil dibuat tetapi gagal disimpan.",
      });
    }

    return jsonOk(
      {
        artifact: {
          id: artifact.id,
          mime: image.mime,
          displayName: artifact.displayName,
          sizeBytes: artifact.sizeBytes,
          expiresAt: artifact.expiresAt,
          downloadUrl: `/api/kawan/v1/artifacts/${encodeURIComponent(artifact.id)}`,
        },
      },
      reqId,
    );
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
