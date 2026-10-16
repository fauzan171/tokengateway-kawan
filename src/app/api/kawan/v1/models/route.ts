/**
 * Endpoint discovery daftar model (REQ-NT-18, REQ-NT-20, SDD-3.3).
 *
 * `GET /api/kawan/v1/models?refresh=1`
 *
 * Memakai koneksi AKTIF milik pengguna. Tanpa `refresh`, cache dipakai bila
 * masih berlaku; `refresh=1` memaksa pengambilan baru dari gateway.
 *
 * Kunci API koneksi didekripsi HANYA di dalam proses ini untuk dipakai sebagai
 * header `Authorization` ke gateway. Kunci maupun ciphertext tidak pernah
 * masuk ke respons, log, atau pesan galat (REQ-NT-07) — pesan galat dari
 * `lib/providers` sudah dipetakan ke kalimat aman (SDD-5.4).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig, type Config } from "@/lib/config/env";
import { getActiveConnection } from "@/lib/connections/connections";
import { getCachedModels, putCachedModels } from "@/lib/connections/model-cache";
import { getDb, type Db } from "@/lib/db";
import { toApiError } from "@/lib/providers/errors";
import { listModels } from "@/lib/providers/gateway";
import { CONNECTION_API_KEY_PURPOSE, decryptSecret } from "@/lib/secrets";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/models";

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

/**
 * Membuka kunci API baris koneksi.
 *
 * Ciphertext dibaca langsung dari `Connection` karena `PublicConnection`
 * (kontrak `lib/connections`) sengaja tidak punya kolomnya. AAD harus sama
 * persis dengan saat penyimpanan (`rowId` + `userId` + tujuan), jadi ciphertext
 * baris lain tidak dapat dipakai di sini.
 */
async function openApiKey(
  db: Db,
  config: Config,
  connectionId: string,
  userId: string,
): Promise<string> {
  const row = await db.connection.findUnique({
    where: { id: connectionId },
    select: { apiKeyEncrypted: true, userId: true },
  });
  if (!row || row.userId !== userId) {
    throw new ApiError({
      status: STATUS.NOT_FOUND,
      code: "NOT_FOUND",
      message: "Koneksi tidak ditemukan.",
    });
  }

  try {
    return decryptSecret({
      envelope: row.apiKeyEncrypted,
      key: config.encryptionKey,
      aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
    });
  } catch {
    // Envelope rusak, AAD tidak cocok, atau kunci server berganti. Pesan
    // generik: tidak ada detail ciphertext yang boleh bocor (REQ-NT-07).
    throw new ApiError({
      status: STATUS.INTERNAL,
      code: "CONNECTION_KEY_UNREADABLE",
      message: "Kunci koneksi tidak dapat dibuka. Simpan ulang kunci API koneksi ini.",
    });
  }
}

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const connection = await getActiveConnection(db, userId);
    if (!connection) {
      // Bukan daftar kosong: pengguna harus tahu sebabnya (SDD-3.3).
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "NO_ACTIVE_CONNECTION",
        message: "Belum ada koneksi aktif. Hubungkan gateway terlebih dahulu.",
      });
    }

    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const now = new Date();

    if (!refresh) {
      const cached = await getCachedModels(db, {
        connectionId: connection.id,
        ttlSeconds: config.modelCacheTtlSeconds,
        now,
      });
      if (cached) {
        logger.info(
          { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "cache" },
          { method: "GET", connectionId: connection.id, count: cached.models.length },
        );
        return modelsResponse(connection.id, cached.fetchedAt, cached.models, reqId);
      }
    }

    const apiKey = await openApiKey(db, config, connection.id, userId);
    const result = await listModels({
      baseUrl: connection.baseUrl,
      apiKey,
      outbound: {
        allowInsecureHttp: config.allowInsecureHttp,
        allowlist: config.outboundAllowlist,
      },
    });

    if (!result.ok) {
      logger.warn(
        { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "error" },
        { method: "GET", connectionId: connection.id, reason: result.reason, refresh },
      );
      return toErrorResponse(
        toApiError({ reason: result.reason, message: result.message, retryable: result.retryable }),
        reqId,
      );
    }

    const stored = await putCachedModels(db, {
      connectionId: connection.id,
      models: result.models,
      now,
    });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "refreshed" },
      { method: "GET", connectionId: connection.id, count: stored.models.length, refresh },
    );
    return modelsResponse(connection.id, stored.fetchedAt, stored.models, reqId);
  } catch (err) {
    return handleError(err, reqId, started);
  }
}

/** Bentuk respons SDD-3.3. Cache-Control privat: isi ini milik pengguna. */
function modelsResponse(
  connectionId: string,
  fetchedAt: Date,
  models: readonly unknown[],
  reqId: string,
): Response {
  return NextResponse.json(
    { connectionId, fetchedAt: fetchedAt.toISOString(), models },
    {
      status: 200,
      headers: {
        [REQUEST_ID_HEADER]: reqId,
        "cache-control": "private, no-store",
      },
    },
  );
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
