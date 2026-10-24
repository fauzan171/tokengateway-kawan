/**
 * Coba lagi ekstraksi dokumen yang gagal (WP-NT-P6-10, REQ-NT-54).
 *
 * Hanya status `failed` yang boleh diulang: dokumen `queued`/`processing`
 * sudah punya job, dan `ready` tidak butuh ekstraksi lagi.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { enqueue } from "@/lib/jobs/queue";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/documents/{documentId}/retry";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { documentId } = await context.params;

    const document = await db.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true, status: true },
    });
    if (!document) {
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "DOCUMENT_NOT_FOUND",
        message: "Dokumen tidak ditemukan.",
      });
    }
    if (document.status !== "failed") {
      throw new ApiError({
        status: STATUS.CONFLICT,
        code: "DOCUMENT_NOT_RETRYABLE",
        message: "Dokumen ini tidak sedang gagal, jadi tidak perlu dicoba lagi.",
      });
    }

    await db.document.update({
      where: { id: document.id },
      data: { status: "queued", errorCode: null },
    });
    await enqueue(db, { kind: "document.extract", payload: { documentId: document.id } });

    return jsonOk({ documentId: document.id, status: "queued" }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
