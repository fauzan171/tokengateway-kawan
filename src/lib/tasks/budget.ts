/**
 * Anggaran + metering per run (D6).
 *
 * Satu bentuk durable untuk `budgetJson` — dipakai `research.ts` (penulis) dan
 * DTO snapshot (pembaca). Versi pertama punya dua bentuk (tulis nested, baca
 * flat) sehingga setiap resume mengembalikan anggaran ke nol; modul ini jadi
 * satu-satunya tempat bentuk itu didefinisikan.
 *
 * `usageJson` tetap ditulis pemanggil (loop riset). Di sini hanya dibaca untuk
 * DTO, dengan aturan jujur: gateway tidak melapor → `reported:false` dan angka
 * `null`, bukan nol beralasan.
 */

import type { FenceChecker } from "@/lib/jobs/fence";
import type { Db } from "@/lib/db";
import { fenced } from "./run";
import { appendEvent } from "./tasks";

export type RunBudget = {
  max: { inputTokens: number; outputTokens: number };
  consumed: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    searches: number;
    reads: number;
    toolCalls: number;
  };
  estimatorVersion: 1;
};

/**
 * Bentuk yang tersimpan di `TaskRun.budgetJson`. `max` sengaja angka tunggal:
 * loop riset memakai satu batas input gabungan (24k), dan baris lama sudah
 * berbentuk begitu — mengubahnya akan memecahkan resume run yang sedang jalan.
 */
export type StoredBudget = {
  max: number;
  consumed: {
    promptTokens: number;
    completionTokens: number;
    searches: number;
    reads: number;
    toolCalls: number;
    /** Panggilan model yang tidak melaporkan usage; >0 → metering estimasi. */
    unreportedCalls: number;
  };
  estimatorVersion: number;
};

export function emptyStoredBudget(max = 0): StoredBudget {
  return {
    max,
    consumed: {
      promptTokens: 0,
      completionTokens: 0,
      searches: 0,
      reads: 0,
      toolCalls: 0,
      unreportedCalls: 0,
    },
    estimatorVersion: 1,
  };
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Baca `budgetJson`; toleran bentuk flat lama (sebelum `consumed` dikenali).
 * Baris rusak/null → anggaran kosong (`max` = `defaultMax`), bukan galat:
 * snapshot run lama tetap valid dan run baru tetap punya batas.
 */
export function readStoredBudget(json: string | null, defaultMax = 0): StoredBudget {
  if (!json) return emptyStoredBudget(defaultMax);
  try {
    const parsed = JSON.parse(json) as Partial<StoredBudget> & Partial<StoredBudget["consumed"]>;
    const consumed = parsed.consumed ?? parsed;
    const base = emptyStoredBudget(defaultMax);
    return {
      max: num(parsed.max, base.max),
      consumed: {
        promptTokens: num(consumed.promptTokens, 0),
        completionTokens: num(consumed.completionTokens, 0),
        searches: num(consumed.searches, 0),
        reads: num(consumed.reads, 0),
        toolCalls: num(consumed.toolCalls, 0),
        unreportedCalls: num(consumed.unreportedCalls, 0),
      },
      estimatorVersion: num(parsed.estimatorVersion, 1),
    };
  } catch {
    return emptyStoredBudget(defaultMax);
  }
}

/**
 * Settle delta setelah model/tool return (D6(2)). Baca → tambah → tulis dalam
 * satu transaksi CAS, jadi dua settle bersamaan tidak menghilangkan delta.
 */
export async function settleUsage(
  db: Db,
  fence: FenceChecker | undefined,
  runId: string,
  delta: Partial<RunBudget["consumed"]> & { unreportedCalls?: number },
  /** Batas dipakai bila run belum pernah menyimpan anggaran (baris pertama). */
  defaultMax = 0,
): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const applied = await fenced(db, fence, async (tx) => {
      const row = await tx.taskRun.findUnique({
        where: { id: runId },
        select: { budgetJson: true },
      });
      if (!row) return false;

      const current = readStoredBudget(row.budgetJson, defaultMax);
      const next: StoredBudget = {
        max: current.max,
        estimatorVersion: current.estimatorVersion,
        consumed: {
          promptTokens: current.consumed.promptTokens + (delta.promptTokens ?? 0),
          completionTokens: current.consumed.completionTokens + (delta.completionTokens ?? 0),
          searches: current.consumed.searches + (delta.searches ?? 0),
          reads: current.consumed.reads + (delta.reads ?? 0),
          toolCalls: current.consumed.toolCalls + (delta.toolCalls ?? 0),
          unreportedCalls: current.consumed.unreportedCalls + (delta.unreportedCalls ?? 0),
        },
      };

      // Anggaran tidak boleh "kembali": delta negatif dijepit ke nol.
      for (const [key, value] of Object.entries(next.consumed)) {
        if (value < 0) (next.consumed as Record<string, number>)[key] = 0;
      }

      // CAS pada NILAI budget itu sendiri, bukan pada `revision`: `revision`
      // adalah penanda transisi status run (dipakai ETag/If-Match dan
      // `policyRevision`), jadi menaikkannya tiap panggilan model akan membuat
      // angka itu berbohong soal state run. Dua settle bersamaan tetap aman
      // karena guard-nya baris `budgetJson` yang dibaca di transaksi yang sama.
      const updated = await tx.taskRun.updateMany({
        where: { id: runId, budgetJson: row.budgetJson },
        data: { budgetJson: JSON.stringify(next) },
      });
      if (updated.count === 0) return false;

      await appendEvent(tx, runId, "budget.updated", {
        consumed: {
          promptTokens: next.consumed.promptTokens,
          completionTokens: next.consumed.completionTokens,
          totalTokens: next.consumed.promptTokens + next.consumed.completionTokens,
          searches: next.consumed.searches,
          reads: next.consumed.reads,
          toolCalls: next.consumed.toolCalls,
        },
        remaining: Math.max(0, next.max - (next.consumed.promptTokens + next.consumed.completionTokens)),
      });
      return true;
    });
    if (applied) return;
  }
  throw new Error("Gagal menyimpan anggaran run: anggaran berubah terus.");
}

