/**
 * Denyut proses worker (FIX-24, SDD-8.5).
 *
 * `Job.heartbeatAt` hanya bergerak saat ada job; worker sehat dengan antrean
 * kosong karena itu tampak mati. Tabel terpisah ini membuktikan prosesnya
 * hidup, dan `capabilities` mencatat kind yang benar-benar terdaftar.
 */

import type { Db } from "@/lib/db";

export type HeartbeatInput = {
  workerId: string;
  version: string;
  capabilities: readonly string[];
  /** Diisi pada denyut pertama saja; denyut berikutnya tidak menimpanya. */
  startedAt?: Date;
};

export async function touchWorkerHeartbeat(db: Db, input: HeartbeatInput): Promise<void> {
  const now = new Date();
  const capabilities = JSON.stringify(input.capabilities);
  await db.workerHeartbeat.upsert({
    where: { workerId: input.workerId },
    create: {
      workerId: input.workerId,
      version: input.version,
      capabilities,
      startedAt: input.startedAt ?? now,
      lastSeenAt: now,
    },
    update: { version: input.version, capabilities, lastSeenAt: now },
  });
}

/** Umur denyut dianggap basi setelah ini (3x interval 10 detik). */
export const HEARTBEAT_STALE_MS = 30_000;

export type WorkerHealth = {
  alive: number;
  stale: number;
  lastSeenAt: string | null;
  versions: string[];
};

/** Ringkasan kesehatan worker untuk status admin/readiness. */
export async function workerHealth(db: Db, now = new Date()): Promise<WorkerHealth> {
  const rows = await db.workerHeartbeat.findMany({
    select: { version: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  let alive = 0;
  let stale = 0;
  for (const row of rows) {
    if (now.getTime() - row.lastSeenAt.getTime() <= HEARTBEAT_STALE_MS) alive += 1;
    else stale += 1;
  }
  return {
    alive,
    stale,
    lastSeenAt: rows[0]?.lastSeenAt.toISOString() ?? null,
    versions: [...new Set(rows.map((row) => row.version))],
  };
}
