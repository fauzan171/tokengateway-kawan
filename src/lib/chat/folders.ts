/**
 * Folder satu tingkat (REQ-NT-35, SDD-2.2).
 *
 * Folder tidak bersarang: `Folder` tidak punya `parentId`. Menghapus folder
 * TIDAK menghapus chat — FK `Chat.folderId` memakai `onDelete: SetNull`.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

const NAME_MAX = 80;

export type PublicFolder = {
  id: string;
  name: string;
  createdAt: string;
};

const FOLDER_FIELDS = { id: true, name: true, createdAt: true } as const;

type FolderRow = { id: string; name: string; createdAt: Date };

function toPublicFolder(row: FolderRow): PublicFolder {
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() };
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_NAME", message: "name harus berupa teks." });
  }
  const name = value.trim();
  if (name === "") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_NAME", message: "name tidak boleh kosong." });
  }
  if (name.length > NAME_MAX) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_NAME",
      message: `name maksimum ${NAME_MAX} karakter.`,
    });
  }
  return name;
}

function folderNotFound(): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code: "FOLDER_NOT_FOUND", message: "Folder tidak ditemukan." });
}

export async function listFolders(db: Db, userId: string): Promise<PublicFolder[]> {
  const rows = await db.folder.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: FOLDER_FIELDS,
  });
  return rows.map(toPublicFolder);
}

export async function createFolder(db: Db, userId: string, name: unknown): Promise<PublicFolder> {
  const row = await db.folder.create({
    data: { id: randomUUID(), userId, name: normalizeName(name) },
    select: FOLDER_FIELDS,
  });
  return toPublicFolder(row);
}

export async function renameFolder(
  db: Db,
  userId: string,
  folderId: string,
  name: unknown,
): Promise<PublicFolder> {
  const result = await db.folder.updateMany({
    where: { id: folderId, userId },
    data: { name: normalizeName(name) },
  });
  if (result.count === 0) throw folderNotFound();

  const row = (await db.folder.findFirst({
    where: { id: folderId, userId },
    select: FOLDER_FIELDS,
  })) as FolderRow | null;
  if (!row) throw folderNotFound();
  return toPublicFolder(row);
}

/** Chat di dalam folder dipindah ke "tanpa folder", bukan dihapus. */
export async function deleteFolder(db: Db, userId: string, folderId: string): Promise<void> {
  const result = await db.folder.deleteMany({ where: { id: folderId, userId } });
  if (result.count === 0) throw folderNotFound();
}
