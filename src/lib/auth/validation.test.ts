/**
 * Uji validasi input autentikasi (REQ-NT-11, SDD-5.1).
 *
 * Uji murni fungsional: tidak menyentuh database atau env.
 */

import { describe, expect, it } from "vitest";
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  validateRegister,
} from "./validation";
import { MIN_PASSWORD_LENGTH } from "./password";

describe("validateEmail", () => {
  it("menerima email wajar", () => {
    expect(validateEmail("budi@contoh.com")).toBeNull();
    expect(validateEmail("  Budi@Contoh.COM  ")).toBeNull();
  });

  it("menolak email kosong", () => {
    expect(validateEmail("")).toBe("Email wajib diisi.");
    expect(validateEmail("   ")).toBe("Email wajib diisi.");
  });

  it("menolak email dengan format salah", () => {
    expect(validateEmail("bukan-email")).toBe("Format email tidak valid.");
    expect(validateEmail("@contoh.com")).toBe("Format email tidak valid.");
    expect(validateEmail("budi@")).toBe("Format email tidak valid.");
  });

  it("menolak email melebihi batas panjang", () => {
    const long = "a".repeat(EMAIL_MAX_LENGTH - 10) + "@contoh.com";
    expect(long.length).toBeGreaterThan(EMAIL_MAX_LENGTH);
    expect(validateEmail(long)).toBe("Email terlalu panjang.");
  });
});

describe("validateName", () => {
  it("menerima nama kosong/opsional", () => {
    expect(validateName("")).toBeNull();
    expect(validateName("   ")).toBeNull();
    expect(validateName(undefined)).toBeNull();
    expect(validateName(null)).toBeNull();
  });

  it("menerima nama wajar", () => {
    expect(validateName("Budi Santoso")).toBeNull();
  });

  it("menolak nama terlalu panjang", () => {
    expect(validateName("a".repeat(NAME_MAX_LENGTH + 1))).toBe("Nama terlalu panjang.");
  });
});

describe("validatePassword", () => {
  it("menerima kata sandi cukup panjang", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(validatePassword("kata-sandi-yang-panjang")).toBeNull();
  });

  it("menolak kata sandi kosong", () => {
    expect(validatePassword("")).toBe("Kata sandi wajib diisi.");
  });

  it("menolak kata sandi kurang dari MIN_PASSWORD_LENGTH", () => {
    const error = validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1));
    expect(error).toContain(String(MIN_PASSWORD_LENGTH));
  });
});

describe("validateLogin", () => {
  it("sukses untuk kredensial wajar", () => {
    expect(
      validateLogin({ email: "budi@contoh.com", password: "kata-sandi-panjang" }),
    ).toEqual({ success: true, errors: {} });
  });

  it("gagal bila email dan sandi kosong", () => {
    const result = validateLogin({ email: "", password: "" });
    expect(result.success).toBe(false);
    expect(result.errors.email).toBe("Email wajib diisi.");
    expect(result.errors.password).toBe("Kata sandi wajib diisi.");
  });

  it("gagal bila email tidak valid", () => {
    const result = validateLogin({ email: "salah", password: "kata-sandi-panjang" });
    expect(result.success).toBe(false);
    expect(result.errors.email).toBe("Format email tidak valid.");
  });
});

describe("validateRegister", () => {
  it("sukses untuk input wajar tanpa nama", () => {
    const result = validateRegister({
      email: "budi@contoh.com",
      password: "kata-sandi-panjang",
      confirmPassword: "kata-sandi-panjang",
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("sukses untuk input wajar dengan nama", () => {
    const result = validateRegister({
      email: "budi@contoh.com",
      name: "Budi",
      password: "kata-sandi-panjang",
      confirmPassword: "kata-sandi-panjang",
    });
    expect(result.success).toBe(true);
  });

  it("gagal bila semua kosong", () => {
    const result = validateRegister({
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
    });
    expect(result.success).toBe(false);
    expect(result.errors.email).toBe("Email wajib diisi.");
    expect(result.errors.password).toBe("Kata sandi wajib diisi.");
    expect(result.errors.confirmPassword).toBe("Kata sandi tidak cocok.");
  });

  it("gagal bila konfirmasi tidak cocok", () => {
    const result = validateRegister({
      email: "budi@contoh.com",
      password: "kata-sandi-panjang",
      confirmPassword: "kata-sandi-lain",
    });
    expect(result.success).toBe(false);
    expect(result.errors.confirmPassword).toBe("Kata sandi tidak cocok.");
  });

  it("gagal bila nama terlalu panjang", () => {
    const result = validateRegister({
      email: "budi@contoh.com",
      name: "a".repeat(NAME_MAX_LENGTH + 1),
      password: "kata-sandi-panjang",
      confirmPassword: "kata-sandi-panjang",
    });
    expect(result.success).toBe(false);
    expect(result.errors.name).toBe("Nama terlalu panjang.");
  });

  it("menggunakan MIN_PASSWORD_LENGTH sebagai batas minimal", () => {
    const result = validateRegister({
      email: "budi@contoh.com",
      password: "a".repeat(MIN_PASSWORD_LENGTH - 1),
      confirmPassword: "a".repeat(MIN_PASSWORD_LENGTH - 1),
    });
    expect(result.success).toBe(false);
    expect(result.errors.password).toBe(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  });
});
