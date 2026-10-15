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
};

type Env = Record<string, string | undefined>;

const KEY_BYTES = 32;

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

export function loadConfig(env: Env = process.env): Config {
  const problems: string[] = [];

  const databaseUrl = env["DATABASE_URL"]?.trim();
  if (!databaseUrl) {
    problems.push("DATABASE_URL wajib diisi (SQLite dev: file:./dev.db, produksi: postgresql://...).");
  }

  const encryptionKey = checkEncryptionSecret(env["ENCRYPTION_SECRET"], problems);
  const authSecret = checkAuthSecret(env["AUTH_SECRET"], problems);

  if (problems.length > 0) throw new ConfigError(problems);

  return { databaseUrl: databaseUrl as string, encryptionKey, authSecret };
}
