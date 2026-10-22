/**
 * Hapus dokumen dan pembersih berkas yatim (WP-NT-P6-09, SDD-6.4).
 *
 * Server-only: memakai `node:fs`, jadi tidak boleh diimpor komponen klien.
 */

import { readdir, rm, stat } from "node:fs/promises";
import { logger } from "@/lib/api/logger";
import type { Db } from "@/lib/db";
import { deleteDocument, resolveKey, storageRoot } from "./storage";

/** Berkas lebih muda dari ini tidak disentuh pembersih: unggahan yang sedang
 *  berjalan menulis `.tmp` lalu `rename`, dan barisnya baru di-commit setelah
 *  berkas ada. */
const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

export async function removeDocument(
  db: Db,
  input: { userId: string; documentId: string; root?: string },
): Promise<{ removed: boolean }> {
  const document = await db.document.findFirst({
    where: { id: input.documentId, userId: input.userId },
    select: { id: true, storageKey: true },
  });
  if (!document) return { removed: false };

  // FIX-06: baris dulu, berkas kemudian. Yatim berkas masih terlacak lewat
  // `cleanupOrphans` (berkas tanpa baris), sebaliknya tidak. Gagal hapus
  // berkas setelah row hilang dibiarkan ke pembersih yatim.
  // Chunk ikut cascade. Sitasi di pesan lama sengaja tidak disentuh: route
  // `chunks/[chunkId]` akan 404 karena barisnya sudah tidak ada.
  await db.document.delete({ where: { id: document.id } });
  await deleteDocument(document.storageKey, input.root);

  return { removed: true };
}

export async function cleanupOrphans(
  db: Db,
  input?: { root?: string },
): Promise<{ deletedFiles: number; keptFiles: number }> {
  const root = input?.root ?? storageRoot();

  let entries: string[];
  try {
    const dirents = await readdir(root, { withFileTypes: true });
    entries = dirents
      .filter((entry) => entry.isFile() && !entry.name.endsWith(".tmp"))
      .map((entry) => entry.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { deletedFiles: 0, keptFiles: 0 };
    }
    throw err;
  }

  const rows = await db.document.findMany({ select: { storageKey: true } });
  const known = new Set(rows.map((row) => row.storageKey));

  let deletedFiles = 0;
  let keptFiles = 0;
  const cutoff = Date.now() - ORPHAN_MIN_AGE_MS;

  for (const name of entries) {
    const target = resolveKey(root, name);
    let mtime: number;
    try {
      mtime = (await stat(target)).mtimeMs;
    } catch {
      continue; // berkas hilang di antara readdir dan stat
    }

    if (known.has(name) || mtime > cutoff) {
      keptFiles += 1;
      continue;
    }

    try {
      await rm(target, { force: true });
      deletedFiles += 1;
    } catch (err) {
      logger.warn(
        { requestId: "storage.cleanup", route: "worker", latencyMs: 0, result: "gagal-hapus" },
        { file: name, error: err },
      );
    }
  }

  return { deletedFiles, keptFiles };
}
