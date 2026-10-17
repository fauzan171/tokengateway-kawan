/**
 * Percakapan milik pengguna (REQ-NT-22, SDD-2.2, SDD-3.4).
 *
 * Modul ini pemilik tabel `Chat` (SDD-2.2). Setiap fungsi menerima `userId`
 * dan memasukkannya ke klausa `where`: baris milik pengguna lain tidak pernah
 * terbaca, sehingga pemanggil tidak perlu menyaring lagi.
 *
 * `pinned`/`archived` disimpan Int 0/1 (migrasi harus portabel SQLite+PostgreSQL)
 * tetapi keluar sebagai Boolean di JSON — kontrak API memakai Boolean.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

/** Bentuk chat yang boleh keluar dari modul ini (SDD-3.4). */
export type PublicChat = {
  id: string;
  title: string;
  modelRef: string | null;
  currentMessageId: string | null;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Kolom yang dibaca. Dipakai bersama oleh `chats.ts` dan `messages.ts`. */
export const CHAT_FIELDS = {
  id: true,
  title: true,
  modelRef: true,
  currentMessageId: true,
  pinned: true,
  archived: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ChatRow = {
  id: string;
  title: string;
  modelRef: string | null;
  currentMessageId: string | null;
  pinned: number;
  archived: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicChat(row: ChatRow): PublicChat {
  return {
    id: row.id,
    title: row.title,
    modelRef: row.modelRef,
    currentMessageId: row.currentMessageId,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const DEFAULT_TITLE = "Chat baru";
const TITLE_MAX = 200;

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

function normalizeTitle(value: unknown): string {
  if (value === undefined || value === null) return DEFAULT_TITLE;
  if (typeof value !== "string") throw badRequest("INVALID_TITLE", "title harus berupa teks.");
  const title = value.trim();
  if (title === "") return DEFAULT_TITLE;
  if (title.length > TITLE_MAX) {
    throw badRequest("INVALID_TITLE", `title maksimum ${TITLE_MAX} karakter.`);
  }
  return title;
}

function normalizeModelRef(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest("INVALID_MODEL", "modelRef harus berupa teks tidak kosong.");
  }
  return value.trim();
}

export type CreateChatInput = {
  userId: string;
  /** Judul sementara; kosong/absen memakai judul bawaan. */
  title?: unknown;
  modelRef?: unknown;
};

export async function createChat(db: Db, input: CreateChatInput): Promise<PublicChat> {
  const title = normalizeTitle(input.title);
  const modelRef = normalizeModelRef(input.modelRef);

  const row = await db.chat.create({
    data: { id: randomUUID(), userId: input.userId, title, modelRef },
    select: CHAT_FIELDS,
  });
  return toPublicChat(row);
}

/** Daftar chat milik pengguna, terbaru diperbarui lebih dulu. */
export async function listChats(db: Db, userId: string): Promise<PublicChat[]> {
  const rows = await db.chat.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: CHAT_FIELDS,
  });
  return rows.map(toPublicChat);
}
