/**
 * Task persisten (FIX-08): `GET /api/kawan/v1/tasks` daftar,
 * `POST` admission task+run+job dalam satu transaksi (SDD-AG-3).
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createTask, listTasks } from "@/lib/tasks/tasks";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tasks";
const IDEMPOTENCY_HEADER = "Idempotency-Key";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    if (status !== null && status !== "active" && status !== "archived") {
      return jsonOk({ tasks: await listTasks(db, { userId }) }, reqId);
    }
    const q = url.searchParams.get("q");
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    return jsonOk(
      {
        tasks: await listTasks(db, {
          userId,
          ...(status ? { status } : {}),
          q,
          ...(Number.isNaN(limit) ? {} : { limit }),
        }),
      },
      reqId,
    );
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);
    const result = await createTask(db, {
      userId,
      title: body["title"],
      input: body["input"],
      connectionId: body["connectionId"],
      modelId: body["modelId"],
      artifactIds: body["artifactIds"],
      agentId: body["agentId"],
      idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER),
    });
    return jsonOk({ task: result.task, run: result.run }, reqId, 202);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}