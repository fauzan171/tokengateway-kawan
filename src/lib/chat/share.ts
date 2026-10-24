/**
 * Tautan berbagi snapshot beku (REQ-NT-36/37/38/41, SDD-3.5).
 *
 * Snapshot disalin saat tautan dibuat dan TIDAK ikut berubah saat chat diedit:
 * tautan publik menampilkan keadaan yang disetujui pemilik, bukan riwayat hidup.
 *
 * Isi snapshot hanya `title`, `createdAt`, dan pesan `user`/`assistant`.
 * Pesan `system`, `modelRef`, id internal, dan kredensial tidak pernah masuk —
 * halaman publik tidak boleh membocorkan apa pun di luar percakapan (REQ-NT-41).
 */

import { randomBytes, randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { messageText } from "./content";

export type SnapshotMessage = {
  role: string;
  text: string;
  createdAt: string;
};

export type ShareSnapshot = {
  title: string;
  createdAt: string;
  messages: SnapshotMessage[];
};

export type PublicShareLink = {
  id: string;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function shareNotFound(): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code: "SHARE_NOT_FOUND", message: "Tautan tidak ditemukan." });
}

function parseExpiry(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_EXPIRY", message: "expiresAt harus ISO-8601." });
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_EXPIRY", message: "expiresAt tidak valid." });
  }
  if (date.getTime() <= Date.now()) {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_EXPIRY", message: "expiresAt harus di masa depan." });
  }
  return date;
}

/** Snapshot dari pesan saat ini, tanpa peran `system`. */
export function buildSnapshot(
  chat: { title: string; createdAt: Date },
  messages: readonly { role: string; contentJson: string; createdAt: Date }[],
): ShareSnapshot {
  return {
    title: chat.title,
    createdAt: chat.createdAt.toISOString(),
    messages: messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        text: messageText(message.contentJson),
        createdAt: message.createdAt.toISOString(),
      })),
  };
}

export async function createShareLink(
  db: Db,
  userId: string,
  chatId: string,
  expiresAtRaw?: unknown,
): Promise<PublicShareLink> {
  const chat = await db.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true, title: true, createdAt: true },
  });
  if (!chat) {
    throw new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
  }

  const expiresAt = parseExpiry(expiresAtRaw);
  const rows = await db.chatMessage.findMany({
    where: { chatId },
    orderBy: { seq: "asc" },
    select: { role: true, contentJson: true, createdAt: true },
  });

  const row = await db.shareLink.create({
    data: {
      id: randomUUID(),
      chatId,
      token: randomBytes(24).toString("base64url"),
      snapshotJson: JSON.stringify(buildSnapshot(chat, rows)),
      expiresAt,
    },
    select: { id: true, token: true, expiresAt: true, revokedAt: true, createdAt: true },
  });

  return {
    id: row.id,
    token: row.token,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listShareLinks(db: Db, userId: string, chatId: string): Promise<PublicShareLink[]> {
  const chat = await db.chat.findFirst({ where: { id: chatId, userId }, select: { id: true } });
  if (!chat) {
    throw new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
  }
  const rows = await db.shareLink.findMany({
    where: { chatId },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, expiresAt: true, revokedAt: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Cabut semua tautan aktif chat ini; tautan yang sudah dicabut tidak diubah. */
export async function revokeShareLinks(db: Db, userId: string, chatId: string): Promise<number> {
  const chat = await db.chat.findFirst({ where: { id: chatId, userId }, select: { id: true } });
  if (!chat) {
    throw new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
  }
  const result = await db.shareLink.updateMany({
    where: { chatId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Snapshot publik. Dicabut, kedaluwarsa, dan tidak ada dijawab 404 yang sama:
 * membedakan sebabnya memberi tahu penebak apakah token pernah ada (SDD-3.1).
 */
export async function getPublicShare(db: Db, token: string): Promise<ShareSnapshot> {
  const row = await db.shareLink.findUnique({
    where: { token },
    select: { snapshotJson: true, expiresAt: true, revokedAt: true },
  });
  if (!row || row.revokedAt !== null) throw shareNotFound();
  if (row.expiresAt !== null && row.expiresAt.getTime() <= Date.now()) throw shareNotFound();

  try {
    return JSON.parse(row.snapshotJson) as ShareSnapshot;
  } catch {
    throw shareNotFound();
  }
}
