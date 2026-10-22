/**
 * Eksekutor satu run task (FIX-08, SDD-AG-3).
 *
 * Versi ini menjalankan SATU putaran model: stream jawaban, tulis teks durable
 * ke `TaskMessage`, lalu tutup run. Tool loop/approval/handover/artifact
 * menyusul di FIX-09+; kontraknya sudah disiapkan (event, status, interaction).
 *
 * Lease Job memagari semua tulisan: lease hilang → berhenti tanpa menulis apa
 * pun, supaya worker lain yang mengambil alih tidak mendapat balapan.
 */

import { logger } from "@/lib/api/logger";
import { getActiveConnection } from "@/lib/connections/connections";
import { getCachedModels, resolveModel } from "@/lib/connections/model-cache";
import type { Db } from "@/lib/db";
import { assertHeld, LeaseLost, type FenceChecker } from "@/lib/jobs/fence";
import { assertOutboundAllowed, fetchOutbound, OUTBOUND_LIMITS } from "@/lib/net";
import {
  DEFAULT_MODEL,
  DEFAULT_TIMEZONE,
  buildRuntimeContext,
  openApiKey,
  type GenerateConfig,
} from "@/lib/chat/generate";
import { createStreamParser, type StreamUsage } from "@/lib/chat/stream-parse";
import { appendEvent, isTerminalRun } from "./tasks";

const CHAT_COMPLETIONS_PATH = "/chat/completions";

const SYSTEM_PROMPT = [
  "Kamu adalah agen otonom Kawan. Kerjakan tujuan pengguna langkah demi langkah.",
  "Jawab dengan hasil nyata; bila ada yang belum bisa dikerjakan, katakan apa adanya.",
].join(" ");

/** Perkiraan token cadangan untuk jawaban; tidak diklaim sebagai usage nyata. */
const OUTPUT_RESERVE_TOKENS = 1024;

/** Batas waktu idle antar potongan; bukan durasi total run. */
const IDLE_MS = OUTBOUND_LIMITS.streamIdleTimeoutMs;

type RunRow = {
  id: string;
  taskId: string;
  status: string;
  revision: number;
  segment: number;
  connectionId: string | null;
  modelId: string;
  assistantMessageId: string | null;
  deadlineAt: Date;
  cancelRequestedAt: Date | null;
};

/** Melempar `LeaseLost` bila lease sudah hilang. */
async function held(fence: FenceChecker | undefined): Promise<void> {
  if (fence) await assertHeld(fence);
}

async function cancelRequested(db: Db, runId: string): Promise<boolean> {
  const row = await db.taskRun.findFirst({
    where: { id: runId },
    select: { cancelRequestedAt: true },
  });
  return row?.cancelRequestedAt !== null && row?.cancelRequestedAt !== undefined;
}

/** Menutup run terminal: status, timestamp, revision, dan satu event penutup. */
async function finish(
  db: Db,
  run: RunRow,
  status: "completed" | "failed" | "cancelled" | "indeterminate",
  data: Record<string, unknown>,
): Promise<void> {
  const kind =
    status === "completed"
      ? "run.completed"
      : status === "failed"
        ? "run.failed"
        : status === "cancelled"
          ? "run.cancelled"
          : "run.indeterminate";

  await db.$transaction(async (tx) => {
    const fresh = await tx.taskRun.findUnique({ where: { id: run.id }, select: { status: true } });
    // Sudah terminal (mis. cancel dari worker lain): jangan tulis event kedua.
    if (!fresh || isTerminalRun(fresh.status)) return;
    await appendEvent(tx, run.id, kind, { status, revision: run.revision + 1, ...data });
    await tx.taskRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        revision: { increment: 1 },
        // Kode galat ikut durable supaya klien tak perlu memutar event penutup.
        errorCode:
          status === "failed" || status === "indeterminate"
            ? ((data["error"] as { code?: string } | undefined)?.code ?? "RUN_FAILED")
            : null,
      },
    });
  });
}

