/**
 * Uji CRUD koneksi gateway (WP-NT-P2-02, REQ-NT-04, REQ-NT-07, REQ-NT-09,
 * REQ-NT-10, SDD-2.2, SDD-3.2).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts`: migrasi yang
 * dikirim repo dijalankan apa adanya, jadi uji ini sekaligus membuktikan
 * skema `Connection`/`ModelCache` benar-benar bisa dipakai jalur CRUD.
 *
 * Bukti inti:
 *   - hanya satu koneksi aktif (REQ-NT-10),
 *   - koneksi pertama otomatis aktif, koneksi kedua tidak (REQ-NT-10),
 *   - `skipTest` → `draft`, ubah key/baseUrl → kembali `draft` (REQ-NT-04, SDD-3.2),
 *   - daftar tidak pernah memuat ciphertext/key mentah (REQ-NT-07),
 *   - koneksi pengguna lain tak terlihat dan tak dapat diubah (SDD-3.1),
 *   - hapus koneksi hanya menyentuh `Connection`/`ModelCache` (REQ-NT-09).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { CONNECTION_API_KEY_PURPOSE, decryptSecret } from "@/lib/secrets";
import {
  activateConnection,
  createConnection,
  deleteConnection,
  getActiveConnection,
  listConnections,
  updateConnection,
} from "./connections";

const KEY = "sk-rahasia-panjang-sekali-abc1";
const BASE = "https://api.tokengateway.ai.id/v1";

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  await temp.cleanup();
});

/** Konfigurasi uji dengan kunci 32 byte nyata, sehingga enkripsi sungguhan
 *  dijalankan (bukan stub). */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    databaseUrl: "file::memory:",
    encryptionKey: Buffer.alloc(32, 7),
    encryptionKeyId: "v1",
    authSecret: "rahasia-sesi-uji",
    loginRateLimitMax: 5,
    loginRateLimitWindowSeconds: 900,
    passwordResetTtlSeconds: 3600,
    emailConfigured: false,
    modelCacheTtlSeconds: 600,
    outboundAllowlist: [],
    allowInsecureHttp: false,
    maxUploadBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

/** Baris `User` minimal; `Connection.userId` punya foreign key ke sini. */
async function makeUser(): Promise<string> {
  const id = randomUUID();
  await db.user.create({ data: { id, email: `${id}@contoh.test` } });
  return id;
}

function create(userId: string, overrides: Record<string, unknown> = {}) {
  return createConnection(db, makeConfig(), {
    userId,
    name: "Gateway Saya",
    baseUrl: BASE,
    apiKey: KEY,
    ...overrides,
  });
}

describe("createConnection", () => {
  it("koneksi PERTAMA otomatis aktif", async () => {
    const userId = await makeUser();
    const conn = await create(userId);

    expect(conn.isActive).toBe(true);
    expect(conn.status).toBe("active");
    // Di database tetap Int 1, bukan boolean (kontrak dibekukan).
    const row = await db.connection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(row.isActive).toBe(1);
  });

  it("koneksi KEDUA tidak mengambil alih koneksi aktif (REQ-NT-10)", async () => {
    const userId = await makeUser();
    const pertama = await create(userId);
    const kedua = await create(userId, { name: "Gateway Kedua" });

    expect(kedua.isActive).toBe(false);
    expect(pertama.isActive).toBe(true);

    const aktif = await getActiveConnection(db, userId);
    expect(aktif?.id).toBe(pertama.id);
    // Tepat satu baris aktif di database.
    expect(await db.connection.count({ where: { userId, isActive: 1 } })).toBe(1);
  });

  it("skipTest: true → status draft (REQ-NT-04)", async () => {
    const userId = await makeUser();
    const conn = await create(userId, { skipTest: true });
    expect(conn.status).toBe("draft");
    // Koneksi pertama tetap aktif walau draft: status dan keaktifan berbeda.
    expect(conn.isActive).toBe(true);
  });

  it("menormalkan baseUrl (trailing slash dibuang) lewat aturan tunggal url.ts", async () => {
    const userId = await makeUser();
    const conn = await create(userId, { baseUrl: `${BASE}///` });
    expect(conn.baseUrl).toBe(BASE);
  });

  it("menolak baseUrl http tanpa TLS saat allowInsecureHttp false", async () => {
    const userId = await makeUser();
    await expect(create(userId, { baseUrl: "http://api.contoh.test/v1" })).rejects.toMatchObject({
      status: 422,
      code: "BAD_SCHEME",
    });
  });

  it("menolak nama dan apiKey kosong", async () => {
    const userId = await makeUser();
    await expect(create(userId, { name: "  " })).rejects.toMatchObject({ code: "INVALID_NAME" });
    await expect(create(userId, { apiKey: "" })).rejects.toMatchObject({ code: "INVALID_API_KEY" });
  });
});

