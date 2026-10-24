/**
 * Uji prompt tersimpan dan variabel `{{isi}}` (WP-NT-P7-04/05/06).
 */

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, afterAll } from "vitest";
import { ApiError } from "@/lib/api/errors";
import type { Db } from "@/lib/db";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import {
  applyVariables,
  createPrompt,
  deletePrompt,
  extractVariables,
  listPrompts,
  setPromptEnabled,
} from "./prompts";

describe("extractVariables", () => {
  it("menemukan variabel sesuai urutan kemunculan", () => {
    expect(extractVariables("Ringkas {{isi}} jadi {{n}} poin")).toEqual(["isi", "n"]);
  });

  it("unik walau spasi berbeda", () => {
    expect(extractVariables("{{ isi }} {{isi}}")).toEqual(["isi"]);
  });

  it("tanpa variabel", () => {
    expect(extractVariables("tanpa variabel")).toEqual([]);
  });
});

describe("applyVariables", () => {
  it("mengganti semua kemunculan", () => {
    expect(applyVariables("A {{isi}} B", { isi: "x" })).toBe("A x B");
    expect(applyVariables("A {{isi}} B", { isi: "x" })).not.toContain("{{");
  });

  it("nilai tidak diproses ulang", () => {
    expect(applyVariables("{{isi}}", { isi: "{{isi}}" })).toBe("{{isi}}");
  });

  it("variabel tanpa nilai menjadi kosong", () => {
    expect(applyVariables("{{kosong}}", {})).toBe("");
  });
});

describe("CRUD prompt", () => {
  let temp: TempDb;
  let db: Db;
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    temp = await createTempDb();
    db = temp.db;
    userId = randomUUID();
    otherUserId = randomUUID();
    await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
    await db.user.create({ data: { id: otherUserId, email: `${otherUserId}@contoh.test` } });
  });

  afterAll(async () => {
    await temp.cleanup();
  });

  it("judul kosong ditolak 400", async () => {
    await expect(createPrompt(db, { userId, title: "  ", body: "isi" })).rejects.toBeInstanceOf(ApiError);
    await expect(createPrompt(db, { userId, title: "  ", body: "isi" })).rejects.toMatchObject({ status: 400 });
  });

  it("body lebih dari 8000 ditolak 400", async () => {
    await expect(
      createPrompt(db, { userId, title: "Judul", body: "a".repeat(8001) }),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_PROMPT" });
  });

  it("simpan, panggil, hapus", async () => {
    const created = await createPrompt(db, { userId, title: "Ringkas", body: "Ringkas {{isi}}" });
    expect(created.variables).toEqual(["isi"]);
    expect(created.isDefault).toBe(false);

    const listed = await listPrompts(db, userId);
    expect(listed.map((p) => p.id)).toEqual([created.id]);

    expect(await deletePrompt(db, { userId, promptId: created.id })).toEqual({ removed: true });
    expect(await listPrompts(db, userId)).toEqual([]);
  });

  it("prompt pengguna lain tidak terlihat", async () => {
    await createPrompt(db, { userId: otherUserId, title: "Rahasia", body: "isi rahasia" });

    expect(await listPrompts(db, userId)).toEqual([]);
  });

  it("prompt bawaan hanya terlihat bila enabled dan tidak bisa dihapus", async () => {
    await db.prompt.create({
      data: { id: "prompt_bawaan", title: "Bawaan", body: "Halo", enabled: true },
    });

    const listed = await listPrompts(db, userId);
    expect(listed.map((p) => p.id)).toEqual(["prompt_bawaan"]);
    expect(listed[0].isDefault).toBe(true);

    expect(await deletePrompt(db, { userId, promptId: "prompt_bawaan" })).toEqual({ removed: false });
    expect(await db.prompt.findUnique({ where: { id: "prompt_bawaan" } })).not.toBeNull();

    expect(await setPromptEnabled(db, { promptId: "prompt_bawaan", enabled: false })).toEqual({
      updated: true,
    });
    expect(await listPrompts(db, userId)).toEqual([]);
  });

  it("prompt pribadi tidak bisa diubah statusnya", async () => {
    const created = await createPrompt(db, { userId, title: "Pribadi", body: "isi" });
    expect(await setPromptEnabled(db, { promptId: created.id, enabled: false })).toEqual({
      updated: false,
    });
  });
});
