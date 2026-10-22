/**
 * Uji pembuatan dan daftar chat (WP-NT-P3-03, WP-NT-P4-01, SDD-3.4, SDD-3.5).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  createChat,
  decodeChatCursor,
  encodeChatCursor,
  listChats,
  listChatsPaginated,
} from "./chats";

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

describe("createChat", () => {
  it("judul bawaan dipakai bila title tidak dikirim, modelRef null", async () => {
    const chat = await createChat(db, { userId });

    expect(chat.title).toBe("Chat baru");
    expect(chat.modelRef).toBeNull();
    expect(chat.currentMessageId).toBeNull();
    expect(chat.folderId).toBeNull();
    expect(chat.pinned).toBe(false);
    expect(chat.archived).toBe(false);
  });

  it("chat tanpa title tercatat auto/revisi 0; title eksplisit = manual (FIX-04)", async () => {
    const auto = await createChat(db, { userId });
    expect(auto.titleSource).toBe("auto");
    expect(auto.titleRevision).toBe(0);

    const manual = await createChat(db, { userId, title: "Chat baru" });
    // Rename ke teks yang sama dengan judul bawaan tetap dianggap pilihan manusia.
    expect(manual.titleSource).toBe("manual");
  });

  it("title, modelRef, dan folderId disimpan", async () => {
    const folder = await db.folder.create({
      data: { id: randomUUID(), userId, name: "Folder A" },
    });
    const chat = await createChat(db, {
      userId,
      title: "  Rencana  ",
      modelRef: "gpt-4o-mini",
      folderId: folder.id,
    });

    expect(chat.title).toBe("Rencana");
    expect(chat.modelRef).toBe("gpt-4o-mini");
    expect(chat.folderId).toBe(folder.id);
  });

  it("title bukan teks → 400", async () => {
    await expect(createChat(db, { userId, title: 5 })).rejects.toMatchObject({ status: 400 });
  });
});

describe("listChats", () => {
  it("hanya chat milik pengguna, terbaru diperbarui dulu", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });

    const first = await createChat(db, { userId, title: "lama" });
    const second = await createChat(db, { userId, title: "baru" });
    await createChat(db, { userId: otherUserId, title: "milik orang lain" });

    // `updatedAt` beresolusi milidetik; majukan yang pertama agar urutannya pasti.
    await db.chat.update({ where: { id: first.id }, data: { updatedAt: new Date(Date.now() + 1000) } });

    const chats = await listChats(db, userId);
    expect(chats.map((c) => c.id)).toEqual([first.id, second.id]);
  });
});

describe("listChatsPaginated & cursor (WP-NT-P4-01)", () => {
  it("paginasi kursor stabil meski data baru disisipkan di atas", async () => {
    const now = Date.now();
    const c1 = await createChat(db, { userId, title: "Chat 1" });
    const c2 = await createChat(db, { userId, title: "Chat 2" });
    const c3 = await createChat(db, { userId, title: "Chat 3" });
    const c4 = await createChat(db, { userId, title: "Chat 4" });

    // Urutkan updatedAt: c4 (paling baru) > c3 > c2 > c1 (paling lama)
    await db.chat.update({ where: { id: c1.id }, data: { updatedAt: new Date(now + 1000) } });
    await db.chat.update({ where: { id: c2.id }, data: { updatedAt: new Date(now + 2000) } });
    await db.chat.update({ where: { id: c3.id }, data: { updatedAt: new Date(now + 3000) } });
    await db.chat.update({ where: { id: c4.id }, data: { updatedAt: new Date(now + 4000) } });

    // Page 1: ambil 2 item
    const page1 = await listChatsPaginated(db, { userId, limit: 2 });
    expect(page1.chats.map((c) => c.id)).toEqual([c4.id, c3.id]);
    expect(page1.nextCursor).not.toBeNull();

    // Simulasi data berubah: insert Chat 5 baru di atas sebelum fetch page 2
    const c5 = await createChat(db, { userId, title: "Chat 5 baru" });
    await db.chat.update({ where: { id: c5.id }, data: { updatedAt: new Date(now + 5000) } });

    // Page 2: ambil kelanjutan dengan cursor page 1
    const page2 = await listChatsPaginated(db, {
      userId,
      limit: 2,
      cursor: page1.nextCursor,
    });
    // Kursor stabil: harus menghasilkan c2 dan c1, c5 tidak mengacaukan offset
    expect(page2.chats.map((c) => c.id)).toEqual([c2.id, c1.id]);
    expect(page2.nextCursor).toBeNull();
  });

  it("pencarian teks q menyaring judul dan isi pesan", async () => {
    const c1 = await createChat(db, { userId, title: "Resep Rendang Padang" });
    const c2 = await createChat(db, { userId, title: "Tips Belajar Coding" });

    // Tambah pesan pada c2 yang memuat kata kunci "rendang"
    await db.chatMessage.create({
      data: {
        id: randomUUID(),
        chatId: c2.id,
        role: "user",
        seq: 1,
        contentJson: JSON.stringify([{ type: "text", text: "Saya ingin resep rendang juga" }]),
      },
    });

    const c3 = await createChat(db, { userId, title: "Tidak Terkait" });

    const searchResult = await listChatsPaginated(db, { userId, q: "rendang" });
    const foundIds = searchResult.chats.map((c) => c.id);

    expect(foundIds).toContain(c1.id);
    expect(foundIds).toContain(c2.id);
    expect(foundIds).not.toContain(c3.id);
  });

  it("filter folderId membedakan folder spesifik dan tanpa folder", async () => {
    const folder = await db.folder.create({
      data: { id: randomUUID(), userId, name: "Proyek X" },
    });
    const cInFolder = await createChat(db, { userId, title: "Di folder", folderId: folder.id });
    const cRoot = await createChat(db, { userId, title: "Di root" });

    const folderRes = await listChatsPaginated(db, { userId, folderId: folder.id });
    expect(folderRes.chats.map((c) => c.id)).toEqual([cInFolder.id]);

    const rootRes = await listChatsPaginated(db, { userId, folderId: null });
    expect(rootRes.chats.map((c) => c.id)).toEqual([cRoot.id]);
  });

  it("filter archived menyembunyikan chat arsip secara default", async () => {
    const active = await createChat(db, { userId, title: "Chat Aktif" });
    const archived = await createChat(db, { userId, title: "Chat Arsip" });
    await db.chat.update({ where: { id: archived.id }, data: { archived: 1 } });

    const defaultRes = await listChatsPaginated(db, { userId });
    expect(defaultRes.chats.map((c) => c.id)).toEqual([active.id]);

    const archivedRes = await listChatsPaginated(db, { userId, archived: true });
    expect(archivedRes.chats.map((c) => c.id)).toEqual([archived.id]);
  });

  it("cursor tidak valid melempar ApiError 400", async () => {
    await expect(
      listChatsPaginated(db, { userId, cursor: "invalid-base64" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_CURSOR" });
  });

  it("encode dan decode cursor round-trip bekerja", () => {
    const d = new Date("2026-10-18T10:00:00.000Z");
    const encoded = encodeChatCursor(d, "chat_123");
    const decoded = decodeChatCursor(encoded);

    expect(decoded.id).toBe("chat_123");
    expect(decoded.updatedAt).toBe(d.toISOString());
  });
});
