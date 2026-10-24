/**
 * Aktif/nonaktif dan hapus pengguna (REQ-NT-74/75, SDD-3.7, SDD-2.6).
 *
 * `PATCH` status, `DELETE` menghapus pengguna beserta seluruh data pribadinya.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { deleteUserData, setUserStatus } from "@/lib/admin/users";
import type { Db } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/admin/users/{userId}";

type RouteContext = { params: Promise<{ userId: string }> };

async function assertAdmin(db: Db, userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "admin") {
    throw new ApiError({
      status: STATUS.FORBIDDEN,
      code: "FORBIDDEN",
      message: "Hanya admin yang boleh mengubah pengguna.",
    });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    await assertAdmin(db, userId);

    const { userId: targetId } = await context.params;
    const body = await readJson(request);
    const result = await setUserStatus(db, { actorId: userId, userId: targetId, status: body["status"] });
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    await assertAdmin(db, userId);

    const { userId: targetId } = await context.params;
    const result = await deleteUserData(db, { actorId: userId, userId: targetId });
    if (!result.removed) {
      throw new ApiError({ status: STATUS.NOT_FOUND, code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
    }
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
