/**
 * Primitif bersama: mulai satu generasi untuk pesan user yang SUDAH ada.
 *
 * Dipakai pengiriman pesan baru (WP-NT-P3-03), regenerate (P3-08), edit bercabang
 * (P3-09), dan continue (P3-10). Logika ini semula hidup di dalam transaksi
 * `sendMessage`; tiga work package berikutnya membutuhkannya, jadi diangkat ke
 * sini supaya hanya ada SATU definisi — bukan tiga salinan yang menyimpang.
 *
 * Semua tulisan terjadi di dalam transaksi milik pemanggil (SDD-4.3 butir 1):
 * placeholder assistant, `Generation`, dan `Job(kind=chat.generate)` harus commit
 * bersama, atau tidak sama sekali. Pemanggil bertanggung jawab sudah memverifikasi
 * bahwa `chatId` milik pengguna.
 */

import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";

/** Placeholder sebelum worker menulis potongan pertama. */
export const ASSISTANT_PLACEHOLDER = JSON.stringify({ parts: [] });

export type StartGenerationInput = {
  chatId: string;
  /** Pesan user yang dijawab generasi ini. */
  userMessageId: string;
  /** Tempat placeholder assistant digantung; biasanya `userMessageId`. */
  parentId: string | null;
  /** Diisi ke `Chat.modelRef` bila bukan null/kosong. */
  model?: string | null;
};

export type StartedGeneration = {
  assistantMessageId: string;
  generationId: string;
};

/**
 * `tx` harus transaksi yang sudah memverifikasi kepemilikan chat.
 *
 * `seq` dihitung dari pesan terakhir chat itu, bukan dari argumen: pemanggil
 * sudah boleh menulis pesan user sebelum ini, dan nomor harus tetap menaik.
 */
export async function startGeneration(
  tx: Db,
  input: StartGenerationInput,
): Promise<StartedGeneration> {
  const last = await tx.chatMessage.findFirst({
    where: { chatId: input.chatId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const baseSeq = last?.seq ?? 0;

  // FIX-05: koneksi dipin di sini, saat admission. Kalau pengguna mengganti
  // koneksi aktif sebelum worker jalan, generasi tetap memakai koneksi yang
  // dipilih saat itu — bukan diam-diam pindah ke koneksi lain.
  const chat = await tx.chat.findUnique({
    where: { id: input.chatId },
    select: { userId: true },
  });
  const connection = chat
    ? await tx.connection.findFirst({
        where: { userId: chat.userId, isActive: 1 },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    : null;

  const assistantMessageId = `msg_${randomUUID()}`;
  const generationId = `gen_${randomUUID()}`;
  const jobId = `job_${randomUUID()}`;

  await tx.chatMessage.create({
    data: {
      id: assistantMessageId,
      chatId: input.chatId,
      parentId: input.parentId,
      role: "assistant",
      contentJson: ASSISTANT_PLACEHOLDER,
      status: "streaming",
      seq: baseSeq + 1,
    },
  });
  await tx.generation.create({
    data: {
      id: generationId,
      chatId: input.chatId,
      userMessageId: input.userMessageId,
      assistantMessageId,
      jobId,
      connectionId: connection?.id ?? null,
      modelId: input.model ?? null,
      status: "queued",
    },
  });
  // Job dibuat di dalam transaksi yang sama; worker tidak dapat melihat baris ini
  // sebelum commit, jadi tidak ada balapan.
  await enqueue(tx, { id: jobId, kind: "chat.generate", payload: { generationId } });

  await tx.chat.update({
    where: { id: input.chatId },
    data: {
      currentMessageId: assistantMessageId,
      updatedAt: new Date(),
      ...(input.model ? { modelRef: input.model } : {}),
    },
  });

  return { assistantMessageId, generationId };
}
