/**
 * Endpoint pesan sistem per chat (REQ-NT-31, SDD-3.4).
 *
 * `PUT /api/kawan/v1/chat/{chatId}/system` — simpan pesan sistem.
 * `DELETE /api/kawan/v1/chat/{chatId}/system` — hapus pesan sistem.
 *
 * `userId` selalu dari sesi, tidak pernah dari body (SDD-3.1). Chat milik
 * pengguna lain dibalas 404 yang sama dengan chat tidak ada.
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { deleteSystemPrompt, setSystemPrompt } from "@/lib/chat/system-prompt";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/system";

type RouteContext = { params: Promise<{ chatId: string }> };

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError({
      status: STATUS.UNAUTHORIZED,
      code: "UNAUTHORIZED",
      message: "Belum masuk.",
    });
  }
  return userId;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_JSON",
      message: "Format JSON tidak valid.",
    });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_JSON",
      message: "Body harus berupa objek JSON.",
    });
  }
  return body as Record<string, unknown>;
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const body = await readJsonObject(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const content = await setSystemPrompt(db, { chatId, userId, content: body["content"] });

    // Isi pesan sistem tidak dicatat: bisa memuat teks pribadi (SDD-3.1).
    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "saved" },
      { method: "PUT", chatId, cleared: content === null },
    );
    return NextResponse.json(
      { systemPrompt: content },
      { status: 200, headers: { [REQUEST_ID_HEADER]: reqId, "cache-control": "private, no-store" } },
    );
  } catch (err) {
    return handleError(err, reqId, started, "PUT");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    await deleteSystemPrompt(db, { chatId, userId });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "deleted" },
      { method: "DELETE", chatId },
    );
    return NextResponse.json(
      { deleted: true },
      { status: 200, headers: { [REQUEST_ID_HEADER]: reqId, "cache-control": "private, no-store" } },
    );
  } catch (err) {
    return handleError(err, reqId, started, "DELETE");
  }
}

function handleError(err: unknown, reqId: string, started: number, method: string): Response {
  if (err instanceof ApiError) {
    logger.warn(
      { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "error" },
      { method, code: err.code, status: err.status },
    );
    return toErrorResponse(err, reqId);
  }
  if (err instanceof Error && err.name === "ConfigError") {
    return toErrorResponse(
      new ApiError({
        status: STATUS.INTERNAL,
        code: "CONFIG_ERROR",
        message: "Konfigurasi server tidak valid.",
      }),
      reqId,
    );
  }
  return toErrorResponse(err, reqId);
}