export async function runTaskRun(
  db: Db,
  config: GenerateConfig,
  runId: string,
  signal: AbortSignal,
  fence?: FenceChecker,
): Promise<void> {
  const run = (await db.taskRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      taskId: true,
      status: true,
      revision: true,
      segment: true,
      connectionId: true,
      modelId: true,
      assistantMessageId: true,
      deadlineAt: true,
      cancelRequestedAt: true,
    },
  })) as RunRow | null;
  if (!run) throw new Error(`Run "${runId}" tidak ditemukan.`);
  if (isTerminalRun(run.status)) return;

  const task = await db.task.findUnique({
    where: { id: run.taskId },
    select: { id: true, userId: true, title: true, deletedAt: true },
  });
  if (!task) throw new Error("Task untuk run ini tidak ditemukan.");

  // Batas keras: run yang sudah lewat deadline tidak boleh memanggil model.
  if (run.deadlineAt.getTime() <= Date.now()) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { code: "RUN_TIMEOUT", message: "Run sudah melewati batas waktunya.", retryable: false },
    });
    return;
  }

  const active = run.connectionId
    ? await db.connection.findFirst({
        where: { id: run.connectionId, userId: task.userId },
        select: { id: true },
      })
    : await getActiveConnection(db, task.userId);
  if (!active) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: {
        code: "CONNECTION_MISSING",
        message: run.connectionId
          ? "Koneksi yang dipakai run ini sudah dihapus atau bukan milik Anda."
          : "Belum ada koneksi aktif.",
        retryable: false,
      },
    });
    return;
  }

  const cached = config.modelCacheTtlSeconds
    ? await getCachedModels(db, {
        connectionId: active.id,
        ttlSeconds: config.modelCacheTtlSeconds,
        now: new Date(),
      })
    : null;
  const resolution = resolveModel({
    modelRef: run.modelId === "" ? null : run.modelId,
    available: cached ? cached.models : null,
    defaultModel: DEFAULT_MODEL,
  });
  if (!resolution.ok) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { code: "MODEL_UNAVAILABLE", message: resolution.message, retryable: false },
    });
    return;
  }

  const messages = await db.taskMessage.findMany({
    where: { taskId: task.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { role: true, text: true, runId: true },
  });
  // Placeholder asisten run ini berteks kosong, jadi filter teks kosong sudah
  // cukup; jangan buang berdasarkan runId atau input user run ini ikut hilang.
  const history = messages
    .filter((row) => row.text !== "")
    .map((row) => ({ role: row.role, content: row.text }));

  await held(fence);
  if (await cancelRequested(db, run.id)) {
    await finish(db, run, "cancelled", { messageId: run.assistantMessageId, reason: "user" });
    return;
  }

  await db.taskRun.update({
    where: { id: run.id },
    data: { status: "running", startedAt: new Date(), revision: { increment: 1 } },
  });
  await db.$transaction(async (tx) => {
    await appendEvent(tx, run.id, "run.started", {
      status: "running",
      revision: run.revision + 1,
      segment: run.segment,
      modelId: resolution.model,
    });
  });

  const { baseUrl, apiKey } = await openApiKey(db, config, active.id, task.userId);

  let url: URL;
  try {
    url = await assertOutboundAllowed(
      `${baseUrl.replace(/\/+$/, "")}${CHAT_COMPLETIONS_PATH}`,
      { allowInsecureHttp: config.allowInsecureHttp, allowlist: config.outboundAllowlist },
    );
  } catch {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { code: "UPSTREAM_BLOCKED", message: "Alamat gateway ditolak kebijakan keluar.", retryable: false },
    });
    return;
  }

  const idle = new AbortController();
  let idleTimer = setTimeout(() => idle.abort(), IDLE_MS);
  const bumpIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => idle.abort(), IDLE_MS);
  };

  const stopSignal = new AbortController();
  const stopPoll = setInterval(() => {
    void cancelRequested(db, run.id).then(
      (stop) => {
        if (stop) stopSignal.abort();
      },
      () => {},
    );
  }, 1000);

  const parser = createStreamParser();

  let text = "";
  let usage: StreamUsage | null = null;
  let failure: { code: string; message: string } | null = null;

  try {
    const response = await fetchOutbound(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          ...(apiKey === "" ? {} : { authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          model: resolution.model,
          stream: true,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: buildRuntimeContext({
                now: new Date(),
                timezone: DEFAULT_TIMEZONE,
                chatTitle: task.title,
                model: resolution.model,
              }),
            },
            ...history,
          ],
        }),
      },
      { allowInsecureHttp: config.allowInsecureHttp, allowlist: config.outboundAllowlist },
      // Stream panjang: redirect tidak diikuti supaya body tidak dibaca ulang.
      0,
    );

    if (!response.ok || !response.body) {
      failure = {
        code: response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
        message: `Gateway membalas ${response.status}.`,
      };
    } else {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bumpIdle();
        await held(fence);

        for (const delta of parser.push(value)) {
          if (delta.kind === "usage" && delta.usage) usage = delta.usage;
          if (delta.kind !== "text" || !delta.text) continue;
          text += delta.text;
          await db.$transaction((tx) =>
            appendEvent(tx, run.id, "message.delta", {
              messageId: run.assistantMessageId,
              text: delta.text,
            }),
          );
          // shortcut: teks durable ditulis utuh tiap potongan (satu UPDATE per
          // delta). Pindahkan ke buffer+flush saat volume delta tinggi.
          if (run.assistantMessageId) {
            await db.taskMessage.update({
              where: { id: run.assistantMessageId },
              data: { text },
            });
          }
        }
      }
      for (const delta of parser.flush()) {
        if (delta.kind === "usage" && delta.usage) usage = delta.usage;
      }
    }
  } catch (err) {
    if (err instanceof LeaseLost) throw err;
    if (idle.signal.aborted) {
      failure = { code: "UPSTREAM_TIMEOUT", message: "Gateway berhenti mengirim data." };
    } else if (stopSignal.signal.aborted) {
      failure = null;
    } else {
      failure = { code: "UPSTREAM_ERROR", message: "Panggilan ke gateway gagal." };
    }
    logger.warn(
      { requestId: run.id, route: "agent.run", latencyMs: 0, result: "error" },
      { code: failure?.code ?? "aborted" },
    );
  } finally {
    clearTimeout(idleTimer);
    clearInterval(stopPoll);
  }

  await held(fence);

  if (stopSignal.signal.aborted && (await cancelRequested(db, run.id))) {
    if (run.assistantMessageId) {
      await db.taskMessage.update({ where: { id: run.assistantMessageId }, data: { text } });
    }
    await finish(db, run, "cancelled", { messageId: run.assistantMessageId, reason: "user" });
    return;
  }

  if (failure) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { ...failure, retryable: false },
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await appendEvent(tx, run.id, "usage.updated", {
      reported: usage !== null && usage.totalTokens !== null,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      estimatedReservedTokens: OUTPUT_RESERVE_TOKENS,
    });
    await tx.taskRun.update({
      where: { id: run.id },
      data: { stepCount: { increment: 1 } },
    });
  });

  if (run.assistantMessageId) {
    await db.taskMessage.update({ where: { id: run.assistantMessageId }, data: { text } });
  }
  await finish(db, run, "completed", {
    messageId: run.assistantMessageId,
    artifactIds: [],
  });
}