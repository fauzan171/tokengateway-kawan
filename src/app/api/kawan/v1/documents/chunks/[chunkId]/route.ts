/**
 * Satu potongan dokumen untuk panel sitasi (WP-NT-P6-08, REQ-NT-57).
 *
 * Kepemilikan disaring di level query, sama seperti retrieval: potongan milik
 * pengguna lain tidak pernah keluar dari database.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/documents/chunks/{chunkId}";

type RouteContext = { params: Promise<{ chunkId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chunkId } = await context.params;

    const chunk = await db.documentChunk.findFirst({
      where: { id: chunkId, document: { userId } },
      select: { id: true, text: true, page: true, document: { select: { filename: true } } },
    });
    if (!chunk) {
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "CHUNK_NOT_FOUND",
        message: "Potongan dokumen tidak ditemukan.",
      });
    }

    return jsonOk(
      { chunkId: chunk.id, filename: chunk.document.filename, page: chunk.page, text: chunk.text },
      reqId,
    );
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
