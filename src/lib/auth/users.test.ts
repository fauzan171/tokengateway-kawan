/**
 * Uji pembuatan akun dan muat ulang identitas (SDD-5.1, REQ-NT-11, REQ-NT-12).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts`: migrasi dijalankan
 * apa adanya dari `prisma/migrations/sqlite`, jadi uji ini sekaligus
 * membuktikan skema yang dikirim bisa dipakai `createUser`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createUser, findUserById, normalizeEmail } from "./users";
import { countRows, createTempDb, type TempDb } from "../../../tests/helpers/auth-db";

let temp: TempDb | null = null;

/** Database baru per uji supaya hitungan baris tidak terpengaruh uji lain. */
async function dbBaru(): Promise<TempDb> {
  temp = await createTempDb();
  return temp;
}

afterEach(async () => {
  await temp?.cleanup();
  temp = null;
});

describe("normalizeEmail", () => {
  it("memangkas spasi dan menurunkan huruf", () => {
    expect(normalizeEmail("  Budi@Contoh.COM ")).toBe("budi@contoh.com");
  });
});

describe("createUser", () => {
  it("pengguna pertama menjadi admin dan active", async () => {
    const { db } = await dbBaru();

    const id = await createUser(db, {
      email: "  Budi@Contoh.COM ",
      password: "kata-sandi-yang-panjang",
    });
    expect(id).not.toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { id: id! } });
    expect(user.role).toBe("admin");
    expect(user.status).toBe("active");
    // Email tersimpan sudah ternormalisasi.
    expect(user.email).toBe("budi@contoh.com");
  });

  it("pengguna kedua menjadi user dan pending", async () => {
    const { db } = await dbBaru();

    await createUser(db, { email: "pertama@contoh.com", password: "kata-sandi-yang-panjang" });
    const id = await createUser(db, {
      email: "kedua@contoh.com",
      password: "kata-sandi-yang-panjang",
    });

    const user = await db.user.findUniqueOrThrow({ where: { id: id! } });
    expect(user.role).toBe("user");
    expect(user.status).toBe("pending");
  });

  it("email duplikat mengembalikan null dan tidak menambah baris", async () => {
    const { db } = await dbBaru();

    const pertama = await createUser(db, {
      email: "budi@contoh.com",
      password: "kata-sandi-yang-panjang",
    });
    expect(pertama).not.toBeNull();

    const sebelum = await countRows(db);

    // Duplikat dengan kapitalisasi dan spasi berbeda: tetap ditolak.
    const kedua = await createUser(db, {
      email: "  BUDI@Contoh.com ",
      password: "kata-sandi-lain-yang-panjang",
    });

    expect(kedua).toBeNull();
    expect(await countRows(db)).toEqual(sebelum);
  });
});

describe("findUserById", () => {
  it("mengembalikan bentuk yang benar untuk id yang ada, null untuk yang tidak ada", async () => {
    const { db } = await dbBaru();

    const id = await createUser(db, {
      email: "budi@contoh.com",
      password: "kata-sandi-yang-panjang",
      name: "  Budi  ",
    });

    const user = await findUserById(db, id!);
    expect(user).toEqual({
      id: id!,
      email: "budi@contoh.com",
      name: "Budi",
      role: "admin",
      status: "active",
    });

    expect(await findUserById(db, "id-yang-tidak-ada")).toBeNull();
  });

  it("tidak membocorkan passwordHash", async () => {
    const { db } = await dbBaru();

    const id = await createUser(db, {
      email: "budi@contoh.com",
      password: "kata-sandi-yang-panjang",
    });

    const user = await findUserById(db, id!);
    expect(user).not.toBeNull();
    expect(user).not.toHaveProperty("credential");
    expect(user).not.toHaveProperty("passwordHash");
    expect(Object.keys(user!).sort()).toEqual(["email", "id", "name", "role", "status"]);
  });
});

describe("admin pertama atomik (REQ-NT-12)", () => {
  it("dua registrasi bersamaan tidak menghasilkan dua admin", async () => {
    const { db } = await dbBaru();

    // Kedua registrasi dimulai tanpa await di antaranya, jadi keduanya berada
    // "di udara" pada saat yang sama.
    const hasil = await Promise.allSettled([
      createUser(db, { email: "a@contoh.com", password: "kata-sandi-yang-panjang" }),
      createUser(db, { email: "b@contoh.com", password: "kata-sandi-yang-panjang" }),
    ]);

    // Tidak ada yang melempar: `createUser` mengubah bentrok email (P2002)
    // menjadi `null`, bukan error.
    expect(hasil.every((h) => h.status === "fulfilled")).toBe(true);

    // Inti REQ-NT-12: berapa pun pemenangnya, admin hanya satu.
    expect(await db.user.count({ where: { role: "admin" } })).toBe(1);

    // Hasil yang teramati: KEDUANYA berhasil (`fulfilled` dengan id), dua
    // baris `User`, satu `admin`/`active` dan satu `user`/`pending`. Yang kalah
    // bukan `null` di sini karena emailnya berbeda.
    expect(hasil.filter((h) => h.status === "fulfilled" && h.value !== null)).toHaveLength(2);
    expect(await db.user.count()).toBe(2);

    // Batas kejujuran uji ini: better-sqlite3 men-serialkan seluruh tulisan,
    // jadi `Promise.all` di atas TIDAK benar-benar menjalankan dua transaksi
    // secara paralel — keduanya dieksekusi berurutan. Yang dibuktikan uji ini
    // hanyalah: pada eksekusi berurutan, logika `isFirst` tetap menetapkan
    // admin tepat sekali. Ini BUKAN bukti bahwa isolasi transaksi PostgreSQL
    // (dua transaksi benar-benar bersamaan) aman; itu butuh uji terhadap
    // Postgres asli dan belum dicakup di sini.
  });

  it("dua registrasi dengan email sama: tepat satu baris", async () => {
    const { db } = await dbBaru();

    const hasil = await Promise.all([
      createUser(db, { email: "sama@contoh.com", password: "kata-sandi-yang-panjang" }),
      createUser(db, { email: "sama@contoh.com", password: "kata-sandi-yang-panjang" }),
    ]);

    // Teramati: `[null, "<id>"]` — satu menang, satu dikembalikan `null` lewat
    // jalur P2002. Karena SQLite men-serialkan tulisan, ini sesungguhnya
    // eksekusi berurutan, bukan balapan sungguhan; yang dibuktikan adalah
    // tidak ada baris ganda untuk email yang sama.
    expect(hasil.filter((v) => v !== null)).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });
});
