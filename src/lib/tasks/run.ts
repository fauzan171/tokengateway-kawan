/**
 * Eksekutor satu run task (FIX-08, SDD-AG-3, D03/WP01).
 *
 * Versi ini menjalankan SATU putaran model: stream jawaban, tulis teks durable
 * ke `TaskMessage`, lalu tutup run. Tool loop/approval/handover/artifact
 * menyusul di FIX-09+; kontraknya sudah disiapkan (event, status, interaction).
 *
 * Lease Job memagari semua tulisan: lease hilang → berhenti tanpa menulis apa
 * pun, supaya worker lain yang mengambil alih tidak mendapat balapan. Cek
 * lease di luar transaksi TIDAK cukup (D02): setiap tulisan domain
 * memeriksa ulang lease DI DALAM transaksi yang sama sebelum mutasi.
 *
 * Semua sinyal stop (cancel user, deadline, shutdown/abort worker) digabung
 * satu AbortSignal yang dihubungkan ke `fetchOutbound`, jadi stream yang
 * menggantung diputus aktif, bukan menunggu idle timeout.
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
import { getAgent } from "@/lib/agents/registry";
import { appendEvent, isTerminalRun } from "./tasks";

const CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * Prompt bawaan untuk run yang tidak menyebut agent (baris lama sebelum K2).
 *
 * R8: run.ts punya prompt sendiri di samping prompt-builder chat. Prompt itu
 * TIDAK dihapus dan TIDAK diganti diam-diam: agent "default" memakai
 * `definition.systemPrompt` dari registry (kebijakan + fakta kemampuan), dan
 * identitas "agen otonom" di bawah tetap dikirim sebagai blok terpisah supaya
 * perilaku agent default setara sebelumnya. Bila kelak prompt ini dipindah ke
 * registry, naikkan version agent default agar run lama tetap dapat direproduksi.
 */
const LEGACY_SYSTEM_PROMPT = [
  "Kamu adalah agen otonom Kawan. Kerjakan tujuan pengguna langkah demi langkah.",
  "Jawab dengan hasil nyata; bila ada yang belum bisa dikerjakan, katakan apa adanya.",
].join(" ");

/** Perkiraan token cadangan untuk jawaban; tidak diklaim sebagai usage nyata. */
const OUTPUT_RESERVE_TOKENS = 1024;

/** Batas waktu idle antar potongan; bukan durasi total run. */
const IDLE_MS = OUTBOUND_LIMITS.streamIdleTimeoutMs;

/** Interval cek niat cancel dan deadline saat stream berjalan. */
const STOP_POLL_MS = 1_000;

export type RunRow = {
  id: string;
  taskId: string;
  status: string;
  revision: number;
  segment: number;
  connectionId: string | null;
  modelId: string;
  /** Agent beku saat admission (K2/K4) + versinya. */
  agentId: string;
  agentVersion: number;
  assistantMessageId: string | null;
  deadlineAt: Date;
  cancelRequestedAt: Date | null;
};

/** Melempar `LeaseLost` bila lease sudah hilang. */
export async function held(fence: FenceChecker | undefined): Promise<void> {
  if (fence) await assertHeld(fence);
}

/**
 * Transaksi terfence (D02/WP01): lease diperiksa DI DALAM transaksi, tepat
 * sebelum mutasi dijalankan. Balapan "lease hilang antara check dan write"
 * (T01) ditutup karena cek dan tulisan berbagi satu transaksi atomik: bila
 * lease gagal, transaksi di-rollback sebelum ada baris yang ditulis.
 */
export async function fenced<T>(
  db: Db,
  fence: FenceChecker | undefined,
  fn: (tx: Parameters<Parameters<Db["$transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await held(fence);
    return fn(tx);
  });
}

export async function cancelRequested(db: Db, runId: string): Promise<boolean> {
  const row = await db.taskRun.findFirst({
    where: { id: runId },
    select: { cancelRequestedAt: true },
  });
  return row?.cancelRequestedAt !== null && row?.cancelRequestedAt !== undefined;
}

