/**
 * Pesan sistem per chat (REQ-NT-31, SDD-3.4).
 *
 * ## Pilihan penyimpanan
 *
 * Disimpan sebagai baris `ChatMessage` ber-`role = "system"` dengan
 * `parentId = null` dan `seq = 0` — BUKAN kolom terpisah, sebab kontrak
 * `prisma/**` dibekukan mandor dan tidak ada kolom sisa di `Chat`.
 *
 * Konsekuensi yang dijaga pilihan ini:
 *   - `buildAncestryPath` (tree.ts) berjalan dari leaf menelusuri `parentId`
 *     sampai `null`. Baris sistem adalah root TERPISAH, tidak pernah dicapai
 *     dari leaf percakapan, jadi ia tidak ikut jadi konteks. `subtreeOf(chat
 *     root)` juga tidak menariknya. Tidak perlu ubah `tree.ts`.
 *   - `contentJson` memakai bentuk yang sama dengan pesan lain
 *     (`{ parts: [{ kind: "text", text }] }`), sehingga jalur generasi bisa
 *     mengirimnya sebagai `{ role: "system", content }` paling awal memakai
 *     `messageText` yang sudah ada di `generate.ts`.
 *
 * ## Celah integrasi yang BELUM tertutup (berkas di luar batas, dilaporkan)
 *
 * `getChat` (messages.ts) dan `runGeneration` (generate.ts) dibekukan dan
 * TIDAK menyaring `role`, sehingga:
 *   - `GET /chat/{chatId}` masih mengembalikan baris sistem di daftar pesan
 *     datar (urut `seq`, jadi paling awal);
 *   - `runGeneration` belum mengirim pesan sistem ke gateway.
 * Keduanya butuh satu baris penyaringan/pengiriman di berkas itu; tidak
 * disentuh di sini.
 */

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

/** Satu-satunya peran yang dipakai modul ini; `ChatMessage.role` bebas teks. */
const SYSTEM_ROLE = "system";

/** `seq` 0 menaruh baris sistem sebelum pesan mana pun (pesan mulai dari 1). */
const SYSTEM_SEQ = 0;

/** Batas panjang yang diminta REQ-NT-31. */
const SYSTEM_PROMPT_MAX = 8000;

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

/** Menggabungkan bagian `text` dari `contentJson`; rusak/absen → null. */
function systemText(contentJson: string): string | null {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (parsed === null || typeof parsed !== "object") return null;
    const parts = (parsed as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) return null;
    return parts
      .filter(
        (part): part is { kind: string; text: string } =>
          part !== null &&
          typeof part === "object" &&
          (part as { kind?: unknown }).kind === "text" &&
          typeof (part as { text?: unknown }).text === "string",
      )
      .map((part) => part.text)
      .join("");
  } catch {
    return null;
  }
}

/**
 * Menyimpan pesan sistem untuk satu chat.
 *
 * Konten kosong/whitespace menghapus pesan sistem (setara `deleteSystemPrompt`)
 * dan mengembalikan `null`. Konten bukan teks atau melebihi batas ditolak 400.
 * Chat milik pengguna lain dibalas 404 yang sama dengan chat tidak ada.
 *
 * Selalu satu baris per chat: baris sistem lama dihapus lebih dulu, lalu baris
 * baru ditulis, dalam satu transaksi.
 */
export async function setSystemPrompt(
  db: Db,
  { chatId, userId, content }: { chatId: string; userId: string; content: unknown },
): Promise<string | null> {
  if (typeof content !== "string") {
    throw badRequest("INVALID_SYSTEM_PROMPT", "Pesan sistem harus berupa teks.");
  }
  if (content.length > SYSTEM_PROMPT_MAX) {
    throw badRequest(
      "SYSTEM_PROMPT_TOO_LONG",
      `Pesan sistem maksimum ${SYSTEM_PROMPT_MAX} karakter.`,
    );
  }
  const clear = content.trim() === "";

  return db.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: chatId, userId },
      select: { id: true },
    });
    if (!chat) throw chatNotFound();

    await tx.chatMessage.deleteMany({ where: { chatId, role: SYSTEM_ROLE } });
    if (clear) return null;

    await tx.chatMessage.create({
      data: {
        id: `msg_${randomUUID()}`,
        chatId,
        parentId: null,
        role: SYSTEM_ROLE,
        contentJson: JSON.stringify({ parts: [{ kind: "text", text: content }] }),
        status: "complete",
        seq: SYSTEM_SEQ,
      },
    });
    return content;
  });
}

/** Pesan sistem chat, atau `null` bila tidak ada (chat tak ada pun `null`). */
export async function getSystemPrompt(db: Db, chatId: string): Promise<string | null> {
  const row = await db.chatMessage.findFirst({
    where: { chatId, role: SYSTEM_ROLE },
    orderBy: { createdAt: "asc" },
    select: { contentJson: true },
  });
  if (!row) return null;
  const text = systemText(row.contentJson);
  return text === null || text === "" ? null : text;
}

/** Menghapus pesan sistem chat. Chat milik pengguna lain → 404. */
export async function deleteSystemPrompt(
  db: Db,
  { chatId, userId }: { chatId: string; userId: string },
): Promise<void> {
  await db.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: chatId, userId },
      select: { id: true },
    });
    if (!chat) throw chatNotFound();
    await tx.chatMessage.deleteMany({ where: { chatId, role: SYSTEM_ROLE } });
  });
}
