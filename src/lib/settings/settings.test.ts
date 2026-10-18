/**
 * Uji preferensi pribadi (REQ-NT-70). Memakai SQLite sementara dari helper
 * bersama, jadi sekaligus membuktikan tabel `UserSetting` bisa dipakai.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { DEFAULT_SETTINGS, readSettings, writeSettings } from "./settings";

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

describe("readSettings", () => {
  it("tanpa baris → DEFAULT_SETTINGS, dan tidak membuat baris", async () => {
    expect(await readSettings(db, userId)).toEqual(DEFAULT_SETTINGS);
    expect(await db.userSetting.count()).toBe(0);
  });
});

describe("writeSettings", () => {
  it("fontScale dijepit ke 90..130", async () => {
    expect((await writeSettings(db, userId, { fontScale: 500 })).fontScale).toBe(130);
    expect((await writeSettings(db, userId, { fontScale: 10 })).fontScale).toBe(90);
  });

  it("theme di luar daftar → ApiError 400 INVALID_SETTING", async () => {
    await expect(writeSettings(db, userId, { theme: "pink" })).rejects.toBeInstanceOf(ApiError);
    await expect(writeSettings(db, userId, { theme: "pink" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_SETTING",
    });
  });

  it("patch parsial tidak menghapus kunci lain", async () => {
    await writeSettings(db, userId, { theme: "dark", locale: "en", fontScale: 120 });
    const after = await writeSettings(db, userId, { sendOnEnter: false });

    expect(after).toEqual({ theme: "dark", locale: "en", fontScale: 120, sendOnEnter: false });
    expect(await readSettings(db, userId)).toEqual(after);
  });

  it("kunci tidak dikenal diabaikan", async () => {
    expect(await writeSettings(db, userId, { warna: "merah" })).toEqual(DEFAULT_SETTINGS);
  });
});
