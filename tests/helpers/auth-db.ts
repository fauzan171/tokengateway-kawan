/**
 * Helper test bersama untuk modul auth.
 *
 * Membuat SQLite sementara, menjalankan migrasi yang dikirim repo apa adanya,
 * lalu mengembalikan klien Prisma. Dipakai oleh password.test.ts,
 * session-store.test.ts, dan users.test.ts supaya ketiganya tidak perlu
 * menyentuh berkas yang sama.
 *
 * Migrasi dijalankan lewat better-sqlite3 langsung (bukan `prisma migrate`)
 * supaya test tidak butuh proses CLI dan tetap membuktikan skema yang dikirim
 * benar-benar bisa dipakai.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { closeDb, getDb, type Db } from "@/lib/db";

const MIGRATION = "prisma/migrations/sqlite/00000000000000_init/migration.sql";

export type TempDb = {
  db: Db;
  /** Jalur berkas database; berguna untuk membuka koneksi kedua. */
  file: string;
  /** Buang direktori sementara. Panggil dari `afterAll`. */
  cleanup: () => Promise<void>;
};

/** Database baru, kosong, dengan skema penuh. */
export async function createTempDb(): Promise<TempDb> {
  await closeDb();
  const dir = mkdtempSync(join(tmpdir(), "kawan-auth-"));
  const file = join(dir, "test.db");

  const raw = new Database(file);
  raw.exec(readFileSync(MIGRATION, "utf8"));
  raw.close();

  const db = await getDb(`file:${file}`);
  return {
    db,
    file,
    cleanup: async () => {
      await closeDb();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Jumlah baris per tabel; dipakai untuk memastikan tidak ada tulisan liar. */
export async function countRows(db: Db): Promise<Record<string, number>> {
  const [users, credentials, sessions] = await Promise.all([
    db.user.count(),
    db.credential.count(),
    db.session.count(),
  ]);
  return { users, credentials, sessions };
}
