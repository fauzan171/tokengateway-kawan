/**
 * Endpoint stream SSE satu generasi (REQ-NT-22, SDD-4.4).
 *
 * `GET /api/kawan/v1/chat/{chatId}/stream?generationId=gen_1&afterSeq=0` —
 * membalas `text/event-stream`. `generationId` wajib dan harus milik chat ini;
 * `userId` selalu dari sesi (SDD-3.1).
 *
 * Otorisasi ditegakkan SEBELUM header SSE ditulis: `loadStreamTarget` melempar
 * 404, dan galat itu dibalas sebagai JSON biasa. Setelah `createSseStream`
 * dimulai, koneksi sudah menjadi stream dan tidak bisa lagi menjadi JSON —
 * karena itu pemeriksaan ganda (di sini dan di dalam stream) memang disengaja.
 *
 * `afterSeq` diteruskan apa adanya; pemutaran ulang dari buffer (resume,
 * SDD-4.5) ditangani `createSseStream` di `lib/chat/sse.ts`.
 */

import { ApiError, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { createSseStream, loadStreamTarget } from "@/lib/chat/sse";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat/{chatId}/stream";

/** Header wajib SDD-4.4. `X-Accel-Buffering: no` mencegah proxy menahan buffer. */
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-store",
  "X-Accel-Buffering": "no",
} as const;

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

function requireGenerationId(request: Request): string {
  const generationId = new URL(request.url).searchParams.get("generationId");
  if (!generationId) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_GENERATION_ID",
      message: "Parameter generationId wajib diisi.",
    });
  }
  return generationId;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { chatId } = await context.params;
    const generationId = requireGenerationId(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    // Sekaligus menegakkan kepemilikan sebelum header SSE ditulis.
    await loadStreamTarget(db, { userId, chatId, generationId });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "streaming" },
      { method: "GET", chatId, generationId },
    );

    const body = createSseStream({
      db,
      userId,
      chatId,
      generationId,
      afterSeq: Number(new URL(request.url).searchParams.get("afterSeq") ?? 0),
      signal: request.signal,
    });

    return new Response(body, { status: 200, headers: { ...SSE_HEADERS } });
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