describe("updateConnection", () => {
  it("mengubah apiKey mengembalikan status ke draft (SDD-3.2)", async () => {
    const userId = await makeUser();
    const conn = await create(userId);
    expect(conn.status).toBe("active");

    const updated = await updateConnection(db, makeConfig(), userId, conn.id, {
      apiKey: "sk-kunci-baru-yang-panjang-xyz9",
    });

    expect(updated.status).toBe("draft");
    expect(updated.apiKeyMask).not.toBe(conn.apiKeyMask);
  });

  it("mengubah baseUrl mengembalikan status ke draft", async () => {
    const userId = await makeUser();
    const conn = await create(userId);

    const updated = await updateConnection(db, makeConfig(), userId, conn.id, {
      baseUrl: "https://gateway.lain.test/v1",
    });

    expect(updated.status).toBe("draft");
    expect(updated.baseUrl).toBe("https://gateway.lain.test/v1");
  });

  it("mengubah nama saja TIDAK mengubah status", async () => {
    const userId = await makeUser();
    const conn = await create(userId);

    const updated = await updateConnection(db, makeConfig(), userId, conn.id, {
      name: "Nama Baru",
    });

    expect(updated.name).toBe("Nama Baru");
    expect(updated.status).toBe("active");
  });

  it("patch isActive: true menonaktifkan koneksi aktif lain dalam satu transaksi", async () => {
    const userId = await makeUser();
    const pertama = await create(userId);
    const kedua = await create(userId, { name: "Gateway Kedua" });

    await updateConnection(db, makeConfig(), userId, kedua.id, { isActive: true });

    expect(await db.connection.count({ where: { userId, isActive: 1 } })).toBe(1);
    expect((await getActiveConnection(db, userId))?.id).toBe(kedua.id);
    const rowPertama = await db.connection.findUniqueOrThrow({ where: { id: pertama.id } });
    expect(rowPertama.isActive).toBe(0);
  });

  it("koneksi pengguna lain tidak dapat diubah → 404", async () => {
    const pemilik = await makeUser();
    const penyusup = await makeUser();
    const conn = await create(pemilik);

    await expect(
      updateConnection(db, makeConfig(), penyusup, conn.id, { name: "Dibajak" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });

    // Nama asli tidak berubah.
    const row = await db.connection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(row.name).toBe("Gateway Saya");
  });

  it("id yang tidak ada → 404", async () => {
    const userId = await makeUser();
    await expect(
      updateConnection(db, makeConfig(), userId, randomUUID(), { name: "X" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("activateConnection", () => {
  it("KRITIS: mengaktifkan koneksi kedua menonaktifkan koneksi pertama (REQ-NT-10)", async () => {
    const userId = await makeUser();
    const pertama = await create(userId);
    const kedua = await create(userId, { name: "Gateway Kedua" });

    const aktif = await activateConnection(db, userId, kedua.id);

    expect(aktif.isActive).toBe(true);
    expect(await db.connection.count({ where: { userId, isActive: 1 } })).toBe(1);
    expect((await db.connection.findUniqueOrThrow({ where: { id: pertama.id } })).isActive).toBe(0);
    expect((await getActiveConnection(db, userId))?.id).toBe(kedua.id);
  });

  it("koneksi milik pengguna lain tidak dapat diaktifkan → 404", async () => {
    const pemilik = await makeUser();
    const penyusup = await makeUser();
    const conn = await create(pemilik);

    await expect(activateConnection(db, penyusup, conn.id)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    // Koneksi aktif pemilik tidak terganggu.
    expect(await db.connection.count({ where: { userId: pemilik, isActive: 1 } })).toBe(1);
  });

  it("aktivasi tidak mengubah koneksi milik pengguna LAIN", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const connA = await create(a);
    const connB = await create(b);

    await activateConnection(db, b, connB.id);

    expect(await db.connection.count({ where: { userId: a, isActive: 1 } })).toBe(1);
    expect((await getActiveConnection(db, a))?.id).toBe(connA.id);
  });
});

describe("getActiveConnection", () => {
  it("null bila pengguna belum punya koneksi aktif", async () => {
    const userId = await makeUser();
    expect(await getActiveConnection(db, userId)).toBeNull();
  });
});

describe("deleteConnection (REQ-NT-09)", () => {
  it("menghapus baris koneksi dan cache modelnya, TANPA menyentuh tabel lain", async () => {
    const userId = await makeUser();
    const conn = await create(userId);
    await db.modelCache.create({
      data: { id: randomUUID(), connectionId: conn.id, modelListJson: "[]", fetchedAt: new Date() },
    });

    // Catat jumlah baris tabel non-koneksi sebelum penghapusan.
    const sebelum = {
      users: await db.user.count(),
      sessions: await db.session.count(),
      jobs: await db.job.count(),
    };

    await deleteConnection(db, userId, conn.id);

    expect(await db.connection.count({ where: { id: conn.id } })).toBe(0);
    // Cache ikut terhapus lewat ON DELETE CASCADE.
    expect(await db.modelCache.count({ where: { connectionId: conn.id } })).toBe(0);
    // Tidak ada tabel lain yang tersentuh. Pada fase ini tabel `Chat` belum
    // ada (NT-P3); jaminannya struktural — fungsi ini hanya menghapus dari
    // `Connection`, sehingga tidak mungkin menyentuh riwayat chat.
    expect({
      users: await db.user.count(),
      sessions: await db.session.count(),
      jobs: await db.job.count(),
    }).toEqual(sebelum);
  });

  it("koneksi pengguna lain tidak dapat dihapus → 404", async () => {
    const pemilik = await makeUser();
    const penyusup = await makeUser();
    const conn = await create(pemilik);

    await expect(deleteConnection(db, penyusup, conn.id)).rejects.toMatchObject({ status: 404 });
    expect(await db.connection.count({ where: { id: conn.id } })).toBe(1);
  });

  it("menghapus koneksi aktif menyisakan pengguna tanpa koneksi aktif", async () => {
    const userId = await makeUser();
    const conn = await create(userId);
    await deleteConnection(db, userId, conn.id);
    expect(await getActiveConnection(db, userId)).toBeNull();
  });
});

describe("sanitasi respons (REQ-NT-07)", () => {
  it("daftar tidak pernah memuat ciphertext atau key mentah", async () => {
    const userId = await makeUser();
    await create(userId);
    await create(userId, { name: "Gateway Kedua", apiKey: "sk-kedua-panjang-sekali-abc2" });

    const list = await listConnections(db, userId);
    const serialized = JSON.stringify(list);

    expect(serialized).not.toContain(KEY);
    expect(serialized).not.toContain("sk-kedua-panjang-sekali-abc2");
    // Tidak ada kunci envelope sama sekali.
    expect(serialized).not.toContain("apiKeyEncrypted");
    expect(serialized).not.toContain("v1:");

    for (const conn of list) {
      expect(Object.keys(conn).sort()).toEqual(
        ["apiKeyMask", "baseUrl", "id", "isActive", "lastTestStatus", "name", "status"].sort(),
      );
      // Mask menyembunyikan isi kunci: hanya awalan skema dan 4 karakter terakhir.
      expect(conn.apiKeyMask).toMatch(/^sk-\.\.\.\w{4}$/);
      expect(conn.apiKeyMask).not.toContain("rahasia");
    }
  });

  it("ciphertext terikat baris: AAD dengan userId lain tidak dapat didekripsi", async () => {
    const userId = await makeUser();
    const conn = await create(userId);

    // Baca ciphertext mentah langsung dari database (hanya di uji).
    const row = await db.connection.findUniqueOrThrow({ where: { id: conn.id } });

    // AAD benar → berhasil.
    expect(
      decryptSecret({
        envelope: row.apiKeyEncrypted,
        key: makeConfig().encryptionKey,
        aad: { rowId: conn.id, userId, purpose: CONNECTION_API_KEY_PURPOSE },
      }),
    ).toBe(KEY);

    // AAD dengan userId lain → ditolak.
    expect(() =>
      decryptSecret({
        envelope: row.apiKeyEncrypted,
        key: makeConfig().encryptionKey,
        aad: { rowId: conn.id, userId: "pengguna-lain", purpose: CONNECTION_API_KEY_PURPOSE },
      }),
    ).toThrow();
  });
});
