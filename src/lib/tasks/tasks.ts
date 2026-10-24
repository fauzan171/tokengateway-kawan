/**
 * Task persisten (FIX-08, SDD-AG-2/SDD-AG-3).
 *
 * Kepemilikan selalu lewat `Task.userId`; child row tidak pernah dipercaya
 * hanya karena punya id. Resource milik pengguna lain dan resource yang tidak
 * ada sama-sama 404 supaya keberadaan task orang lain tidak bocor.
 *
 * Admission (task + run + pesan + job + event) commit dalam satu transaksi:
 * job yang gagal diantrekan membatalkan seluruh baris, bukan menyisakan task
 * tanpa pekerjaan.
 */

import { randomUUID } from "node:crypto";
import { getAgent, type AgentDefinition } from "@/lib/agents/registry";
import { ApiError, STATUS } from "@/lib/api/errors";
import { idempotencyDigest } from "@/lib/chat/idempotency";
import type { Db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";

export const OPERATION_CREATE_TASK = "task.create";
export const OPERATION_FOLLOW_UP = "task.followup";

/** Kind job eksekusi agen; non-idempotent karena memanggil model berbayar. */
export const JOB_KIND_AGENT_RUN = "agent.run";

export const RUN_STATUSES = [
  "queued",
  "running",
  "waiting_input",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled",
  "indeterminate",
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

const TERMINAL: ReadonlySet<string> = new Set(["completed", "failed", "cancelled", "indeterminate"]);

export function isTerminalRun(status: string): boolean {
  return TERMINAL.has(status);
}

export type TaskDto = {
  id: string;
  title: string;
  status: "active" | "archived";
  activeRunId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type RunDto = {
  id: string;
  taskId: string;
  status: RunStatus;
  revision: number;
  modelId: string;
  /** K7: agent beku yang menjalankan run (default "default"). */
  agentId: string;
  agentVersion: number;
  stepCount: number;
  lastEventSeq: number;
  deadlineAt: string;
  cancelRequestedAt: string | null;
  errorCode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  activeRunId: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

type RunRow = {
  id: string;
  taskId: string;
  status: string;
  revision: number;
  modelId: string;
  agentId: string;
  agentVersion: number;
  stepCount: number;
  lastEventSeq: number;
  deadlineAt: Date;
  cancelRequestedAt: Date | null;
  errorCode: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toTaskDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    title: row.title,
    status: row.status === "archived" ? "archived" : "active",
    activeRunId: row.activeRunId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRunDto(row: RunRow): RunDto {
  return {
    id: row.id,
    taskId: row.taskId,
    status: row.status as RunStatus,
    revision: row.revision,
    modelId: row.modelId,
    agentId: row.agentId,
    agentVersion: row.agentVersion,
    stepCount: row.stepCount,
    lastEventSeq: row.lastEventSeq,
    deadlineAt: row.deadlineAt.toISOString(),
    cancelRequestedAt: iso(row.cancelRequestedAt),
    errorCode: row.errorCode,
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
  };
}

const TASK_FIELDS = {
  id: true,
  title: true,
  status: true,
  activeRunId: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const;

const RUN_FIELDS = {
  id: true,
  taskId: true,
  status: true,
  revision: true,
  modelId: true,
  // K7: label agent aktif di detail task — UI membaca ini, bukan menebak.
  agentId: true,
  agentVersion: true,
  stepCount: true,
  lastEventSeq: true,
  deadlineAt: true,
  cancelRequestedAt: true,
  errorCode: true,
  startedAt: true,
  finishedAt: true,
} as const;

export function notFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "RESOURCE_NOT_FOUND",
    message: "Task tidak ditemukan.",
  });
}

/** Batas input teks (SDD-AG-3): 100.000 karakter, kosong ditolak 422. */
const MAX_INPUT_CHARS = 100_000;

function normalizeInput(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_INPUT",
      message: "input wajib diisi.",
    });
  }
  const text = value.trim();
  if (text.length > MAX_INPUT_CHARS) {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_INPUT",
      message: `input melebihi ${MAX_INPUT_CHARS} karakter.`,
    });
  }
  return text;
}

/** Judul default dari potongan input pertama. */
function deriveTitle(input: string): string {
  const firstLine = input.split("\n", 1)[0]!.trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function normalizeTitle(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_INPUT", message: "title harus teks." });
  }
  const title = value.trim();
  if (title === "" || title.length > 200) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_INPUT",
      message: "title harus 1..200 karakter.",
    });
  }
  return title;
}

