/**
 * SSE event run (FIX-08): `GET /tasks/:taskId/runs/:runId/events?afterSeq=`.
 * Owner dicek sebelum header ditulis, jadi lintas pengguna = 404 JSON.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, requireContext } from "@/lib/api/route";
import { createTaskEventStream, loadRunTarget } from "@/lib/tasks/events";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tasks/[taskId]/runs/[runId]/events";

type Params = { params: Promise<{ taskId: string; runId: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId, runId } = await params;

    // Owner dicek SEBELUM header apa pun; galat jadi JSON 404 biasa.
    await loadRunTarget(db, { userId, taskId, runId });

    const url = new URL(request.url);
    const afterSeq = Number.parseInt(
      url.searchParams.get("afterSeq") ?? request.headers.get("last-event-id") ?? "",
      10,
    );

    const stream = createTaskEventStream({
      db,
      userId,
      taskId,
      runId,
      ...(Number.isNaN(afterSeq) ? {} : { afterSeq }),
      signal: request.signal,
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "private, no-store",
        connection: "keep-alive",
        "x-request-id": reqId,
      },
    });
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}