/**
 * Validasi input autentikasi bersama form dan API (REQ-NT-11, SDD-5.1).
 *
 * Fungsi murni di bawah dipakai oleh halaman klien (masuk/daftar) dan endpoint
 * `/api/register` agar satu sumber kebenaran memutuskan validitas input.
 * Semua pesan dalam bahasa Indonesia.
 */

import { MIN_PASSWORD_LENGTH } from "./password";

/** Batas panjang yang diterima input teks. */
export const EMAIL_MAX_LENGTH = 254; // RFC 5321
export const NAME_MAX_LENGTH = 100;

/** Hasil validasi; bila `success` true, `errors` kosong. */
export type ValidationResult = {
  success: boolean;
  errors: Record<string, string>;
};

/** Bentuk request pendaftaran dari form UI dan API. */
export type RegisterInput = {
  email: string;
  name?: string | null;
  password: string;
  confirmPassword: string;
};

/** Bentuk request masuk dari form UI. */
export type LoginInput = {
  email: string;
  password: string;
};

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Memvalidasi format dan panjang email.
 * Mengembalikan pesan galat dalam bahasa Indonesia, atau null bila valid.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Email wajib diisi.";
  if (trimmed.length > EMAIL_MAX_LENGTH) return "Email terlalu panjang.";
  if (!EMAIL_RE.test(trimmed)) return "Format email tidak valid.";
  return null;
}

/**
 * Memvalidasi nama tampilan (opsional).
 */
export function validateName(name?: string | null): string | null {
  if (name === undefined || name === null || name.trim() === "") return null;
  if (name.length > NAME_MAX_LENGTH) return "Nama terlalu panjang.";
  return null;
}

/**
 * Memvalidasi kata sandi memakai konstanta MIN_PASSWORD_LENGTH dari modul
 * password agar tidak ada duplikasi nilai batas.
 */
export function validatePassword(password: string): string | null {
  if (!password) return "Kata sandi wajib diisi.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  return null;
}

/**
 * Validasi lengkap untuk form masuk.
 */
export function validateLogin(input: LoginInput): ValidationResult {
  const errors: Record<string, string> = {};
  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;
  if (!input.password) errors.password = "Kata sandi wajib diisi.";
  return { success: Object.keys(errors).length === 0, errors };
}

/**
 * Validasi lengkap untuk pendaftaran. Kata sandi dan konfirmasi harus cocok.
 */
export function validateRegister(input: RegisterInput): ValidationResult {
  const errors: Record<string, string> = {};

  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;

  const nameError = validateName(input.name);
  if (nameError) errors.name = nameError;

  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;

  // Kosong juga dihitung tidak cocok: tanpa cabang ini, dua string kosong
  // dianggap "sama" dan kolom konfirmasi lolos tanpa pesan galat.
  if (!input.confirmPassword || input.password !== input.confirmPassword) {
    errors.confirmPassword = "Kata sandi tidak cocok.";
  }

  return { success: Object.keys(errors).length === 0, errors };
}
