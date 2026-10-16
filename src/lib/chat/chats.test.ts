/**
 * Uji pembuatan dan daftar chat (WP-NT-P3-03, SDD-3.4).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createChat, listChats } from "./chats";

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
    expect(chat.pinned).toBe(false);
    expect(chat.archived).toBe(false);
  });

  it("title dan modelRef dari body disimpan", async () => {
    const chat = await createChat(db, { userId, title: "  Rencana  ", modelRef: "gpt-4o-mini" });

    expect(chat.title).toBe("Rencana");
    expect(chat.modelRef).toBe("gpt-4o-mini");
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
