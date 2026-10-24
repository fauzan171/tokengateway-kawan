/**
 * Ekspor seluruh data percakapan pengguna (REQ-NT-40, SDD-3.5).
 * Tanpa kredensial, `modelRef`, atau id internal.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { exportAll } from "@/lib/chat/transfer";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/export";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk(await exportAll(db, userId), reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
