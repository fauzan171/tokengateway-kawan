/**
 * Artefak pengguna (FIX-11): `GET` daftar, `POST` buat dari konten bertipe.
 *
 * Konten diterima sebagai schema `{format, displayName, content|rows}` — tidak
 * pernah path. PDF/DOCX/XLSX/PPTX ditolak di sini sampai FIX-12 memasang renderer.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createArtifact, listArtifacts } from "@/lib/artifacts/create";
import { isArtifactFormat } from "@/lib/artifacts/format";
import { ArtifactError } from "@/lib/artifacts/render";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/artifacts";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ artifacts: await listArtifacts(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);

    const format = body["format"];
    if (!isArtifactFormat(format)) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_FORMAT",
        message: "Format artefak tidak didukung.",
      });
    }
    if (format === "xlsx" || format === "docx" || format === "pdf" || format === "zip") {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "FORMAT_NOT_READY",
        message: "Format ini belum tersedia.",
      });
    }

    const displayName = typeof body["displayName"] === "string" ? body["displayName"] : "";

    const input =
      format === "csv"
        ? Array.isArray(body["rows"])
          ? { format, rows: body["rows"] as unknown[][] }
          : null
        : format === "json"
          ? { format, content: body["content"] }
          : typeof body["content"] === "string"
            ? { format, content: body["content"] }
            : null;

    if (!input) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_CONTENT",
        message: "Konten artefak tidak sesuai format.",
      });
    }

    const artifact = await createArtifact(db, {
      userId,
      chatId: typeof body["chatId"] === "string" ? body["chatId"] : null,
      messageId: typeof body["messageId"] === "string" ? body["messageId"] : null,
      parentArtifactId: typeof body["parentArtifactId"] === "string" ? body["parentArtifactId"] : null,
      displayName,
      input,
    });

    if (artifact.status === "failed") {
      throw new ApiError({
        status: STATUS.INTERNAL,
        code: "ARTIFACT_WRITE_FAILED",
        message: "Berkas gagal disimpan.",
      });
    }

    return jsonOk({ artifact }, reqId, 201);
  } catch (err) {
    if (err instanceof ArtifactError) {
      return handleRouteError(
        new ApiError({
          status: err.code === "TOO_LARGE" ? STATUS.PAYLOAD_TOO_LARGE : STATUS.BAD_REQUEST,
          code: err.code,
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
