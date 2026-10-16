/**
 * Registry konfigurasi runtime.
 *
 * Validasi dijalankan `loadConfig()` saat server start (dipanggil dari
 * `src/instrumentation.ts`), bukan saat modul di-import. `next build`
 * meng-import modul tanpa env runtime, jadi gagal saat import akan merusak
 * build; SDD-1.5 meminta aplikasi gagal *start*.
 *
 * Hanya variabel yang sudah punya konsumen nyata masuk registry ini.
 * Sisa variabel SDD-1.5 ditambahkan bersama paket yang memakainya.
 */

export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Konfigurasi tidak valid:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

export type Config = {
  databaseUrl: string;
  /** 32 byte ter-decode, siap dipakai AES-256-GCM. */
  encryptionKey: Buffer;
  /** Kunci penandatanganan cookie sesi Auth.js. Bukan kunci enkripsi:
   *  panjang apa pun diterima selama tidak kosong (SDD-5.1). */
  authSecret: string;
  /** Jumlah percobaan login gagal yang diizinkan per jendela (REQ-NT-15). */
  loginRateLimitMax: number;
  /** Panjang jendela rate limit login, dalam detik. */
  loginRateLimitWindowSeconds: number;
  /** Masa berlaku tautan reset kata sandi, dalam detik (REQ-NT-16). */
  passwordResetTtlSeconds: number;
  /**
   * Penanda apakah operator sudah mengonfigurasi email (REQ-NT-16, SDD-1.5).
   *
   * PENGIRIMAN EMAIL BELUM DIBANGUN DI v1: tidak ada kode yang mengirim pesan
   * apa pun. Penanda ini hanya memberi tahu UI dan log bahwa operator berniat
   * memakai email, sehingga alur reset bisa memilih cara menyampaikan tautan.
   * Saat `false`, tautan ditulis ke log admin supaya operator dapat
   * meneruskannya; UI mengatakan keadaan itu apa adanya, tanpa menjanjikan
   * email terkirim.
   */
  emailConfigured: boolean;
};

type Env = Record<string, string | undefined>;

const KEY_BYTES = 32;

/** Bawaan aman bila operator tidak mengatur apa pun: 5 percobaan per 15 menit. */
export const DEFAULT_LOGIN_RATE_LIMIT_MAX = 5;
export const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

/** Bawaan masa berlaku tautan reset: 60 menit. */
export const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 60 * 60;

/**
 * Variabel yang menandai email sudah dikonfigurasi operator (SDD-1.5).
 *
 * v1 belum punya pengirim email, jadi tidak ada variabel yang benar-benar
 * dipakai untuk mengirim. Daftar ini hanya mengenali niat operator lewat nama
 * variabel yang lazim, supaya alur reset bisa memilih cara menyampaikan tautan.
 */
const EMAIL_ENV_NAMES = ["KAWAN_SMTP_URL", "SMTP_HOST"] as const;

/** Base64 apa adanya. `Buffer.from` membuang karakter asing diam-diam, jadi
 *  hasil decode di-encode ulang dan dibandingkan sebelum dipercaya. */
function decodeBase64(raw: string): Buffer | null {
  const s = raw.trim();
  if (s === "") return null;
  const buf = Buffer.from(s, "base64");
  if (buf.toString("base64").replace(/=+$/, "") !== s.replace(/=+$/, "")) return null;
  return buf;
}

function checkEncryptionSecret(raw: string | undefined, problems: string[]): Buffer {
  if (raw === undefined || raw.trim() === "") {
    problems.push(
      "ENCRYPTION_SECRET wajib diisi: kunci AES-256-GCM, 32 byte ter-decode (base64 dari 32 byte acak).",
    );
    return Buffer.alloc(0);
  }
  const key = decodeBase64(raw);
  if (key === null) {
    problems.push("ENCRYPTION_SECRET bukan base64 yang valid.");
    return Buffer.alloc(0);
  }
  if (key.length !== KEY_BYTES) {
    problems.push(
      `ENCRYPTION_SECRET harus 32 byte setelah decode, dapat ${key.length} byte.`,
    );
    return Buffer.alloc(0);
  }
  return key;
}

/** Auth.js menerima string apa pun yang tidak kosong sebagai `AUTH_SECRET`;
 *  aturan 32 byte hanya berlaku untuk `ENCRYPTION_SECRET`. */
function checkAuthSecret(raw: string | undefined, problems: string[]): string {
  const secret = raw?.trim();
  if (!secret) {
    problems.push(
      "AUTH_SECRET wajib diisi: kunci penandatanganan cookie sesi (mis. `openssl rand -base64 32`).",
    );
    return "";
  }
  return secret;
}

/** Bilangan bulat positif untuk variabel batas. Kosong → bawaan aman; nilai
 *  rusak (bukan angka, nol, negatif, pecahan) → masalah, agar salah ketik
 *  tidak diam-diam melumpuhkan batas. */
function checkPositiveInt(
  raw: string | undefined,
  fallback: number,
  name: string,
  problems: string[],
): number {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === "") return fallback;
  // `Number` menerima "1e3", " 5 ", "0x10", dan Infinity; regex ini menolaknya
  // sehingga hanya bilangan bulat desimal positif yang lolos.
  if (!/^\d+$/.test(trimmed)) {
    problems.push(`${name} harus bilangan bulat positif, dapat "${trimmed}".`);
    return fallback;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) {
    problems.push(`${name} harus bilangan bulat positif, dapat "${trimmed}".`);
    return fallback;
  }
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];

  const databaseUrl = env["DATABASE_URL"]?.trim();
  if (!databaseUrl) {
    problems.push("DATABASE_URL wajib diisi (SQLite dev: file:./dev.db, produksi: postgresql://...).");
  }

  const encryptionKey = checkEncryptionSecret(env["ENCRYPTION_SECRET"], problems);
  const authSecret = checkAuthSecret(env["AUTH_SECRET"], problems);

  const loginRateLimitMax = checkPositiveInt(
    env["LOGIN_RATE_LIMIT_MAX"],
    DEFAULT_LOGIN_RATE_LIMIT_MAX,
    "LOGIN_RATE_LIMIT_MAX",
    problems,
  );
  const loginRateLimitWindowSeconds = checkPositiveInt(
    env["LOGIN_RATE_LIMIT_WINDOW_SECONDS"],
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
    problems,
  );

  const passwordResetTtlSeconds = checkPositiveInt(
    env["PASSWORD_RESET_TTL_SECONDS"],
    DEFAULT_PASSWORD_RESET_TTL_SECONDS,
    "PASSWORD_RESET_TTL_SECONDS",
    problems,
  );

  // Salah satu variabel email terisi (tidak hanya spasi) = operator sudah
  // mengonfigurasi email. Tidak ada validasi lebih jauh karena v1 belum
  // menghubungi server mana pun.
  const emailConfigured = EMAIL_ENV_NAMES.some((name) => (env[name] ?? "").trim() !== "");

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    databaseUrl: databaseUrl as string,
    encryptionKey,
    authSecret,
    loginRateLimitMax,
    loginRateLimitWindowSeconds,
    passwordResetTtlSeconds,
    emailConfigured,
  };
}