/** Bentuk DTO metering snapshot (S2-2): backend sumber kebenaran. */
export type RunMetering = {
  usage: {
    reported: boolean;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
  consumed: RunBudget["consumed"];
  sourcesRead: number;
};

/**
 * Proyeksi snapshot. `sourcesRead` = halaman unik yang benar-benar dibaca
 * (`page_read`), dedupe per `finalUrl`+`textHash`; URL gagal-baca tidak dihitung.
 */
/**
 * `null` bila run belum punya data metering sama sekali (kolom D6 masih null,
 * mis. run pra-D6 atau agen non-riset). Mengembalikan objek nol di sini akan
 * tampil sebagai "pemakaian 0" — klaim, bukan ketiadaan data.
 */
export function toRunMetering(
  run: { budgetJson: string | null; usageJson: string | null },
  sources: { kind: string; finalUrl: string | null; requestedUrl: string; textHash: string | null }[],
): RunMetering | null {
  if (!run.budgetJson && !run.usageJson) return null;
  const budget = readStoredBudget(run.budgetJson);

  let usage: RunMetering["usage"] = {
    reported: false,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
  };
  if (run.usageJson) {
    try {
      const parsed = JSON.parse(run.usageJson) as {
        reported?: unknown;
        promptTokens?: unknown;
        completionTokens?: unknown;
        totalTokens?: unknown;
      };
      const reported = parsed.reported === true;
      usage = {
        reported,
        promptTokens: reported ? num(parsed.promptTokens, 0) : null,
        completionTokens: reported ? num(parsed.completionTokens, 0) : null,
        totalTokens: reported ? num(parsed.totalTokens, 0) : null,
      };
    } catch {
      // Baris rusak = tidak dilaporkan, bukan nol.
    }
  }

  const seen = new Set<string>();
  for (const source of sources) {
    if (source.kind !== "page_read") continue;
    const key = `${source.finalUrl ?? source.requestedUrl}::${source.textHash ?? ""}`;
    seen.add(key);
  }

  return {
    usage,
    consumed: {
      promptTokens: budget.consumed.promptTokens,
      completionTokens: budget.consumed.completionTokens,
      totalTokens: budget.consumed.promptTokens + budget.consumed.completionTokens,
      searches: budget.consumed.searches,
      reads: budget.consumed.reads,
      toolCalls: budget.consumed.toolCalls,
    },
    sourcesRead: seen.size,
  };
}