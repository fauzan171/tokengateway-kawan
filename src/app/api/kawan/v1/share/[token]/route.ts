/**
 * Snapshot publik tanpa sesi (REQ-NT-36/37/41, SDD-3.5).
 * Isi hanya yang tersimpan di `snapshotJson`; token dicabut/kedaluwarsa → 404.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk } from "@/lib/api/route";
import { getPublicShare } from "@/lib/chat/share";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/share/{token}";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { token } = await context.params;
    const db = await getDb(loadConfig().databaseUrl);
    return jsonOk({ share: await getPublicShare(db, token) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
