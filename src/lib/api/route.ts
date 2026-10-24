/**
 * Perancah bersama untuk route `/api/kawan/v1/*` (SDD-3.1, SDD-3.8).
 *
 * Setiap respons wajib memuat `X-Request-Id` dan `Cache-Control: private, no-store`;
 * galat diterjemahkan lewat `toErrorResponse` supaya pesan internal tidak bocor.
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb, type Db } from "@/lib/db";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError({ status: STATUS.UNAUTHORIZED, code: "UNAUTHORIZED", message: "Belum masuk." });
  }
  return userId;
}

/** Sesi + DB dalam satu panggilan; hampir semua route butuh keduanya. */
export async function requireContext(): Promise<{ userId: string; db: Db }> {
  const userId = await requireUserId();
  const db = await getDb(loadConfig().databaseUrl);
  return { userId, db };
}

export function jsonOk(body: unknown, reqId: string, status = 200): Response {
  return NextResponse.json(body, {
    status,
    headers: { [REQUEST_ID_HEADER]: reqId, "cache-control": "private, no-store" },
  });
}

export function handleRouteError(err: unknown, reqId: string, route: string, started: number): Response {
  if (err instanceof ApiError) {
    logger.warn(
      { requestId: reqId, route, latencyMs: Date.now() - started, result: "error" },
      { code: err.code, status: err.status },
    );
    return toErrorResponse(err, reqId);
  }
  if (err instanceof Error && err.name === "ConfigError") {
    return toErrorResponse(
      new ApiError({ status: STATUS.INTERNAL, code: "CONFIG_ERROR", message: "Konfigurasi server tidak valid." }),
      reqId,
    );
  }
  return toErrorResponse(err, reqId);
}

/** Body JSON; body rusak dijawab 400, bukan 500. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  // POST tanpa body sah (mis. buat tautan berbagi dengan nilai bawaan).
  const raw = await request.text();
  if (raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_BODY", message: "Body harus objek JSON." });
  }
}
