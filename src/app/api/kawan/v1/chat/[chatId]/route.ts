/**
 * Endpoint satu chat beserta pesannya (REQ-NT-22, SDD-3.4, SDD-4.4).
 *
 * `GET /api/kawan/v1/chat/{chatId}` — dipakai klien untuk rekonsiliasi setelah
 * SSE selesai, sehingga keadaan akhir tidak bergantung pada kelengkapan stream.
 * Respons memuat `currentMessageId` (leaf aktif) dan seluruh pesan urut `seq`.
 *
 * Chat milik pengguna lain dibalas 404 yang sama dengan chat tidak ada: 403
 * akan membocorkan keberadaannya (SDD-3.1).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { getChat } from "@/lib/chat/messages";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}";

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

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const { chat, messages } = await getChat(db, userId, chatId);

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "ok" },
      { method: "GET", chatId, count: messages.length },
    );
    return NextResponse.json(
      { chat, messages },
      {
        status: 200,
        headers: { [REQUEST_ID_HEADER]: reqId, "cache-control": "private, no-store" },
      },
    );
  } catch (err) {
    return handleError(err, reqId, started);
  }
}

function handleError(err: unknown, reqId: string, started: number): Response {
  if (err instanceof ApiError) {
    logger.warn(
      { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "error" },
      { method: "GET", code: err.code, status: err.status },
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
