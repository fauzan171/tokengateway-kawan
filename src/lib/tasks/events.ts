/**
 * SSE event task (FIX-08, SDD-AG-3 kontrak SSE task).
 *
 * Sama seperti stream generasi: satu-satunya penyimpanan adalah `TaskEvent`
 * durable, jadi klien yang menyambung ulang dengan `afterSeq` tidak kehilangan
 * potongan dan tidak menerimanya dua kali. Owner dicek SEBELUM header ditulis
 * supaya 404 dikirim sebagai JSON, bukan stream kosong.
 */

import { notFound } from "./tasks";
import { sseEvent } from "@/lib/chat/sse";
import type { Db } from "@/lib/db";

/** Status run yang berarti tidak ada event penutup lagi setelah ini. */
const TERMINAL = new Set(["completed", "failed", "cancelled", "indeterminate"]);

const POLL_MS = 150;

/** Owner dicek di sini DAN di route: 404 sebelum header, bukan stream kosong. */
export async function loadRunTarget(
  db: Db,
  input: { userId: string; taskId: string; runId: string },
): Promise<{ assistantMessageId: string | null }> {
  const task = await db.task.findFirst({
    where: { id: input.taskId, userId: input.userId },
    select: { id: true },
  });
  if (!task) throw notFound();

  const run = await db.taskRun.findFirst({
    where: { id: input.runId, taskId: input.taskId },
    select: { assistantMessageId: true },
  });
  if (!run) throw notFound();

  return { assistantMessageId: run.assistantMessageId };
}

export function createTaskEventStream(options: {
  db: Db;
  userId: string;
  taskId: string;
  runId: string;
  /** `seq` terakhir yang sudah dimiliki klien; 0/hilang → putar dari awal. */
  afterSeq?: number;
  signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const { db, userId, taskId, runId, signal } = options;
  const raw = options.afterSeq;
  const from = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  const encoder = new TextEncoder();
  const stopped = new AbortController();
  const stop = AbortSignal.any([signal, stopped.signal]);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      let cursor = from;
      const send = (kind: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(kind, data)));
        } catch {
          open = false;
        }
      };

      // Id event eksplisit supaya klien bisa mengirim `Last-Event-ID` mentah.
      const sendEvent = (seq: number, kind: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`id: ${seq}\n${sseEvent(kind, data)}`));
        } catch {
          open = false;
        }
      };

      const authenticate = async (): Promise<boolean> => {
        const task = await db.task.findFirst({
          where: { id: taskId, userId },
          select: { id: true },
        });
        if (!task) {
          send("error", { code: "RESOURCE_NOT_FOUND", message: "Task tidak ditemukan." });
          return false;
        }
        const run = await db.taskRun.findFirst({ where: { id: runId, taskId }, select: { id: true } });
        if (!run) {
          send("error", { code: "RESOURCE_NOT_FOUND", message: "Run tidak ditemukan." });
          return false;
        }
        return true;
      };

      try {
        if (!(await authenticate())) return;
        send("meta", { schemaVersion: 1, runId, afterSeq: cursor });

        for (;;) {
          if (stop.aborted) break;

          const rows = await db.taskEvent.findMany({
            where: { runId, seq: { gt: cursor } },
            orderBy: { seq: "asc" },
            take: 200,
          });
          for (const row of rows) {
            let payload: unknown = {};
            try {
              // Amplop event menyimpan `{schemaVersion, runId, seq, data}`;
              // klien hanya butuh `data`-nya.
              const parsed = JSON.parse(row.payloadJson) as { data?: unknown };
              payload = parsed.data ?? {};
            } catch {
              payload = {};
            }
            sendEvent(row.seq, row.kind, payload);
            cursor = row.seq;
          }

          const run = await db.taskRun.findFirst({
            where: { id: runId },
            select: { status: true, lastEventSeq: true },
          });
          if (!run) break;
          // Terminal dan sudah tersentuh: tidak ada tulisan lagi setelah ini.
          if (TERMINAL.has(run.status) && cursor >= run.lastEventSeq) break;

          await new Promise<void>((resolve) => setTimeout(resolve, POLL_MS));
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Sudah ditutup klien.
        }
      }
    },
    cancel() {
      stopped.abort();
    },
  });
}