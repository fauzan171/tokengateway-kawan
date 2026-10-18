/**
 * Satu chat: ubah dan hapus (REQ-NT-33/34/35, SDD-3.5).
 *
 * `PATCH` menerima sebagian field (`title`, `folderId`, `pinned`, `archived`);
 * field yang absen tidak disentuh. `DELETE` menghapus chat beserta turunannya.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { deleteChat, updateChat } from "@/lib/chat/chats";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats/{chatId}";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    const chat = await updateChat(db, userId, chatId, await readJson(request));
    return jsonOk({ chat }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    await deleteChat(db, userId, chatId);
    return jsonOk({ deleted: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
