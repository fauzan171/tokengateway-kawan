/**
 * Audit run per agent (K8): daftar run dikelompokkan per agent dari
 * `TaskRun` + hitungan `TaskEvent` — TANPA tabel audit baru (rencana §K8).
 *
 * Isi prompt tidak pernah keluar: payload TaskEvent dibaca HANYA untuk
 * menghitung jumlah event per run, tidak dikembalikan. logger route tetap
 * requestId/route/latency/result tanpa isi prompt.
 */

import type { Db } from "@/lib/db";

export type AgentRunRow = {
  runId: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentVersion: number;
  status: string;
  stepCount: number;
  eventCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  createdAt: string;
};

export type AgentRunsResult = {
  agentId: string;
  /** Total run agent ini (tanpa filter status), untuk konteks halaman. */
  totalRuns: number;
  runs: AgentRunRow[];
};

/** Batas halaman: audit dibaca manusia, bukan diekspor massal. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Daftar run untuk satu agent, terbaru dulu. agentId kosong = "default".
 * Event dihitung per run lewat groupBy — payload tidak pernah dibaca.
 */
export async function listAgentRuns(
  db: Db,
  input: { agentId: string; limit?: number; cursor?: string },
): Promise<AgentRunsResult> {
  const agentId = input.agentId.trim() === "" ? "default" : input.agentId.trim();
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const [totalRuns, rows] = await Promise.all([
    db.taskRun.count({ where: { agentId } }),
    db.taskRun.findMany({
      where: { agentId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        taskId: true,
        agentId: true,
        agentVersion: true,
        status: true,
        stepCount: true,
        errorCode: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        task: { select: { title: true } },
      },
    }),
  ]);

  const page = rows.slice(0, limit);
  // Hitungan event per run: satu groupBy untuk semua run halaman ini.
  const eventCounts = await db.taskEvent.groupBy({
    by: ["runId"],
    where: { runId: { in: page.map((row) => row.id) } },
    _count: { id: true },
  });
  const countByRun = new Map(eventCounts.map((row) => [row.runId, row._count.id]));

  return {
    agentId,
    totalRuns,
    runs: page.map((row) => ({
      runId: row.id,
      taskId: row.taskId,
      taskTitle: row.task.title,
      agentId: row.agentId,
      agentVersion: row.agentVersion,
      status: row.status,
      stepCount: row.stepCount,
      eventCount: countByRun.get(row.id) ?? 0,
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      errorCode: row.errorCode,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/** Ringkasan per agent untuk halaman indeks: total run + run terakhir. */
export async function listAgentSummaries(
  db: Db,
): Promise<{ agentId: string; agentVersion: number; totalRuns: number; lastRunAt: string | null }[]> {
  const grouped = await db.taskRun.groupBy({
    by: ["agentId", "agentVersion"],
    _count: { id: true },
    _max: { createdAt: true },
  });
  return grouped
    .map((row) => ({
      agentId: row.agentId,
      agentVersion: row.agentVersion,
      totalRuns: row._count.id,
      lastRunAt: row._max.createdAt ? row._max.createdAt.toISOString() : null,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns);
}
