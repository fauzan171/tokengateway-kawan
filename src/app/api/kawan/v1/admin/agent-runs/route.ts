/**
 * Audit run per agent (K8), khusus admin.
 *
 * `GET /api/kawan/v1/admin/agent-runs` — ringkasan semua agent.
 * `GET ?agentId=peneliti&limit=20&cursor=` — daftar run satu agent.
 *
 * Tanpa tabel audit baru (rencana §K8): sumber = TaskRun + hitungan
 * TaskEvent. Isi prompt dan payload event TIDAK PERNAH dikembalikan.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { listAgentRuns, listAgentSummaries } from "@/lib/admin/agent-runs";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/admin/agent-runs";

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
        message: "Hanya admin yang boleh melihat audit run per agent.",
      });
    }

    const params = new URL(request.url).searchParams;
    const agentId = params.get("agentId");
    if (!agentId) {
      return jsonOk({ agents: await listAgentSummaries(db) }, reqId);
    }
    const limitParam = Number(params.get("limit"));
    const result = await listAgentRuns(db, {
      agentId,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
      cursor: params.get("cursor") ?? undefined,
    });
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
