/**
 * Impor chat dari JSON `kawan.chat.v1` (REQ-NT-39, SDD-3.5).
 * Selalu membuat chat baru; tidak menimpa chat yang ada.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { importChat } from "@/lib/chat/transfer";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats/import";

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const chat = await importChat(db, userId, await readJson(request));
    return jsonOk({ chat }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
