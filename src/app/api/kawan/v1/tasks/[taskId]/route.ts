/**
 * Satu task (FIX-08): snapshot, PATCH judul/status dengan If-Match, DELETE
 * tombstone. Owner dicek lewat `Task.userId`; milik orang lain = 404.
 */

import { NextResponse } from "next/server";
import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { deleteTask, getTaskSnapshot, updateTask } from "@/lib/tasks/tasks";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tasks/[taskId]";

type Params = { params: Promise<{ taskId: string }> };

export async function GET(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId } = await params;
    const snapshot = await getTaskSnapshot(db, userId, taskId);
    return NextResponse.json(snapshot, {
      headers: {
        "x-request-id": reqId,
        "cache-control": "private, no-store",
        ETag: `"${snapshot.task.revision}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId } = await params;
    const body = await readJson(request);
    const task = await updateTask(db, {
      userId,
      taskId,
      title: body["title"],
      status: body["status"],
      ifMatch: request.headers.get("if-match"),
    });
    return jsonOk({ task }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { taskId } = await params;
    await deleteTask(db, userId, taskId);
    return jsonOk({ id: taskId, status: "deleting" }, reqId, 202);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}