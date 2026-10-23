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

import { randomUUID } from "node:crypto";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { startGeneration } from "./start-generation";
import { validateAttachments } from "./attachments";
import { CHAT_FIELDS, toPublicChat, type ChatRow, type PublicChat } from "./chats";
import { idempotencyDigest, isUniqueViolation } from "./idempotency";

/** Nama operasi untuk digest; satu kunci tidak boleh dipakai lintas operasi. */
export const OPERATION_SEND_MESSAGE = "chat.messages.send";

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

export type SendMessageInput = {
  userId: string;
  chatId: string;
  content: unknown;
  parentId: unknown;
  model: unknown;
  /** Lampiran gambar dari body; divalidasi `validateAttachments`. */
  attachments?: unknown;
  /** FIX-06: dokumen yang dilampirkan ke chat (manifest ChatDocument). */
  documentIds?: unknown;
  /** Nilai header `Idempotency-Key`; `null` bila tidak dikirim. */
  idempotencyKey: string | null;
  /** Permintaan pencarian web; hanya `true` yang dihormati (REQ-NT-51). */
  webSearch?: unknown;
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

/** FIX-06: dokumen dilampirkan ke chat lewat manifest ChatDocument. */
const MAX_DOCUMENTS = 10;

function normalizeDocumentIds(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest("INVALID_DOCUMENTS", "documentIds harus berupa array.");
  const ids = value.map((id) => {
    if (typeof id !== "string" || id.trim() === "") {
      throw badRequest("INVALID_DOCUMENTS", "documentIds harus berisi teks tidak kosong.");
    }
    return id.trim();
  });
  if (new Set(ids).size !== ids.length) {
    throw badRequest("INVALID_DOCUMENTS", "documentIds tidak boleh duplikat.");
  }
  if (ids.length > MAX_DOCUMENTS) {
    throw badRequest("INVALID_DOCUMENTS", `Maksimal ${MAX_DOCUMENTS} dokumen per chat.`);
  }
  return ids;
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
  const documentIds = normalizeDocumentIds(input.documentIds);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const webSearch = input.webSearch === true;
  // Digest memuat owner + operasi + chat, jadi kunci yang sama pada chat atau
  // operasi lain tidak memutar ulang hasil milik chat lain (FIX-03).
  const digest = idempotencyDigest({
    owner: input.userId,
    operation: OPERATION_SEND_MESSAGE,
    chatId: input.chatId,
    payload: [
      content,
      parentId,
      model,
      // FIX-16: gambar hasil pembuatan ikut digest lewat artifactId-nya.
      images.map((a) => [a.mime, a.dataUrl ?? null, a.artifactId ?? null]),
      webSearch,
      documentIds,
    ],
  });

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

        // FIX-06: manifest dokumen chat diperbarui dalam transaksi yang sama.
        // Hanya dokumen milik pengguna yang berstatus ready yang diterima;
        // lampiran ulang berisi superset ID yang sudah ada tidak menimpa.
        if (documentIds.length > 0) {
          const owned = await tx.document.findMany({
            where: { userId: input.userId, id: { in: documentIds }, status: "ready" },
            select: { id: true },
          });
          if (owned.length !== documentIds.length) {
            throw badRequest("INVALID_DOCUMENTS", "Ada dokumen yang tidak ditemukan, bukan milik Anda, atau belum siap.");
          }
          const existing = await tx.chatDocument.findMany({
            where: { chatId: input.chatId, documentId: { in: documentIds } },
            select: { documentId: true },
          });
          const existingIds = new Set(existing.map((row) => row.documentId));
          const toAdd = documentIds.filter((id) => !existingIds.has(id));
          if (toAdd.length > 0) {
            await tx.chatDocument.createMany({
              data: toAdd.map((documentId) => ({
                id: randomUUID(),
                chatId: input.chatId,
                documentId,
                ownerId: input.userId,
              })),
            });
          }
        }

        // FIX-16: gambar hasil pembuatan wajib milik pengguna ini dan masih
        // hidup — artifactId dari klien tidak dipercaya begitu saja. Diperiksa
        // di dalam transaksi yang sama supaya tidak ada jendela TOCTOU.
        const artifactImageIds = images
          .map((image) => image.artifactId)
          .filter((id): id is string => typeof id === "string");
        if (artifactImageIds.length > 0) {
          const ownedArtifacts = await tx.artifact.findMany({
            where: {
              id: { in: artifactImageIds },
              userId: input.userId,
              deletedAt: null,
              status: "ready",
            },
            select: { id: true },
          });
          if (ownedArtifacts.length !== artifactImageIds.length) {
            throw badRequest("INVALID_ATTACHMENT", "Gambar tidak ditemukan atau bukan milik Anda.");
          }
        }

        const userMessageId = `msg_${randomUUID()}`;
        const contentJson = JSON.stringify({
          parts: [
            { kind: "text", text: content },
            ...(webSearch ? [{ kind: "web-search" }] : []),
            ...images,
          ],
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
              // FIX-16: hasil pembuatan disimpan sebagai rujukan artefak, bukan
              // base64 permanen. Unggahan pengguna tetap membawa dataUrl-nya.
              payloadJson: JSON.stringify(
                image.artifactId
                  ? { mime: image.mime, artifactId: image.artifactId }
                  : { mime: image.mime, dataUrl: image.dataUrl },
              ),
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
