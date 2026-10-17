/**
 * Uji hash dan verifikasi kata sandi (SDD-5.1, REQ-NT-11).
 *
 * Semua uji di sini murni fungsi: tidak menyentuh database. Parameter Argon2id
 * diuji sebagai konstanta karena nilainya adalah kontrak keamanan (OWASP).
 */

import { describe, expect, it } from "vitest";
import { ARGON2, MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "./password";

const KATA_SANDI = "kata-sandi-yang-panjang";

describe("hashPassword", () => {
  it("menghasilkan string berawalan $argon2id$ dan bukan kata sandi mentah", async () => {
    const hasil = await hashPassword(KATA_SANDI);

    expect(hasil.startsWith("$argon2id$")).toBe(true);
    expect(hasil).not.toBe(KATA_SANDI);
    expect(hasil).not.toContain(KATA_SANDI);
  });

  it("dua panggilan untuk kata sandi sama menghasilkan hash berbeda (salt acak)", async () => {
    const pertama = await hashPassword(KATA_SANDI);
    const kedua = await hashPassword(KATA_SANDI);

    // Salt acak: hash tidak boleh identik, tetapi keduanya tetap sah.
    expect(pertama).not.toBe(kedua);
    expect(await verifyPassword(pertama, KATA_SANDI)).toBe(true);
    expect(await verifyPassword(kedua, KATA_SANDI)).toBe(true);
  });
});

describe("verifyPassword", () => {
  it("mengembalikan false untuk kata sandi yang salah", async () => {
    const hash = await hashPassword(KATA_SANDI);

    expect(await verifyPassword(hash, "kata-sandi-yang-salah")).toBe(false);
    // Beda hanya pada kapitalisasi tetap dianggap salah.
    expect(await verifyPassword(hash, KATA_SANDI.toUpperCase())).toBe(false);
  });

  it("mengembalikan false, bukan melempar, untuk hash rusak", async () => {
    const valid = await hashPassword(KATA_SANDI);

    // 1. String acak yang sama sekali bukan hash.
    await expect(verifyPassword("ini-bukan-hash", KATA_SANDI)).resolves.toBe(false);

    // 2. String kosong.
    await expect(verifyPassword("", KATA_SANDI)).resolves.toBe(false);

    // 3. Hash sah yang dipotong separuh.
    const dipotong = valid.slice(0, Math.floor(valid.length / 2));
    await expect(verifyPassword(dipotong, KATA_SANDI)).resolves.toBe(false);

    // 4. Hash kosong: tetap false, tidak melempar.
    await expect(verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$", KATA_SANDI)).resolves.toBe(false);
  });

  it("kata sandi non-ASCII tetap lolos verifikasi", async () => {
    const nonAscii = "sandi-rahasia-ü-日本語";
    const hash = await hashPassword(nonAscii);

    expect(await verifyPassword(hash, nonAscii)).toBe(true);
    expect(await verifyPassword(hash, "sandi-rahasia-u-日本語")).toBe(false);
  });
});

describe("konstanta", () => {
  it("ARGON2 sesuai rekomendasi OWASP dan MIN_PASSWORD_LENGTH = 12", () => {
    expect(ARGON2.memoryCost).toBe(19_456);
    expect(ARGON2.timeCost).toBe(2);
    expect(ARGON2.parallelism).toBe(1);
    expect(MIN_PASSWORD_LENGTH).toBe(12);
  });
});
