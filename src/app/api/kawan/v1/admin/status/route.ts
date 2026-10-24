/**
 * Status sistem (REQ-NT-77, SDD-8.5). Khusus admin.
 *
 * `GET /api/kawan/v1/admin/status` — tidak memanggil jaringan, tidak melempar
 * saat database mati; komponen opsional yang tidak dikonfigurasi hanya `false`.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { loadConfig } from "@/lib/config/env";
import { systemStatus } from "@/lib/admin/status";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/admin/status";

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
        message: "Hanya admin yang boleh melihat status sistem.",
      });
    }

    return jsonOk(await systemStatus(db, { config: loadConfig() }), reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
