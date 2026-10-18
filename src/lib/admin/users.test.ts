/**
 * Uji pengelolaan pengguna oleh admin (REQ-NT-74/75).
 *
 * Uji penghapusan sengaja menghitung SETIAP tabel yang menyimpan `userId`
 * sesudah operasi, bukan hanya `User`: sisa baris di tabel lain berarti data
 * pribadi masih tertinggal (SDD-2.6).
 */

import { randomUUID } from "node:crypto";
import { mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { deleteUserData, listUsers, setUserStatus } from "./users";

let temp: TempDb;
let db: Db;
let storageDir: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  // Akar penyimpanan sementara: uji ini juga membuktikan berkas dokumen ikut
  // terhapus dari disk, bukan hanya barisnya.
  storageDir = mkdtempSync(join(tmpdir(), "kawan-admin-storage-"));
  process.env["STORAGE_LOCAL_DIR"] = storageDir;
});

afterAll(async () => {
  delete process.env["STORAGE_LOCAL_DIR"];
  rmSync(storageDir, { recursive: true, force: true });
  await temp?.cleanup();
});

async function makeUser(label: string, role = "user", status = "active"): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${label}-${id}@contoh.test`, role, status } });
  return id;
}

describe("setUserStatus", () => {
  it("status di luar daftar → 400 INVALID_STATUS", async () => {
    const admin = await makeUser("admin", "admin");
    const target = await makeUser("target");

    await expect(
      setUserStatus(db, { actorId: admin, userId: target, status: "tidur" }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_STATUS" });
  });

  it("admin menonaktifkan dirinya sendiri → 400 CANNOT_DISABLE_SELF", async () => {
    const admin = await makeUser("admin", "admin");

    await expect(
      setUserStatus(db, { actorId: admin, userId: admin, status: "disabled" }),
    ).rejects.toMatchObject({ status: 400, code: "CANNOT_DISABLE_SELF" });
  });

  it("menonaktifkan pengguna lain menghapus semua sesinya", async () => {
    const admin = await makeUser("admin", "admin");
    const target = await makeUser("target");

    for (const label of ["a", "b", "c"]) {
      await db.session.create({
        data: {
          id: randomUUID(),
          userId: target,
          tokenHash: `${label}-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    expect(await db.session.count({ where: { userId: target } })).toBe(3);

    await setUserStatus(db, { actorId: admin, userId: target, status: "disabled" });

    expect(await db.session.count({ where: { userId: target } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: target } })).status).toBe("disabled");
  });

  it("pengguna tidak ada → 404 USER_NOT_FOUND", async () => {
    const admin = await makeUser("admin", "admin");

    await expect(
      setUserStatus(db, { actorId: admin, userId: "tidak-ada", status: "disabled" }),
    ).rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
  });
});

describe("listUsers", () => {
  it("urut terbaru dulu dan kursor berhenti tepat", async () => {
    const first = await makeUser("satu");
    const second = await makeUser("dua");
    const third = await makeUser("tiga");

    const page1 = await listUsers(db, { limit: 2 });
    expect(page1.users.map((user) => user.id)).toEqual([third, second]);
    expect(page1.nextCursor).toBe(second);

    const page2 = await listUsers(db, { cursor: page1.nextCursor ?? undefined, limit: 2 });
    expect(page2.users.map((user) => user.id)).toEqual([first]);
    expect(page2.nextCursor).toBeNull();
  });
});

