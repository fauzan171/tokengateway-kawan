/**
 * Judul chat otomatis dan penggantian manual (REQ-NT-29, SDD-3.4).
 *
 * Penanda "judul masih otomatis" adalah kolom `Chat.titleSource`
 * (`auto` | `manual`), bukan nilai judulnya. `setManualTitle` menulis
 * `manual`, sehingga rename manual menang bahkan bila pengguna mengetik persis
 * `DEFAULT_CHAT_TITLE` (audit G02). Setiap perubahan judul menaikkan
 * `titleRevision`; penulisan otomatis memakai syarat `titleSource: "auto"`
 * sehingga pemeriksaan dan penulisan tetap atomik (CAS).
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { CHAT_FIELDS, toPublicChat, type ChatRow, type PublicChat } from "./chats";

/** Judul bawaan `createChat`; sekaligus penanda "judul belum diganti manual". */
export const DEFAULT_CHAT_TITLE = "Chat baru";
/** Judul cadangan bila pesan pertama tidak menyisakan teks bermakna. */
export const FALLBACK_CHAT_TITLE = "Obrolan baru";

const TITLE_MAX = 200;

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

/** Chat tidak ada ATAU milik pengguna lain → 404 yang sama (SDD-3.1). */
function chatNotFound(): ApiError {
  return new ApiError({
    status: STATUS.NOT_FOUND,
    code: "CHAT_NOT_FOUND",
    message: "Chat tidak ditemukan.",
  });
}

/** Buang penanda markdown yang umum pada satu baris judul. */
function stripMarkdown(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s*/, "") // heading
    .replace(/^\s{0,3}>\s?/, "") // blockquote
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "") // penanda daftar
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // tautan/gambar → label
    .replace(/`+/g, "") // penanda kode
    .replace(/\*\*|__|\*|~~/g, "") // tebal/miring/coret
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Judul dari pesan pertama pengguna: hanya baris pertama, markdown dibuang,
 * spasi dirapatkan. Dipotong pada batas KATA dan diberi `…` bila terpotong.
 * Pesan yang tidak menyisakan teks → `FALLBACK_CHAT_TITLE`, bukan string kosong.
 */
export function deriveTitle(firstUserMessage: string, maxLength = 60): string {
  const firstLine = firstUserMessage.split(/\r?\n/, 1)[0];
  const cleaned = stripMarkdown(firstLine);
  if (cleaned === "") return FALLBACK_CHAT_TITLE;
  if (cleaned.length <= maxLength) return cleaned;

  const slice = cleaned.slice(0, maxLength);
  const space = slice.lastIndexOf(" ");
  // Tanpa spasi (satu kata panjang) potong keras; `slice[0]` pasti bukan spasi
  // karena `cleaned` sudah di-trim, jadi `head` tidak pernah kosong.
  const head = (space > 0 ? slice.slice(0, space) : slice).trimEnd();
  return `${head}…`;
}

export type AutoTitleInput = {
  chatId: string;
  userId: string;
  /** Isi pesan pertama pengguna. */
  content: string;
};

/**
 * Isi judul HANYA bila masih bawaan. `updateMany` dengan `title` di klausa
 * `where` membuat pemeriksaan dan penulisan atomik: judul yang sudah diganti
 * manual (atau chat milik pengguna lain, atau chat tidak ada) tidak tersentuh.
 *
 * @returns judul baru bila diisi, `null` bila tidak ada yang berubah.
 */
export async function maybeSetAutoTitle(db: Db, input: AutoTitleInput): Promise<string | null> {
  const title = deriveTitle(input.content);
  const { count } = await db.chat.updateMany({
    where: { id: input.chatId, userId: input.userId, titleSource: "auto" },
    data: { title, titleRevision: { increment: 1 } },
  });
  return count === 1 ? title : null;
}

export type ManualTitleInput = {
  chatId: string;
  userId: string;
  title: unknown;
};

/**
 * Ganti judul secara manual; menang atas judul otomatis karena mengubah judul
 * menjauh dari `DEFAULT_CHAT_TITLE`. Kosong atau lebih dari 200 karakter ditolak.
 */
export async function setManualTitle(db: Db, input: ManualTitleInput): Promise<PublicChat> {
  if (typeof input.title !== "string") {
    throw badRequest("INVALID_TITLE", "title harus berupa teks.");
  }
  const title = input.title.trim();
  if (title === "") {
    throw badRequest("INVALID_TITLE", "title tidak boleh kosong.");
  }
  if (title.length > TITLE_MAX) {
    throw badRequest("INVALID_TITLE", `title maksimum ${TITLE_MAX} karakter.`);
  }

  const chat = await db.chat.findFirst({
    where: { id: input.chatId, userId: input.userId },
    select: { id: true },
  });
  if (!chat) throw chatNotFound();

  const row = (await db.chat.update({
    where: { id: chat.id },
    data: { title, titleSource: "manual", titleRevision: { increment: 1 } },
    select: CHAT_FIELDS,
  })) as ChatRow;
  return toPublicChat(row);
}
