/**
 * Endpoint daftar berpaginasi kursor dan pencarian chat (REQ-NT-32, SDD-3.5).
 *
 * `GET /api/kawan/v1/chats?q=&folderId=&archived=&cursor=&limit=`
 * `POST /api/kawan/v1/chats` — buat chat baru (opsional: folderId, title, modelRef).
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { createChat, listChatsPaginated } from "@/lib/chat/chats";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats";

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
  let text: string;
  try {
    text = await request.text();
  } catch {
    text = "";
  }
  if (text.trim() === "") return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
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
  return NextResponse.json(data, {
    status,
    headers: {
      [REQUEST_ID_HEADER]: reqId,
      "cache-control": "private, no-store",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const rawFolderId = url.searchParams.get("folderId");
    const folderId = rawFolderId === null
      ? undefined
      : rawFolderId === "null" || rawFolderId === ""
        ? null
        : rawFolderId;

    const rawArchived = url.searchParams.get("archived");
    const archived = rawArchived === "true" || rawArchived === "1";

    const cursor = url.searchParams.get("cursor") ?? undefined;
    const rawLimit = url.searchParams.get("limit");
    let limit: number | undefined;
    if (rawLimit !== null) {
      const parsedLimit = parseInt(rawLimit, 10);
      if (isNaN(parsedLimit)) {
        throw new ApiError({
          status: STATUS.BAD_REQUEST,
          code: "INVALID_LIMIT",
          message: "Parameter limit harus berupa angka bulat.",
        });
      }
      limit = parsedLimit;
    }

    const result = await listChatsPaginated(db, {
      userId,
      q,
      folderId,
      archived,
      cursor,
      limit,
    });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "ok" },
      { method: "GET", count: result.chats.length, hasMore: result.nextCursor !== null },
    );
    return ok(result, 200, reqId);
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

    const chat = await createChat(db, {
      userId,
      title: body["title"],
      modelRef: body["modelRef"],
      folderId: body["folderId"],
    });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "created" },
      { method: "POST", chatId: chat.id },
    );
    return ok(chat, 201, reqId);
  } catch (err) {
    return handleError(err, reqId, started, "POST");
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
  logger.error(
    { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "unexpected" },
    { method, error: err instanceof Error ? err.stack ?? err.message : String(err) },
  );
  return toErrorResponse(
    new ApiError({
      status: STATUS.INTERNAL,
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan internal.",
    }),
    reqId,
  );
}
