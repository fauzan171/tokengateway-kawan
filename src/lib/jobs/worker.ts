/**
 * Runtime worker (SDD-8.3).
 *
 * Loop klaim → jalankan → selesaikan. Handler didaftarkan per kind, jadi
 * modul ini tidak tahu apa pun soal chat, RAG, atau surel. Lease dijaga
 * heartbeat selama handler berjalan; bila lease hilang (worker lain sudah
 * mengambil alih), hasil handler dibuang, bukan ditulis.
 *
 * Shutdown sopan: berhenti mengklaim, batalkan handler yang berjalan, beri
 * kesempatan selesai sampai `shutdownGraceMs`, lalu yang belum selesai
 * ditandai `indeterminate` — bukan dikembalikan ke `queued`, karena hasil
 * percobaan yang terpotong tidak diketahui (SDD-8.1).
 */

import type { Db } from "@/lib/db";
import { logger } from "@/lib/api/logger";
import {
  claim,
  complete,
  fail,
  heartbeat,
  releaseExpired,
  HEARTBEAT_MS,
  LEASE_MS,
  type Claim,
} from "./queue";

export type JobHandler = (job: Claim, signal: AbortSignal) => Promise<void>;

export type WorkerOptions = {
  db: Db;
  workerId: string;
  handlers: Record<string, JobHandler>;
  /** Jeda saat antrean kosong. */
  idleMs?: number;
  leaseMs?: number;
  heartbeatMs?: number;
  /** Batas waktu job berjalan saat shutdown sebelum ditandai `indeterminate`. */
  shutdownGraceMs?: number;
  now?: () => Date;
};

export type Worker = {
  /** Menjalankan loop sampai `stop()` dipanggil atau sinyal dibatalkan. */
  run(signal: AbortSignal): Promise<void>;
  /** Berhenti mengklaim dan membatalkan handler yang berjalan. */
  stop(): void;
  /** Menandai job yang masih berjalan sebagai `indeterminate`. */
  abandonRunning(): Promise<number>;
};

const DEFAULT_IDLE_MS = 1_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 10_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
  });
}

function aborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export function createWorker(options: WorkerOptions): Worker {
  const {
    db,
    workerId,
    handlers,
    idleMs = DEFAULT_IDLE_MS,
    leaseMs = LEASE_MS,
    heartbeatMs = HEARTBEAT_MS,
    shutdownGraceMs = DEFAULT_SHUTDOWN_GRACE_MS,
    now = () => new Date(),
  } = options;

  // Satu sinyal untuk seluruh worker: `stop()` membatalkannya, dan setiap
  // handler menerima turunannya supaya handler yang berjalan ikut berhenti.
  const master = new AbortController();
  const running = new Map<string, Claim>();

  async function processOne(held: Claim): Promise<void> {
    const handler = handlers[held.kind];
    if (!handler) {
      // Tidak ada yang dijalankan, jadi efeknya pasti tidak ada: `failed`,
      // bukan `indeterminate`. Ini kesalahan program, bukan ragu.
      await db.job.updateMany({
        where: { id: held.id, leaseToken: held.leaseToken },
        data: {
          state: "failed",
          lastError: `tidak ada handler untuk kind ${held.kind}`,
          finishedAt: now(),
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      return;
    }

    const controller = new AbortController();
    const cancel = () => controller.abort();
    master.signal.addEventListener("abort", cancel, { once: true });
    if (master.signal.aborted) controller.abort();

    const beat = setInterval(() => {
      void heartbeat(db, held, leaseMs, now()).then((stillHeld) => {
        // Lease hilang: hentikan handler, hasilnya tidak boleh ditulis.
        if (!stillHeld) controller.abort();
      });
    }, heartbeatMs);

    running.set(held.id, held);
    try {
      await handler(held, controller.signal);
      if (controller.signal.aborted) return;
      await complete(db, held, now());
    } catch (error) {
      if (controller.signal.aborted) return;
      const state = await fail(db, held, error, { now: now() });
      logger.error(
        { requestId: held.id, route: "worker", latencyMs: 0, result: state },
        { kind: held.kind, workerId, error },
      );
    } finally {
      clearInterval(beat);
      master.signal.removeEventListener("abort", cancel);
      running.delete(held.id);
    }
  }

  async function abandonRunning(): Promise<number> {
    let total = 0;
    for (const held of [...running.values()]) {
      const { count } = await db.job.updateMany({
        where: { id: held.id, leaseToken: held.leaseToken, state: { in: ["leased", "running"] } },
        data: {
          state: "indeterminate",
          lastError: `worker berhenti saat job berjalan (${workerId})`,
          finishedAt: now(),
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      total += count;
      running.delete(held.id);
    }
    return total;
  }

  return {
    stop() {
      master.abort();
    },
    abandonRunning,

    async run(signal: AbortSignal) {
      const stopSignal = AbortSignal.any([signal, master.signal]);

      while (!stopSignal.aborted) {
        // Lease worker yang mati tidak menyandera job: sapu sebelum klaim.
        await releaseExpired(db, now());

        const held = await claim(db, { workerId, leaseMs, now: now() });
        if (!held) {
          await sleep(idleMs, stopSignal);
          continue;
        }

        // Jangan menunggu handler selesai tanpa syarat: shutdown harus bisa
        // memotongnya. `processOne` menyelesaikan pembukuannya sendiri.
        await Promise.race([processOne(held), aborted(stopSignal)]);
      }

      if (running.size > 0) {
        const deadline = now().getTime() + shutdownGraceMs;
        while (running.size > 0 && now().getTime() < deadline) {
          await sleep(25);
        }
        await abandonRunning();
      }
    },
  };
}