function normalizeIdList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_INPUT", message: "artifactIds harus array." });
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_INPUT",
        message: "artifactIds harus berisi teks.",
      });
    }
    return item.trim();
  });
}

function normalizeModelId(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_INPUT", message: "modelId harus teks." });
  }
  return value.trim();
}

function normalizeConnectionId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_INPUT",
      message: "connectionId harus teks.",
    });
  }
  return value.trim();
}

/**
 * Deadline bawaan satu run (30 menit) — nilai agent "default".
 *
 * Sumber kebenaran sekarang registry agent (`limits.deadlineMs`); konstanta ini
 * dipertahankan sebagai rujukan perilaku lama dan dipakai sebagai jaring
 * pengaman bila definisi agent tidak menyatakan deadline yang masuk akal.
 */
export const RUN_DEADLINE_MS = 30 * 60 * 1000;

export type CreateTaskInput = {
  userId: string;
  title?: unknown;
  input: unknown;
  connectionId?: unknown;
  modelId?: unknown;
  artifactIds?: unknown;
  /** Opsional; kosong = agent "default". */
  agentId?: unknown;
  idempotencyKey: string | null;
};

export type AdmissionResult = { task: TaskDto; run: RunDto; taskId: string; runId: string };

/** Peran pemanggil; agent ber-audience "admin" hanya boleh dipakai admin. */
async function isAdmin(tx: Pick<Db, "user">, userId: string): Promise<boolean> {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "admin";
}

/**
 * Validasi agent di dalam transaksi admission (K3).
 *
 * Id asing -> 422 AGENT_UNKNOWN; agent khusus admin oleh non-admin -> 403
 * AGENT_FORBIDDEN. Validasi dilakukan di dalam transaksi supaya admission yang
 * ditolak tidak menyisakan task tanpa run.
 */
async function resolveAgent(
  tx: Pick<Db, "user">,
  userId: string,
  value: unknown,
): Promise<AgentDefinition> {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_INPUT", message: "agentId harus teks." });
  }
  const agentId = typeof value === "string" && value.trim() !== "" ? value.trim() : "default";
  const definition = getAgent(agentId);
  if (!definition) {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "AGENT_UNKNOWN",
      message: "Agent tidak dikenal.",
      details: { agentId },
    });
  }
  if (definition.audience === "admin" && !(await isAdmin(tx, userId))) {
    throw new ApiError({
      status: STATUS.FORBIDDEN,
      code: "AGENT_FORBIDDEN",
      message: "Agent ini hanya untuk admin.",
      details: { agentId: definition.id },
    });
  }
  return definition;
}

/** Deadline dari definisi agent; nilai tidak masuk akal jatuh ke bawaan. */
function deadlineFrom(agent: AgentDefinition): Date {
  const ms = agent.limits.deadlineMs > 0 ? agent.limits.deadlineMs : RUN_DEADLINE_MS;
  return new Date(Date.now() + ms);
}

/**
 * Menambah event run dengan alokasi `lastEventSeq` di dalam transaksi yang
 * sama. Pemanggil wajib memegang transaksi; `max(seq)+1` di luar transaksi
 * adalah balapan yang menghasilkan dua event bernomor sama.
 */
export async function appendEvent(
  tx: Pick<Db, "taskRun" | "taskEvent">,
  runId: string,
  kind: string,
  data: unknown,
): Promise<number> {
  const run = await tx.taskRun.update({
    where: { id: runId },
    data: { lastEventSeq: { increment: 1 } },
    select: { lastEventSeq: true },
  });
  await tx.taskEvent.create({
    data: {
      id: randomUUID(),
      runId,
      seq: run.lastEventSeq,
      kind,
      payloadJson: JSON.stringify({ schemaVersion: 1, runId, seq: run.lastEventSeq, data }),
    },
  });
  return run.lastEventSeq;
}

