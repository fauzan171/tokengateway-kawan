/**
 * Uji judul otomatis + ganti manual (WP-NT-P3-13, REQ-NT-29).
 *
 * Inti REQ-NT-29 ada di "ganti manual menang": setelah `setManualTitle`,
 * `maybeSetAutoTitle` berikutnya tidak boleh menimpa.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createChat } from "./chats";
import {
  DEFAULT_CHAT_TITLE,
  FALLBACK_CHAT_TITLE,
  deriveTitle,
  maybeSetAutoTitle,
  setManualTitle,
} from "./title";

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

describe("deriveTitle", () => {
  it("memakai baris pertama saja", () => {
    expect(deriveTitle("Baris judul\nbaris kedua\nbaris ketiga")).toBe("Baris judul");
  });

  it("membuang markdown dan merapatkan spasi", () => {
    expect(deriveTitle("# Judul Utama")).toBe("Judul Utama");
    expect(deriveTitle("**tebal** dan *miring*")).toBe("tebal dan miring");
    expect(deriveTitle("lihat [dokumen](https://contoh.test/x) ini")).toBe("lihat dokumen ini");
    expect(deriveTitle("teks   dengan    spasi")).toBe("teks dengan spasi");
  });

  it("memotong pada batas kata dan menambah …", () => {
    const title = deriveTitle("satu dua tiga empat lima enam tujuh delapan", 20);

    expect(title).toBe("satu dua tiga empat…");
    expect(title.length).toBeLessThanOrEqual(21); // 20 karakter + …
  });

  it("satu kata lebih panjang dari batas dipotong keras tanpa galat", () => {
    expect(deriveTitle("abcdefghijklmnopqrstuvwxyz", 5)).toBe("abcde…");
  });

  it("pesan kosong, hanya spasi, atau hanya simbol → judul cadangan", () => {
    expect(deriveTitle("")).toBe(FALLBACK_CHAT_TITLE);
    expect(deriveTitle("   \n\n  ")).toBe(FALLBACK_CHAT_TITLE);
    expect(deriveTitle("###")).toBe(FALLBACK_CHAT_TITLE);
    expect(deriveTitle("**__`")).toBe(FALLBACK_CHAT_TITLE);
  });
});

describe("maybeSetAutoTitle", () => {
  it("mengisi judul saat masih bawaan", async () => {
    const chat = await createChat(db, { userId });
    expect(chat.title).toBe(DEFAULT_CHAT_TITLE);

    const title = await maybeSetAutoTitle(db, {
      chatId: chat.id,
      userId,
      content: "Tolong rangkum dokumen ini",
    });

    expect(title).toBe("Tolong rangkum dokumen ini");
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe("Tolong rangkum dokumen ini");
  });

  it("TIDAK menimpa judul manual (inti REQ-NT-29)", async () => {
    const chat = await createChat(db, { userId });
    await setManualTitle(db, { chatId: chat.id, userId, title: "Judul pilihanku" });

    const title = await maybeSetAutoTitle(db, {
      chatId: chat.id,
      userId,
      content: "pesan pertama yang panjang sekali",
    });

    expect(title).toBeNull();
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe("Judul pilihanku");
  });

  it("judul manual yang persis judul bawaan tetap tidak ditimpa", async () => {
    // Penandanya kolom `titleSource`, bukan nilai judul (audit G02).
    const chat = await createChat(db, { userId });
    await setManualTitle(db, { chatId: chat.id, userId, title: DEFAULT_CHAT_TITLE });

    const title = await maybeSetAutoTitle(db, { chatId: chat.id, userId, content: "Halo" });

    expect(title).toBeNull();
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe(DEFAULT_CHAT_TITLE);
    expect(row.titleSource).toBe("manual");
  });

  it("judul otomatis menaikkan titleRevision", async () => {
    const chat = await createChat(db, { userId });
    await maybeSetAutoTitle(db, { chatId: chat.id, userId, content: "Halo" });
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.titleSource).toBe("auto");
    expect(row.titleRevision).toBe(1);
  });

  it("chat pengguna lain tidak tersentuh", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const chat = await createChat(db, { userId: otherUserId });

    const title = await maybeSetAutoTitle(db, {
      chatId: chat.id,
      userId,
      content: "Halo",
    });

    expect(title).toBeNull();
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe(DEFAULT_CHAT_TITLE);
  });

  it("chat tidak ada → null, bukan galat", async () => {
    await expect(
      maybeSetAutoTitle(db, { chatId: "chat-tidak-ada", userId, content: "Halo" }),
    ).resolves.toBeNull();
  });
});

describe("setManualTitle", () => {
  it("mengganti judul otomatis yang sudah ada", async () => {
    const chat = await createChat(db, { userId });
    await maybeSetAutoTitle(db, { chatId: chat.id, userId, content: "pesan awal" });

    const updated = await setManualTitle(db, {
      chatId: chat.id,
      userId,
      title: "  Judul Manual  ",
    });

    expect(updated.id).toBe(chat.id);
    expect(updated.title).toBe("Judul Manual");
    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe("Judul Manual");
  });

  it("judul lebih dari 200 karakter ditolak", async () => {
    const chat = await createChat(db, { userId });

    await expect(
      setManualTitle(db, { chatId: chat.id, userId, title: "a".repeat(201) }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TITLE" });

    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe(DEFAULT_CHAT_TITLE);
  });

  it("judul kosong ditolak", async () => {
    const chat = await createChat(db, { userId });

    await expect(
      setManualTitle(db, { chatId: chat.id, userId, title: "   " }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TITLE" });
  });

  it("judul bukan teks ditolak", async () => {
    const chat = await createChat(db, { userId });

    await expect(
      setManualTitle(db, { chatId: chat.id, userId, title: 5 }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_TITLE" });
  });

  it("chat pengguna lain → tidak ditemukan", async () => {
    const otherUserId = randomUUID();
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
    const chat = await createChat(db, { userId: otherUserId, title: "milik orang lain" });

    await expect(
      setManualTitle(db, { chatId: chat.id, userId, title: "coba curi" }),
    ).rejects.toMatchObject({ status: 404, code: "CHAT_NOT_FOUND" });

    const row = await db.chat.findUniqueOrThrow({ where: { id: chat.id } });
    expect(row.title).toBe("milik orang lain");
  });
});