export async function deadlinePassed(db: Db, runId: string): Promise<boolean> {
  const row = await db.taskRun.findFirst({ where: { id: runId }, select: { deadlineAt: true } });
  return row !== null && row.deadlineAt.getTime() <= Date.now();
}

/** Menutup run terminal: status, timestamp, revision, dan satu event penutup. */
export async function finish(
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
        // D1: penyebab terminal (user_cancel/provider_error/deadline/...) ikut
        // durable; tanpa ini kolomnya tetap null untuk semua terminal non-sukses.
        stopReason: (data["stopReason"] as string | undefined) ?? null,
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
      agentId: true,
      agentVersion: true,
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
  // Agent dibekukan di baris run. Definisi yang sudah tidak ada (id dihapus
  // dari registry) TIDAK ditebak: run gagal jujur, bukan diam-diam memakai
  // agent lain yang mungkin punya izin berbeda.
  const agent = getAgent(run.agentId);
  if (!agent) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { code: "AGENT_UNKNOWN", message: "Agent run ini tidak dikenal lagi.", retryable: false },
    });
    return;
  }

  // D1: agent riset punya loop sendiri (fase + tool). Satu cabang dispatch di
  // awal; jalur agen umum di bawah TIDAK disentuh. Sisa pra-syarat (koneksi,
  // model, deadline) diperiksa ulang di dalam `runResearchRun`.
  if (run.agentId === "research") {
    // Impor malas: `research.ts` memakai helper dari berkas ini, jadi impor
    // nilai di level modul membentuk siklus. Siklus ESM aman, tapi impor malas
    // membuat ketergantungan eksplisit satu arah saat runtime.
    const { runResearchRun } = await import("./research");
    await runResearchRun(db, config, runId, signal, fence);
    return;
  }

  const resolution = resolveModel({
    modelRef: run.modelId === "" ? null : run.modelId,
    available: cached ? cached.models : null,
    // modelId kosong: model bawaan AGENT, bukan konstanta global.
    defaultModel: agent.defaultModelId || DEFAULT_MODEL,
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

  // Transisi queued→running terfence: cek lease dan tulisan satu transaksi,
  // dan hanya bila status masih benar-benar queued (takeover/cancel antara
  // baca dan tulis tidak bisa lolos).
  const started = await db.$transaction(async (tx) => {
    await held(fence);
    const fresh = await tx.taskRun.findUnique({ where: { id: run.id }, select: { status: true } });
    if (!fresh || fresh.status !== "queued") return false;
    await tx.taskRun.update({
      where: { id: run.id },
      data: { status: "running", startedAt: new Date(), revision: { increment: 1 } },
    });
    await appendEvent(tx, run.id, "run.started", {
      status: "running",
      revision: run.revision + 1,
      segment: run.segment,
      modelId: resolution.model,
      agentId: run.agentId,
      agentVersion: run.agentVersion,
    });
    return true;
  });
  if (!started) {
    // Status berubah sebelum tulisan (cancel/takeover/terminal): diam saja,
    // penutupnya sudah ditulis pemilik baru status itu.
    if (await cancelRequested(db, run.id)) {
      await finish(db, run, "cancelled", { messageId: run.assistantMessageId, reason: "user" });
    }
    return;
  }

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

  // Kombinasi SEMUA sinyal stop (D03): abort worker (shutdown/lease), idle
  // timeout antar potongan, niat cancel user, dan deadline. Sinyal gabungan
  // ini diteruskan ke `fetchOutbound` supaya stream yang menggantung benar
  // DIBATALKAN di soketnya, bukan menunggu potongan berikutnya.
  const idle = new AbortController();
  let idleTimer = setTimeout(() => idle.abort(), IDLE_MS);
  const bumpIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => idle.abort(), IDLE_MS);
  };

  const stop = new AbortController();
  const stopReasons = { user: false, deadline: false, shutdown: false };
  const onAbort = () => {
    if (!stopReasons.shutdown) stopReasons.shutdown = true;
    stop.abort();
  };
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  const stopPoll = setInterval(() => {
    void cancelRequested(db, run.id).then(
      (requested) => {
        if (requested) {
          stopReasons.user = true;
          stop.abort();
        }
      },
      () => {},
    );
    void deadlinePassed(db, run.id).then(
      (passed) => {
        if (passed) {
          stopReasons.deadline = true;
          stop.abort();
        }
      },
      () => {},
    );
  }, STOP_POLL_MS);

  const abortFetch = AbortSignal.any([signal, idle.signal, stop.signal]);

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
            // Prompt agent (kebijakan + fakta kemampuan dari registry) lalu blok
            // identitas agen otonom yang lama. Dua blok terpisah, urutan tetap:
            // kebijakan lebih tinggi daripada identitas.
            { role: "system", content: agent.systemPrompt },
            { role: "system", content: LEGACY_SYSTEM_PROMPT },
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
        // Stream yang menggantung diputus lewat sini, bukan ditunggu.
        signal: abortFetch,
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
        if (stop.signal.aborted) {
          // Stop tercatat: putus reader supaya soket tidak menahan proses.
          await reader.cancel().catch(() => {});
          break;
        }
        await held(fence);

        for (const delta of parser.push(value)) {
          if (delta.kind === "usage" && delta.usage) usage = delta.usage;
          if (delta.kind !== "text" || !delta.text) continue;
          text += delta.text;
          // Delta event terfence: lease dicek di dalam transaksi yang sama
          // dengan tulisan event + proyeksi teks.
          await fenced(db, fence, (tx) =>
            appendEvent(tx, run.id, "message.delta", {
              messageId: run.assistantMessageId,
              text: delta.text,
            }).then(() =>
              run.assistantMessageId
                ? tx.taskMessage.update({ where: { id: run.assistantMessageId }, data: { text } })
                : Promise.resolve(null),
            ),
          );
        }
      }
      for (const delta of parser.flush()) {
        if (delta.kind === "usage" && delta.usage) usage = delta.usage;
      }
    }
  } catch (err) {
    if (err instanceof LeaseLost) throw err;
    if (stopReasons.user || stop.signal.aborted) {
      failure = null;
    } else if (idle.signal.aborted && !signal.aborted) {
      failure = { code: "UPSTREAM_TIMEOUT", message: "Gateway berhenti mengirim data." };
    } else if (signal.aborted || stopReasons.shutdown) {
      // Shutdown/abort eksternal D03: stop ambigu → indeterminate.
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
    signal.removeEventListener("abort", onAbort);
  }

  await held(fence);

  if (stopReasons.shutdown || (signal.aborted && !stopReasons.user && !stopReasons.deadline)) {
    // Abort eksternal (SIGTERM/lease hilang): efek model tidak diketahui
    // lengkap → indeterminate, bukan failed (D03). Terminal tetap sekali.
    await finish(db, run, "indeterminate", {
      messageId: run.assistantMessageId,
      error: { code: "RUN_ABORTED", message: "Run dihentikan sebelum selesai.", retryable: true },
    });
    return;
  }

  if (stopReasons.deadline) {
    await finish(db, run, "failed", {
      messageId: run.assistantMessageId,
      error: { code: "RUN_TIMEOUT", message: "Run melewati batas waktu saat berjalan.", retryable: false },
    });
    return;
  }

  if (stop.signal.aborted && (await cancelRequested(db, run.id))) {
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

  await fenced(db, fence, (tx) =>
    appendEvent(tx, run.id, "usage.updated", {
      reported: usage !== null && usage.totalTokens !== null,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      estimatedReservedTokens: OUTPUT_RESERVE_TOKENS,
    }).then(() => tx.taskRun.update({ where: { id: run.id }, data: { stepCount: { increment: 1 } } })),
  );

  if (run.assistantMessageId) {
    await db.taskMessage.update({ where: { id: run.assistantMessageId }, data: { text } });
  }
  await finish(db, run, "completed", {
    messageId: run.assistantMessageId,
    artifactIds: [],
  });
}
