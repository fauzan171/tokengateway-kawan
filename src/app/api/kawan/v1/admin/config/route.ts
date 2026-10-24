/**
 * Konfigurasi aplikasi (REQ-NT-76, SDD-3.7). Khusus admin.
 *
 * `GET /api/kawan/v1/admin/config`, `PATCH` dengan `{ registrationOpen }`.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { readAppConfig, writeAppConfig } from "@/lib/admin/config";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/admin/config";

async function requireAdmin() {
  const { userId, db } = await requireContext();
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "admin") {
    throw new ApiError({
      status: STATUS.FORBIDDEN,
      code: "FORBIDDEN",
      message: "Hanya admin yang boleh mengubah konfigurasi.",
    });
  }
  return db;
}

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const db = await requireAdmin();
    return jsonOk({ config: await readAppConfig(db) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const db = await requireAdmin();
    const body = await readJson(request);
    return jsonOk({ config: await writeAppConfig(db, { registrationOpen: body["registrationOpen"] }) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
