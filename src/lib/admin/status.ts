/**
 * Status sistem untuk panel admin (REQ-NT-77, SDD-8.5).
 *
 * Dua aturan yang dijaga:
 *   1. Tidak ada panggilan jaringan. Status tidak boleh menggantung karena
 *      SearXNG atau gateway media sedang mati.
 *   2. Komponen opsional yang tidak dikonfigurasi bukan kegagalan. Boolean
 *      `false` hanya berarti "tidak dipasang", dan status tetap 200.
 *
 * Versi dibaca dari `package.json` lewat `readFile`, bukan `import`, supaya
 * berkas itu tidak ikut ke bundel server.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { readEmbeddingConfig } from "@/lib/documents/embed";
import { readMediaConfig } from "@/lib/media/config";
import { readWebSearchConfig } from "@/lib/search/web";
import { workerHealth } from "@/lib/jobs/worker-heartbeat";

export type SystemStatus = {
  version: string;
  database: { ok: boolean };
  worker: {
    lastHeartbeat: string | null;
    pendingJobs: number;
    failedJobs: number;
    /** Proses worker yang denyutnya masih segar — bukan turunan heartbeat job. */
    alive: number;
    stale: number;
    versions: string[];
  };
  counts: { users: number; chats: number; documents: number };
  optional: { webSearch: boolean; imageGen: boolean; stt: boolean; tts: boolean; embedding: boolean };
};

async function readVersion(): Promise<string> {
  try {
    const raw = await readFile(join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "tidak diketahui";
  } catch {
    return "tidak diketahui";
  }
}

export async function systemStatus(db: Db, input: { config: Config }): Promise<SystemStatus> {
  // `config` sengaja diterima walau belum dipakai: pemanggil sudah memegang
  // konfigurasi tervalidasi, dan status kelak butuh nilai env yang sama.
  void input.config;

  let databaseOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    databaseOk = false;
  }

  // Bila database mati, hitungan juga tidak bisa diambil; jangan biarkan
  // status gagal total hanya karena itu.
  let pendingJobs = 0;
  let failedJobs = 0;
  let lastHeartbeat: string | null = null;
  let health = { alive: 0, stale: 0, lastSeenAt: null as string | null, versions: [] as string[] };
  let users = 0;
  let chats = 0;
  let documents = 0;

  if (databaseOk) {
    try {
      const [queued, failed, jobs, userCount, chatCount, documentCount] = await Promise.all([
        db.job.count({ where: { state: "queued" } }),
        db.job.count({ where: { state: "failed" } }),
        db.job.findMany({
          where: { state: { in: ["leased", "succeeded"] } },
          select: { heartbeatAt: true, finishedAt: true },
        }),
        db.user.count(),
        db.chat.count(),
        db.document.count(),
      ]);

      pendingJobs = queued;
      failedJobs = failed;
      users = userCount;
      chats = chatCount;
      documents = documentCount;

      // Job tidak punya kolom `updatedAt`; detak terakhir diambil dari
      // `heartbeatAt` (lease) atau `finishedAt` (selesai).
      let latest: Date | null = null;
      for (const job of jobs) {
        const at = job.heartbeatAt ?? job.finishedAt;
        if (at && (!latest || at.getTime() > latest.getTime())) latest = at;
      }
      lastHeartbeat = latest ? latest.toISOString() : null;
      health = await workerHealth(db);
    } catch {
      // Tabel belum ada / koneksi putus di tengah: status tetap dikembalikan.
    }
  }

  const media = readMediaConfig();

  return {
    version: await readVersion(),
    database: { ok: databaseOk },
    worker: {
      // Denyut proses adalah sumber utama; heartbeat job hanya cadangan untuk
      // instalasi lama yang belum pernah menulis baris `WorkerHeartbeat`.
      lastHeartbeat: health.lastSeenAt ?? lastHeartbeat,
      pendingJobs,
      failedJobs,
      alive: health.alive,
      stale: health.stale,
      versions: health.versions,
    },
    counts: { users, chats, documents },
    optional: {
      webSearch: Boolean(readWebSearchConfig()),
      imageGen: Boolean(media.image),
      stt: Boolean(media.stt),
      tts: Boolean(media.tts),
      embedding: Boolean(readEmbeddingConfig()),
    },
  };
}
