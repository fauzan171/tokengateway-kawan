/**
 * Satu dokumen pengguna (WP-NT-P6-09, SDD-6.4): `DELETE` menghapus berkas,
 * baris, dan chunk-nya.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { removeDocument } from "@/lib/documents/remove";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/documents/{documentId}";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { documentId } = await context.params;

    const { removed } = await removeDocument(db, { userId, documentId });
    if (!removed) {
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "DOCUMENT_NOT_FOUND",
        message: "Dokumen tidak ditemukan.",
      });
    }

    return jsonOk({ documentId, removed: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
