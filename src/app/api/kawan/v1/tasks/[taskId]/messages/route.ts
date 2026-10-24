/**
 * Follow-up task (FIX-08): run baru setelah run terminal. Run aktif → 409
 * RUN_ACTIVE; pesan tidak pernah disisipkan diam-diam ke run berjalan.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { followUp } from "@/lib/tasks/tasks";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tasks/[taskId]/messages";

type Params = { params: Promise<{ taskId: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId } = await params;
    const body = await readJson(request);
    const run = await followUp(db, {
      userId,
      taskId,
      input: body["input"],
      connectionId: body["connectionId"],
      modelId: body["modelId"],
      artifactIds: body["artifactIds"],
      agentId: body["agentId"],
      idempotencyKey: request.headers.get("Idempotency-Key"),
    });
    return jsonOk({ run }, reqId, 202);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}