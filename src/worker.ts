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
import { runGeneration } from "@/lib/chat/generate";

const IDLE_MS = 1_000;
const SHUTDOWN_GRACE_MS = 10_000;
/** Batas keras: setelah ini proses keluar meski ada handler yang bandel. */
const FORCE_EXIT_MS = 30_000;

/**
 * Handler per kind didaftarkan di sini saat kind-nya benar-benar lahir.
 */
const handlers: Record<string, JobHandler> = {
  "chat.generate": async (claim, signal) => {
    const payload = JSON.parse(claim.payloadJson || "{}") as { generationId?: string };
    if (!payload.generationId) throw new Error("Payload job chat.generate tidak memiliki generationId.");
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);
    await runGeneration(db, config, payload.generationId, signal);
  },
};

async function main(): Promise<void> {
  const config = loadConfig();
  const db = await getDb(config.databaseUrl);

  // Id worker terlihat di kolom `leaseOwner`: hostname membedakan pod,
  // pid membedakan proses dalam satu host.
  const workerId = `${hostname()}-${process.pid}`;
  const log = (result: string, extra?: Record<string, unknown>) =>
    logger.info({ requestId: workerId, route: "worker", latencyMs: 0, result }, extra);

  const worker = createWorker({
    db,
    workerId,
    handlers,
    idleMs: IDLE_MS,
    shutdownGraceMs: SHUTDOWN_GRACE_MS,
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
