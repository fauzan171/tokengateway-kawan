/**
 * Ekspor dan impor percakapan (REQ-NT-39/40, SDD-3.5, SDD-2.4).
 *
 * Bentuk JSON ekspor adalah kontrak round-trip: `id`/`parentId` ikut ditulis
 * supaya struktur pohon (cabang) selamat. Impor memetakan id lama ke id baru
 * dan menolak `parentId` yang tidak ada di payload (dangling) maupun siklus.
 *
 * Ekspor tidak pernah memuat kredensial, `modelRef`, atau id pengguna: arsip
 * boleh dibagikan tanpa membocorkan koneksi gateway (REQ-NT-40).
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { messageText } from "./content";
export {
  exportChatDocxBytes,
  exportChatPdfBytes,
  exportChatXlsxBytes,
  type ChatTranscript,
  type ChatTranscriptMessage,
} from "./document-export";

export const CHAT_FORMAT = "kawan.chat.v1";
export const EXPORT_FORMAT = "kawan.export.v1";

const TEXT_MAX = 100_000;
const MESSAGES_MAX = 2_000;

type ExportMessage = {
  id: string;
  parentId: string | null;
  role: string;
  text: string;
  createdAt: string;
};

type ExportChat = {
  format: string;
  chat: { title: string; createdAt: string };
  messages: ExportMessage[];
};

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

async function loadChat(db: Db, userId: string, chatId: string) {
  const chat = await db.chat.findFirst({
    where: { id: chatId, userId },
    select: { id: true, title: true, createdAt: true },
  });
  if (!chat) {
    throw new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
  }
  const messages = await db.chatMessage.findMany({
    where: { chatId },
    orderBy: { seq: "asc" },
    select: { id: true, parentId: true, role: true, contentJson: true, createdAt: true },
  });
  return { chat, messages };
}

export async function exportChatJson(db: Db, userId: string, chatId: string): Promise<ExportChat> {
  const { chat, messages } = await loadChat(db, userId, chatId);
  return {
    format: CHAT_FORMAT,
    chat: { title: chat.title, createdAt: chat.createdAt.toISOString() },
    messages: messages.map((message) => ({
      id: message.id,
      parentId: message.parentId,
      role: message.role,
      text: messageText(message.contentJson),
      createdAt: message.createdAt.toISOString(),
    })),
  };
}

/** Markdown datar: cabang ditulis berurutan `seq`, bukan sebagai pohon. */
export async function exportChatMarkdown(db: Db, userId: string, chatId: string): Promise<string> {
  const data = await exportChatJson(db, userId, chatId);
  const lines = [`# ${data.chat.title}`, "", `_Dibuat ${data.chat.createdAt}_`, ""];
  for (const message of data.messages) {
    if (message.role === "system") continue;
    lines.push(`## ${message.role === "user" ? "Kamu" : "Kawan"}`, "", message.text, "");
  }
  return lines.join("\n");
}

/** Chat per query saat ekspor: 100 chat jadi 4 query, bukan 100. */
const EXPORT_CHAT_BATCH = 25;

/** Arsip seluruh data percakapan pengguna; tanpa kredensial atau id internal. */
export async function exportAll(db: Db, userId: string) {
  const [folders, chats] = await Promise.all([
    db.folder.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.chat.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, createdAt: true, folderId: true },
    }),
  ]);

  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));

  // Semua pesan diambil per batch chat, bukan satu query per chat.
  const byChat = new Map<string, ExportMessage[]>();
  for (let index = 0; index < chats.length; index += EXPORT_CHAT_BATCH) {
    const ids = chats.slice(index, index + EXPORT_CHAT_BATCH).map((chat) => chat.id);
    const messages = await db.chatMessage.findMany({
      where: { chatId: { in: ids } },
      orderBy: { seq: "asc" },
      select: { chatId: true, id: true, parentId: true, role: true, contentJson: true, createdAt: true },
    });
    for (const message of messages) {
      const list = byChat.get(message.chatId) ?? [];
      list.push({
        id: message.id,
        parentId: message.parentId,
        role: message.role,
        text: messageText(message.contentJson),
        createdAt: message.createdAt.toISOString(),
      });
      byChat.set(message.chatId, list);
    }
  }

  const exported = chats.map((chat) => ({
    title: chat.title,
    folder: chat.folderId ? folderNames.get(chat.folderId) ?? null : null,
    createdAt: chat.createdAt.toISOString(),
    messages: byChat.get(chat.id) ?? [],
  }));

  return {
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    folders: folders.map((folder) => folder.name),
    chats: exported,
  };
}

