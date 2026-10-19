/**
 * Uji P4: ubah/hapus chat, folder, berbagi snapshot, ekspor-impor
 * (WP-NT-P4-03..P4-10, REQ-NT-33..41).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createChat, deleteChat, updateChat } from "./chats";
import { getChat } from "./messages";
import { createFolder, deleteFolder, listFolders, renameFolder } from "./folders";
import { buildSnapshot, createShareLink, getPublicShare, revokeShareLinks } from "./share";
import { CHAT_FORMAT, exportAll, exportChatJson, exportChatMarkdown, importChat } from "./transfer";

let temp: TempDb;
let db: Db;
let userId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

async function seedChat(title = "Chat uji") {
  const chat = await createChat(db, { userId, title });
  const first = randomUUID();
  await db.chatMessage.create({
    data: {
      id: first,
      chatId: chat.id,
      role: "user",
      contentJson: JSON.stringify({ parts: [{ kind: "text", text: "halo" }] }),
      status: "complete",
      seq: 1,
    },
  });
  await db.chatMessage.create({
    data: {
      id: randomUUID(),
      chatId: chat.id,
      parentId: first,
      role: "assistant",
      contentJson: JSON.stringify({ parts: [{ kind: "text", text: "hai juga" }] }),
      status: "complete",
      seq: 2,
    },
  });
  return chat;
}

describe("updateChat", () => {
  it("ubah judul dan pin tanpa menyentuh field lain", async () => {
    const chat = await seedChat("Awal");
    const updated = await updateChat(db, userId, chat.id, { title: "Baru", pinned: true });

    expect(updated.title).toBe("Baru");
    expect(updated.pinned).toBe(true);
    expect(updated.archived).toBe(false);
  });

  it("chat pengguna lain → 404 CHAT_NOT_FOUND", async () => {
    const chat = await seedChat();
    await expect(updateChat(db, randomUUID(), chat.id, { title: "X" })).rejects.toMatchObject({
      code: "CHAT_NOT_FOUND",
      status: 404,
    });
  });

  it("body kosong ditolak", async () => {
    const chat = await seedChat();
    await expect(updateChat(db, userId, chat.id, {})).rejects.toMatchObject({ code: "EMPTY_UPDATE" });
  });

  it("folderId milik pengguna lain ditolak", async () => {
    const chat = await seedChat();
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });
    const foreign = await createFolder(db, other, "Punya orang");

    await expect(updateChat(db, userId, chat.id, { folderId: foreign.id })).rejects.toMatchObject({
      code: "INVALID_FOLDER",
    });
  });
});

describe("deleteChat", () => {
  it("hapus chat ikut menghapus pesan", async () => {
    const chat = await seedChat();
    await deleteChat(db, userId, chat.id);

    expect(await db.chat.count({ where: { id: chat.id } })).toBe(0);
    expect(await db.chatMessage.count({ where: { chatId: chat.id } })).toBe(0);
    await expect(getChat(db, userId, chat.id)).rejects.toMatchObject({ code: "CHAT_NOT_FOUND" });
  });
});

describe("folders", () => {
  it("buat, ganti nama, dan daftar folder", async () => {
    const folder = await createFolder(db, userId, "  Kerja  ");
    expect(folder.name).toBe("Kerja");

    const renamed = await renameFolder(db, userId, folder.id, "Proyek");
    expect(renamed.name).toBe("Proyek");
    expect(await listFolders(db, userId)).toHaveLength(1);
  });

  it("nama kosong dan kepanjangan ditolak", async () => {
    await expect(createFolder(db, userId, "   ")).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(createFolder(db, userId, "x".repeat(81))).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("hapus folder tidak menghapus chat, folderId jadi null", async () => {
    const folder = await createFolder(db, userId, "Sementara");
    const chat = await seedChat();
    await updateChat(db, userId, chat.id, { folderId: folder.id });

    await deleteFolder(db, userId, folder.id);

    const { chat: after } = await getChat(db, userId, chat.id);
    expect(after.folderId).toBeNull();
  });
});

describe("share", () => {
  it("snapshot beku tidak ikut berubah saat chat diedit", async () => {
    const chat = await seedChat("Judul asli");
    const share = await createShareLink(db, userId, chat.id);

    await updateChat(db, userId, chat.id, { title: "Judul baru" });

    const snapshot = await getPublicShare(db, share.token);
    expect(snapshot.title).toBe("Judul asli");
    expect(snapshot.messages.map((m) => m.text)).toEqual(["halo", "hai juga"]);
  });

  it("tautan dicabut → 404", async () => {
    const chat = await seedChat();
    const share = await createShareLink(db, userId, chat.id);

    expect(await revokeShareLinks(db, userId, chat.id)).toBe(1);
    await expect(getPublicShare(db, share.token)).rejects.toMatchObject({ code: "SHARE_NOT_FOUND" });
  });

  it("kedaluwarsa ditolak saat dibuat dan saat dibaca", async () => {
    const chat = await seedChat();
    await expect(createShareLink(db, userId, chat.id, "2020-01-01T00:00:00.000Z")).rejects.toMatchObject({
      code: "INVALID_EXPIRY",
    });

    const share = await createShareLink(db, userId, chat.id, new Date(Date.now() + 60_000).toISOString());
    await db.shareLink.update({ where: { id: share.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(getPublicShare(db, share.token)).rejects.toMatchObject({ code: "SHARE_NOT_FOUND" });
  });

  it("snapshot tidak memuat peran system", () => {
    const snapshot = buildSnapshot(
      { title: "T", createdAt: new Date(0) },
      [
        { role: "system", contentJson: JSON.stringify({ parts: [{ kind: "text", text: "rahasia prompt" }] }), createdAt: new Date(0) },
        { role: "user", contentJson: JSON.stringify({ parts: [{ kind: "text", text: "tanya" }] }), createdAt: new Date(0) },
      ],
    );
    expect(snapshot.messages).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain("rahasia prompt");
  });
});

describe("transfer", () => {
  it("ekspor → impor mempertahankan isi dan struktur pohon", async () => {
    const chat = await seedChat("Round trip");
    const exported = await exportChatJson(db, userId, chat.id);
    expect(exported.format).toBe(CHAT_FORMAT);

    const imported = await importChat(db, userId, exported);
    const { chat: copy, messages } = await getChat(db, userId, imported.id);

    expect(copy.title).toBe("Round trip");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages.map((m) => m.id)).not.toEqual(exported.messages.map((m) => m.id));
    expect(messages[1]?.parentId).toBe(messages[0]?.id);
  });

  it("Markdown memuat judul dan isi", async () => {
    const chat = await seedChat("Catatan");
    const markdown = await exportChatMarkdown(db, userId, chat.id);
    expect(markdown).toContain("# Catatan");
    expect(markdown).toContain("hai juga");
  });

  it("impor menolak format salah, id ganda, dan parentId menggantung", async () => {
    const base = { format: CHAT_FORMAT, chat: { title: "x" } };
    const msg = (id: string, parentId: string | null) => ({ id, parentId, role: "user", text: "t" });

    await expect(importChat(db, userId, { ...base, format: "lain" })).rejects.toMatchObject({
      code: "INVALID_IMPORT",
    });
    await expect(importChat(db, userId, { ...base, messages: [msg("a", null), msg("a", null)] })).rejects.toMatchObject(
      { code: "INVALID_IMPORT" },
    );
    await expect(importChat(db, userId, { ...base, messages: [msg("a", "hantu")] })).rejects.toMatchObject({
      code: "INVALID_IMPORT",
    });
  });

  it("impor menolak siklus parentId", async () => {
    const payload = {
      format: CHAT_FORMAT,
      chat: { title: "siklus" },
      messages: [
        { id: "a", parentId: "b", role: "user", text: "t" },
        { id: "b", parentId: "a", role: "assistant", text: "t" },
      ],
    };
    await expect(importChat(db, userId, payload)).rejects.toMatchObject({ code: "INVALID_IMPORT" });
  });

  it("ekspor 100 chat memakai empat query pesan, isi tetap utuh (AUD-07)", async () => {
    for (let index = 0; index < 100; index += 1) await seedChat(`Chat ${index}`);

    let messageQueries = 0;
    const counted = new Proxy(db, {
      get(inner, prop, receiver) {
        const value = Reflect.get(inner, prop, receiver) as Record<string, unknown> | undefined;
        if (prop !== "chatMessage" || !value) return value;
        return new Proxy(value, {
          get(target, method, recv) {
            if (method !== "findMany") return Reflect.get(target, method, recv);
            return (...args: unknown[]) => {
              messageQueries += 1;
              return (Reflect.get(target, method, recv) as (...a: unknown[]) => unknown)(...args);
            };
          },
        });
      },
    }) as Db;

    const archive = await exportAll(counted, userId);

    expect(archive.chats).toHaveLength(100);
    expect(archive.chats.every((chat) => chat.messages.length === 2)).toBe(true);
    expect(messageQueries).toBe(4);
  });
});
