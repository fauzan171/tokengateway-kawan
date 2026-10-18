/**
 * Pengiriman pesan ke percakapan (REQ-NT-22, SDD-3.4, SDD-4.3, SDD-4.7).
 *
 * `sendMessage` adalah satu-satunya jalur yang membuat pesan, placeholder
 * assistant, `Generation`, dan `Job(kind=chat.generate)`. Semuanya ditulis
 * dalam SATU transaksi (SDD-4.3 butir 1): percobaan yang gagal di tengah tidak
 * boleh meninggalkan pesan user tanpa generasi, atau generasi tanpa job.
 *
 * Idempotensi (SDD-4.7) memakai tabel `IdempotencyKey` yang unik per
 * `(userId, key)`. Baris kunci ditulis DI DALAM transaksi yang sama, jadi
 * permintaan ganda yang berbarengan tidak bisa sama-sama lolos: yang kalah
 * balapan mendapat galat unik, lalu membacanya kembali sebagai pemutaran ulang.
 *
 * Modul ini juga pemilik pesan: `getChat` merakit satu chat beserta pesannya
 * untuk rekonsiliasi klien setelah SSE selesai (SDD-4.4).
 */

import { createHash, randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { startGeneration } from "./start-generation";
import { validateAttachments } from "./attachments";
import { CHAT_FIELDS, toPublicChat, type ChatRow, type PublicChat } from "./chats";

const CONTENT_MAX = 100_000;
const IDEMPOTENCY_KEY_MAX = 200;

/** Hasil `POST .../messages` (SDD-3.4). */
export type SendMessageResult = {
  userMessageId: string;
  assistantMessageId: string;
  generationId: string;
};

export type ChatMessageDto = {
  id: string;
  parentId: string | null;
  role: string;
  content: unknown;
  status: string;
  seq: number;
  createdAt: string;
};

const MESSAGE_FIELDS = {
  id: true,
  parentId: true,
  role: true,
  contentJson: true,
  status: true,
  seq: true,
  createdAt: true,
} as const;

type MessageRow = {
  id: string;
  parentId: string | null;
  role: string;
  contentJson: string;
  status: string;
  seq: number;
  createdAt: Date;
};

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

/** Chat tidak ada ATAU milik pengguna lain → 404 yang sama, tanpa membedakan
 *  sebabnya supaya keberadaan chat orang lain tidak bocor (SDD-3.1). */
function chatNotFound(): ApiError {
  return new ApiError({ status: STATUS.NOT_FOUND, code: "CHAT_NOT_FOUND", message: "Chat tidak ditemukan." });
}

function parseContent(contentJson: string): unknown {
  try {
    return JSON.parse(contentJson);
  } catch {
    // Nilai rusak tidak boleh menjatuhkan pembacaan riwayat; kirim bagian kosong.
    return { parts: [] };
  }
}

function toPublicMessage(row: MessageRow): ChatMessageDto {
  return {
    id: row.id,
    parentId: row.parentId,
    role: row.role,
    content: parseContent(row.contentJson),
    status: row.status,
    seq: row.seq,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Digest kanonik dari isi permintaan yang bermakna (content + parentId + model).
 * Urutan field tetap dan `parentId`/`model` yang absen dinormalkan ke `null`
 * supaya dua permintaan yang sama menghasilkan digest yang sama (SDD-4.7).
 */
export function idempotencyDigest(input: {
  content: string;
  parentId: string | null;
  model: string | null;
  attachments?: readonly { mime: string; dataUrl: string }[];
}): string {
  const images = (input.attachments ?? []).map((a) => [a.mime, a.dataUrl]);
  const canonical = JSON.stringify([input.content, input.parentId, input.model, images]);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Kode unik Prisma (P2002). Duck-typing: modul ini tidak perlu mengimpor tipe
 *  klien Prisma hanya untuk satu pengecekan. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export type SendMessageInput = {
  userId: string;
  chatId: string;
  content: unknown;
  parentId: unknown;
  model: unknown;
  /** Lampiran gambar dari body; divalidasi `validateAttachments`. */
  attachments?: unknown;
  /** Nilai header `Idempotency-Key`; `null` bila tidak dikirim. */
  idempotencyKey: string | null;
};

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

function normalizeParentId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest("INVALID_PARENT", "parentId harus berupa teks tidak kosong.");
  }
  return value;
}

function normalizeModel(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest("INVALID_MODEL", "model harus berupa teks tidak kosong.");
  }
  return value.trim();
}

function normalizeIdempotencyKey(value: string | null): string | null {
  if (value === null) return null;
  const key = value.trim();
  if (key === "" || key.length > IDEMPOTENCY_KEY_MAX) {
    throw badRequest("INVALID_IDEMPOTENCY_KEY", "Header Idempotency-Key tidak sah.");
  }
  return key;
}

/**
 * Menyisipkan pesan user + placeholder assistant + `Generation` + `Job` dalam
 * satu transaksi, dengan idempotensi berbasis `(userId, key)`.
 *
 * Urutan kunci: baris `IdempotencyKey` ditulis paling akhir di dalam transaksi.
 * Permintaan ganda yang berbarengan sama-sama melihat kunci belum ada, lalu
 * salah satunya kalah pada batasan unik; pemenang menyelesaikan transaksinya,
 * dan yang kalah mengulang transaksi sekali dan menemukan baris kunci itu.
 */
export async function sendMessage(db: Db, input: SendMessageInput): Promise<SendMessageResult> {
  const content = normalizeContent(input.content);
  const parentId = normalizeParentId(input.parentId);
  const model = normalizeModel(input.model);
  const images = validateAttachments(input.attachments);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const digest = idempotencyDigest({ content, parentId, model, attachments: images });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const chat = await tx.chat.findFirst({
          where: { id: input.chatId, userId: input.userId },
          select: { id: true },
        });
        if (!chat) throw chatNotFound();

        if (idempotencyKey) {
          const existing = await tx.idempotencyKey.findUnique({
            where: { userId_key: { userId: input.userId, key: idempotencyKey } },
            select: { digest: true, responseJson: true },
          });
          if (existing) {
            if (existing.digest !== digest) {
              throw new ApiError({
                status: STATUS.CONFLICT,
                code: "IDEMPOTENCY_CONFLICT",
                message: "Kunci idempotensi ini sudah dipakai untuk permintaan yang berbeda.",
              });
            }
            return JSON.parse(existing.responseJson) as SendMessageResult;
          }
        }

        if (parentId !== null) {
          const parent = await tx.chatMessage.findFirst({
            where: { id: parentId, chatId: input.chatId },
            select: { id: true },
          });
          if (!parent) throw badRequest("INVALID_PARENT", "parentId bukan pesan pada chat ini.");
        }

        const last = await tx.chatMessage.findFirst({
          where: { chatId: input.chatId },
          orderBy: { seq: "desc" },
          select: { seq: true },
        });
        const baseSeq = last?.seq ?? 0;

        const userMessageId = `msg_${randomUUID()}`;
        const contentJson = JSON.stringify({
          parts: [{ kind: "text", text: content }, ...images],
        });

        await tx.chatMessage.create({
          data: {
            id: userMessageId,
            chatId: input.chatId,
            parentId,
            role: "user",
            contentJson,
            status: "complete",
            seq: baseSeq + 1,
          },
        });
        await tx.chatMessagePart.create({
          data: {
            id: randomUUID(),
            messageId: userMessageId,
            kind: "text",
            ordinal: 0,
            payloadJson: JSON.stringify({ text: content }),
          },
        });
        for (const [index, image] of images.entries()) {
          await tx.chatMessagePart.create({
            data: {
              id: randomUUID(),
              messageId: userMessageId,
              kind: "image",
              ordinal: index + 1,
              payloadJson: JSON.stringify({ mime: image.mime, dataUrl: image.dataUrl }),
            },
          });
        }
        // Placeholder assistant, Generation, dan Job dibuat oleh primitif bersama
        // supaya regenerate/edit/continue memakai jalur yang sama persis, bukan
        // tiga salinan yang menyimpang.
        const { assistantMessageId, generationId } = await startGeneration(
          tx as unknown as Db,
          { chatId: input.chatId, userMessageId, parentId: userMessageId, model },
        );

        const response: SendMessageResult = { userMessageId, assistantMessageId, generationId };
        if (idempotencyKey) {
          await tx.idempotencyKey.create({
            data: {
              id: randomUUID(),
              userId: input.userId,
              key: idempotencyKey,
              digest,
              responseJson: JSON.stringify(response),
            },
          });
        }
        return response;
      });
    } catch (err) {
      // Kalah balapan idempotensi: ulangi sekali; percobaan kedua akan menemukan
      // baris kunci pemenang dan memutar ulang hasilnya.
      if (isUniqueViolation(err) && idempotencyKey && attempt === 0) continue;
      throw err;
    }
  }

  // Tidak tercapai: loop selalu `return` atau `throw`.
  throw new ApiError({
    status: STATUS.INTERNAL,
    code: "INTERNAL_ERROR",
    message: "Terjadi galat internal.",
  });
}

/** Satu chat + seluruh pesannya, urut `seq` menaik (SDD-4.4). */
export async function getChat(
  db: Db,
  userId: string,
  chatId: string,
): Promise<{ chat: PublicChat; messages: ChatMessageDto[] }> {
  const chat = (await db.chat.findFirst({
    where: { id: chatId, userId },
    select: CHAT_FIELDS,
  })) as ChatRow | null;
  if (!chat) throw chatNotFound();

  const rows = await db.chatMessage.findMany({
    where: { chatId },
    orderBy: { seq: "asc" },
    select: MESSAGE_FIELDS,
  });
  return { chat: toPublicChat(chat), messages: rows.map(toPublicMessage) };
}
