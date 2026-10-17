/**
 * Uji mask kunci rahasia (SDD-5.2, REQ-NT-07).
 *
 * Mask adalah satu-satunya bentuk kunci yang boleh sampai ke UI. Uji ini
 * memastikan bentuknya benar dan isi di luar awalan + 4 karakter terakhir
 * tidak bocor.
 */

import { describe, expect, it } from "vitest";
import { FULLY_MASKED, maskSecret } from "./mask";

describe("maskSecret", () => {
  it("memakai bentuk awalan + ... + 4 karakter terakhir", () => {
    expect(maskSecret("sk-CONTOH-BUKAN-KUNCI-abc1")).toBe("sk-...abc1");
    expect(maskSecret("gsk-0123456789xyz9")).toBe("gsk-...xyz9");
  });

  it("hanya menampilkan awalan dan ekor, bukan isi tengah", () => {
    const rahasia = "sk-TENGAH-RAHASIA-9f4b1c7e-abc1";
    const hasil = maskSecret(rahasia);

    expect(hasil.startsWith("sk-")).toBe(true);
    expect(hasil.endsWith("abc1")).toBe(true);
    // Potongan tengah tidak boleh muncul.
    expect(hasil).not.toContain("TENGAH");
    expect(hasil).not.toContain("RAHASIA");
    expect(hasil).not.toContain("9f4b1c7e");
  });

  it("kunci tanpa skema tetap termask sebagian", () => {
    // Tanpa tanda hubung: 4 karakter pertama + 4 terakhir.
    expect(maskSecret("abcdefghijklmnopqrst")).toBe("abcd...qrst");
  });

  it("kunci pendek tidak membocorkan sebagian besar isinya", () => {
    // 4 karakter: seluruhnya akan terlihat bila dipotong biasa.
    expect(maskSecret("abc1")).toBe(FULLY_MASKED);
    expect(maskSecret("abc1")).not.toContain("abc1");
    // Di bawah ambang panjang: bentuk aman.
    expect(maskSecret("sk-abc1")).toBe(FULLY_MASKED);
  });

  it("string kosong dan bukan string → bentuk aman", () => {
    expect(maskSecret("")).toBe(FULLY_MASKED);
    expect(maskSecret(undefined as unknown as string)).toBe(FULLY_MASKED);
  });

  it("tidak pernah menampilkan separuh kunci atau lebih", () => {
    for (const panjang of [0, 1, 4, 8, 11, 12, 15]) {
      const kunci = "k".repeat(panjang);
      const hasil = maskSecret(kunci);
      const terlihat = hasil.replace(/[.•]/g, "").length;
      expect(terlihat).toBeLessThan(Math.max(panjang, 1) / 2);
    }
  });
});
