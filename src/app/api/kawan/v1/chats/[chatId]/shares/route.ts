/**
 * Tautan berbagi satu chat (REQ-NT-36/37/38): daftar, buat, cabut.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createShareLink, listShareLinks, revokeShareLinks } from "@/lib/chat/share";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats/{chatId}/shares";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    return jsonOk({ shares: await listShareLinks(db, userId, chatId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    const body = await readJson(request);
    const share = await createShareLink(db, userId, chatId, body.expiresAt);
    return jsonOk({ share }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

/** `DELETE` mencabut semua tautan aktif milik chat ini. */
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    return jsonOk({ revoked: await revokeShareLinks(db, userId, chatId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
