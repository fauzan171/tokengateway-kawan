/**
 * Ganti judul chat secara manual (REQ-NT-29, SDD-3.4).
 *
 * `PATCH /api/kawan/v1/chat/{chatId}/title` — `{ "title": "..." }`. Judul
 * manual menang atas judul otomatis: setelah ini `maybeSetAutoTitle` tidak
 * lagi menimpa. Otorisasi ditegakkan di sini lewat sesi; chat milik pengguna
 * lain dibalas 404 yang sama dengan chat tidak ada (SDD-3.1).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { setManualTitle } from "@/lib/chat/title";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/title";

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

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const body = await readJsonObject(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const chat = await setManualTitle(db, { chatId, userId, title: body["title"] });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "updated" },
      { method: "PATCH", chatId: chat.id },
    );
    return NextResponse.json(chat, {
      status: 200,
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
      { method: "PATCH", code: err.code, status: err.status },
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
