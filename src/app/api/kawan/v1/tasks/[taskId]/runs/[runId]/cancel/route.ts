/**
 * Cancel run (FIX-08): menandai niat cancel segera, hasil terminal ditulis
 * worker setelah tool/model benar-benar berhenti. Run terminal → 200 tanpa efek.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { cancelRun } from "@/lib/tasks/tasks";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tasks/[taskId]/runs/[runId]/cancel";

type Params = { params: Promise<{ taskId: string; runId: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId, runId } = await params;
    const run = await cancelRun(db, { userId, taskId, runId });
    return jsonOk({ run }, reqId, 202);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}