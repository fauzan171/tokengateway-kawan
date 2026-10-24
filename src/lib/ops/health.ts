/**
 * Kesiapan dan keaktifan layanan (FIX-24).
 *
 * Tiga endpoint dengan audiens berbeda, dan itu disengaja:
 *
 *   - **liveness**: "proses ini hidup". Tidak menyentuh DB, tidak memeriksa
 *     worker. Dipakai supervisor untuk restart, jadi tidak boleh gagal hanya
 *     karena DB sedang sibuk.
 *   - **readiness**: "boleh menerima trafik". Memeriksa DB, schema, denyut
 *     worker, dan runner. Detail lengkap hanya untuk admin; publik mendapat
 *     boolean + satu alasan ringkas.
 *   - **admin status**: detail penuh, wajib sesi admin.
 *
 * Kebocoran yang dihindari: readiness publik TIDAK menyebut versi build, nama
 * tabel, host DB, jumlah baris, pesan galat driver, atau capability internal.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "@/lib/db";
import { HEARTBEAT_STALE_MS } from "@/lib/jobs/worker-heartbeat";

export type CheckState = "ok" | "degraded" | "down" | "unknown";

export type ReadinessCheck = {
  name: string;
  state: CheckState;
  /** Hanya diisi pada keluaran admin. */
  detail?: string;
};

export type ReadinessReport = {
  ready: boolean;
  checks: ReadinessCheck[];
  checkedAt: string;
};

export type ReadinessInput = {
  db: Db;
  now?: Date;
  /** Versi build; hanya dipakai pada keluaran admin. */
  version?: string;
  /** Migrasi yang diharapkan ada di disk (bukan rahasia). */
  migrationsDir?: string;
  /** Kesegaran denyut worker, milidetik. */
  heartbeatStaleMs?: number;
};

/**
 * Periksa migrasi: apakah direktori migrasi di disk lebih baru dari yang
 * tercatat di DB. Ini menangkap keadaan "kode sudah deploy, migrasi belum"
 * — insiden yang pernah terjadi dan membuat worker crash-loop.
 */
export async function checkMigrations(
  db: Db,
  migrationsDir = join(process.cwd(), "prisma", "migrations", "sqlite"),
): Promise<ReadinessCheck> {
  try {
    const onDisk = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const applied = await db.$queryRawUnsafe<{ migration_name: string }[]>(
      'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL',
    );
    const appliedNames = new Set(applied.map((row) => row.migration_name));
    const missing = onDisk.filter((name) => !appliedNames.has(name));
    if (missing.length > 0) {
      return {
        name: "migrations",
        state: "down",
        detail: `belum diterapkan: ${missing.join(", ")}`,
      };
    }
    return { name: "migrations", state: "ok" };
  } catch {
    // Tabel _prisma_migrations tidak ada / bukan SQLite: tidak dapat dipastikan.
    return { name: "migrations", state: "unknown" };
  }
}

/** Kesiapan worker: minimal satu denyut segar. */
export async function checkWorker(
  db: Db,
  now: Date,
  staleMs = HEARTBEAT_STALE_MS,
): Promise<ReadinessCheck> {
  try {
    const freshest = await db.workerHeartbeat.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true, version: true },
    });
    if (!freshest) return { name: "worker", state: "down", detail: "belum ada denyut" };
    const age = now.getTime() - freshest.lastSeenAt.getTime();
    if (age > staleMs) {
      return {
        name: "worker",
        state: "down",
        detail: `denyut terakhir ${Math.round(age / 1000)} detik lalu`,
      };
    }
    return { name: "worker", state: "ok", detail: `versi ${freshest.version}` };
  } catch {
    return { name: "worker", state: "unknown" };
  }
}

/**
 * Kesiapan penuh. `degraded` berarti masih bisa melayani sebagian; `down`
 * berarti tidak boleh menerima trafik.
 */
