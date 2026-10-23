/**
 * Satu butir memori (FIX-13).
 *
 * `PATCH`  — koreksi: versi baru, baris lama `superseded`.
 * `POST`   — konfirmasi usulan menjadi memori aktif.
 * `DELETE` — cabut butir dan seluruh turunannya.
 *
 * Tidak ada `GET`: butir tunggal tidak dipakai UI, daftar sudah lewat `GET /memory`.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import {
  confirmProposal,
  correctMemory,
  revokeMemory,
  type MemoryCategory,
} from "@/lib/memory/store";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/memory/{memoryId}";

type RouteContext = { params: Promise<{ memoryId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { memoryId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_JSON",
        message: "Body bukan JSON yang valid.",
      });
    }
    const input = body as Record<string, unknown>;

    const memory = await correctMemory(db, {
      userId,
      memoryId,
      text: input["text"] as string,
      ...(typeof input["category"] === "string"
        ? { category: input["category"] as MemoryCategory }
        : {}),
    });

    return jsonOk({ memory }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { memoryId } = await context.params;

    const memory = await confirmProposal(db, { userId, memoryId });
    return jsonOk({ memory }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { memoryId } = await context.params;

    const { revoked } = await revokeMemory(db, { userId, memoryId });
    return jsonOk({ memoryId, revoked }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
