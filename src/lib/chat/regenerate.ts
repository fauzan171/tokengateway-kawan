/**
 * Regenerate: jawaban alternatif untuk satu pesan assistant (REQ-NT-24, SDD-3.4).
 *
 * Jawaban baru digantung pada parent yang SAMA dengan jawaban lama — yaitu pesan
 * user yang dijawabnya — sehingga keduanya menjadi sibling, bukan rantai
 * berurutan. Jawaban lama TIDAK dihapus; itulah gunanya cabang: pengguna dapat
 * berpindah antar alternatif tanpa kehilangan yang lama.
 *
 * Pembuatan placeholder + `Generation` + `Job` diserahkan ke primitif bersama
 * `startGeneration`, bukan disalin. Seluruh tulisan berada dalam satu transaksi
 * milik fungsi ini (SDD-4.3 butir 1), jadi tidak pernah ada placeholder tanpa
 * generasi.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { startGeneration } from "./start-generation";

export type RegenerateInput = {
  chatId: string;
  userId: string;
  /** Pesan assistant yang dibuatkan alternatifnya. */
  messageId: string;
  /** Diisi ke `Chat.modelRef` bila bukan null/kosong; divalidasi di sini. */
  model?: unknown;
};

export type RegenerateResult = {
  assistantMessageId: string;
  generationId: string;
};

/** Chat tidak ada ATAU milik pengguna lain → 404 yang sama (SDD-3.1). */
function chatNotFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "CHAT_NOT_FOUND",
    message: "Chat tidak ditemukan.",
  });
}

/** Pesan tidak ada, bukan milik chat ini, atau milik pengguna lain → 404 sama. */
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

/**
 * Membuat jawaban alternatif (sibling) untuk `messageId`, yang harus berperan
 * `assistant`. Mengembalikan id pesan assistant baru dan generasi yang mengisinya.
 */
export async function regenerate(db: Db, input: RegenerateInput): Promise<RegenerateResult> {
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
      throw badRequest(
        "NOT_ASSISTANT",
        "Hanya pesan assistant yang dapat dibuatkan jawaban alternatif.",
      );
    }
    // Assistant tanpa parent tidak menjawab pesan user mana pun; tidak ada
    // tempat menggantung sibling, dan `Generation.userMessageId` tidak nullable.
    if (message.parentId === null) {
      throw badRequest(
        "NOT_ANSWERABLE",
        "Pesan assistant ini tidak memiliki pesan pengguna induk.",
      );
    }

    // Parent yang sama → sibling; `Chat.currentMessageId` dipindah ke sibling
    // baru oleh `startGeneration`.
    return startGeneration(tx as unknown as Db, {
      chatId: input.chatId,
      userMessageId: message.parentId,
      parentId: message.parentId,
      model,
    });
  });
}
