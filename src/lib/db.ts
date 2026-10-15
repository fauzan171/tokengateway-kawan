/**
 * Klien Prisma tunggal untuk proses web dan worker (SDD-2).
 *
 * Provider dipilih dari bentuk `DATABASE_URL`: `file:` berarti SQLite (dev),
 * selain itu PostgreSQL (produksi). Dua klien hasil generate berbeda
 * (`prisma` dan `prisma-sqlite`) tidak bisa di-import statis keduanya tanpa
 * menarik driver yang tidak dipakai, jadi pemilihannya dinamis.
 *
 * `import type` di bawah hanya untuk tipe: ia tidak ikut ke runtime, jadi
 * tidak ada driver yang dimuat lebih awal.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient as PrismaClientPg } from "@/generated/prisma/client";

export type Db = PrismaClientPg;

let client: Db | null = null;

export function isSqliteUrl(url: string): boolean {
  return url.startsWith("file:");
}

export async function getDb(url: string): Promise<Db> {
  if (client) return client;

  const instance = isSqliteUrl(url)
    ? new (await import("@/generated/prisma-sqlite/client")).PrismaClient({
        adapter: new PrismaBetterSqlite3({ url }),
      })
    : new (await import("@/generated/prisma/client")).PrismaClient({
        adapter: new PrismaPg(url),
      });

  client = instance as unknown as Db;
  return client;
}

/** Menutup klien saat proses berhenti. */
export async function closeDb(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  await current.$disconnect();
}
