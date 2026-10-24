/**
 * Pembersihan terjadwal (FIX-24).
 *
 * CLI nyata, bukan perintah yang belum ada: ia benar-benar memangkas baris yang
 * sudah lewat retensi. Dijalankan cron/supervisor, misalnya:
 *
 *   17 * * * *  cd /srv/kawan && npm run cleanup >> logs/cleanup.log 2>&1
 *
 * Aman diulang: setiap langkah idempoten. `--dry-run` melaporkan apa yang AKAN
 * dihapus tanpa menghapus apa pun.
 *
 * Dijalankan lewat `tsx` (sama seperti worker) karena klien Prisma yang
 * digenerate berupa TypeScript, bukan JS hasil build.
 */

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as PrismaClientPg } from "../src/generated/prisma/client";
import { PrismaClient as PrismaClientSqlite } from "../src/generated/prisma-sqlite/client";

const DAY = 24 * 60 * 60 * 1000;

/** Retensi; harus sejalan dengan `RETENTION` di src/lib/data-control. */
const RETENTION = {
  jobDays: 30,
  idempotencyDays: 7,
  occurrenceDays: 30,
  heartbeatDays: 7,
};

const dryRun = process.argv.includes("--dry-run");

type CleanupDb = {
  artifact: { count: (a: unknown) => Promise<number>; updateMany: (a: unknown) => Promise<unknown> };
  job: { count: (a: unknown) => Promise<number>; deleteMany: (a: unknown) => Promise<unknown> };
  idempotencyKey: { count: (a: unknown) => Promise<number>; deleteMany: (a: unknown) => Promise<unknown> };
  scheduleOccurrence: { count: (a: unknown) => Promise<number>; deleteMany: (a: unknown) => Promise<unknown> };
  workerHeartbeat: { count: (a: unknown) => Promise<number>; deleteMany: (a: unknown) => Promise<unknown> };
  $disconnect: () => Promise<void>;
};

async function createClient(url: string): Promise<CleanupDb> {
  if (url.startsWith("file:")) {
    return new PrismaClientSqlite({ adapter: new PrismaBetterSqlite3({ url }) }) as unknown as CleanupDb;
  }
  return new PrismaClientPg({ adapter: new PrismaPg(url) }) as unknown as CleanupDb;
}

async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"]?.trim();
  if (!url) throw new Error("DATABASE_URL wajib diisi.");
  const db = await createClient(url);
  const now = new Date();
  const cutoff = (days: number) => new Date(now.getTime() - days * DAY);
  const report: Record<string, number> = {};

  try {
    // Artefak kedaluwarsa: hanya baris. Byte dibersihkan langkah terpisah
    // supaya kegagalan storage tidak membuat baris menunjuk berkas hilang.
    const expiredArtifacts = await db.artifact.count({
      where: { deletedAt: null, expiresAt: { lt: now } },
    });
    report["expiredArtifacts"] = expiredArtifacts;
    if (!dryRun && expiredArtifacts > 0) {
      await db.artifact.updateMany({
        where: { deletedAt: null, expiresAt: { lt: now } },
        data: { deletedAt: now },
      });
    }

    const terminalJobs = {
      state: { in: ["succeeded", "failed", "cancelled"] },
      finishedAt: { lt: cutoff(RETENTION.jobDays) },
    };
    const oldJobs = await db.job.count({ where: terminalJobs });
    report["oldJobs"] = oldJobs;
    if (!dryRun && oldJobs > 0) await db.job.deleteMany({ where: terminalJobs });

    const oldKeys = { createdAt: { lt: cutoff(RETENTION.idempotencyDays) } };
    const keyCount = await db.idempotencyKey.count({ where: oldKeys });
    report["oldIdempotencyKeys"] = keyCount;
    if (!dryRun && keyCount > 0) await db.idempotencyKey.deleteMany({ where: oldKeys });

    const oldOccurrences = {
      status: { in: ["dispatched", "skipped", "cancelled"] },
      scheduledFor: { lt: cutoff(RETENTION.occurrenceDays) },
    };
    const occurrenceCount = await db.scheduleOccurrence.count({ where: oldOccurrences });
    report["oldOccurrences"] = occurrenceCount;
    if (!dryRun && occurrenceCount > 0) {
      await db.scheduleOccurrence.deleteMany({ where: oldOccurrences });
    }

    const staleHeartbeats = { lastSeenAt: { lt: cutoff(RETENTION.heartbeatDays) } };
    const heartbeatCount = await db.workerHeartbeat.count({ where: staleHeartbeats });
    report["staleHeartbeats"] = heartbeatCount;
    if (!dryRun && heartbeatCount > 0) {
      await db.workerHeartbeat.deleteMany({ where: staleHeartbeats });
    }

    console.log(JSON.stringify({ at: now.toISOString(), dryRun, ...report }, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("cleanup gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
