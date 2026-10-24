/**
 * Endpoint daftar dan pembuatan koneksi gateway (REQ-NT-17, REQ-NT-04,
 * SDD-3.2).
 *
 * Otorisasi ditegakkan DI SINI, bukan di middleware saja (SDD-1.3):
 * `userId` selalu berasal dari sesi `auth()`, tidak pernah dari body
 * (SDD-3.1). Modul `lib/connections` yang memegang aturan penyimpanan;
 * berkas ini hanya penyambung HTTP.
 *
 * Respons tidak pernah memuat `apiKey` atau ciphertext — `PublicConnection`
 * yang dikembalikan `lib/connections` memang tidak punya kolomnya
 * (REQ-NT-07).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { createConnection, listConnections } from "@/lib/connections/connections";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/connections";

/** Sesi wajib ada. Identitas hanya dari sesi, bukan dari body (SDD-3.1). */
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

/** Body JSON; galat parse jadi 400, bukan 500. */
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

function ok(data: unknown, status: number, reqId: string): Response {
  return NextResponse.json(data, { status, headers: { [REQUEST_ID_HEADER]: reqId } });
}

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const connections = await listConnections(db, userId);

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "ok" },
      { method: "GET", count: connections.length },
    );
    return ok({ connections }, 200, reqId);
  } catch (err) {
    return handleError(err, reqId, started, "GET");
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const body = await readJsonObject(request);
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    // Jalur "pakai langganan": URL dan key datang dari konfigurasi server,
    // bukan dari browser. Key tidak pernah dikirim ke klien (lihat GET).
    const useDefault = body["useDefault"] === true;
    if (useDefault && !config.defaultGateway) {
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: "NO_DEFAULT_GATEWAY",
        message: "Server ini belum menyediakan gateway bawaan.",
      });
    }

    const connection = await createConnection(db, config, {
      userId,
      name: useDefault ? String(body["name"] ?? "Langganan") : String(body["name"] ?? ""),
      baseUrl: useDefault ? config.defaultGateway!.baseUrl : String(body["baseUrl"] ?? ""),
      apiKey: useDefault ? config.defaultGateway!.apiKey : String(body["apiKey"] ?? ""),
      skipTest: body["skipTest"] === true,
    });

    // Body permintaan TIDAK dicatat: memuat kunci API (SDD-3.1).
    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "created" },
      { method: "POST", connectionId: connection.id, status: connection.status },
    );
    return ok(connection, 201, reqId);
  } catch (err) {
    return handleError(err, reqId, started, "POST");
  }
}

/** Galat `ApiError` diteruskan apa adanya; `ConfigError` dan galat tak dikenal
 *  disembunyikan sebagai 500 generik (SDD-3.1). */
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
