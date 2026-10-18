/**
 * Uji hapus dokumen dan pembersih berkas yatim (WP-NT-P6-09, REQ-NT-59).
 */

import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { cleanupOrphans, removeDocument } from "./remove";

let temp: TempDb;
let db: Db;
let userId: string;
let otherUserId: string;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-remove-"));

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  otherUserId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
  for (const name of readdirSync(storageDir)) rmSync(join(storageDir, name), { force: true });
});

afterAll(async () => {
  await temp.cleanup();
  rmSync(storageDir, { recursive: true, force: true });
});

async function seed(owner: string, withChunk = true): Promise<{ id: string; key: string }> {
  const id = `doc_${randomUUID()}`;
  const key = randomUUID();
  writeFileSync(join(storageDir, key), "isi");
  await db.document.create({
    data: { id, userId: owner, filename: "uji.txt", mime: "text/plain", sizeBytes: 3, storageKey: key },
  });
  if (withChunk) {
    await db.documentChunk.create({
      data: { id: `chunk_${randomUUID()}`, documentId: id, ordinal: 0, text: "potongan" },
    });
  }
  return { id, key };
}

describe("removeDocument", () => {
  it("dokumen pengguna lain tidak terhapus", async () => {
    const { id, key } = await seed(otherUserId);

    const result = await removeDocument(db, { userId, documentId: id, root: storageDir });

    expect(result.removed).toBe(false);
    expect(await db.document.findUnique({ where: { id } })).not.toBeNull();
    expect(readdirSync(storageDir)).toContain(key);
  });

  it("dokumen sendiri: baris, chunk, dan berkas hilang", async () => {
    const { id, key } = await seed(userId);

    const result = await removeDocument(db, { userId, documentId: id, root: storageDir });

    expect(result.removed).toBe(true);
    expect(await db.document.findUnique({ where: { id } })).toBeNull();
    expect(await db.documentChunk.count({ where: { documentId: id } })).toBe(0);
    expect(readdirSync(storageDir)).not.toContain(key);
  });

  it("hapus dua kali tidak melempar", async () => {
    const { id } = await seed(userId);

    await removeDocument(db, { userId, documentId: id, root: storageDir });
    await expect(
      removeDocument(db, { userId, documentId: id, root: storageDir }),
    ).resolves.toEqual({ removed: false });
  });

  it("storageKey tidak sah: baris database dipertahankan", async () => {
    const id = `doc_${randomUUID()}`;
    await db.document.create({
      data: { id, userId, filename: "x", mime: "text/plain", sizeBytes: 1, storageKey: "../luar" },
    });

    await expect(
      removeDocument(db, { userId, documentId: id, root: storageDir }),
    ).rejects.toThrow(/tidak sah/);
    expect(await db.document.findUnique({ where: { id } })).not.toBeNull();
  });
});

describe("cleanupOrphans", () => {
  it("menghapus berkas tanpa baris Document", async () => {
    const orphan = randomUUID();
    writeFileSync(join(storageDir, orphan), "yatim");
    await utimes(join(storageDir, orphan), new Date(Date.now() - 2 * 60 * 60 * 1000), new Date(Date.now() - 2 * 60 * 60 * 1000));

    const result = await cleanupOrphans(db, { root: storageDir });

    expect(result.deletedFiles).toBe(1);
    expect(readdirSync(storageDir)).not.toContain(orphan);
  });

  it("tidak menghapus berkas yang punya baris", async () => {
    const { key } = await seed(userId, false);
    await utimes(join(storageDir, key), new Date(Date.now() - 2 * 60 * 60 * 1000), new Date(Date.now() - 2 * 60 * 60 * 1000));

    const result = await cleanupOrphans(db, { root: storageDir });

    expect(result.deletedFiles).toBe(0);
    expect(result.keptFiles).toBe(1);
    expect(readdirSync(storageDir)).toContain(key);
  });

  it("tidak menghapus berkas yang baru dibuat", async () => {
    const fresh = randomUUID();
    writeFileSync(join(storageDir, fresh), "baru");

    const result = await cleanupOrphans(db, { root: storageDir });

    expect(result.deletedFiles).toBe(0);
    expect(readdirSync(storageDir)).toContain(fresh);
  });

  it("akar belum ada: hitungan nol, tidak melempar", async () => {
    await expect(cleanupOrphans(db, { root: join(storageDir, "belum-ada") })).resolves.toEqual({
      deletedFiles: 0,
      keptFiles: 0,
    });
  });
});
