/**
 * FIX-19: tool aplikasi memanggil service, bukan HTTP; isolasi antar-pengguna.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createChat } from "@/lib/chat/chats";
import { createFolder } from "@/lib/chat/folders";
import {
  APP_TOOLS,
  isAppTool,
  requiresApproval,
  runAppTool,
} from "./app";

let temp: TempDb;
let db: Db;
let userId: string;
let otherUserId: string;

async function seedUser(id: string): Promise<void> {
  await db.user.create({ data: { id, email: `${id}@contoh.test` } });
}

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  otherUserId = randomUUID();
  await seedUser(userId);
  await seedUser(otherUserId);
});

afterAll(async () => {
  await temp.cleanup();
});

const ctx = () => ({ db, userId, currentChatId: null });

describe("schema tool", () => {
  it("semua tool punya nama, deskripsi, dan additionalProperties false", () => {
    for (const tool of APP_TOOLS) {
      expect(tool.function.name).toMatch(/^app\./);
      expect(tool.function.description.length).toBeGreaterThan(10);
      expect(tool.function.parameters.additionalProperties).toBe(false);
    }
    expect(isAppTool("app.list_chats")).toBe(true);
    expect(isAppTool("app.hapus_semua")).toBe(false);
  });

  it("hanya hapus dan bagikan yang butuh approval", () => {
    expect(requiresApproval("app.delete_chat")).toBe(true);
    expect(requiresApproval("app.share_chat")).toBe(true);
    expect(requiresApproval("app.rename_chat")).toBe(false);
  });
});

describe("app.list_chats", () => {
  it("hanya mengembalikan chat milik pengguna sendiri", async () => {
    await createChat(db, { userId });
    await createChat(db, { userId });
    await createChat(db, { userId: otherUserId });

    const result = await runAppTool("app.list_chats", {}, ctx());
    expect(result.status).toBe("ok");
    const data = result.data as { chats: { id: string }[] };
    expect(data.chats).toHaveLength(2);

    const otherChats = await db.chat.findMany({ where: { userId: otherUserId } });
    expect(data.chats.map((chat) => chat.id)).not.toContain(otherChats[0]?.id);
  });

  it("batas limit dipaksa ke maksimum, bukan dipercaya dari model", async () => {
    await createChat(db, { userId });
    const result = await runAppTool("app.list_chats", { limit: 10_000 }, ctx());
    expect((result.data as { limit: number }).limit).toBeLessThanOrEqual(20);
  });

  it("argumen bukan objek ditolak", async () => {
    expect((await runAppTool("app.list_chats", "semua", ctx())).status).toBe("invalid");
    expect((await runAppTool("app.list_chats", null, ctx())).status).toBe("invalid");
  });
});

describe("app.rename_chat", () => {
  it("mengubah judul chat yang tepat", async () => {
    const chat = await createChat(db, { userId });
    const result = await runAppTool(
      "app.rename_chat",
      { chatId: chat.id, title: "Rencana Q4" },
      ctx(),
    );
    expect(result.status).toBe("ok");
    const row = await db.chat.findUnique({ where: { id: chat.id } });
    expect(row?.title).toBe("Rencana Q4");
    expect(row?.titleSource).toBe("manual");
  });

  it("tidak dapat mengubah chat milik orang lain", async () => {
    const otherChat = await createChat(db, { userId: otherUserId });
    const result = await runAppTool(
      "app.rename_chat",
      { chatId: otherChat.id, title: "Dibajak" },
      ctx(),
    );
    expect(result.status).toBe("not_found");
    const row = await db.chat.findUnique({ where: { id: otherChat.id } });
    expect(row?.title).not.toBe("Dibajak");
  });

  it("revisi kadaluarsa ditolak, bukan menimpa state terbaru", async () => {
    const chat = await createChat(db, { userId });
    // Pengguna lain mengubah lebih dulu lewat service yang sama.
    await runAppTool("app.rename_chat", { chatId: chat.id, title: "Pertama" }, ctx());
    const stale = await runAppTool(
      "app.rename_chat",
      { chatId: chat.id, title: "Kedua", expectedRevision: 0 },
      ctx(),
    );
    expect(stale.status).toBe("conflict");
    const row = await db.chat.findUnique({ where: { id: chat.id } });
    expect(row?.title).toBe("Pertama");
  });

  it("judul kosong/terlalu panjang ditolak", async () => {
    const chat = await createChat(db, { userId });
    expect((await runAppTool("app.rename_chat", { chatId: chat.id, title: "  " }, ctx())).status).toBe("invalid");
    expect(
      (await runAppTool("app.rename_chat", { chatId: chat.id, title: "x".repeat(300) }, ctx())).status,
    ).toBe("invalid");
  });
});

describe("pin, archive, move", () => {
  it("pin dan archive mengubah field yang benar", async () => {
    const chat = await createChat(db, { userId });
    expect((await runAppTool("app.pin_chat", { chatId: chat.id, pinned: true }, ctx())).status).toBe("ok");
    expect((await runAppTool("app.archive_chat", { chatId: chat.id, archived: true }, ctx())).status).toBe("ok");

    // Flag disimpan Int 0/1 supaya portabel SQLite+PostgreSQL (lihat chats.ts).
    const row = await db.chat.findUnique({ where: { id: chat.id } });
    expect(row?.pinned).toBe(1);
    expect(row?.archived).toBe(1);
  });

  it("nilai bukan boolean ditolak", async () => {
    const chat = await createChat(db, { userId });
    expect((await runAppTool("app.pin_chat", { chatId: chat.id, pinned: "ya" }, ctx())).status).toBe("invalid");
  });

  it("pindah folder milik sendiri berhasil, folder orang lain ditolak", async () => {
    const chat = await createChat(db, { userId });
    const folder = await createFolder(db, userId, "Kerja");
    const otherFolder = await createFolder(db, otherUserId, "Rahasia");

    const moved = await runAppTool(
      "app.move_chat",
      { chatId: chat.id, folderId: folder.id },
      ctx(),
    );
    expect(moved.status).toBe("ok");
    expect((await db.chat.findUnique({ where: { id: chat.id } }))?.folderId).toBe(folder.id);

    const rejected = await runAppTool(
      "app.move_chat",
      { chatId: chat.id, folderId: otherFolder.id },
      ctx(),
    );
    expect(rejected.status).toBe("not_found");
    expect((await db.chat.findUnique({ where: { id: chat.id } }))?.folderId).toBe(folder.id);
  });
});

describe("aksi destruktif", () => {
  it("delete dan share TIDAK dieksekusi, hanya mengajukan approval", async () => {
    const chat = await createChat(db, { userId });
    const del = await runAppTool("app.delete_chat", { chatId: chat.id }, ctx());
    expect(del.status).toBe("needs_approval");
    expect(await db.chat.findUnique({ where: { id: chat.id } })).not.toBeNull();

    const share = await runAppTool("app.share_chat", { chatId: chat.id }, ctx());
    expect(share.status).toBe("needs_approval");
    expect(await db.shareLink.count({ where: { chatId: chat.id } })).toBe(0);
  });

  it("tanpa chatId dan tanpa chat aktif → invalid, bukan menebak", async () => {
    expect((await runAppTool("app.delete_chat", {}, ctx())).status).toBe("invalid");
  });
});

describe("app.list_folders", () => {
  it("hanya folder milik pengguna", async () => {
    await createFolder(db, userId, "Kerja");
    await createFolder(db, otherUserId, "Rahasia");
    const result = await runAppTool("app.list_folders", {}, ctx());
    const data = result.data as { folders: { name: string }[] };
    expect(data.folders.map((folder) => folder.name)).toEqual(["Kerja"]);
  });
});
