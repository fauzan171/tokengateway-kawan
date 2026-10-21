import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";

const ACTIVE = ["queued", "preparing", "streaming"];

/** Menutup proyeksi chat ketika antrean mengetahui worker gagal atau hilang. */
export async function reconcileGenerations(db: Db): Promise<void> {
  const active = await db.generation.findMany({
    where: { status: { in: ACTIVE }, jobId: { not: null } },
    select: { id: true, jobId: true },
  });
  if (active.length === 0) return;
  const jobs = await db.job.findMany({
    where: {
      id: { in: active.map((generation) => generation.jobId!) },
      kind: "chat.generate",
      state: { in: ["failed", "indeterminate"] },
    },
    select: { id: true },
  });
  const terminal = new Set(jobs.map((job) => job.id));
  for (const candidate of active.filter((generation) => terminal.has(generation.jobId!))) {
    await db.$transaction(async (tx) => {
      const generation = await tx.generation.findUniqueOrThrow({ where: { id: candidate.id } });
      const last = await tx.generationEvent.findFirst({
        where: { generationId: generation.id }, orderBy: { seq: "desc" },
      });
      const finishedEvent = last?.kind === "done" || last?.kind === "error";
      const status = last?.kind === "done"
        ? (JSON.parse(last.payloadJson).status === "stopped" ? "stopped" : "complete")
        : last?.kind === "error" ? "error" : "indeterminate";
      const changed = await tx.generation.updateMany({
        where: { id: generation.id, status: { in: ACTIVE } },
        data: { status, ...(finishedEvent ? {} : { errorCode: "WORKER_INTERRUPTED" }), finishedAt: new Date() },
      });
      if (changed.count === 0) return;
      const parts = await tx.chatMessagePart.findMany({
        where: { messageId: generation.assistantMessageId, kind: "text" },
        orderBy: { ordinal: "asc" },
      });
      const text = parts.map((part) => {
        const value: unknown = JSON.parse(part.payloadJson);
        return value && typeof value === "object" && "text" in value && typeof value.text === "string" ? value.text : "";
      }).join("");
      await tx.chatMessage.update({
        where: { id: generation.assistantMessageId },
        data: {
          status: status === "indeterminate" ? "error" : status,
          ...(text ? { contentJson: JSON.stringify({ parts: [{ kind: "text", text }] }) } : {}),
        },
      });
      if (finishedEvent) return;
      await tx.generationEvent.create({
        data: {
          id: randomUUID(), generationId: generation.id, seq: (last?.seq ?? 0) + 1, kind: "error",
          payloadJson: JSON.stringify({ code: "WORKER_INTERRUPTED", message: "Hasil tidak dapat dipastikan. Periksa jawaban sebelum mencoba lagi.", retryable: false }),
        },
      });
    });
  }
}
