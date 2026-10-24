/**
 * Satu folder: `PATCH` ganti nama, `DELETE` hapus folder tanpa menghapus chat
 * (REQ-NT-35; FK `Chat.folderId` memakai `SetNull`).
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { deleteFolder, renameFolder } from "@/lib/chat/folders";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/folders/{folderId}";

type RouteContext = { params: Promise<{ folderId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { folderId } = await context.params;
    const body = await readJson(request);
    return jsonOk({ folder: await renameFolder(db, userId, folderId, body.name) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { folderId } = await context.params;
    await deleteFolder(db, userId, folderId);
    return jsonOk({ deleted: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
