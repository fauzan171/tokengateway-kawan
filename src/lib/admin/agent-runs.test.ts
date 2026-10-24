/**
 * Uji K8: audit run per agent — dari TaskRun + hitungan TaskEvent, tanpa
 * tabel audit baru, tanpa isi prompt.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { listAgentRuns, listAgentSummaries } from "./agent-runs";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

async function seedRun(
  agentId: string,
  status: string,
  events = 0,
  taskTitle = "t",
): Promise<string> {
  const taskId = `task_${randomUUID()}`;
  await db.task.create({ data: { id: taskId, userId, title: taskTitle } });
  const runId = `run_${randomUUID()}`;
  await db.taskRun.create({
    data: {
      id: runId,
      taskId,
      status,
      agentId,
      deadlineAt: new Date(Date.now() + 60_000),
    },
  });
  for (let i = 0; i < events; i++) {
    await db.taskEvent.create({
      // Payload sengaja memuat teks "PROMPT RAHASIA" — harus TIDAK PERNAH
      // muncul di hasil audit.
      data: {
        id: `ev_${randomUUID()}`,
        runId,
        seq: i,
        kind: "message.delta",
        payloadJson: JSON.stringify({ text: "PROMPT RAHASIA" }),
      },
    });
  }
  return runId;
}

describe("listAgentRuns", () => {
  it("mengelompokkan per agent: hanya run agent itu, dengan eventCount", async () => {
    const runA = await seedRun("peneliti", "completed", 3);
    await seedRun("default", "failed", 1);
    const result = await listAgentRuns(db, { agentId: "peneliti" });
    expect(result.agentId).toBe("peneliti");
    expect(result.totalRuns).toBe(1);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].runId).toBe(runA);
    expect(result.runs[0].eventCount).toBe(3);
    expect(result.runs[0].status).toBe("completed");
  });

  it("agentId kosong jatuh ke default; judul task ikut; payload TIDAK keluar", async () => {
    await seedRun("default", "completed", 2, "Judul Task");
    const result = await listAgentRuns(db, { agentId: "" });
    expect(result.agentId).toBe("default");
    expect(result.runs[0].taskTitle).toBe("Judul Task");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("PROMPT RAHASIA");
    expect(serialized).not.toContain("payloadJson");
  });

  it("limit dibatasi 100 dan urutan terbaru dulu", async () => {
    for (let i = 0; i < 3; i++) await seedRun("peneliti", "completed");
    const first = await listAgentRuns(db, { agentId: "peneliti", limit: 2 });
    expect(first.runs).toHaveLength(2);
    expect(first.totalRuns).toBe(3);
    expect(first.runs[0].createdAt >= first.runs[1].createdAt).toBe(true);
    const huge = await listAgentRuns(db, { agentId: "peneliti", limit: 1_000 });
    expect(huge.runs.length).toBeLessThanOrEqual(100);
  });
});

describe("listAgentSummaries", () => {
  it("total run per (agent, versi) diurutkan terbesar; lastRunAt terisi", async () => {
    await seedRun("peneliti", "completed");
    await seedRun("peneliti", "failed");
    await seedRun("default", "completed");
    const summaries = await listAgentSummaries(db);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].agentId).toBe("peneliti");
    expect(summaries[0].totalRuns).toBe(2);
    expect(summaries[0].lastRunAt).toBeTruthy();
    expect(summaries[1].agentId).toBe("default");
    expect(summaries[1].totalRuns).toBe(1);
  });

  it("belum ada run → daftar kosong", async () => {
    expect(await listAgentSummaries(db)).toEqual([]);
  });
});

