/**
 * Cache daftar model per koneksi (REQ-NT-20, SDD-3.3).
 *
 * Satu baris `ModelCache` per koneksi (`@@unique([connectionId])`). Modul ini
 * sengaja tipis: ia hanya menyimpan dan membaca kembali daftar model yang
 * sudah dinormalisasi `src/lib/providers/gateway.ts`.
 *
 * Dua aturan yang penting:
 *
 * 1. **TTL dihitung dari `fetchedAt` di DATA, bukan timer proses.** Umur cache
 *    adalah `now - fetchedAt`, sehingga restart proses tidak memperpanjang
 *    umur cache — persis yang diminta SDD-3.3/REQ-NT-20.
 * 2. **Data rusak diperlakukan sebagai cache kosong, bukan galat.** Bila JSON
 *    di kolom tidak terbaca atau isinya bukan daftar model, fungsi baca
 *    mengembalikan `null` supaya pemanggil mengambil ulang dari gateway.
 *    Melempar di sini akan mengubah satu baris rusak menjadi kegagalan
 *    endpoint yang tidak dapat dipulihkan pengguna.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import type { GatewayModel } from "@/lib/providers/gateway";

export type CachedModels = {
  models: GatewayModel[];
  fetchedAt: Date;
};

export type GetCachedModelsInput = {
  connectionId: string;
  /** Dari `Config.modelCacheTtlSeconds` (REQ-NT-20). */
  ttlSeconds: number;
  /** Titik waktu pembanding; disuntik agar uji tidak bergantung jam nyata. */
  now: Date;
};

export type PutCachedModelsInput = {
  connectionId: string;
  models: readonly GatewayModel[];
  now: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Memvalidasi isi kolom JSON.
 *
 * Entri yang tidak punya `id` string dibuang: bentuk tersimpan adalah kontrak
 * internal, jadi entri yang tidak memenuhi kontrak itu tidak boleh lolos ke
 * pemilih model.
 */
function parseModels(json: string): GatewayModel[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const models: GatewayModel[] = [];
  for (const entry of parsed) {
    if (!isRecord(entry)) continue;
    const id = entry["id"];
    if (typeof id !== "string" || id === "") continue;
    models.push(entry as GatewayModel);
  }
  return models.length > 0 ? models : null;
}

/**
 * Cache yang masih berlaku, atau `null` bila tidak ada, sudah kedaluwarsa,
 * atau isinya rusak.
 *
 * Batas TTL bersifat eksklusif: umur tepat sama dengan TTL dianggap sudah
 * kedaluwarsa, sehingga "tidak menahan model baru lebih dari TTL" (REQ-NT-20)
 * terpenuhi tanpa toleransi tambahan.
 */
export async function getCachedModels(
  db: Db,
  { connectionId, ttlSeconds, now }: GetCachedModelsInput,
): Promise<CachedModels | null> {
  const row = await db.modelCache.findUnique({ where: { connectionId } });
  if (!row) return null;

  const ageMs = now.getTime() - row.fetchedAt.getTime();
  // `ageMs < 0` berarti jam mundur setelah penyimpanan; data tetap dianggap
  // segar karena tidak mungkin sudah lebih tua dari TTL.
  if (ageMs >= ttlSeconds * 1000) return null;

  const models = parseModels(row.modelListJson);
  if (models === null) return null;

  return { models, fetchedAt: row.fetchedAt };
}

/**
 * Menyimpan (upsert) daftar model untuk sebuah koneksi.
 *
 * Satu baris per koneksi: panggilan berulang menimpa baris yang sama, tidak
 * menumpuk riwayat.
 */
export async function putCachedModels(
  db: Db,
  { connectionId, models, now }: PutCachedModelsInput,
): Promise<CachedModels> {
  const modelListJson = JSON.stringify(models);

  await db.modelCache.upsert({
    where: { connectionId },
    create: { id: randomUUID(), connectionId, modelListJson, fetchedAt: now },
    update: { modelListJson, fetchedAt: now },
  });

  return { models: [...models], fetchedAt: now };
}