export async function createTask(db: Db, input: CreateTaskInput): Promise<AdmissionResult> {
  const text = normalizeInput(input.input);
  const title = normalizeTitle(input.title, deriveTitle(text));
  const modelId = normalizeModelId(input.modelId);
  const connectionId = normalizeConnectionId(input.connectionId);
  const artifactIds = normalizeIdList(input.artifactIds);
  // Agent ikut digest: permintaan dengan agent berbeda bukan permintaan yang
  // sama, walau kunci idempotensinya sama.
  const agentRef =
    typeof input.agentId === "string" && input.agentId.trim() !== "" ? input.agentId.trim() : "default";

  const digest = idempotencyDigest({
    owner: input.userId,
    operation: OPERATION_CREATE_TASK,
    // Channel `chatId` dipakai pembeda namespace digest; operation sudah beda,
    // jadi task-level memakai penanda tetap "-".
    chatId: "-",
    payload: [title, text, connectionId, modelId, artifactIds, agentRef],
  });

  // short-cut: satu run aktif per pengguna ditegakkan lewat CAS Task.revision +
  // cek run nonterminal di dalam transaksi; SQLite menserialisasi tulis, jadi
  // cukup di dev/test. Upgrade ke lock baris User bila PG mulai menerima
  // admission bersamaan dengan volume nyata.
  return db.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.idempotencyKey.findUnique({
        where: { userId_key: { userId: input.userId, key: input.idempotencyKey } },
        select: { digest: true, responseJson: true },
      });
      if (existing) {
        if (existing.digest !== digest) {
          throw new ApiError({
            status: STATUS.CONFLICT,
            code: "IDEMPOTENCY_CONFLICT",
            message: "Kunci idempotensi ini sudah dipakai untuk permintaan yang berbeda.",
          });
        }
        const saved = JSON.parse(existing.responseJson) as AdmissionResult;
        return saved;
      }
    }

    // Agent divalidasi lebih dulu: penolakan agent tidak boleh menyentuh tabel
    // lain, dan idempotency key yang sudah tersimpan tidak divalidasi ulang.
    const agent = await resolveAgent(tx, input.userId, input.agentId);

    if (connectionId) {
      const owned = await tx.connection.findFirst({
        where: { id: connectionId, userId: input.userId },
        select: { id: true },
      });
      if (!owned) {
        throw new ApiError({
          status: STATUS.UNPROCESSABLE,
          code: "INVALID_INPUT",
          message: "connectionId bukan koneksi milik Anda.",
        });
      }
    }

    if (artifactIds.length > 0) {
      const ready = await tx.artifact.findMany({
        where: { userId: input.userId, id: { in: artifactIds }, status: "ready" },
        select: { id: true },
      });
      if (ready.length !== artifactIds.length) {
        throw new ApiError({
          status: STATUS.CONFLICT,
          code: "ARTIFACT_NOT_READY",
          message: "Ada artefak yang bukan milik Anda atau belum siap.",
        });
      }
    }

    const taskId = randomUUID();
    const runId = randomUUID();
    const inputMessageId = randomUUID();
    const assistantMessageId = randomUUID();

    await tx.task.create({
      data: {
        id: taskId,
        userId: input.userId,
        title,
        status: "active",
        activeRunId: runId,
        revision: 1,
      },
    });

    const jobId = await enqueue(tx as Db, {
      kind: JOB_KIND_AGENT_RUN,
      payload: { runId, segment: 1 },
    });

    // Run lebih dulu: `TaskMessage.runId` ber-FK ke run ini, jadi pesan tidak
    // bisa dibuat sebelum baris run ada.
    await tx.taskRun.create({
      data: {
        id: runId,
        taskId,
        segment: 1,
        status: "queued",
        revision: 1,
        connectionId,
        modelId,
        inputMessageId,
        assistantMessageId,
        currentJobId: jobId,
        // Agent dibekukan di baris run: definisi yang dipakai saat admission,
        // bukan definisi terbaru saat worker menjalankan.
        agentId: agent.id,
        agentVersion: agent.version,
        deadlineAt: deadlineFrom(agent),
      },
    });

    await tx.taskMessage.create({
      data: { id: inputMessageId, taskId, runId, role: "user", text },
    });
    await tx.taskMessage.create({
      data: { id: assistantMessageId, taskId, runId, role: "assistant", text: "" },
    });

    await appendEvent(tx, runId, "run.queued", { taskId, agentId: agent.id, agentVersion: agent.version });

    const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, select: TASK_FIELDS });
    const run = await tx.taskRun.findUniqueOrThrow({ where: { id: runId }, select: RUN_FIELDS });
    const result: AdmissionResult = {
      task: toTaskDto(task),
      run: toRunDto(run),
      taskId,
      runId,
    };

    if (input.idempotencyKey) {
      await tx.idempotencyKey.create({
        data: {
          id: randomUUID(),
          userId: input.userId,
          key: input.idempotencyKey,
          digest,
          responseJson: JSON.stringify(result),
        },
      });
    }
    return result;
  });
}

