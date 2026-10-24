/**
 * Memori pengguna (FIX-13).
 *
 * `GET`  — daftar/cari butir aktif milik pengguna.
 * `POST` — simpan butir baru secara eksplisit.
 *
 * Tidak ada jalur yang menerima `userId` dari klien: identitas selalu dari sesi.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { createMemory, listMemories, type MemoryCategory, type MemoryStatus } from "@/lib/memory/store";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/memory";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? undefined;
    const chatId = url.searchParams.get("chatId") ?? undefined;
    const statusParam = url.searchParams.get("status") ?? "active";

    const items = await listMemories(db, {
      userId,
      ...(query ? { query } : {}),
      ...(chatId ? { chatId } : {}),
      status: statusParam as MemoryStatus | "all",
    });

    return jsonOk({ items, count: items.length }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
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

    const memory = await createMemory(db, {
      userId,
      text: input["text"] as string,
      ...(input["category"] ? { category: input["category"] as MemoryCategory } : {}),
      ...(input["scope"] === "chat" ? { scope: "chat" as const } : {}),
      ...(typeof input["chatId"] === "string" ? { chatId: input["chatId"] } : {}),
      ...(input["consent"] === "proposed" ? { consent: "proposed" as const } : {}),
      ...(typeof input["sourceKind"] === "string"
        ? { sourceKind: input["sourceKind"] as "message" | "document" | "manual" }
        : {}),
      ...(typeof input["sourceRef"] === "string" ? { sourceRef: input["sourceRef"] } : {}),
    });

    return jsonOk({ memory }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
