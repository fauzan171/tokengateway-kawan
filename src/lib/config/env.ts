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
  /**
   * ID kunci untuk envelope dan rotasi (SDD-5.2).
   *
   * Envelope menyimpan keyId ini, sehingga ciphertext lama tetap terbaca
   * setelah kunci berganti. Rotasi menambah keyId baru lalu pensiunkan yang
   * lama — lihat `src/lib/secrets/README.md`.
   */
  encryptionKeyId: string;
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
  /**
   * Masa berlaku cache daftar model, dalam detik (REQ-NT-20, SDD-3.3).
   *
   * Cache tidak boleh menahan model baru melewati TTL ini. Dihitung dari
   * `fetchedAt` di DATA, bukan timer proses, sehingga restart tidak
   * memperpanjang umur cache.
   */
  modelCacheTtlSeconds: number;
  /**
   * Gateway bawaan yang disediakan operator (mis. 9Router di VPS ini).
   *
   * Diisi `DEFAULT_GATEWAY_URL` + `DEFAULT_GATEWAY_KEY`. Bila kosong, tombol
   * "Pakai langganan" tidak ditampilkan dan formulir hanya menerima isian
   * manual. Key disimpan di server dan TIDAK pernah dikirim ke browser;
   * koneksi yang dibuat lewat jalur ini memakai key itu saat mengobrol.
   */
  defaultGateway?: { baseUrl: string; apiKey: string } | null;
  /**
   * Host yang diizinkan operator sebagai tujuan keluar, di luar aturan SSRF
   * bawaan (SDD-5.3).
   *
   * Dipakai untuk gateway privat on-premise (mis. rentang `10.x`). Sengaja
   * berupa allowlist presisi `host` atau `host:port`, BUKAN cara melonggarkan
   * aturan global: tanpa isi, seluruh rentang privat tetap ditolak.
   */
  outboundAllowlist: readonly string[];
  /**
   * Apakah `http://` (tanpa TLS) diizinkan sebagai baseUrl gateway (SDD-5.3).
   *
   * Bawaan `false`: hanya `https`. Operator yang menjalankan gateway di
   * jaringan lokal dapat menyalakannya secara sadar.
   */
  allowInsecureHttp: boolean;
  /** Batas ukuran berkas dokumen yang boleh diunggah, dalam byte (REQ-NT-60). */
  maxUploadBytes: number;
};

type Env = Record<string, string | undefined>;

const KEY_BYTES = 32;

/** Bawaan aman bila operator tidak mengatur apa pun: 5 percobaan per 15 menit. */
export const DEFAULT_LOGIN_RATE_LIMIT_MAX = 5;
export const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

/** Bawaan masa berlaku tautan reset: 60 menit. */
export const DEFAULT_PASSWORD_RESET_TTL_SECONDS = 60 * 60;

/** Bawaan masa berlaku cache daftar model: 10 menit (REQ-NT-20). */
export const DEFAULT_MODEL_CACHE_TTL_SECONDS = 10 * 60;

/** Bawaan batas unggah dokumen: 10 MB (REQ-NT-60). */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** ID kunci bawaan saat operator belum mengatur rotasi (SDD-5.2). */
export const DEFAULT_ENCRYPTION_KEY_ID = "v1";

/** Pemisah daftar pada variabel yang menerima banyak nilai. */
const LIST_SEPARATOR = ",";

/**
 * Daftar host allowlist (SDD-5.3).
 *
 * Nilai dipisah koma, dipangkas, huruf kecil, dan kosong dibuang. Tidak ada
 * wildcard: allowlist ini untuk host atau `host:port` presisi, bukan cara
 * melonggarkan seluruh rentang privat.
 */
function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(LIST_SEPARATOR)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== "");
}

/**
 * Gateway bawaan operator. Keduanya wajib terisi bersama: URL tanpa key akan
 * gagal di provider, key tanpa URL tidak punya tujuan.
 */
function parseDefaultGateway(
  env: Env,
  problems: string[],
): { baseUrl: string; apiKey: string } | null {
  const baseUrl = (env["DEFAULT_GATEWAY_URL"] ?? "").trim();
  const apiKey = (env["DEFAULT_GATEWAY_KEY"] ?? "").trim();
  if (baseUrl === "" && apiKey === "") return null;
  if (baseUrl === "" || apiKey === "") {
    problems.push("DEFAULT_GATEWAY_URL dan DEFAULT_GATEWAY_KEY harus diisi bersama.");
    return null;
  }
  return { baseUrl, apiKey };
}

/** Penanda boolean dari env. Hanya `"true"`/`"1"` yang menyalakan; nilai lain
 *  (termasuk kosong dan salah ketik) berarti mati, karena variabel ini
 *  MELONGGARKAN aturan keamanan — gagal ke arah yang aman. */
function checkBoolean(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "true" || value === "1";
}

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

  const modelCacheTtlSeconds = checkPositiveInt(
    env["MODEL_CACHE_TTL_SECONDS"],
    DEFAULT_MODEL_CACHE_TTL_SECONDS,
    "MODEL_CACHE_TTL_SECONDS",
    problems,
  );

  const maxUploadBytes = checkPositiveInt(
    env["MAX_UPLOAD_BYTES"],
    DEFAULT_MAX_UPLOAD_BYTES,
    "MAX_UPLOAD_BYTES",
    problems,
  );

  const encryptionKeyId = (env["ENCRYPTION_KEY_ID"] ?? "").trim() || DEFAULT_ENCRYPTION_KEY_ID;

  // Salah satu variabel email terisi (tidak hanya spasi) = operator sudah
  // mengonfigurasi email. Tidak ada validasi lebih jauh karena v1 belum
  // menghubungi server mana pun.
  const emailConfigured = EMAIL_ENV_NAMES.some((name) => (env[name] ?? "").trim() !== "");

  if (problems.length > 0) throw new ConfigError(problems);

  return {
    databaseUrl: databaseUrl as string,
    encryptionKey,
    encryptionKeyId,
    authSecret,
    loginRateLimitMax,
    loginRateLimitWindowSeconds,
    passwordResetTtlSeconds,
    emailConfigured,
    modelCacheTtlSeconds,
    outboundAllowlist: parseAllowlist(env["OUTBOUND_ALLOWLIST"]),
    allowInsecureHttp: checkBoolean(env["ALLOW_INSECURE_HTTP"]),
    defaultGateway: parseDefaultGateway(env, problems),
    maxUploadBytes,
  };
}
