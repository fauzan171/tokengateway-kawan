/**
 * Endpoint aktivasi koneksi gateway (REQ-NT-10, SDD-3.2).
 *
 * Aktivasi adalah aksi eksplisit: hanya jalur inilah (dan PATCH `isActive`)
 * yang boleh memindahkan koneksi aktif. Menambah koneksi kedua tidak pernah
 * memindahkannya sendiri.
 *
 * Penonaktifan koneksi aktif lain terjadi di dalam satu transaksi di
 * `lib/connections`, sehingga tidak pernah ada dua koneksi aktif. `userId`
 * berasal dari sesi; koneksi milik pengguna lain menghasilkan 404 (SDD-3.1).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { activateConnection } from "@/lib/connections/connections";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/connections/[id]/activate";

type RouteContext = { params: Promise<{ id: string }> };

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
    const { id } = await context.params;

    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const connection = await activateConnection(db, userId, id);

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "activated" },
      { method: "POST", connectionId: connection.id },
    );
    return NextResponse.json(connection, {
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
