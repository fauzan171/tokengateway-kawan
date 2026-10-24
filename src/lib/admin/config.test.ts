/**
 * Uji konfigurasi runtime admin (REQ-NT-76).
 *
 * Baris tidak ada harus dibaca sebagai "terbuka" TANPA menulis baris baru:
 * kalau membaca ikut menulis, tabel akan terisi hanya karena ada yang
 * membuka halaman daftar.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { readAppConfig, writeAppConfig } from "./config";

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp?.cleanup();
});

describe("readAppConfig", () => {
  it("baris tidak ada → registrationOpen true, tanpa membuat baris", async () => {
    expect(await readAppConfig(db)).toEqual({ registrationOpen: true });
    expect(await db.appConfig.count()).toBe(0);
  });
});

describe("writeAppConfig", () => {
  it("nilai bukan boolean → 400 INVALID_CONFIG", async () => {
    await expect(writeAppConfig(db, { registrationOpen: "ya" })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_CONFIG",
    });
  });

  it("upsert satu baris; pembacaan berikutnya melihat nilai baru", async () => {
    expect(await writeAppConfig(db, { registrationOpen: false })).toEqual({ registrationOpen: false });
    expect(await readAppConfig(db)).toEqual({ registrationOpen: false });

    expect(await writeAppConfig(db, { registrationOpen: true })).toEqual({ registrationOpen: true });
    expect(await db.appConfig.count()).toBe(1);
  });
});
