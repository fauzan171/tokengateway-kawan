/**
 * Endpoint ubah dan hapus satu koneksi gateway (REQ-NT-09, REQ-NT-10,
 * SDD-3.2).
 *
 * Otorisasi ditegakkan di sini: `userId` dari sesi, dan kepemilikan baris
 * diperiksa di `lib/connections` dengan `id` + `userId` dalam satu klausa.
 * Koneksi milik pengguna lain menghasilkan 404, bukan 403 — keberadaannya
 * tidak boleh bocor (SDD-3.1).
 *
 * `DELETE` hanya menghapus baris `Connection`; riwayat chat tidak tersentuh
 * (REQ-NT-09).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import {
  deleteConnection,
  updateConnection,
  type UpdateConnectionPatch,
} from "@/lib/connections/connections";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/connections/[id]";

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

/**
 * Menerjemahkan body PATCH menjadi patch yang dikenal.
 *
 * Field yang tidak ada dibiarkan `undefined` (tidak diubah). Field yang ada
 * tetapi bertipe salah ditolak dengan 422, bukan diam-diam diabaikan: diam
 * membuat pengguna mengira perubahannya tersimpan.
 */
function buildPatch(body: Record<string, unknown>): UpdateConnectionPatch {
  const patch: UpdateConnectionPatch = {};

  if (body["name"] !== undefined) {
    if (typeof body["name"] !== "string") {
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "INVALID_NAME",
        message: "Nama koneksi harus berupa teks.",
      });
    }
    patch.name = body["name"];
  }
  if (body["baseUrl"] !== undefined) {
    if (typeof body["baseUrl"] !== "string") {
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "BAD_URL",
        message: "Base URL harus berupa teks.",
      });
    }
    patch.baseUrl = body["baseUrl"];
  }
  if (body["apiKey"] !== undefined) {
    if (typeof body["apiKey"] !== "string") {
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "INVALID_API_KEY",
        message: "API key harus berupa teks.",
      });
    }
    patch.apiKey = body["apiKey"];
  }
  if (body["isActive"] !== undefined) {
    if (typeof body["isActive"] !== "boolean") {
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "INVALID_IS_ACTIVE",
        message: "isActive harus berupa boolean.",
      });
    }
    patch.isActive = body["isActive"];
  }

  return patch;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const patch = buildPatch(body);

    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const connection = await updateConnection(db, config, userId, id, patch);

    // Body permintaan tidak dicatat: bisa memuat kunci API (SDD-3.1).
    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "updated" },
      { method: "PATCH", connectionId: connection.id, fields: Object.keys(patch) },
    );
    return NextResponse.json(connection, {
      status: 200,
      headers: { [REQUEST_ID_HEADER]: reqId },
    });
  } catch (err) {
    return handleError(err, reqId, started, "PATCH");
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const { id } = await context.params;

    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    await deleteConnection(db, userId, id);

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "deleted" },
      { method: "DELETE", connectionId: id },
    );
    return NextResponse.json(
      { deleted: true, id },
      { status: 200, headers: { [REQUEST_ID_HEADER]: reqId } },
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
