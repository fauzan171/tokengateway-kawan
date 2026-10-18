/**
 * Uji unggah dokumen (WP-NT-P6-02, REQ-NT-54/60).
 */

import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { ApiError, STATUS } from "@/lib/api/errors";
import { DEFAULT_MAX_UPLOAD_BYTES, loadConfig, type Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { listDocuments, sanitizeFilename, uploadDocument } from "./upload";

let temp: TempDb;
let db: Db;
let config: Config;
let userId: string;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-upload-"));
const originalStorage = process.env["STORAGE_LOCAL_DIR"];

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });

  process.env["STORAGE_LOCAL_DIR"] = storageDir;
  for (const name of readdirSync(storageDir)) rmSync(join(storageDir, name), { force: true });
  config = { ...loadConfig({ DATABASE_URL: "file:x", ENCRYPTION_SECRET: Buffer.alloc(32).toString("base64"), AUTH_SECRET: "uji" }) };
});

afterAll(async () => {
  await temp.cleanup();
  if (originalStorage === undefined) delete process.env["STORAGE_LOCAL_DIR"];
  else process.env["STORAGE_LOCAL_DIR"] = originalStorage;
  rmSync(storageDir, { recursive: true, force: true });
});

describe("uploadDocument", () => {
  it("PDF valid tersimpan: Document queued, storageKey acak, job extract antre", async () => {
    const doc = await uploadDocument(db, config, {
      userId,
      filename: "../../rahasiaku.pdf",
      mime: "application/pdf",
      data: Buffer.from("%PDF-1.4 isi"),
    });

    expect(doc.status).toBe("queued");
    expect(doc.filename).toBe("rahasiaku.pdf");
    expect(doc.sizeBytes).toBe(12);

    const row = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
    expect(row.userId).toBe(userId);
    expect(row.storageKey).not.toContain("rahasiaku");
    expect(readdirSync(storageDir)).toContain(row.storageKey);

    const job = await db.job.findFirstOrThrow({ where: { kind: "document.extract" } });
    expect(JSON.parse(job.payloadJson)).toEqual({ documentId: doc.id });
    expect(job.state).toBe("queued");
  });

  it("MIME di luar allowlist ditolak tanpa baris Document dan tanpa berkas", async () => {
    const err = await uploadDocument(db, config, {
      userId,
      filename: "gambar.png",
      mime: "image/png",
      data: Buffer.from("bukan pdf"),
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(STATUS.UNSUPPORTED_MEDIA_TYPE);
    expect((err as ApiError).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(await db.document.count()).toBe(0);
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it("berkas melebihi batas ditolak FILE_TOO_LARGE tanpa baris Document", async () => {
    const small = { ...config, maxUploadBytes: 8 };
    const err = await uploadDocument(db, small, {
      userId,
      filename: "besar.txt",
      mime: "text/plain",
      data: Buffer.from("sembilan!"),
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(STATUS.PAYLOAD_TOO_LARGE);
    expect((err as ApiError).code).toBe("FILE_TOO_LARGE");
    expect((err as ApiError).message).toContain("MB");
    expect(await db.document.count()).toBe(0);
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it("listDocuments hanya mengembalikan dokumen milik pengguna yang diminta", async () => {
    const other = randomUUID();
    await db.user.create({ data: { id: other, email: `${other}@contoh.test` } });

    await uploadDocument(db, config, { userId, filename: "a.txt", mime: "text/plain", data: Buffer.from("a") });
    await uploadDocument(db, config, { userId: other, filename: "b.txt", mime: "text/plain", data: Buffer.from("b") });

    const mine = await listDocuments(db, userId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.filename).toBe("a.txt");
  });
});

describe("sanitizeFilename", () => {
  it("membuang komponen path, karakter kontrol, dan membatasi panjang", () => {
    expect(sanitizeFilename("C:\\data\\laporan.pdf")).toBe("laporan.pdf");
    expect(sanitizeFilename("a\u0000b.txt")).toBe("ab.txt");
    expect(sanitizeFilename("   ")).toBe("dokumen");
    expect(sanitizeFilename(undefined)).toBe("dokumen");
    expect(sanitizeFilename("x".repeat(500))).toHaveLength(200);
  });
});

describe("batas unggah dari env", () => {
  it("bawaan 10 MB dan menolak nilai tidak sah", () => {
    expect(config.maxUploadBytes).toBe(DEFAULT_MAX_UPLOAD_BYTES);
    expect(() =>
      loadConfig({
        DATABASE_URL: "file:x",
        ENCRYPTION_SECRET: Buffer.alloc(32).toString("base64"),
        AUTH_SECRET: "uji",
        MAX_UPLOAD_BYTES: "0",
      }),
    ).toThrow(/MAX_UPLOAD_BYTES/);
  });
});