function validateMessages(raw: unknown): { id: string; parentId: string | null; role: string; text: string }[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest("INVALID_IMPORT", "messages harus array tidak kosong.");
  }
  if (raw.length > MESSAGES_MAX) {
    throw badRequest("INVALID_IMPORT", `messages maksimum ${MESSAGES_MAX} butir.`);
  }

  const ids = new Set<string>();
  const messages = raw.map((item, index) => {
    const entry = item as Record<string, unknown> | null;
    if (typeof entry !== "object" || entry === null) {
      throw badRequest("INVALID_IMPORT", `messages[${index}] harus objek.`);
    }
    const { id, parentId, role, text } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id === "") {
      throw badRequest("INVALID_IMPORT", `messages[${index}].id harus teks.`);
    }
    if (ids.has(id)) throw badRequest("INVALID_IMPORT", `id ganda: ${id}.`);
    ids.add(id);
    if (parentId !== null && parentId !== undefined && typeof parentId !== "string") {
      throw badRequest("INVALID_IMPORT", `messages[${index}].parentId harus teks atau null.`);
    }
    if (role !== "user" && role !== "assistant") {
      throw badRequest("INVALID_IMPORT", `messages[${index}].role harus user atau assistant.`);
    }
    if (typeof text !== "string" || text.length > TEXT_MAX) {
      throw badRequest("INVALID_IMPORT", `messages[${index}].text harus teks maksimum ${TEXT_MAX} karakter.`);
    }
    return { id, parentId: (parentId as string | null | undefined) ?? null, role, text };
  });

  const byId = new Map(messages.map((message) => [message.id, message]));
  for (const message of messages) {
    if (message.parentId !== null && !byId.has(message.parentId)) {
      throw badRequest("INVALID_IMPORT", `parentId menggantung: ${message.parentId}.`);
    }
  }
  // Siklus akan membuat penelusuran pohon berputar tanpa henti di klien.
  for (const message of messages) {
    const seen = new Set<string>();
    let cursor: string | null = message.parentId;
    while (cursor !== null) {
      if (seen.has(cursor)) throw badRequest("INVALID_IMPORT", "Struktur pesan mengandung siklus.");
      seen.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }
  return messages;
}

export async function importChat(db: Db, userId: string, raw: unknown): Promise<{ id: string; title: string }> {
  const payload = raw as Record<string, unknown> | null;
  if (typeof payload !== "object" || payload === null) {
    throw badRequest("INVALID_IMPORT", "Body harus objek JSON.");
  }
  if (payload.format !== CHAT_FORMAT) {
    throw badRequest("INVALID_IMPORT", `format harus ${CHAT_FORMAT}.`);
  }
  const chatMeta = payload.chat as Record<string, unknown> | undefined;
  const title =
    typeof chatMeta?.title === "string" && chatMeta.title.trim() !== ""
      ? chatMeta.title.trim().slice(0, 200)
      : "Chat impor";

  const messages = validateMessages(payload.messages);
  const idMap = new Map(messages.map((message) => [message.id, randomUUID()]));
  const chatId = randomUUID();

  await db.$transaction(async (tx) => {
    // Judul hasil impor adalah pilihan pengguna, bukan judul bawaan.
    await tx.chat.create({ data: { id: chatId, userId, title, titleSource: "manual" } });
    await tx.chatMessage.createMany({
      data: messages.map((message, index) => ({
        id: idMap.get(message.id)!,
        chatId,
        parentId: message.parentId === null ? null : idMap.get(message.parentId)!,
        role: message.role,
        contentJson: JSON.stringify({ parts: [{ kind: "text", text: message.text }] }),
        status: "complete",
        seq: index + 1,
      })),
    });
  });

  return { id: chatId, title };
}
