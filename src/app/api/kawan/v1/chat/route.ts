/**
 * Endpoint daftar dan pembuatan chat (REQ-NT-22, SDD-3.4).
 *
 * `GET  /api/kawan/v1/chat` — daftar chat milik pengguna, terbaru dulu.
 * `POST /api/kawan/v1/chat` — chat baru; `title` sementara, `modelRef` dari body.
 *
 * Otorisasi ditegakkan DI SINI (SDD-1.3): `userId` selalu dari sesi `auth()`,
 * tidak pernah dari body (SDD-3.1). Modul `lib/chat/chats` yang memegang aturan
 * penyimpanan; berkas ini hanya penyambung HTTP.
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { createChat, listChatsPaginated } from "@/lib/chat/chats";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chat";

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

/** Body JSON; galat parse jadi 400, bukan 500. Body kosong dianggap `{}`. */
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
  return NextResponse.json(data, { status, headers: { [REQUEST_ID_HEADER]: reqId } });
}

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    // Dibatasi: daftar tanpa batas membengkak seiring riwayat pengguna.
    const { chats } = await listChatsPaginated(db, { userId, limit: 100 });

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "ok" },
      { method: "GET", count: chats.length },
    );
    return ok({ chats }, 200, reqId);
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
  return toErrorResponse(err, reqId);
}
