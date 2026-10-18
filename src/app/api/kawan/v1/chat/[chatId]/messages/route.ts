/**
 * Endpoint kirim pesan (REQ-NT-22, SDD-3.4, SDD-4.3, SDD-4.7).
 *
 * `POST /api/kawan/v1/chat/{chatId}/messages` — menyisipkan pesan user,
 * placeholder assistant, `Generation`, dan `Job` dalam satu transaksi, lalu
 * membalas 202 dengan id-id yang dibutuhkan klien untuk membuka SSE.
 *
 * `Idempotency-Key` dibaca dari header (SDD-4.7): kunci sama + digest sama
 * memutar ulang hasil, digest berbeda dibalas 409. Aturan itu ditegakkan di
 * `lib/chat/messages`; berkas ini hanya meneruskan header apa adanya.
 *
 * `userId` selalu dari sesi, tidak pernah dari body (SDD-3.1).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { sendMessage } from "@/lib/chat/messages";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/messages";
const IDEMPOTENCY_HEADER = "Idempotency-Key";

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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const body = await readJsonObject(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const result = await sendMessage(db, {
      userId,
      chatId,
      content: body["content"],
      parentId: body["parentId"],
      model: body["model"],
      attachments: body["attachments"],
      webSearch: body["webSearch"],
      idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER),
    });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "accepted" },
      { method: "POST", chatId, generationId: result.generationId },
    );
    return NextResponse.json(result, {
      status: 202,
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
