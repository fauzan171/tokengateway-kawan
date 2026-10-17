/**
 * Endpoint edit pesan (WP-NT-P3-09, REQ-NT-25, REQ-NT-26, SDD-3.4).
 *
 * `POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/edit` — body
 * `{ "content": "...", "mode": "branch" | "inplace" }`. `mode` absen → `branch`.
 *
 * `branch` → 202 dengan id sibling baru + generasi; `inplace` → 200 tanpa
 * generasi. Chat yang masih punya generasi aktif dibalas 409.
 *
 * `userId` selalu dari sesi, tidak pernah dari body (SDD-3.1).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { editMessage } from "@/lib/chat/edit";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/messages/{messageId}/edit";

type RouteContext = { params: Promise<{ chatId: string; messageId: string }> };

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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId, messageId } = await context.params;
    const body = await readJsonObject(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const result = await editMessage(db, {
      chatId,
      userId,
      messageId,
      content: body["content"],
      mode: body["mode"],
    });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "ok" },
      { method: "POST", chatId, newMessageId: result.newMessageId },
    );
    // Cabang baru memulai generasi → 202; edit inplace tidak → 200.
    const status = "generationId" in result ? 202 : 200;
    return NextResponse.json(result, {
      status,
      headers: { [REQUEST_ID_HEADER]: reqId },
    });
  } catch (err) {
    return handleError(err, reqId, started);
  }
}

function handleError(err: unknown, reqId: string, started: number): Response {
  if (err instanceof ApiError) {
    logger.warn(
      { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "error" },
      { method: "POST", code: err.code, status: err.status },
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
