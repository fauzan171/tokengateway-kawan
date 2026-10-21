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
  folderId: string | null;
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
  folderId: true,
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
  folderId?: string | null;
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
    folderId: row.folderId ?? null,
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
  folderId?: unknown;
};

export async function createChat(db: Db, input: CreateChatInput): Promise<PublicChat> {
  const title = normalizeTitle(input.title);
  const modelRef = normalizeModelRef(input.modelRef);
  const folderId = typeof input.folderId === "string" && input.folderId.trim() !== ""
    ? input.folderId.trim()
    : null;

  const row = await db.chat.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      title,
      // Judul yang dikirim pemanggil adalah pilihan manusia; judul otomatis
      // tidak boleh menimpanya (FIX-04).
      titleSource: input.title === undefined || input.title === null ? "auto" : "manual",
      modelRef,
      folderId,
    },
    select: CHAT_FIELDS,
  });
  return toPublicChat(row);
}

export type ChatCursorPayload = {
  updatedAt: string;
  id: string;
};

export function encodeChatCursor(updatedAt: Date | string, id: string): string {
  const iso = typeof updatedAt === "string" ? updatedAt : updatedAt.toISOString();
  return Buffer.from(JSON.stringify({ updatedAt: iso, id })).toString("base64url");
}

export function decodeChatCursor(cursor: string): ChatCursorPayload {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.updatedAt === "string" &&
      typeof parsed.id === "string" &&
      !isNaN(new Date(parsed.updatedAt).getTime())
    ) {
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    }
  } catch {
    // fall through
  }
  throw badRequest("INVALID_CURSOR", "Cursor paginasi tidak valid.");
}

export type ListChatsOptions = {
  userId: string;
  q?: string | null;
  folderId?: string | null;
  archived?: boolean;
  cursor?: string | null;
  limit?: number;
};

export type PaginatedChats = {
  chats: PublicChat[];
  nextCursor: string | null;
};

/**
 * Daftar chat berpaginasi kursor stabil (REQ-NT-32, SDD-3.5).
 * Urutan deterministik: updatedAt DESC, id DESC.
 */
export async function listChatsPaginated(
  db: Db,
  options: ListChatsOptions,
): Promise<PaginatedChats> {
  const { userId, q, folderId, archived = false, cursor } = options;
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

  const whereAnd: Array<Record<string, unknown>> = [
    { userId },
    { archived: archived ? 1 : 0 },
  ];

  if (folderId !== undefined) {
    whereAnd.push({ folderId });
  }

  if (q && q.trim() !== "") {
    const term = q.trim();
    whereAnd.push({
      OR: [
        { title: { contains: term } },
        { messages: { some: { contentJson: { contains: term } } } },
      ],
    });
  }

  if (cursor && cursor.trim() !== "") {
    const decoded = decodeChatCursor(cursor.trim());
    const cursorDate = new Date(decoded.updatedAt);
    whereAnd.push({
      OR: [
        { updatedAt: { lt: cursorDate } },
        {
          AND: [
            { updatedAt: cursorDate },
            { id: { lt: decoded.id } },
          ],
        },
      ],
    });
  }

  const rows = await db.chat.findMany({
    where: { AND: whereAnd },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: CHAT_FIELDS,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;
  const nextCursor =
    hasMore && lastItem ? encodeChatCursor(lastItem.updatedAt, lastItem.id) : null;

  return {
    chats: items.map(toPublicChat),
    nextCursor,
  };
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

function chatNotFound(): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
}

function normalizeFlag(value: unknown, field: string): number {
  if (value === true) return 1;
  if (value === false) return 0;
  throw badRequest("INVALID_FIELD", `${field} harus boolean.`);
}

export type UpdateChatInput = {
  title?: unknown;
  folderId?: unknown;
  pinned?: unknown;
  archived?: unknown;
};

/**
 * Ubah judul, folder, pin, atau arsip (REQ-NT-33/34/35, SDD-3.5).
 * Field yang tidak dikirim tidak disentuh. Chat milik pengguna lain → 404.
 */
export async function updateChat(
  db: Db,
  userId: string,
  chatId: string,
  input: UpdateChatInput,
): Promise<PublicChat> {
  const data: Record<string, unknown> = {};

  if ("title" in input) {
    // Rename lewat PATCH juga manual: judul otomatis tidak boleh menimpanya,
    // dan revisi naik supaya penulis otomatis yang lebih lambat kalah CAS.
    data.title = normalizeTitle(input.title);
    data.titleSource = "manual";
    data.titleRevision = { increment: 1 };
  }

  if ("folderId" in input) {
    const raw = input.folderId;
    if (raw === null) {
      data.folderId = null;
    } else if (typeof raw === "string" && raw.trim() !== "") {
      const folder = await db.folder.findFirst({
        where: { id: raw.trim(), userId },
        select: { id: true },
      });
      if (!folder) throw badRequest("INVALID_FOLDER", "Folder tidak ditemukan.");
      data.folderId = raw.trim();
    } else if (typeof raw === "string") {
      data.folderId = null;
    } else {
      throw badRequest("INVALID_FOLDER", "folderId harus teks atau null.");
    }
  }

  if ("pinned" in input) data.pinned = normalizeFlag(input.pinned, "pinned");
  if ("archived" in input) data.archived = normalizeFlag(input.archived, "archived");

  if (Object.keys(data).length === 0) {
    throw badRequest("EMPTY_UPDATE", "Tidak ada field yang diubah.");
  }

  const result = await db.chat.updateMany({ where: { id: chatId, userId }, data });
  if (result.count === 0) throw chatNotFound();

  const row = (await db.chat.findFirst({
    where: { id: chatId, userId },
    select: CHAT_FIELDS,
  })) as ChatRow | null;
  if (!row) throw chatNotFound();
  return toPublicChat(row);
}

/**
 * Hapus chat beserta pesan, generasi, dan tautan berbaginya (cascade FK).
 *
 * Job generasi TIDAK punya FK ke Chat (payload JSON), jadi ia dihapus eksplisit
 * dalam transaksi yang sama. Tanpa itu, worker yang sedang memegang lease
 * generasi terhapus akan menulis hasil basi; dengan baris job hilang, fence
 * worker gagal dan worker berhenti (FIX-02/T17).
 */
export async function deleteChat(db: Db, userId: string, chatId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: chatId, userId },
      select: { id: true },
    });
    if (!chat) throw chatNotFound();

    const generations = await tx.generation.findMany({
      where: { chatId },
      select: { jobId: true },
    });
    const jobIds = generations
      .map((generation) => generation.jobId)
      .filter((jobId): jobId is string => jobId !== null);
    if (jobIds.length > 0) {
      await tx.job.deleteMany({ where: { id: { in: jobIds } } });
    }

    await tx.chat.delete({ where: { id: chatId } });
  });
}
