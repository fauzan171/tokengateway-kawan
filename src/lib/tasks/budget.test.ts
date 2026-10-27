/**
 * Uji metering + anggaran durable (D6, WO-B5).
 *
 * Lima kasus wajib SDD-BACKEND §D6(6). Prinsipnya satu: angka yang tak
 * dilaporkan gateway tetap `reported:false`/null — tidak pernah diisi nol
 * beralasan, karena itu akan jadi klaim tagihan palsu.
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { readStoredBudget, settleUsage, toRunMetering } from "./budget";
import { getTaskSnapshot } from "./tasks";

let temp: TempDb;
let db: Db;
let userId: string;
let taskId: string;
let runId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  taskId = `task_${randomUUID()}`;
  await db.task.create({ data: { id: taskId, userId, title: "m" } });
  runId = `run_${randomUUID()}`;
  await db.taskRun.create({
    data: { id: runId, taskId, status: "running", deadlineAt: new Date(Date.now() + 60_000) },
  });
});

describe("metering run (D6)", () => {
  it("usage reported dari stream terbaca apa adanya", async () => {
    await db.taskRun.update({
      where: { id: runId },
      data: {
        usageJson: JSON.stringify({
          reported: true,
          promptTokens: 1_200,
          completionTokens: 300,
          totalTokens: 1_500,
          estimated: false,
        }),
        budgetJson: JSON.stringify({
          max: 24_000,
          consumed: { promptTokens: 1_200, completionTokens: 300, searches: 2, reads: 3, toolCalls: 5, unreportedCalls: 0 },
          estimatorVersion: 1,
        }),
      },
    });

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    const metering = toRunMetering(run, []);
    if (!metering) throw new Error("metering harus ada: budgetJson + usageJson terisi");

    expect(metering.usage).toEqual({
      reported: true,
      promptTokens: 1_200,
      completionTokens: 300,
      totalTokens: 1_500,
    });
    expect(metering.consumed.totalTokens).toBe(1_500);
    expect(metering.consumed.toolCalls).toBe(5);
  });

  it("tanpa usage → reported:false dan angka null, bukan nol", async () => {
    // Belum ada kolom D6 sama sekali → metering absen, bukan objek nol.
    const kosong = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(toRunMetering(kosong, [])).toBeNull();

    // usageJson ada tapi tanpa angka → reported:false dan null, bukan nol.
    await db.taskRun.update({ where: { id: runId }, data: { usageJson: "{rusak" } });
    const rusak = toRunMetering(await db.taskRun.findUniqueOrThrow({ where: { id: runId } }), []);
    expect(rusak?.usage.reported).toBe(false);
    expect(rusak?.usage.totalTokens).toBeNull();
    expect(rusak?.consumed.totalTokens).toBe(0);
  });

  it("settleUsage CAS: dua settle bersamaan tidak menghilangkan delta", async () => {
    await db.taskRun.update({
      where: { id: runId },
      data: {
        budgetJson: JSON.stringify({
          max: 24_000,
          consumed: { promptTokens: 0, completionTokens: 0, searches: 0, reads: 0, toolCalls: 0, unreportedCalls: 0 },
          estimatorVersion: 1,
        }),
      },
    });

    await Promise.all([
      settleUsage(db, undefined, runId, { promptTokens: 100, toolCalls: 1 }),
      settleUsage(db, undefined, runId, { promptTokens: 200, toolCalls: 1 }),
      settleUsage(db, undefined, runId, { completionTokens: 50, searches: 2 }),
    ]);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    const stored = readStoredBudget(run.budgetJson);
    expect(stored.consumed.promptTokens).toBe(300);
    expect(stored.consumed.completionTokens).toBe(50);
    expect(stored.consumed.toolCalls).toBe(2);
    expect(stored.consumed.searches).toBe(2);

    // Tiap settle durable juga memancarkan budget.updated (D6(3)).
    const events = await db.taskEvent.findMany({ where: { runId, kind: "budget.updated" } });
    expect(events).toHaveLength(3);
    const last = JSON.parse(events[events.length - 1].payloadJson).data as {
      consumed: { totalTokens: number };
      remaining: number;
    };
    expect(last.consumed.totalTokens).toBe(350);
    expect(last.remaining).toBe(24_000 - 350);
  });

  it("sourcesRead dihitung dari TaskSource page_read unik", async () => {
    await db.taskRun.update({
      where: { id: runId },
      data: { usageJson: JSON.stringify({ reported: false }) },
    });
    const base = {
      runId,
      accessedAt: new Date(),
    };
    await db.taskSource.createMany({
      data: [
        { id: `src_${randomUUID()}`, ...base, kind: "search_result", requestedUrl: "https://a.test/1" },
        {
          id: `src_${randomUUID()}`,
          ...base,
          kind: "page_read",
          requestedUrl: "https://a.test/1",
          finalUrl: "https://a.test/1",
          textHash: "h1",
        },
        // Duplikat persis (URL + hash sama) → tetap satu.
        {
          id: `src_${randomUUID()}`,
          ...base,
          kind: "page_read",
          requestedUrl: "https://a.test/1",
          finalUrl: "https://a.test/1",
          textHash: "h1",
        },
        // Redirect ke URL sama tapi isi beda (hash beda) → halaman lain.
        {
          id: `src_${randomUUID()}`,
          ...base,
          kind: "page_read",
          requestedUrl: "https://b.test/x",
          finalUrl: "https://a.test/1",
          textHash: "h2",
        },
      ],
    });

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    const sources = await db.taskSource.findMany({
      where: { runId },
      select: { kind: true, finalUrl: true, requestedUrl: true, textHash: true },
    });
    expect(toRunMetering(run, sources)?.sourcesRead ?? -1).toBe(2);
  });

  it("snapshot API mengekspos metering; run lama (kolom null) tetap valid", async () => {
    await db.task.update({ where: { id: taskId }, data: { activeRunId: runId } });

    // Run pra-D6: metering absen (bukan nol) — UI tak merender blok apa pun.
    const lama = await getTaskSnapshot(db, userId, taskId);
    expect(lama.run?.metering ?? null).toBeNull();
    // Field run-level tetap terbaca (stopReason bukan bagian metering, S2-2).
    expect(lama.run?.stopReason).toBeNull();
    expect(lama.run?.researchCycle).toBe(0);

    await db.taskRun.update({
      where: { id: runId },
      data: {
        usageJson: JSON.stringify({ reported: true, promptTokens: 10, completionTokens: 5, totalTokens: 15 }),
        budgetJson: JSON.stringify({
          max: 24_000,
          consumed: { promptTokens: 10, completionTokens: 5, searches: 1, reads: 1, toolCalls: 2, unreportedCalls: 0 },
          estimatorVersion: 1,
        }),
      },
    });
    const snapshot = await getTaskSnapshot(db, userId, taskId);
    expect(snapshot.run?.metering).toEqual({
      usage: { reported: true, promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      consumed: { promptTokens: 10, completionTokens: 5, totalTokens: 15, searches: 1, reads: 1, toolCalls: 2 },
      sourcesRead: 0,
    });

    // Tanpa run aktif → run null (tak ada metering palsu).
    await db.task.update({ where: { id: taskId }, data: { activeRunId: null } });
    expect((await getTaskSnapshot(db, userId, taskId)).run).toBeNull();
  });

  it("budgetJson rusak tidak membuang batas default (max tetap)", async () => {
    // Tanpa ini `max` jatuh ke 0 pada baris rusak → resume langsung
    // `budget_limit` tanpa satu pun panggilan model, dan settle menulis
    // max:0 permanen.
    await db.taskRun.update({ where: { id: runId }, data: { budgetJson: "{rusak" } });
    const rusak = readStoredBudget(
      (await db.taskRun.findUniqueOrThrow({ where: { id: runId } })).budgetJson,
      24_000,
    );
    expect(rusak.max).toBe(24_000);
    expect(rusak.consumed.promptTokens).toBe(0);
  });
});
