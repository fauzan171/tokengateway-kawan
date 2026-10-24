/**
 * SDD-9.3 butir 4 — isolasi lintas pengguna.
 *
 * Semua panggilan memakai id milik pengguna A tetapi `userId` pengguna B, tepat
 * seperti route melakukannya: `requireContext()` memberi id sesi, id datang
 * dari URL. Yang diharapkan seragam: 404 (`NOT_FOUND`/`*_NOT_FOUND`), bukan
 * 403 — membedakan keduanya memberi tahu penebak bahwa id itu ada (SDD-3.1).
 *
 * Tidak ada harness baru: memakai SQLite sementara yang sudah dipakai tes
 * modul masing-masing (`tests/helpers/auth-db.ts`).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../tests/helpers/auth-db";
import { ApiError } from "@/lib/api/errors";
import { createChat, deleteChat, listChats, updateChat } from "@/lib/chat/chats";
import { continueMessage } from "@/lib/chat/continue";
import { editMessage } from "@/lib/chat/edit";
import { deleteFolder, listFolders, renameFolder } from "@/lib/chat/folders";
import { getChat, sendMessage } from "@/lib/chat/messages";
import { regenerate } from "@/lib/chat/regenerate";
import {
  createShareLink,
  getPublicShare,
  listShareLinks,
  revokeShareLinks,
} from "@/lib/chat/share";
import { exportAll, exportChatJson } from "@/lib/chat/transfer";
import {
  activateConnection,
  createConnection,
  deleteConnection,
  listConnections,
  updateConnection,
} from "@/lib/connections/connections";
import { loadConfig, type Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { removeDocument, cleanupOrphans } from "@/lib/documents/remove";
import { listDocuments } from "@/lib/documents/upload";
import { createPrompt, deletePrompt, listPrompts } from "@/lib/prompts/prompts";

let temp: TempDb;
let db: Db;
let config: Config;
/** A = pemilik data, B = penyusup yang memakai id milik A. */
let a: string;
let b: string;

