/**
 * Preferensi pribadi (SDD-3.7, REQ-NT-70): `GET` baca, `PATCH` ubah sebagian.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { readSettings, writeSettings } from "@/lib/settings/settings";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/settings";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ settings: await readSettings(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);
    return jsonOk({ settings: await writeSettings(db, userId, body) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
