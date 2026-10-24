/**
 * Daftar pengguna untuk admin (REQ-NT-74, SDD-3.7).
 *
 * `GET /api/kawan/v1/admin/users?cursor=&limit=`
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { listUsers } from "@/lib/admin/users";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/admin/users";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();

    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== "admin") {
      throw new ApiError({
        status: STATUS.FORBIDDEN,
        code: "FORBIDDEN",
        message: "Hanya admin yang boleh melihat daftar pengguna.",
      });
    }

    const params = new URL(request.url).searchParams;
    const limitParam = Number(params.get("limit"));
    const result = await listUsers(db, {
      cursor: params.get("cursor") ?? undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
    });
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
