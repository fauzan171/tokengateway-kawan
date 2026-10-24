/**
 * Kuota per pengguna (K6, rencana §K6): BATAS PEMAKAIAN, BUKAN TAGIHAN.
 *
 * Tiga sinyal: token dari UsageRecord (hanya baris reported=1; usage tak
 * dilaporkan = "tidak tersedia", bukan nol bohongan), jumlah run nonterminal,
 * jumlah task per jendela. Konstanta di sini (bukan env) karena belum ada
 * kebutuhan operator mengubahnya; pindah ke env saat multi-tenant nyata.
 *
 * ponytail: agregasi COUNT/SUM per jendela; pindah ke tabel counter inkremental
 * bila query ini mulai mahal (aset: index [userId, createdAt] sudah ada).
 */

import type { Db } from "@/lib/db";

export const TASK_QUOTA = {
  /** Token gabungan per jendela 24 jam; label "batas", bukan tagihan. */
  tokenWindowMs: 24 * 60 * 60 * 1000,
  tokenMax: 1_000_000,
  /** Run nonterminal serentak (queued/running). */
  activeRunMax: 2,
  /** Task baru per jendela 24 jam. */
  taskWindowMs: 24 * 60 * 60 * 1000,
  taskMax: 50,
  /** Detik Retry-After saat 429. */
  retryAfterSeconds: 60,
} as const;

export type QuotaDecision =
  | { ok: true }
  | { ok: false; code: "QUOTA_TOKENS" | "QUOTA_ACTIVE_RUNS" | "QUOTA_TASKS"; message: string; retryAfterSeconds: number };

/**
 * Cek kuota SEBELUM admission task baru. Usage yang tidak dilaporkan
 * (reported=0) diabaikan — bukan "0 token dipakai" melainkan "tidak
 * tersedia"; keputusan tetap diambil dari sinyal yang ada.
 */
export async function checkTaskQuota(db: Db, userId: string, now = new Date()): Promise<QuotaDecision> {
  const since24h = new Date(now.getTime() - TASK_QUOTA.tokenWindowMs);

  const [tokens, activeRuns, tasks] = await Promise.all([
    db.usageRecord.aggregate({
      where: { userId, reported: 1, createdAt: { gte: since24h } },
      _sum: { totalTokens: true },
    }),
    // TaskRun tidak punya userId langsung (lewat Task); hitung task yang masih
    // punya run nonterminal — run aktif serentak dibatasi per task aktif.
    db.taskRun.count({
      where: { status: { in: ["queued", "running"] }, task: { userId } },
    }),
    db.task.count({
      where: { userId, createdAt: { gte: new Date(now.getTime() - TASK_QUOTA.taskWindowMs) } },
    }),
  ]);

  const used = tokens._sum.totalTokens ?? 0;
  if (used >= TASK_QUOTA.tokenMax) {
    return {
      ok: false,
      code: "QUOTA_TOKENS",
      message: "Batas token 24 jam tercapai. Ini batas pemakaian, bukan tagihan.",
      retryAfterSeconds: TASK_QUOTA.retryAfterSeconds,
    };
  }
  if (activeRuns >= TASK_QUOTA.activeRunMax) {
    return {
      ok: false,
      code: "QUOTA_ACTIVE_RUNS",
      message: `Masih ada ${activeRuns} run berjalan; tunggu selesai atau batalkan.`,
      retryAfterSeconds: TASK_QUOTA.retryAfterSeconds,
    };
  }
  if (tasks >= TASK_QUOTA.taskMax) {
    return {
      ok: false,
      code: "QUOTA_TASKS",
      message: "Batas task baru per 24 jam tercapai.",
      retryAfterSeconds: TASK_QUOTA.retryAfterSeconds,
    };
  }
  return { ok: true };
}
