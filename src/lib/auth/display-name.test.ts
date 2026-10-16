/**
 * Uji ganti nama tampilan (WP-NT-P1-05, REQ-NT-14).
 *
 * SQLite sementara dari `tests/helpers/auth-db.ts`, sama seperti tes auth lain.
 * Pengguna dibuat mentah lewat `db.user.create` supaya uji ini hanya menguji
 * `changeDisplayName`, bukan modul pembuatan akun.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import { NAME_MAX_LENGTH } from "./validation";
import { changeDisplayName } from "./display-name";

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp.cleanup();
});

async function makeUser(name: string | null = null): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${id}@contoh.test`, name } });
  return id;
}

const nameOf = async (userId: string): Promise<string | null> =>
  (await db.user.findUniqueOrThrow({ where: { id: userId } })).name;

describe("changeDisplayName", () => {
  it("nama valid: dipangkas dan tersimpan", async () => {
    const userId = await makeUser();

    const result = await changeDisplayName(db, { userId, name: "  Budi Santoso  " });

    expect(result).toEqual({ ok: true, name: "Budi Santoso", reason: null });
    expect(await nameOf(userId)).toBe("Budi Santoso");
  });

  it("nama kosong atau spasi-saja: disimpan sebagai null", async () => {
    const userId = await makeUser("Nama Lama");

    const kosong = await changeDisplayName(db, { userId, name: "" });
    expect(kosong).toEqual({ ok: true, name: null, reason: null });
    expect(await nameOf(userId)).toBeNull();

    const spasi = await changeDisplayName(db, { userId, name: "   " });
    expect(spasi).toEqual({ ok: true, name: null, reason: null });
    expect(await nameOf(userId)).toBeNull();
  });

  it("nama tepat pada batas panjang: diterima", async () => {
    const userId = await makeUser();
    const pas = "a".repeat(NAME_MAX_LENGTH);

    const result = await changeDisplayName(db, { userId, name: pas });

    expect(result.ok).toBe(true);
    expect(await nameOf(userId)).toBe(pas);
  });

  it("nama terlalu panjang: ditolak dan nama lama tidak berubah", async () => {
    const userId = await makeUser("Nama Lama");
    const kepanjangan = "a".repeat(NAME_MAX_LENGTH + 1);

    const result = await changeDisplayName(db, { userId, name: kepanjangan });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain(String(NAME_MAX_LENGTH));
    expect(await nameOf(userId)).toBe("Nama Lama");
  });

  it("pengguna tidak ada: tidak melempar, ok false", async () => {
    const result = await changeDisplayName(db, { userId: randomUUID(), name: "Siapa Pun" });

    expect(result.ok).toBe(false);
    expect(result.name).toBeNull();
    expect(result.reason).toBeTruthy();
  });
});
