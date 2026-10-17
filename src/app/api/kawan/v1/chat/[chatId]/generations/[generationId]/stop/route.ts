/**
 * Endpoint hentikan generasi (REQ-NT-23, SDD-4.6).
 *
 * `POST /api/kawan/v1/chat/{chatId}/generations/{generationId}/stop` — mencatat
 * permintaan berhenti (`Generation.cancelRequestedAt`). Worker yang sedang
 * membaca stream melihat bendera itu pada potongan berikutnya, menutup koneksi,
 * menyimpan partial, lalu menutup generasi `stopped`.
 *
 * Idempoten: memanggil stop dua kali aman; generasi yang sudah terminal tidak
 * berubah. `userId` selalu dari sesi, tidak pernah dari body (SDD-3.1).
 *
 * Catatan jujur (SDD-4.6): stop tidak membatalkan efek samping di sisi gateway
 * (mis. tool eksternal yang sudah berjalan). Respons ini hanya mengakui
 * permintaan diterima, bukan bahwa gateway sudah berhenti.
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { requestStop } from "@/lib/chat/stop";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/generations/{generationId}/stop";

type RouteContext = { params: Promise<{ chatId: string; generationId: string }> };

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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId, generationId } = await context.params;
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const result = await requestStop(db, { chatId, userId, generationId });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "stopping" },
      { method: "POST", chatId, generationId },
    );
    return NextResponse.json(result, {
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
