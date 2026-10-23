/**
 * FIX-22: review model kedua terbatas — budget turunan, subset tool, agregasi jujur.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  MULTI_MODEL_LIMITS,
  aggregateFindings,
  childWithinBudget,
  listActiveChildren,
  planReview,
} from "./multi-model";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

const parent = { model: "deepseek-v4.1-flash", connectionId: "conn_1" };
const budget = { maxSteps: 40, maxTokens: 50_000, deadlineAt: new Date(Date.now() + 15 * 60_000) };

describe("planReview", () => {
  const base = {
    parentRunId: "run_1",
    parent,
    reviewer: { model: "model-lain", connectionId: "conn_1" },
    parentBudget: budget,
    parentTools: ["web.search", "web.read"],
  };

  it("budget child diturunkan dari parent, tidak pernah lebih besar", () => {
    const plan = planReview(base);
    for (const child of plan.children) {
      expect(child.maxSteps).toBeLessThanOrEqual(budget.maxSteps * MULTI_MODEL_LIMITS.childBudgetRatio);
      expect(child.maxTokens).toBeLessThanOrEqual(budget.maxTokens * MULTI_MODEL_LIMITS.childBudgetRatio);
      expect(child.deadlineAt.getTime()).toBeLessThan(budget.deadlineAt.getTime());
      expect(child.depth).toBe(MULTI_MODEL_LIMITS.maxDepth);
    }
    expect(plan.children.length).toBe(MULTI_MODEL_LIMITS.maxChildren);
  });

  it("model peninjau sama dengan parent ditolak", () => {
    expect(() => planReview({ ...base, reviewer: { ...parent } })).toThrow();
  });

  it("child tidak pernah mendapat tool di luar daftar parent", () => {
    const plan = planReview({
      ...base,
      requestedTools: ["web.search", "shell.exec", "filesystem.write"],
    });
    for (const child of plan.children) {
      expect(child.tools).toEqual(["web.search"]);
    }
    expect(plan.notes.join(" ")).toContain("shell.exec");
    expect(plan.notes.join(" ")).toContain("filesystem.write");
  });

  it("beda koneksi dicatat sebagai peringatan biaya/privasi", () => {
    const plan = planReview({ ...base, reviewer: { model: "model-lain", connectionId: "conn_2" } });
    expect(plan.notes.join(" ")).toMatch(/biaya|privasi/);
  });

  it("kedalaman maksimum 1 dan jumlah child dibatasi", () => {
    expect(MULTI_MODEL_LIMITS.maxDepth).toBe(1);
    expect(MULTI_MODEL_LIMITS.maxChildren).toBeLessThanOrEqual(3);
  });
});

describe("childWithinBudget", () => {
  const parentBudget = { maxSteps: 40, maxTokens: 50_000 };

  it("dalam batas → ok", () => {
    expect(childWithinBudget({ parentBudget, childUsage: { steps: 10, tokens: 10_000 } })).toEqual({ ok: true });
  });

  it("melebihi langkah atau token ditolak dengan alasan", () => {
    expect(childWithinBudget({ parentBudget, childUsage: { steps: 21, tokens: 1 } })).toEqual({
      ok: false,
      reason: "STEPS",
    });
    expect(childWithinBudget({ parentBudget, childUsage: { steps: 1, tokens: 25_001 } })).toEqual({
      ok: false,
      reason: "TOKENS",
    });
  });
});

describe("aggregateFindings", () => {
  it("isu yang muncul di dua sumber masuk 'agreed', satu sumber masuk 'disputed'", () => {
    const result = aggregateFindings([
      { source: "utama", text: "Klaim tanggal tidak didukung sumber" },
      { source: "peninjau", text: "Klaim tanggal tidak didukung sumber" },
      { source: "peninjau", text: "Rumus pembagian memakai n bukan n-1" },
    ]);
    expect(result.agreed).toHaveLength(1);
    expect(result.agreed[0]?.sources).toEqual(["peninjau", "utama"]);
    expect(result.disputed).toHaveLength(1);
  });

  it("selalu menyertakan disclaimer bahwa sepakat bukan bukti kebenaran", () => {
    const result = aggregateFindings([]);
    expect(result.disclaimer).toContain("bukan bukti kebenaran");
    expect(result.disclaimer).toContain("Perbedaan pendapat ditampilkan");
  });

  it("temuan kosong tidak membuat grup palsu", () => {
    expect(aggregateFindings([{ source: "a", text: "  " }]).agreed).toEqual([]);
  });
});

describe("listActiveChildren", () => {
  it("hanya child nonterminal milik parent yang dikembalikan", async () => {
    const taskId = `task_${randomUUID()}`;
    await db.task.create({ data: { id: taskId, userId, title: "T", status: "active" } });
    const parentRunId = `run_${randomUUID()}`;
    await db.taskRun.create({
      data: { id: parentRunId, taskId, status: "running", deadlineAt: new Date(Date.now() + 60_000) },
    });
    await db.taskRun.create({
      data: {
        id: `run_${randomUUID()}`,
        taskId,
        status: "running",
        parentRunId,
        depth: 1,
        deadlineAt: new Date(Date.now() + 60_000),
      },
    });
    await db.taskRun.create({
      data: {
        id: `run_${randomUUID()}`,
        taskId,
        status: "completed",
        parentRunId,
        depth: 1,
        deadlineAt: new Date(Date.now() + 60_000),
      },
    });

    expect(await listActiveChildren(db, parentRunId)).toHaveLength(1);
  });
});
