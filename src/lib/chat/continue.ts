/**
 * Lanjutkan jawaban (WP-NT-P3-10, REQ-NT-30, SDD-3.4).
 *
 * Kelanjutan ditulis sebagai node assistant BARU yang digantung pada node
 * assistant lama, bukan menimpa isinya: output lama tetap utuh dan tidak ada
 * token yang hilang. Karena `parentId` menunjuk jawaban lama, jalur ancestry
 * generasi baru memuat teks lama sebagai giliran assistant terakhir — model
 * menyambung dari situ.
 *
 * Pembuatan placeholder + `Generation` + `Job` memakai primitif bersama
 * `startGeneration`, sama seperti regenerate dan edit bercabang.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { startGeneration, type StartedGeneration } from "./start-generation";

const ACTIVE_STATUSES = ["queued", "preparing", "streaming"];

export type ContinueInput = {
  chatId: string;
  userId: string;
  /** Pesan assistant yang dilanjutkan. */
  messageId: string;
  /** Diisi ke `Chat.modelRef` bila bukan null/kosong. */
  model?: unknown;
};

function chatNotFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "CHAT_NOT_FOUND",
    message: "Chat tidak ditemukan.",
  });
}

function messageNotFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "MESSAGE_NOT_FOUND",
    message: "Pesan tidak ditemukan.",
  });
}

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

function normalizeModel(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest("INVALID_MODEL", "model harus berupa teks tidak kosong.");
  }
  return value.trim();
}

export async function continueMessage(
  db: Db,
  input: ContinueInput,
): Promise<StartedGeneration> {
  const model = normalizeModel(input.model);

  return db.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: input.chatId, userId: input.userId },
      select: { id: true },
    });
    if (!chat) throw chatNotFound();

    const message = await tx.chatMessage.findFirst({
      where: { id: input.messageId, chatId: input.chatId },
      select: { id: true, role: true, parentId: true },
    });
    if (!message) throw messageNotFound();
    if (message.role !== "assistant") {
      throw badRequest("NOT_ASSISTANT", "Hanya pesan assistant yang dapat dilanjutkan.");
    }
    // Assistant tanpa parent tidak menjawab pesan user mana pun, dan
    // `Generation.userMessageId` wajib menunjuk pesan user.
    if (message.parentId === null) {
      throw badRequest(
        "NOT_CONTINUABLE",
        "Pesan assistant ini tidak memiliki pesan pengguna induk.",
      );
    }

    // Menulis kelanjutan di tengah generasi aktif akan balapan dengan worker.
    const running = await tx.generation.findFirst({
      where: { chatId: input.chatId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (running) {
      throw new ApiError({
        status: STATUS.CONFLICT,
        code: "GENERATION_IN_PROGRESS",
        message: "Jawaban masih sedang dibuat. Hentikan dulu, lalu lanjutkan.",
      });
    }

    return startGeneration(tx as unknown as Db, {
      chatId: input.chatId,
      userMessageId: message.parentId,
      parentId: message.id,
      model,
    });
  });
}