/** Task milik pengguna; `null` bila tidak ada atau sudah di-tombstone. */
export async function findOwnedTask(db: Db, userId: string, taskId: string) {
  return db.task.findFirst({
    where: { id: taskId, userId, deletedAt: null },
    select: TASK_FIELDS,
  });
}

export type ListTasksOptions = {
  userId: string;
  status?: "active" | "archived";
  q?: string | null;
  limit?: number;
};

export async function listTasks(db: Db, options: ListTasksOptions): Promise<TaskDto[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const term = options.q?.trim();
  const rows = await db.task.findMany({
    where: {
      userId: options.userId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(term ? { title: { contains: term } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: TASK_FIELDS,
  });
  return rows.map(toTaskDto);
}

export type TaskSnapshot = {
  task: TaskDto;
  run: RunDto | null;
  messages: Array<{ id: string; role: string; text: string; createdAt: string }>;
};

export async function getTaskSnapshot(db: Db, userId: string, taskId: string): Promise<TaskSnapshot> {
  const task = await findOwnedTask(db, userId, taskId);
  if (!task) throw notFound();

  const messages = await db.taskMessage.findMany({
    where: { taskId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, role: true, text: true, createdAt: true },
  });

  const run = task.activeRunId
    ? await db.taskRun.findFirst({ where: { id: task.activeRunId, taskId }, select: RUN_FIELDS })
    : null;

  return {
    task: toTaskDto(task),
    run: run ? toRunDto(run) : null,
    messages: messages.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/**
 * Patch task. agentId sengaja TIDAK ada di sini: agent dibekukan per run saat
 * admission, jadi mengganti agent sebuah task akan membuat riwayat run-nya
 * berbohong. Body yang memuat agentId ditolak 422 AGENT_IMMUTABLE, bukan
 * diabaikan diam-diam — pemanggil harus tahu perubahan itu tidak berlaku.
 */
export type UpdateTaskInput = {
  userId: string;
  taskId: string;
  title?: unknown;
  status?: unknown;
  /** Hanya untuk ditolak; lihat komentar di atas. */
  agentId?: unknown;
  /** Nilai header `If-Match`; `null` bila tidak dikirim. */
  ifMatch: string | null;
};

function parseIfMatch(ifMatch: string | null): number | null {
  if (ifMatch === null) return null;
  const parsed = Number.parseInt(ifMatch.replaceAll('"', "").trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function updateTask(db: Db, input: UpdateTaskInput): Promise<TaskDto> {
  const task = await findOwnedTask(db, input.userId, input.taskId);
  if (!task) throw notFound();

  const expected = parseIfMatch(input.ifMatch);
  if (input.ifMatch !== null && expected === null) {
    throw new ApiError({ status: STATUS.CONFLICT, code: "REVISION_CONFLICT", message: "If-Match tidak valid." });
  }
  if (expected !== null && expected !== task.revision) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "REVISION_CONFLICT",
      message: "Task sudah berubah; muat ulang snapshot.",
      details: { revision: task.revision },
    });
  }

  if (input.agentId !== undefined) {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "AGENT_IMMUTABLE",
      message: "agentId tidak dapat diubah; buat run baru lewat follow-up.",
    });
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data["title"] = normalizeTitle(input.title, task.title);
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "archived") {
      throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_INPUT", message: "status harus active/archived." });
    }
    data["status"] = input.status;
  }
  data["revision"] = { increment: 1 };

  const updated = await db.task.update({ where: { id: task.id }, data, select: TASK_FIELDS });
  return toTaskDto(updated);
}

/** Tombstone: daftar/detail menyembunyikannya, cleanup menyusul. */
export async function deleteTask(db: Db, userId: string, taskId: string): Promise<TaskDto> {
  const task = await findOwnedTask(db, userId, taskId);
  if (!task) throw notFound();
  const updated = await db.task.update({
    where: { id: task.id },
    data: { deletedAt: new Date(), status: "archived", revision: { increment: 1 } },
    select: TASK_FIELDS,
  });
  return toTaskDto(updated);
}

/** Follow-up setelah run terminal membuat run baru; run aktif ditolak 409. */
export async function followUp(db: Db, input: CreateTaskInput & { taskId: string }): Promise<RunDto> {
  const text = normalizeInput(input.input);
  const modelId = normalizeModelId(input.modelId);
  const connectionId = normalizeConnectionId(input.connectionId);
  const artifactIds = normalizeIdList(input.artifactIds);

  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, userId: input.userId, deletedAt: null },
      select: { id: true, activeRunId: true, revision: true, title: true },
    });
    if (!task) throw notFound();

    if (task.activeRunId) {
      const active = await tx.taskRun.findUnique({
        where: { id: task.activeRunId },
        select: { status: true },
      });
      if (active && !isTerminalRun(active.status)) {
        throw new ApiError({
          status: STATUS.CONFLICT,
          code: "RUN_ACTIVE",
          message: "Masih ada run aktif; tunggu selesai atau batalkan dulu.",
        });
      }
    }

    // Agent follow-up boleh berbeda dari segment sebelumnya; validasinya sama
    // dan tetap di dalam transaksi (K3).
    const agent = await resolveAgent(tx, input.userId, input.agentId);

    // CAS: hanya satu admission yang boleh menaikkan revision task ini.
    const locked = await tx.task.updateMany({
      where: { id: task.id, revision: task.revision },
      data: { revision: { increment: 1 } },
    });
    if (locked.count === 0) {
      throw new ApiError({
        status: STATUS.CONFLICT,
        code: "REVISION_CONFLICT",
        message: "Task sedang berubah; coba lagi.",
      });
    }

    if (artifactIds.length > 0) {
      const ready = await tx.artifact.findMany({
        where: { userId: input.userId, id: { in: artifactIds }, status: "ready" },
        select: { id: true },
      });
      if (ready.length !== artifactIds.length) {
        throw new ApiError({
          status: STATUS.CONFLICT,
          code: "ARTIFACT_NOT_READY",
          message: "Ada artefak yang bukan milik Anda atau belum siap.",
        });
      }
    }

    const previous = await tx.taskRun.findFirst({
      where: { taskId: task.id },
      orderBy: { segment: "desc" },
      select: { segment: true },
    });
    const segment = (previous?.segment ?? 0) + 1;

    const runId = randomUUID();
    const inputMessageId = randomUUID();
    const assistantMessageId = randomUUID();

    const jobId = await enqueue(tx as Db, {
      kind: JOB_KIND_AGENT_RUN,
      payload: { runId, segment },
    });

    // Run dulu: pesan ber-FK ke run (urutan yang sama seperti createTask).
    await tx.taskRun.create({
      data: {
        id: runId,
        taskId: task.id,
        segment,
        status: "queued",
        revision: 1,
        connectionId,
        modelId,
        inputMessageId,
        assistantMessageId,
        currentJobId: jobId,
        agentId: agent.id,
        agentVersion: agent.version,
        deadlineAt: deadlineFrom(agent),
      },
    });

    await tx.taskMessage.create({
      data: { id: inputMessageId, taskId: task.id, runId, role: "user", text },
    });
    await tx.taskMessage.create({
      data: { id: assistantMessageId, taskId: task.id, runId, role: "assistant", text: "" },
    });

    await tx.task.update({ where: { id: task.id }, data: { activeRunId: runId } });
    await appendEvent(tx, runId, "run.queued", { taskId: task.id, agentId: agent.id, agentVersion: agent.version });

    const run = await tx.taskRun.findUniqueOrThrow({ where: { id: runId }, select: RUN_FIELDS });
    return toRunDto(run);
  });
}

/**
 * Menandai niat cancel segera; hasil terminal ditulis worker setelah
 * tool/model benar-benar berhenti. Cancel berulang tidak menambah efek baru.
 */
export async function cancelRun(
  db: Db,
  input: { userId: string; taskId: string; runId: string },
): Promise<RunDto> {
  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, userId: input.userId, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw notFound();

    const run = await tx.taskRun.findFirst({
      where: { id: input.runId, taskId: task.id },
      select: RUN_FIELDS,
    });
    if (!run) throw notFound();

    if (isTerminalRun(run.status)) return toRunDto(run);

    const already = run.cancelRequestedAt !== null;
    const updated = await tx.taskRun.update({
      where: { id: run.id },
      data: {
        cancelRequestedAt: run.cancelRequestedAt ?? new Date(),
        status: "running",
        revision: { increment: 1 },
      },
      select: RUN_FIELDS,
    });

    if (already) return toRunDto(updated);

    await appendEvent(tx, run.id, "cancel.requested", {});
    return toRunDto(updated);
  });
}