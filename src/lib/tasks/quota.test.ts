/**
 * Uji K6: kuota per pengguna = batas pemakaian (bukan tagihan).
 *
 * Token dari UsageRecord reported=1 saja; usage tak dilaporkan diabaikan
 * ("tidak tersedia", bukan nol bohongan); run nonterminal dihitung lewat
 * relasi task.userId; 429 menyertakan Retry-After.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { checkTaskQuota, TASK_QUOTA } from "./quota";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

async function seedTask(): Promise<string> {
  const taskId = `task_${randomUUID()}`;
  await db.task.create({ data: { id: taskId, userId, title: "t" } });
  return taskId;
}

async function seedRun(taskId: string, status: string): Promise<void> {
  await db.taskRun.create({
    data: {
      id: `run_${randomUUID()}`,
      taskId,
      status,
      deadlineAt: new Date(Date.now() + 60_000),
    },
  });
}

function seedUsage(totalTokens: number, reported: number): Promise<unknown> {
  return db.usageRecord.create({
    data: {
      id: `usage_${randomUUID()}`,
      userId,
      model: "m",
      totalTokens,
      reported,
    },
  });
}

describe("checkTaskQuota", () => {
  it("pengguna baru tanpa pemakaian lolos", async () => {
    const decision = await checkTaskQuota(db, userId);
    expect(decision.ok).toBe(true);
  });

  it("usage reported=0 diabaikan — 'tidak tersedia', bukan nol bohongan", async () => {
    await seedUsage(999_999_999, 0);
    const decision = await checkTaskQuota(db, userId);
    // Usage tak dilaporkan tidak membuat kuota penuh maupun bebas.
    expect(decision.ok).toBe(true);
  });

  it("token >= batas 24 jam -> QUOTA_TOKENS + retryAfter", async () => {
    await seedUsage(TASK_QUOTA.tokenMax, 1);
    const decision = await checkTaskQuota(db, userId);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe("QUOTA_TOKENS");
      expect(decision.retryAfterSeconds).toBe(TASK_QUOTA.retryAfterSeconds);
      expect(decision.message).toContain("bukan tagihan");
    }
  });

  it("run nonterminal >= 2 -> QUOTA_ACTIVE_RUNS; terminal tidak dihitung", async () => {
    const taskId = await seedTask();
    await seedRun(taskId, "completed");
    expect((await checkTaskQuota(db, userId)).ok).toBe(true);
    await seedRun(taskId, "queued");
    await seedRun(taskId, "running");
    const decision = await checkTaskQuota(db, userId);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("QUOTA_ACTIVE_RUNS");
  });

  it("task >= 50 per 24 jam -> QUOTA_TASKS; run milik user lain tidak dihitung", async () => {
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });
    for (let i = 0; i < TASK_QUOTA.taskMax; i++) {
      const taskId = `task_${randomUUID()}`;
      await db.task.create({ data: { id: taskId, userId, title: "t" } });
    }
    // User lain tidak terpengaruh.
    expect((await checkTaskQuota(db, other)).ok).toBe(true);
    const decision = await checkTaskQuota(db, userId);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.code).toBe("QUOTA_TASKS");
  });

  it("task lama (di luar jendela 24 jam) tidak dihitung", async () => {
    const taskId = `task_${randomUUID()}`;
    await db.task.create({
      data: { id: taskId, userId, title: "t", createdAt: new Date(Date.now() - TASK_QUOTA.taskWindowMs - 1_000) },
    });
    expect((await checkTaskQuota(db, userId)).ok).toBe(true);
  });
});
