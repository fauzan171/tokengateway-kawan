/**
 * Uji lifecycle artefak (FIX-11): render, sanitasi nama, kuota, owner check.
 */

import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { createArtifact, deleteArtifact, getArtifactForUser, listArtifacts, openArtifactBytes } from "./create";
import { MAX_ARTIFACT_BYTES, sanitizeDisplayName } from "./format";
import { renderArtifactBytes } from "./render";

let temp: TempDb;
let db: Db;
let userId: string;
let otherUserId: string;
const storageDir = mkdtempSync(join(tmpdir(), "kawan-artifact-"));

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

describe("renderArtifactBytes", () => {
  it("csv meng-escape RFC 4180 dan menetralkan formula injection", () => {
    const csv = renderArtifactBytes({
      format: "csv",
      rows: [
        ["=1+1", "-2", "@SUM(A1)"],
        ['koma, kutip "', "baris\nbaru"],
      ],
    }).toString("utf8");

    expect(csv).toContain("'=1+1,'-2,'@SUM(A1)");
    expect(csv).toContain('"koma, kutip """');
    expect(csv).toContain('"baris\nbaru"');
  });

  it("json tidak serializable ditolak", () => {
    expect(() => renderArtifactBytes({ format: "json", content: undefined })).toThrowError(/UNSERIALIZABLE_JSON/);
  });
});

describe("sanitizeDisplayName", () => {
  it("membuang pemisah path dan karakter kontrol", () => {
    const name = sanitizeDisplayName("../../etc/passwd", "pdf");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("menambah ekstensi bila belum ada dan memakai nama bawaan bila kosong", () => {
    expect(sanitizeDisplayName("laporan", "pdf")).toBe("laporan.pdf");
    expect(sanitizeDisplayName("", "md")).toBe("berkas.md");
  });

  it("membatasi panjang 120 karakter", () => {
    expect(sanitizeDisplayName("x".repeat(500), "txt").length).toBeLessThanOrEqual(120);
  });
});

describe("createArtifact", () => {
  it("sukses menulis baris ready + byte dengan sha256 cocok", async () => {
    const artifact = await createArtifact(
      db,
      { userId, displayName: "catatan", input: { format: "md", content: "# Halo" } },
      storageDir,
    );

    expect(artifact.status).toBe("ready");
    expect(artifact.displayName).toBe("catatan.md");
    const { bytes } = await openArtifactBytes(db, userId, artifact.id, storageDir);
    expect(bytes.toString("utf8")).toBe("# Halo");
    expect(readdirSync(storageDir).length).toBe(1);
  });

  it("melebihi batas ukuran ditolak tanpa baris dan tanpa berkas", async () => {
    await expect(
      createArtifact(
        db,
        { userId, displayName: "besar", input: { format: "txt", content: "x".repeat(MAX_ARTIFACT_BYTES + 1) } },
        storageDir,
      ),
    ).rejects.toThrowError(/TOO_LARGE/);

    expect(await listArtifacts(db, userId)).toEqual([]);
    expect(readdirSync(storageDir)).toEqual([]);
  });

  it("pengguna lain mendapat 404", async () => {
    const artifact = await createArtifact(
      db,
      { userId, displayName: "rahasia", input: { format: "txt", content: "isi" } },
      storageDir,
    );

    await expect(getArtifactForUser(db, otherUserId, artifact.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(openArtifactBytes(db, otherUserId, artifact.id, storageDir)).rejects.toBeInstanceOf(ApiError);
  });

  it("delete menutup unduhan, menghapus byte, dan idempoten", async () => {
    const artifact = await createArtifact(
      db,
      { userId, displayName: "hapus", input: { format: "txt", content: "isi" } },
      storageDir,
    );

    await deleteArtifact(db, userId, artifact.id, storageDir);
    await expect(openArtifactBytes(db, userId, artifact.id, storageDir)).rejects.toMatchObject({ status: 404 });
    expect(readdirSync(storageDir)).toEqual([]);

    await deleteArtifact(db, userId, artifact.id, storageDir);
  });
});