describe("deleteUserData", () => {
  it("tidak ada sisa di tabel mana pun yang menyimpan userId", async () => {
    const admin = await makeUser("admin", "admin");
    const target = await makeUser("target");
    const other = await makeUser("lain");

    const chatId = randomUUID();
    const messageId = randomUUID();
    const documentId = randomUUID();
    const connectionId = randomUUID();

    await db.credential.create({ data: { userId: target, passwordHash: "hash" } });
    await db.session.create({
      data: { id: randomUUID(), userId: target, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 60_000) },
    });
    await db.userSetting.create({ data: { userId: target } });
    await db.folder.create({ data: { id: randomUUID(), userId: target, name: "Kerja" } });
    await db.prompt.create({ data: { id: randomUUID(), userId: target, title: "P", body: "B" } });
    await db.usageRecord.create({ data: { id: randomUUID(), userId: target, model: "m" } });
    await db.idempotencyKey.create({
      data: { id: randomUUID(), userId: target, key: "k", digest: "d", responseJson: "{}" },
    });
    await db.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId: target,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await db.connection.create({
      data: {
        id: connectionId,
        userId: target,
        name: "koneksi",
        baseUrl: "https://contoh.test",
        apiKeyEncrypted: "x",
        apiKeyMask: "***",
        keyId: "v1",
      },
    });
    await db.modelCache.create({
      data: { id: randomUUID(), connectionId, modelListJson: "[]", fetchedAt: new Date() },
    });
    const storageKey = randomUUID();
    const storedFile = join(storageDir, storageKey);
    writeFileSync(storedFile, "isi");
    await db.document.create({
      data: {
        id: documentId,
        userId: target,
        filename: "a.txt",
        mime: "text/plain",
        sizeBytes: 3,
        storageKey,
      },
    });
    await db.documentChunk.create({ data: { id: randomUUID(), documentId, ordinal: 0, text: "isi" } });
    await db.chat.create({ data: { id: chatId, userId: target, title: "Chat" } });
    await db.chatMessage.create({
      data: { id: messageId, chatId, role: "user", contentJson: "{}", seq: 0 },
    });
    await db.shareLink.create({
      data: { id: randomUUID(), chatId, token: randomUUID(), snapshotJson: "{}" },
    });
    const targetEmail = (await db.user.findUniqueOrThrow({ where: { id: target } })).email;
    await db.loginAttempt.create({ data: { id: randomUUID(), key: `${targetEmail}\u0000-` } });
    await db.loginAttempt.create({ data: { id: randomUUID(), key: `lain@contoh.test\u0000-` } });

    // Milik pengguna lain: harus utuh.
    await db.chat.create({ data: { id: randomUUID(), userId: other, title: "Chat lain" } });

    const result = await deleteUserData(db, { actorId: admin, userId: target });
    expect(result).toEqual({ removed: true });

    expect(await db.user.count({ where: { id: target } })).toBe(0);
    expect(await db.credential.count({ where: { userId: target } })).toBe(0);
    expect(await db.session.count({ where: { userId: target } })).toBe(0);
    expect(await db.userSetting.count({ where: { userId: target } })).toBe(0);
    expect(await db.folder.count({ where: { userId: target } })).toBe(0);
    expect(await db.prompt.count({ where: { userId: target } })).toBe(0);
    expect(await db.usageRecord.count({ where: { userId: target } })).toBe(0);
    expect(await db.idempotencyKey.count({ where: { userId: target } })).toBe(0);
    expect(await db.passwordResetToken.count({ where: { userId: target } })).toBe(0);
    expect(await db.connection.count({ where: { userId: target } })).toBe(0);
    expect(await db.modelCache.count({ where: { connectionId } })).toBe(0);
    expect(await db.document.count({ where: { userId: target } })).toBe(0);
    expect(await db.documentChunk.count({ where: { documentId } })).toBe(0);
    expect(existsSync(storedFile)).toBe(false);
    expect(await db.chat.count({ where: { userId: target } })).toBe(0);
    expect(await db.chatMessage.count({ where: { chatId } })).toBe(0);
    expect(await db.shareLink.count({ where: { chatId } })).toBe(0);

    // LoginAttempt dikunci lewat email, bukan userId.
    expect(await db.loginAttempt.count({ where: { key: { startsWith: `${targetEmail}\u0000` } } })).toBe(0);
    expect(await db.loginAttempt.count()).toBe(1);

    // Bukti tidak menyapu data pengguna lain.
    expect(await db.chat.count({ where: { userId: other } })).toBe(1);
  });

  it("pengguna tidak ada → { removed: false }", async () => {
    const admin = await makeUser("admin", "admin");

    expect(await deleteUserData(db, { actorId: admin, userId: "tidak-ada" })).toEqual({ removed: false });
  });

  it("admin menghapus dirinya sendiri → 400 CANNOT_DELETE_SELF", async () => {
    const admin = await makeUser("admin", "admin");

    await expect(deleteUserData(db, { actorId: admin, userId: admin })).rejects.toMatchObject({
      status: 400,
      code: "CANNOT_DELETE_SELF",
    });
  });
});