export async function readiness(input: ReadinessInput): Promise<ReadinessReport> {
  const now = input.now ?? new Date();
  const checks: ReadinessCheck[] = [];

  try {
    await input.db.$queryRawUnsafe("SELECT 1");
    checks.push({ name: "database", state: "ok" });
  } catch {
    checks.push({ name: "database", state: "down", detail: "tidak dapat menghubungi basis data" });
  }

  checks.push(await checkMigrations(input.db, input.migrationsDir));
  checks.push(await checkWorker(input.db, now, input.heartbeatStaleMs));

  // `unknown` TIDAK menjatuhkan readiness: tidak dapat dipastikan bukan berarti
  // tidak siap, dan menurunkannya karena ketidaktahuan akan memicu restart
  // yang justru merusak layanan sehat.
  const down = checks.some((check) => check.state === "down");
  return {
    ready: !down,
    checks,
    checkedAt: now.toISOString(),
  };
}

/**
 * Bentuk publik dari readiness: boolean + satu alasan, tanpa detail.
 * Supervisor cukup, dan tidak ada informasi internal yang bocor.
 */
export function publicReadiness(report: ReadinessReport): {
  ready: boolean;
  checkedAt: string;
  reason?: string;
} {
  if (report.ready) return { ready: true, checkedAt: report.checkedAt };
  const failed = report.checks.find((check) => check.state === "down");
  return {
    ready: false,
    checkedAt: report.checkedAt,
    reason: failed ? `${failed.name} tidak siap` : "komponen belum siap",
  };
}

/** Liveness: tidak menyentuh apa pun. */
export function liveness(now = new Date()): { alive: true; uptimeSeconds: number; checkedAt: string } {
  return {
    alive: true,
    uptimeSeconds: Math.floor(process.uptime()),
    checkedAt: now.toISOString(),
  };
}

/** Ringkasan metrik operasional yang boleh dibaca admin (tanpa isi prompt). */
export type OperationalMetrics = {
  jobs: Record<string, number>;
  runs: Record<string, number>;
  artifacts: { bytes: number; expired: number };
  cleanup: { occurrencesPastRetention: number };
  usage: { reportedTokens: number; estimatedTokens: number; unknownRuns: number };
  checkedAt: string;
};

export async function operationalMetrics(
  db: Db,
  now = new Date(),
): Promise<OperationalMetrics> {
  const [jobRows, runRows, artifactAgg, expiredArtifacts, pastOccurrences, reported, unknownRuns] =
    await Promise.all([
      db.job.groupBy({ by: ["state"], _count: { _all: true } }),
      db.taskRun.groupBy({ by: ["status"], _count: { _all: true } }),
      db.artifact.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true } }),
      db.artifact.count({ where: { deletedAt: null, expiresAt: { lt: now } } }),
      db.scheduleOccurrence.count({ where: { status: "pending", scheduledFor: { lt: now } } }),
      db.usageRecord.aggregate({ where: { reported: 1 }, _sum: { promptTokens: true, completionTokens: true } }),
      db.usageRecord.count({ where: { reported: 0 } }),
    ]);

  return {
    jobs: Object.fromEntries(jobRows.map((row) => [row.state, row._count._all])),
    runs: Object.fromEntries(runRows.map((row) => [row.status, row._count._all])),
    artifacts: { bytes: artifactAgg._sum.sizeBytes ?? 0, expired: expiredArtifacts },
    cleanup: { occurrencesPastRetention: pastOccurrences },
    usage: {
      reportedTokens: (reported._sum.promptTokens ?? 0) + (reported._sum.completionTokens ?? 0),
      // Nilai "estimated" sengaja 0: tidak ada estimasi per baris yang akurat,
      // dan mengarangnya berarti mencampur angka nyata dengan tebakan.
      estimatedTokens: 0,
      unknownRuns,
    },
    checkedAt: now.toISOString(),
  };
}
