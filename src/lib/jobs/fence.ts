/**
 * Fencing penulisan worker (FIX-02, SDD-4.2/SDD-8.1).
 *
 * Worker hanya boleh menulis selama lease-nya masih hidup. Tanpa pemeriksaan
 * ini, worker yang lease-nya kedaluwarsa (atau job-nya sudah dihentikan/dihapus)
 * tetap menulis delta, event, dan status — menghasilkan jawaban ganda atau
 * menghidupkan kembali generasi yang sudah ditutup.
 *
 * Pemeriksaan dilakukan lewat satu query ringan dengan cache pendek: heartbeat
 * memperpanjang lease tiap 20 detik sementara lease berumur 60 detik, jadi
 * jendela 1 detik tetap jauh di bawah margin keselamatan, dan tidak menambah
 * satu query per token.
 */

import type { Db } from "@/lib/db";

/** Identitas lease yang diterima worker saat klaim. */
export type JobFence = { jobId: string; leaseToken: string };

/** Dilempar saat lease hilang; pemanggil berhenti tanpa menulis apa pun. */
export class LeaseLost extends Error {
  constructor() {
    super("Lease job sudah tidak dipegang worker ini.");
    this.name = "LeaseLost";
  }
}

const CACHE_MS = 1_000;

export type FenceChecker = {
  /** `true` bila lease masih hidup. Hasil di-cache `CACHE_MS`. */
  held(): Promise<boolean>;
  /** `true` bila lease masih hidup, tanpa cache. Dipakai sebelum tulisan final. */
  heldFresh(): Promise<boolean>;
};

export function createFence(db: Db, fence: JobFence | undefined): FenceChecker {
  let checkedAt = 0;
  let last = true;

  const query = async (): Promise<boolean> => {
    const now = new Date();
    const row = await db.job.findFirst({
      where: {
        id: fence!.jobId,
        leaseToken: fence!.leaseToken,
        state: { in: ["leased", "running"] },
        leaseExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    return row !== null;
  };

  return {
    async heldFresh() {
      if (!fence) return true;
      last = await query();
      checkedAt = Date.now();
      return last;
    },
    async held() {
      // Tanpa fence (mis. dipanggil test langsung) semua tulisan diizinkan.
      if (!fence) return true;
      if (Date.now() - checkedAt < CACHE_MS) return last;
      return this.heldFresh();
    },
  };
}

/** Berhenti dengan `LeaseLost` bila lease sudah tidak dipegang. */
export async function assertHeld(checker: FenceChecker): Promise<void> {
  if (!(await checker.held())) throw new LeaseLost();
}