async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${id}@contoh.test` } });
  return id;
}

/** Pesan user + assistant pada satu chat. */
async function makeConversation(ownerId: string) {
  const chat = await createChat(db, { userId: ownerId, title: "milik A" });
  const user = await sendMessage(db, {
    userId: ownerId,
    chatId: chat.id,
    content: "halo",
    parentId: null,
    model: null,
    idempotencyKey: null,
  });
  const assistantId = await db.chatMessage
    .findFirstOrThrow({ where: { chatId: chat.id, role: "assistant" } })
    .then((row) => row.id);
  return { chat, userId: user.userMessageId, assistantId };
}

async function notFound(promise: Promise<unknown>, label: string): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `${label}: seharusnya gagal`).toBeInstanceOf(ApiError);
  expect((err as ApiError).status, label).toBe(404);
}

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  a = await makeUser();
  b = await makeUser();
  config = loadConfig({
    DATABASE_URL: "file:x",
    ENCRYPTION_SECRET: Buffer.alloc(32).toString("base64"),
    AUTH_SECRET: "uji",
  });
});

afterAll(async () => {
  await temp.cleanup();
});

describe("chat", () => {
  it("get, update, delete dengan id milik A → 404", async () => {
    const { chat } = await makeConversation(a);
    await notFound(getChat(db, b, chat.id), "getChat");
    await notFound(updateChat(db, b, chat.id, { title: "dibajak" }), "updateChat");
    await notFound(deleteChat(db, b, chat.id), "deleteChat");
  });

  it("tidak terlihat di daftar maupun ekspor B", async () => {
    const { chat } = await makeConversation(a);
    expect(await listChats(db, b)).toEqual([]);
    expect(JSON.stringify(await exportAll(db, b))).not.toContain(chat.id);
    await notFound(exportChatJson(db, b, chat.id), "exportChatJson");
  });

  it("kirim pesan ke chat A lewat sesi B → 404", async () => {
    const { chat } = await makeConversation(a);
    await notFound(
      sendMessage(db, {
        userId: b,
        chatId: chat.id,
        content: "sisip",
        parentId: null,
        model: null,
        idempotencyKey: null,
      }),
      "sendMessage",
    );
  });
});

describe("chatMessage", () => {
  it("edit pesan user A lewat sesi B → 404", async () => {
    const { chat, userId } = await makeConversation(a);
    await notFound(
      editMessage(db, { userId: b, chatId: chat.id, messageId: userId, content: "ubah" }),
      "editMessage",
    );
  });

  it("regenerate pesan assistant A lewat sesi B → 404", async () => {
    const { chat, assistantId } = await makeConversation(a);
    await notFound(regenerate(db, { userId: b, chatId: chat.id, messageId: assistantId }), "regenerate");
  });

  it("continue pesan assistant A lewat sesi B → 404", async () => {
    const { chat, assistantId } = await makeConversation(a);
    await notFound(continueMessage(db, { userId: b, chatId: chat.id, messageId: assistantId }), "continue");
  });
});

describe("document", () => {
  it("hapus dokumen A lewat sesi B → tidak terhapus", async () => {
    const id = randomUUID();
    await db.document.create({
      data: {
        id,
        userId: a,
        filename: "rahasia.pdf",
        mime: "application/pdf",
        sizeBytes: 1,
        storageKey: `${id}.pdf`,
      },
    });
    const result = await removeDocument(db, { userId: b, documentId: id });
    expect(result.removed).toBe(false);
    expect(await db.document.findUnique({ where: { id } })).not.toBeNull();
  });

  it("tidak terlihat di daftar dokumen B", async () => {
    await db.document.create({
      data: {
        id: randomUUID(),
        userId: a,
        filename: "rahasia.pdf",
        mime: "application/pdf",
        sizeBytes: 1,
        storageKey: randomUUID(),
      },
    });
    expect(await listDocuments(db, b)).toEqual([]);
  });

  it("pembersih yatim global tidak menghapus berkas yang masih punya baris", async () => {
    const key = `${randomUUID()}.pdf`;
    await db.document.create({
      data: {
        id: randomUUID(),
        userId: a,
        filename: "ada.pdf",
        mime: "application/pdf",
        sizeBytes: 1,
        storageKey: key,
      },
    });
    // Akar penyimpanan kosong/tidak ada: tidak ada yang boleh terhapus.
    const result = await cleanupOrphans(db, { root: "/tmp/kawan-tidak-ada" });
    expect(result).toEqual({ deletedFiles: 0, keptFiles: 0 });
    expect(await db.document.count()).toBe(1);
  });
});

describe("folder", () => {
  it("rename dan hapus folder A lewat sesi B → 404", async () => {
    const folder = await db.folder.create({
      data: { id: randomUUID(), userId: a, name: "A" },
    });
    await notFound(renameFolder(db, b, folder.id, "dibajak"), "renameFolder");
    await notFound(deleteFolder(db, b, folder.id), "deleteFolder");
    expect(await db.folder.findUnique({ where: { id: folder.id } })).not.toBeNull();
  });

  it("daftar folder B tidak memuat folder A", async () => {
    await db.folder.create({ data: { id: randomUUID(), userId: a, name: "A" } });
    expect(await listFolders(db, b)).toEqual([]);
  });
});

describe("prompt", () => {
  it("hapus prompt A lewat sesi B → tidak terhapus", async () => {
    const prompt = await createPrompt(db, { userId: a, title: "P", body: "isi" });
    expect(await deletePrompt(db, { userId: b, promptId: prompt.id })).toEqual({ removed: false });
    expect(await db.prompt.findUnique({ where: { id: prompt.id } })).not.toBeNull();
  });

  it("daftar prompt B tidak memuat prompt A", async () => {
    await createPrompt(db, { userId: a, title: "P", body: "isi" });
    expect(await listPrompts(db, b)).toEqual([]);
  });
});

describe("connection", () => {
  async function makeConnection(ownerId: string): Promise<string> {
    const row = await createConnection(db, config, {
      userId: ownerId,
      name: "gw",
      baseUrl: "https://api.contoh.test/v1",
      apiKey: "sk-rahasia-panjang-sekali-abc1",
      skipTest: true,
    });
    return row.id;
  }

  it("update, activate, delete koneksi A lewat sesi B → 404", async () => {
    const id = await makeConnection(a);
    await notFound(updateConnection(db, config, b, id, { name: "dibajak" }), "updateConnection");
    await notFound(activateConnection(db, b, id), "activateConnection");
    await notFound(deleteConnection(db, b, id), "deleteConnection");
    expect(await db.connection.findUnique({ where: { id } })).not.toBeNull();
  });

  it("daftar koneksi B kosong", async () => {
    await makeConnection(a);
    expect(await listConnections(db, b)).toEqual([]);
  });
});

describe("shareLink", () => {
  it("tautan A tidak bisa dibuat, didaftar, atau dicabut lewat sesi B", async () => {
    const { chat } = await makeConversation(a);
    const link = await createShareLink(db, a, chat.id);
    await notFound(createShareLink(db, b, chat.id), "createShareLink");
    await notFound(listShareLinks(db, b, chat.id), "listShareLinks");
    await notFound(revokeShareLinks(db, b, chat.id), "revokeShareLinks");

    // Tautan yang sudah ada tetap berlaku dan tidak tercabut oleh B.
    expect((await getPublicShare(db, link.token)).title).toBe("milik A");
    expect(await db.shareLink.findUniqueOrThrow({ where: { token: link.token } })).toMatchObject({
      revokedAt: null,
    });
  });
});
