/**
 * Konfigurasi runtime yang diubah admin (REQ-NT-76, SDD-3.7).
 *
 * Satu baris `id = "app"`. Baris tidak ada berarti pendaftaran terbuka;
 * membaca tidak pernah menulis, supaya tabel tetap bersih sampai admin
 * benar-benar mengubah sesuatu.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

export type AppConfig = { registrationOpen: boolean };

export const DEFAULT_APP_CONFIG: AppConfig = { registrationOpen: true };

const ROW_ID = "app";

export async function readAppConfig(db: Db): Promise<AppConfig> {
  const row = await db.appConfig.findUnique({ where: { id: ROW_ID } });
  if (!row) return DEFAULT_APP_CONFIG;
  return { registrationOpen: row.registrationOpen !== 0 };
}

/** Hanya kunci `registrationOpen`; nilai bukan boolean ditolak 400. */
export async function writeAppConfig(db: Db, patch: { registrationOpen?: unknown }): Promise<AppConfig> {
  const value = patch.registrationOpen;
  if (typeof value !== "boolean") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_CONFIG",
      message: "registrationOpen harus boolean.",
    });
  }

  const registrationOpen = value ? 1 : 0;
  const row = await db.appConfig.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, registrationOpen },
    update: { registrationOpen },
  });
  return { registrationOpen: row.registrationOpen !== 0 };
}
