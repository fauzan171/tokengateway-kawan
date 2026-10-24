/**
 * Pengelolaan pengguna oleh admin (REQ-NT-74/75, SDD-3.7, SDD-2.6).
 *
 * Dua jaminan yang dijaga di sini:
 *   1. Menonaktifkan pengguna menghapus SEMUA baris `Session` miliknya. Sesi
 *      lama langsung mati walau tokennya masih dipegang browser; lapis kedua
 *      ada di `isSessionValid` yang menolak pengguna berstatus bukan `active`.
 *   2. Menghapus pengguna membersihkan setiap tabel yang menyimpan `userId`,
 *      berkas dokumen di disk, dan `LoginAttempt` yang dikunci lewat email.
 *      Tidak ada sisa yang bisa dipakai menautkan identitas lama.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import type { Db } from "@/lib/db";
import { deleteDocument } from "@/lib/documents/storage";
import { normalizeEmail } from "@/lib/auth/users";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const SELECT = { id: true, email: true, name: true, role: true, status: true, createdAt: true } as const;

function toRow(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
}): AdminUserRow {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listUsers(
  db: Db,
  input: { cursor?: string; limit?: number } = {},
): Promise<{ users: AdminUserRow[]; nextCursor: string | null }> {
  const raw = input.limit ?? DEFAULT_LIMIT;
  const limit = Number.isFinite(raw) ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(raw))) : DEFAULT_LIMIT;
  const cursor = input.cursor?.trim();

  // Ambil satu baris lebih banyak untuk mengetahui apakah masih ada halaman
  // berikutnya tanpa menghitung seluruh tabel.
  const rows = await db.user.findMany({
    select: SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const page = rows.slice(0, limit);
  return {
    users: page.map(toRow),
    nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function setUserStatus(
  db: Db,
  input: { actorId: string; userId: string; status: unknown },
): Promise<{ user: AdminUserRow }> {
  const status = input.status;
  if (status !== "active" && status !== "disabled") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_STATUS",
      message: "status harus active atau disabled.",
    });
  }
  if (input.userId === input.actorId && status === "disabled") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "CANNOT_DISABLE_SELF",
      message: "Admin tidak dapat menonaktifkan akunnya sendiri.",
    });
  }

  const exists = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!exists) {
    throw new ApiError({ status: STATUS.NOT_FOUND, code: "USER_NOT_FOUND", message: "Pengguna tidak ditemukan." });
  }

  const user = await db.user.update({ where: { id: input.userId }, data: { status }, select: SELECT });

  // Lapis pertama pencabutan: baris sesi dibuang, bukan hanya ditandai, supaya
  // tidak ada yang bisa divalidasi ulang bila status dikembalikan kelak.
  if (status === "disabled") {
    await db.session.deleteMany({ where: { userId: input.userId } });
  }

  return { user: toRow(user) };
}

export async function deleteUserData(
  db: Db,
  input: { actorId: string; userId: string },
): Promise<{ removed: boolean }> {
  if (input.userId === input.actorId) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "CANNOT_DELETE_SELF",
      message: "Admin tidak dapat menghapus akunnya sendiri.",
    });
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, documents: { select: { storageKey: true } } },
  });
  if (!user) return { removed: false };

  // Transaksi adalah sumber kebenaran: berkas baru dibersihkan setelah commit.
  // Urutan sebaliknya meninggalkan baris yang menunjuk berkas hilang bila
  // transaksi gagal.
  const email = normalizeEmail(user.email);

  await db.$transaction(async (tx) => {
    await tx.usageRecord.deleteMany({ where: { userId: input.userId } });
    await tx.prompt.deleteMany({ where: { userId: input.userId } });
    await tx.document.deleteMany({ where: { userId: input.userId } });
    await tx.folder.deleteMany({ where: { userId: input.userId } });
    await tx.shareLink.deleteMany({ where: { chat: { userId: input.userId } } });
    await tx.chat.deleteMany({ where: { userId: input.userId } });
    await tx.connection.deleteMany({ where: { userId: input.userId } });
    await tx.idempotencyKey.deleteMany({ where: { userId: input.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: input.userId } });
    // Kunci pembatas laju memuat email, bukan userId; tanpa ini percobaan
    // login lama tetap bisa mengunci alamat yang sama setelah akun dihapus.
    await tx.loginAttempt.deleteMany({ where: { key: { startsWith: `${email}\u0000` } } });
    await tx.session.deleteMany({ where: { userId: input.userId } });
    await tx.credential.deleteMany({ where: { userId: input.userId } });
    await tx.userSetting.deleteMany({ where: { userId: input.userId } });
    await tx.user.delete({ where: { id: input.userId } });
  });

  // Setelah commit: berkas tidak lagi punya baris. Kegagalan unlink dicatat
  // agar `cleanupOrphans` bisa menyapunya nanti; path pengguna tidak dicatat.
  let failedFiles = 0;
  for (const document of user.documents) {
    try {
      await deleteDocument(document.storageKey);
    } catch {
      failedFiles += 1;
    }
  }
  if (failedFiles > 0) {
    logger.warn(
      { requestId: "admin.delete-user", route: "admin.users", latencyMs: 0, result: "gagal-hapus-berkas" },
      { failedFiles },
    );
  }

  return { removed: true };
}
