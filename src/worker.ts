/**
 * Entry point worker (SDD-8.3).
 *
 * Proses terpisah dari image yang sama: `npm run worker` di dev, dan nanti
 * `node dist/worker.js` di produksi. Worker tidak melayani HTTP; satu-satunya
 * tugasnya menarik job dari tabel dan menjalankannya.
 *
 * Shutdown sopan adalah syarat, bukan tambahan: SIGINT/SIGTERM berhenti
 * mengklaim, memberi handler yang berjalan kesempatan selesai, lalu yang
 * belum selesai ditandai `indeterminate` oleh `createWorker`. Sinyal kedua
 * keluar paksa supaya proses tidak tersangkut selamanya.
 */

import { hostname } from "node:os";
import { logger } from "@/lib/api/logger";
import { loadConfig } from "@/lib/config/env";
import { closeDb, getDb } from "@/lib/db";
import { createWorker, type JobHandler } from "@/lib/jobs/worker";
import { HANDLED_KINDS } from "@/lib/jobs/kinds";
import { touchWorkerHeartbeat } from "@/lib/jobs/worker-heartbeat";
import { runGeneration } from "@/lib/chat/generate";
import { runExtract } from "@/lib/documents/run-extract";
import { runTaskRun } from "@/lib/tasks/run";
import { cleanupOrphans } from "@/lib/documents/remove";
import { reconcileGenerations } from "@/lib/chat/recovery";

const IDLE_MS = 1_000;
const WORKER_HEARTBEAT_MS = 10_000;
/** Ditulis ke `WorkerHeartbeat.version`; dibaca dari package.json sekali. */
const VERSION = process.env["npm_package_version"] ?? "0.2.0";
const SHUTDOWN_GRACE_MS = 10_000;
/** Batas keras: setelah ini proses keluar meski ada handler yang bandel. */
const FORCE_EXIT_MS = 30_000;

/**
 * Handler per kind didaftarkan di sini saat kind-nya benar-benar lahir.
 */
const handlers: Record<string, JobHandler> = {
  "chat.generate": async (claim, signal, fence) => {
    const payload = JSON.parse(claim.payloadJson || "{}") as { generationId?: string };
    if (!payload.generationId) throw new Error("Payload job chat.generate tidak memiliki generationId.");
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    await runGeneration(db, config, payload.generationId, signal, fence);
  },
  "document.extract": async (claim, signal) => {
    const payload = JSON.parse(claim.payloadJson || "{}") as { documentId?: string };
    if (!payload.documentId) throw new Error("Payload job document.extract tidak memiliki documentId.");
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    await runExtract(db, payload.documentId, signal);
  },
  "agent.run": async (claim, signal, fence) => {
    const payload = JSON.parse(claim.payloadJson || "{}") as { runId?: string };
    if (!payload.runId) throw new Error("Payload job agent.run tidak memiliki runId.");
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    await runTaskRun(db, config, payload.runId, signal, fence);
  },
  "storage.cleanup": async () => {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    const result = await cleanupOrphans(db);
    logger.info(
      { requestId: "storage.cleanup", route: "worker", latencyMs: 0, result: "selesai" },
      result,
    );
  },
};

/**
 * Registry yang tidak lengkap adalah kesalahan program, bukan keadaan runtime:
 * job kind itu akan mengendap `queued` tanpa pernah dijalankan. Gagal di
 * startup lebih baik daripada antrean yang diam-diam macet (FIX-24/T14).
 */
function assertHandlerRegistry(): void {
  const missing = HANDLED_KINDS.filter((kind) => !(kind in handlers));
  if (missing.length > 0) {
    throw new Error(`Worker tidak punya handler untuk kind: ${missing.join(", ")}`);
  }
}

async function main(): Promise<void> {
  assertHandlerRegistry();
  const config = loadConfig();
  const db = await getDb(config.databaseUrl);

  // Id worker terlihat di kolom `leaseOwner`: hostname membedakan pod,
  // pid membedakan proses dalam satu host.
  const workerId = `${hostname()}-${process.pid}`;
  const log = (result: string, extra?: Record<string, unknown>) =>
    logger.info({ requestId: workerId, route: "worker", latencyMs: 0, result }, extra);

  // Denyut proses ditulis walau tidak ada job: status admin harus bisa
  // membedakan "worker mati" dari "antrean kosong" (FIX-24).
  await touchWorkerHeartbeat(db, {
    workerId,
    version: VERSION,
    capabilities: Object.keys(handlers),
    startedAt: new Date(),
  });
  const beat = setInterval(() => {
    void touchWorkerHeartbeat(db, { workerId, version: VERSION, capabilities: Object.keys(handlers) }).catch(
      (error: unknown) =>
        logger.warn(
          { requestId: workerId, route: "worker", latencyMs: 0, result: "heartbeat-gagal" },
          { error },
        ),
    );
  }, WORKER_HEARTBEAT_MS);
  beat.unref();

  const worker = createWorker({
    db,
    workerId,
    handlers,
    idleMs: IDLE_MS,
    shutdownGraceMs: SHUTDOWN_GRACE_MS,
    beforeClaim: () => reconcileGenerations(db),
  });

  const controller = new AbortController();
  let force: NodeJS.Timeout | undefined;
  const shutdown = (signal: NodeJS.Signals) => {
    if (controller.signal.aborted) {
      logger.warn(
        { requestId: workerId, route: "worker", latencyMs: 0, result: "exit-paksa" },
        { signal },
      );
      process.exit(1);
    }
    log("shutdown", { signal });
    worker.stop();
    controller.abort();
    // Deadline force-exit baru aktif saat shutdown pertama: operasi normal
    // tidak boleh membawa timer yang mematikan proses.
    force = setTimeout(() => process.exit(1), FORCE_EXIT_MS);
    force.unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log("started", { kinds: Object.keys(handlers) });
  await worker.run(controller.signal);

  clearInterval(beat);
  await reconcileGenerations(db);
  if (force) clearTimeout(force);
  await closeDb();
  log("stopped");
}

main().catch((error) => {
  // Konfigurasi salah atau database tidak bisa dibuka: keluar dengan kode
  // bukan-nol supaya supervisor (systemd, Kubernetes) tahu ini bukan
  // shutdown normal.
  logger.error(
    { requestId: "worker", route: "worker", latencyMs: 0, result: "crash" },
    { error },
  );
  process.exit(1);
});
