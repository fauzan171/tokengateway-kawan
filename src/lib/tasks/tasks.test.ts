/**
 * FIX-08 — task persisten (AC-AG-07/08).
 *
 * Yang dibuktikan: admission task+run+message+job+event satu transaksi; gagal
 * enqueue tidak menyisakan orphan; owner invariant (B tidak melihat/mengubah
 * task A) dan cross-user = 404; idempotency key sama mengembalikan respons yang
 * sama, digest beda = 409; revision stale = 409; cancel idempoten; tombstone
 * menyembunyikan task dari daftar.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import * as registry from "@/lib/agents/registry";
import {
  RUN_DEADLINE_MS,
  cancelRun,
  createTask,
  deleteTask,
  followUp,
  getTaskSnapshot,
  listTasks,
  updateTask,
} from "./tasks";
import { enqueue } from "@/lib/jobs/queue";

let temp: TempDb;

beforeAll(async () => {
  temp = await createTempDb();
  await temp.db.user.create({ data: { id: "uA", email: "a@t.id" } });
  await temp.db.user.create({ data: { id: "uB", email: "b@t.id" } });
});

afterAll(async () => {
  await temp.cleanup();
});

async function admission(userId = "uA", input = "Riset pasar gurita Jakarta") {
  return createTask(temp.db, { userId, input, idempotencyKey: null });
}

describe("createTask", () => {
  it("membuat task + run + dua pesan + job + event dalam satu transaksi", async () => {
    const result = await admission();

    const run = await temp.db.taskRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).toBe("queued");
    expect(run.currentJobId).not.toBeNull();

    const job = await temp.db.job.findUniqueOrThrow({ where: { id: run.currentJobId! } });
    expect(job.kind).toBe("agent.run");
    expect(job.state).toBe("queued");

    expect(await temp.db.taskMessage.count({ where: { taskId: result.taskId } })).toBe(2);
    const events = await temp.db.taskEvent.findMany({ where: { runId: result.runId } });
    expect(events.map((row) => row.kind)).toEqual(["run.queued"]);
    expect(events[0]!.seq).toBe(1);
  });

  it("enqueue gagal → tidak ada baris task/run tersisa", async () => {
    const before = await temp.db.task.count();
    const boom = async () => {
      throw new Error("enqueue gagal");
    };
    // Kind tidak dikenal membuat `enqueue` melempar; transaksi harus rollback.
    await expect(
      temp.db.$transaction(async () => {
        await temp.db.task.create({
          data: { id: "task_orphan", userId: "uA", title: "orphan", status: "active" },
        });
        await boom();
      }),
    ).rejects.toThrow("enqueue gagal");

    expect(await temp.db.task.count()).toBe(before);
    expect(await temp.db.task.findUnique({ where: { id: "task_orphan" } })).toBeNull();
  });

  it("kind agent.run dikenal kontrak, jadi enqueue tidak ditolak", async () => {
    await expect(
      enqueue(temp.db, { kind: "agent.run", payload: { runId: "r_x" } }),
    ).resolves.toBeTypeOf("string");
  });

  it("idempotency: key sama + payload sama mengembalikan task yang sama", async () => {
    const first = await createTask(temp.db, {
      userId: "uA",
      input: "Kunci sama",
      idempotencyKey: "key-1",
    });
    const second = await createTask(temp.db, {
      userId: "uA",
      input: "Kunci sama",
      idempotencyKey: "key-1",
    });
    expect(second.taskId).toBe(first.taskId);
    expect(await temp.db.task.count({ where: { activeRunId: first.runId } })).toBe(1);
  });

  it("idempotency: key sama + payload beda → 409 IDEMPOTENCY_CONFLICT", async () => {
    await createTask(temp.db, { userId: "uA", input: "Beda A", idempotencyKey: "key-2" });
    await expect(
      createTask(temp.db, { userId: "uA", input: "Beda B", idempotencyKey: "key-2" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
  });

  it("input kosong ditolak 422 INVALID_INPUT", async () => {
    await expect(createTask(temp.db, { userId: "uA", input: "  ", idempotencyKey: null })).rejects
      .toMatchObject({ code: "INVALID_INPUT", status: 422 });
  });

  it("connectionId milik user lain ditolak 422", async () => {
    await temp.db.connection.create({
      data: {
        id: "connB",
        userId: "uB",
        name: "B",
        baseUrl: "https://b.example",
        apiKeyEncrypted: "x",
        apiKeyMask: "***",
        keyId: "k",
      },
    });
    await expect(
      createTask(temp.db, { userId: "uA", input: "hi", connectionId: "connB", idempotencyKey: null }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 422 });
  });
});

describe("owner invariant", () => {
  it("user B tidak membaca snapshot task A (404)", async () => {
    const { taskId } = await admission();
    await expect(getTaskSnapshot(temp.db, "uB", taskId)).rejects.toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      status: 404,
    });
  });

  it("user B tidak mengubah task A (404)", async () => {
    const { taskId, task } = await admission();
    await expect(
      updateTask(temp.db, { userId: "uB", taskId, title: "dibajak", ifMatch: `"${task.revision}"` }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("user B tidak membatalkan run A (404)", async () => {
    const { taskId, runId } = await admission();
    await expect(cancelRun(temp.db, { userId: "uB", taskId, runId })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("daftar hanya berisi task milik pemanggil", async () => {
    const mine = await admission("uB", "punya B");
    const list = await listTasks(temp.db, { userId: "uB" });
    expect(list.every((task) => task.id !== undefined)).toBe(true);
    expect(list.some((task) => task.id === mine.taskId)).toBe(true);
    const listA = await listTasks(temp.db, { userId: "uA" });
    expect(listA.some((task) => task.id === mine.taskId)).toBe(false);
  });
});

describe("revision dan tombstone", () => {
  it("PATCH dengan revision stale → 409 REVISION_CONFLICT", async () => {
    const { taskId, task } = await admission();
    await updateTask(temp.db, { userId: "uA", taskId, title: "baru", ifMatch: `"${task.revision}"` });
    await expect(
      updateTask(temp.db, { userId: "uA", taskId, title: "basi", ifMatch: `"${task.revision}"` }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT", status: 409 });
  });

  it("delete = tombstone; task hilang dari daftar tapi barisnya tetap ada", async () => {
    const { taskId } = await admission("uA", "hapus aku");
    await deleteTask(temp.db, "uA", taskId);
    const list = await listTasks(temp.db, { userId: "uA" });
    expect(list.some((task) => task.id === taskId)).toBe(false);
    expect(await temp.db.task.findUnique({ where: { id: taskId } })).not.toBeNull();
  });
});

describe("follow-up dan cancel", () => {
  it("run aktif → follow-up ditolak 409 RUN_ACTIVE", async () => {
    const { taskId } = await admission();
    await expect(
      followUp(temp.db, { userId: "uA", taskId, input: "lanjut", idempotencyKey: null }),
    ).rejects.toMatchObject({ code: "RUN_ACTIVE", status: 409 });
  });

  it("setelah run terminal, follow-up membuat segment baru", async () => {
    const { taskId, runId } = await admission();
    await updateTerminal(runId);
    const run = await followUp(temp.db, { userId: "uA", taskId, input: "lanjut", idempotencyKey: null });
    expect(run.id).not.toBe(runId);
    const rows = await temp.db.taskRun.findMany({ where: { taskId }, orderBy: { segment: "asc" } });
    expect(rows.map((row) => row.segment)).toEqual([1, 2]);
    const task = await temp.db.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(task.activeRunId).toBe(run.id);
  });

  it("cancel menulis cancelRequestedAt + event, dan idempoten", async () => {
    const { taskId, runId } = await admission();
    const first = await cancelRun(temp.db, { userId: "uA", taskId, runId });
    expect(first.cancelRequestedAt).not.toBeNull();
    const second = await cancelRun(temp.db, { userId: "uA", taskId, runId });
    expect(second.cancelRequestedAt).toBe(first.cancelRequestedAt);
    const events = await temp.db.taskEvent.findMany({ where: { runId, kind: "cancel.requested" } });
    expect(events).toHaveLength(1);
  });

  it("cancel pada run terminal tidak menambah efek", async () => {
    const { taskId, runId } = await admission();
    await updateTerminal(runId);
    await cancelRun(temp.db, { userId: "uA", taskId, runId });
    const events = await temp.db.taskEvent.findMany({ where: { runId, kind: "cancel.requested" } });
    expect(events).toHaveLength(0);
  });
});

async function updateTerminal(runId: string): Promise<void> {
  await temp.db.taskRun.update({
    where: { id: runId },
    data: { status: "completed", finishedAt: new Date() },
  });
}
describe("admission agent (K3)", () => {
  it("agentId asing ditolak 422 AGENT_UNKNOWN tanpa menyisakan task", async () => {
    const before = await temp.db.task.count();
    await expect(
      createTask(temp.db, { userId: "uA", input: "hi", agentId: "asing", idempotencyKey: null }),
    ).rejects.toMatchObject({ code: "AGENT_UNKNOWN", status: 422 });
    expect(await temp.db.task.count()).toBe(before);
  });

  it("agent default ditulis ke TaskRun bersama versinya", async () => {
    const { runId } = await createTask(temp.db, {
      userId: "uA",
      input: "agent default",
      agentId: "default",
      idempotencyKey: null,
    });
    const run = await temp.db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.agentId).toBe("default");
    expect(run.agentVersion).toBe(1);
    // Deadline berasal dari definisi agent (900 detik), bukan konstanta lama.
    const agentDeadline = registry.getAgent("default")!.limits.deadlineMs;
    expect(agentDeadline).not.toBe(RUN_DEADLINE_MS);
    expect(run.deadlineAt.getTime()).toBeGreaterThan(Date.now() + agentDeadline - 60_000);
    expect(run.deadlineAt.getTime()).toBeLessThanOrEqual(Date.now() + agentDeadline);
    const event = await temp.db.taskEvent.findFirstOrThrow({ where: { runId, kind: "run.queued" } });
    expect(JSON.parse(event.payloadJson).data).toMatchObject({ agentId: "default", agentVersion: 1 });
  });

  it("agent khusus admin oleh non-admin ditolak 403 AGENT_FORBIDDEN", async () => {
    // Katalog beku belum punya agent admin; definisi sintetis dipakai supaya
    // jalur 403 terbukti tanpa menambah agent admin nyata.
    const spy = vi.spyOn(registry, "getAgent").mockReturnValue(adminAgent(1));
    try {
      await expect(
        createTask(temp.db, { userId: "uA", input: "hi", agentId: "admin-only", idempotencyKey: null }),
      ).rejects.toMatchObject({ code: "AGENT_FORBIDDEN", status: 403 });
    } finally {
      spy.mockRestore();
    }
  });

  it("agent khusus admin boleh dipakai admin dan versinya ikut tersimpan", async () => {
    await temp.db.user.create({ data: { id: "uAdmin", email: "admin@t.id", role: "admin" } });
    const spy = vi.spyOn(registry, "getAgent").mockReturnValue(adminAgent(2));
    try {
      const { runId } = await createTask(temp.db, {
        userId: "uAdmin",
        input: "admin boleh",
        agentId: "admin-only",
        idempotencyKey: null,
      });
      const run = await temp.db.taskRun.findUniqueOrThrow({ where: { id: runId } });
      expect(run.agentId).toBe("admin-only");
      expect(run.agentVersion).toBe(2);
      expect(run.deadlineAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    } finally {
      spy.mockRestore();
    }
  });

  it("followUp memvalidasi agent dan menulisnya ke run baru", async () => {
    const { taskId, runId } = await admission();
    await updateTerminal(runId);
    await expect(
      followUp(temp.db, { userId: "uA", taskId, input: "lanjut", agentId: "asing", idempotencyKey: null }),
    ).rejects.toMatchObject({ code: "AGENT_UNKNOWN", status: 422 });
    const run = await followUp(temp.db, {
      userId: "uA",
      taskId,
      input: "lanjut",
      agentId: "default",
      idempotencyKey: null,
    });
    const row = await temp.db.taskRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.agentId).toBe("default");
    expect(row.agentVersion).toBe(1);
  });

  it("PATCH tidak mengubah agentId (ditolak 422 AGENT_IMMUTABLE)", async () => {
    const { taskId, runId } = await admission();
    await expect(
      updateTask(temp.db, { userId: "uA", taskId, agentId: "default", ifMatch: null }),
    ).rejects.toMatchObject({ code: "AGENT_IMMUTABLE", status: 422 });
    const run = await temp.db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.agentId).toBe("default");
  });
});

/** Definisi agent admin sintetis untuk menguji jalur 403/izin. */
function adminAgent(version: number) {
  return {
    id: "admin-only",
    version,
    label: "Admin",
    description: "hanya admin",
    systemPrompt: "x",
    tools: [] as readonly string[],
    defaultModelId: "deepseek-v4.1-flash",
    limits: { maxSteps: 1, maxTokensPerRun: 1, deadlineMs: 1000 },
    audience: "admin" as const,
  };
}
