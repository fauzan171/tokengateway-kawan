/**
 * Edit pesan pengguna (WP-NT-P3-09, REQ-NT-25, REQ-NT-26, SDD-3.4).
 *
 * `mode: "branch"` menulis pesan user BARU dengan `parentId` yang sama persis
 * dengan pesan lama, jadi keduanya sibling dan cabang lama tetap utuh; generasi
 * baru digantung pada sibling baru lewat primitif bersama `startGeneration`.
 * `mode: "inplace"` hanya mengganti isi node yang sama — tidak ada cabang baru.
 *
 * Edit ditolak 409 selama chat masih punya generasi `queued`/`preparing`/
 * `streaming` (REQ-NT-26): mengubah konteks di tengah generasi membuat jawaban
 * yang sedang ditulis tidak lagi cocok dengan pesannya.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { startGeneration } from "./start-generation";
import { nextSeq, siblingsOf, type TreeNode } from "./tree";

const CONTENT_MAX = 100_000;
const ACTIVE_STATUSES = ["queued", "preparing", "streaming"];

export type EditMode = "branch" | "inplace";

export type EditInput = {
  chatId: string;
  userId: string;
  /** Pesan user yang diedit. */
  messageId: string;
  content: unknown;
  /** `"branch"` (default) atau `"inplace"`. */
  mode?: unknown;
};

export type EditResult =
  | {
      newMessageId: string;
      siblings: string[];
      currentMessageId: string | null;
    }
  | {
      newMessageId: string;
      assistantMessageId: string;
      generationId: string;
      siblings: string[];
      currentMessageId: string;
    };

const TREE_FIELDS = {
  id: true,
  chatId: true,
  parentId: true,
  role: true,
  seq: true,
  status: true,
  contentJson: true,
} as const;

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

function normalizeContent(value: unknown): string {
  if (typeof value !== "string") {
    throw badRequest("INVALID_CONTENT", "content harus berupa teks.");
  }
  if (value.trim() === "") {
    throw badRequest("INVALID_CONTENT", "content tidak boleh kosong.");
  }
  if (value.length > CONTENT_MAX) {
    throw badRequest("INVALID_CONTENT", `content maksimum ${CONTENT_MAX} karakter.`);
  }
  return value;
}

function normalizeMode(value: unknown): EditMode {
  if (value === undefined || value === null) return "branch";
  if (value === "branch" || value === "inplace") return value;
  throw badRequest("INVALID_MODE", 'mode harus "branch" atau "inplace".');
}

function contentJson(text: string): string {
  return JSON.stringify({ parts: [{ kind: "text", text }] });
}

/** Satu part teks, sama seperti yang ditulis `sendMessage` untuk pesan user. */
async function writeTextPart(
  tx: Db,
  messageId: string,
  text: string,
): Promise<void> {
  await tx.chatMessagePart.deleteMany({ where: { messageId } });
  await tx.chatMessagePart.create({
    data: {
      id: randomUUID(),
      messageId,
      kind: "text",
      ordinal: 0,
      payloadJson: JSON.stringify({ text }),
    },
  });
}

export async function editMessage(db: Db, input: EditInput): Promise<EditResult> {
  const content = normalizeContent(input.content);
  const mode = normalizeMode(input.mode);

  return db.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: input.chatId, userId: input.userId },
      select: { id: true, currentMessageId: true },
    });
    if (!chat) throw chatNotFound();

    const message = await tx.chatMessage.findFirst({
      where: { id: input.messageId, chatId: input.chatId },
      select: { id: true, role: true, parentId: true },
    });
    if (!message) throw messageNotFound();
    if (message.role !== "user") {
      throw badRequest("NOT_USER", "Hanya pesan pengguna yang dapat diedit.");
    }

    const running = await tx.generation.findFirst({
      where: { chatId: input.chatId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (running) {
      throw new ApiError({
        status: STATUS.CONFLICT,
        code: "GENERATION_IN_PROGRESS",
        message:
          "Jawaban masih sedang dibuat. Hentikan dulu, lalu edit pesan ini.",
      });
    }

    if (mode === "inplace") {
      await tx.chatMessage.update({
        where: { id: message.id },
        data: { contentJson: contentJson(content) },
      });
      await writeTextPart(tx as unknown as Db, message.id, content);
      return {
        newMessageId: message.id,
        siblings: [message.id],
        currentMessageId: chat.currentMessageId,
      };
    }

    const rows = await tx.chatMessage.findMany({
      where: { chatId: input.chatId },
      select: TREE_FIELDS,
    });
    const newMessageId = `msg_${randomUUID()}`;
    await tx.chatMessage.create({
      data: {
        id: newMessageId,
        chatId: input.chatId,
        parentId: message.parentId,
        role: "user",
        contentJson: contentJson(content),
        status: "complete",
        seq: nextSeq(rows, input.chatId),
      },
    });
    await writeTextPart(tx as unknown as Db, newMessageId, content);

    const started = await startGeneration(tx as unknown as Db, {
      chatId: input.chatId,
      userMessageId: newMessageId,
      parentId: newMessageId,
      model: null,
    });

    const after = await tx.chatMessage.findMany({
      where: { chatId: input.chatId },
      select: TREE_FIELDS,
    });
    const siblings = siblingsOf(after as TreeNode[], newMessageId).map((m) => m.id);

    return {
      newMessageId,
      assistantMessageId: started.assistantMessageId,
      generationId: started.generationId,
      siblings,
      currentMessageId: started.assistantMessageId,
    };
  });
}
