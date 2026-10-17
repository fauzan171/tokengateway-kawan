import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_LOGIN_RATE_LIMIT_MAX,
  DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_PASSWORD_RESET_TTL_SECONDS,
  loadConfig,
} from "./env";

const SECRET = randomBytes(32).toString("base64");
const BASE = {
  DATABASE_URL: "file:./dev.db",
  ENCRYPTION_SECRET: SECRET,
  AUTH_SECRET: "auth-secret-uji",
};

function problemsFrom(env: Record<string, string | undefined>): string[] {
  try {
    loadConfig(env);
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as ConfigError).problems as string[];
  }
  throw new Error("loadConfig seharusnya menolak env ini");
}

describe("loadConfig", () => {
  it("menerima env yang benar dan mengembalikan kunci 32 byte", () => {
    const cfg = loadConfig(BASE);
    expect(cfg.databaseUrl).toBe("file:./dev.db");
    expect(cfg.encryptionKey.length).toBe(32);
    expect(cfg.authSecret).toBe("auth-secret-uji");
  });

  it("menyebut ENCRYPTION_SECRET dengan jelas saat variabelnya hilang", () => {
    const problems = problemsFrom({ ...BASE, ENCRYPTION_SECRET: undefined });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ENCRYPTION_SECRET");
    expect(problems[0]).toContain("wajib diisi");
  });

  it("menolak AUTH_SECRET yang kosong tanpa menuntut panjang tertentu", () => {
    const problems = problemsFrom({ ...BASE, AUTH_SECRET: "   " });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("AUTH_SECRET");

    // Nilai pendek tetap sah: aturan 32 byte hanya milik ENCRYPTION_SECRET.
    expect(loadConfig({ ...BASE, AUTH_SECRET: "pendek" }).authSecret).toBe("pendek");
  });

  it("menolak panjang yang bukan 32 byte dan menyebut panjang yang terlihat", () => {
    const problems = problemsFrom({ ...BASE, ENCRYPTION_SECRET: randomBytes(16).toString("base64") });
    expect(problems[0]).toContain("16 byte");
  });

  it("menolak nilai yang bukan base64, bukan hash diam-diam", () => {
    const problems = problemsFrom({ ...BASE, ENCRYPTION_SECRET: "bukan-base64!!" });
    expect(problems[0]).toContain("base64");
  });

  it("mengumpulkan semua masalah, bukan berhenti di yang pertama", () => {
    const problems = problemsFrom({});
    expect(problems).toHaveLength(3);
    expect(problems.join("\n")).toContain("DATABASE_URL");
    expect(problems.join("\n")).toContain("ENCRYPTION_SECRET");
    expect(problems.join("\n")).toContain("AUTH_SECRET");
  });
});

describe("batas rate limit login", () => {
  it("memakai bawaan aman bila variabel tidak diisi", () => {
    const cfg = loadConfig(BASE);
    expect(cfg.loginRateLimitMax).toBe(DEFAULT_LOGIN_RATE_LIMIT_MAX);
    expect(cfg.loginRateLimitWindowSeconds).toBe(DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  });

  it("membaca nilai yang diberikan operator", () => {
    const cfg = loadConfig({
      ...BASE,
      LOGIN_RATE_LIMIT_MAX: "10",
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: "60",
    });
    expect(cfg.loginRateLimitMax).toBe(10);
    expect(cfg.loginRateLimitWindowSeconds).toBe(60);
  });

  it("memperlakukan nilai kosong sebagai tidak diatur", () => {
    const cfg = loadConfig({
      ...BASE,
      LOGIN_RATE_LIMIT_MAX: "   ",
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: "",
    });
    expect(cfg.loginRateLimitMax).toBe(DEFAULT_LOGIN_RATE_LIMIT_MAX);
    expect(cfg.loginRateLimitWindowSeconds).toBe(DEFAULT_LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  });

  it("menolak nilai rusak dengan menyebut nama variabel", () => {
    for (const bad of ["0", "-3", "abc", "1.5", "1e3", "Infinity"]) {
      const problems = problemsFrom({ ...BASE, LOGIN_RATE_LIMIT_MAX: bad });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("LOGIN_RATE_LIMIT_MAX");
    }
  });
});

describe("konfigurasi reset kata sandi (REQ-NT-16)", () => {
  it("TTL reset memakai bawaan 60 menit bila tidak diisi", () => {
    expect(loadConfig(BASE).passwordResetTtlSeconds).toBe(DEFAULT_PASSWORD_RESET_TTL_SECONDS);
  });

  it("TTL reset dapat diatur operator dan menolak nilai rusak", () => {
    expect(loadConfig({ ...BASE, PASSWORD_RESET_TTL_SECONDS: "900" }).passwordResetTtlSeconds).toBe(
      900,
    );
    const problems = problemsFrom({ ...BASE, PASSWORD_RESET_TTL_SECONDS: "0" });
    expect(problems[0]).toContain("PASSWORD_RESET_TTL_SECONDS");
  });

  it("email dianggap BELUM dikonfigurasi bila tidak ada variabel terkait", () => {
    expect(loadConfig(BASE).emailConfigured).toBe(false);
  });

  it("email dianggap terkonfigurasi bila salah satu variabel diisi", () => {
    expect(loadConfig({ ...BASE, KAWAN_SMTP_URL: "smtp://contoh.test" }).emailConfigured).toBe(true);
    expect(loadConfig({ ...BASE, SMTP_HOST: "smtp.contoh.test" }).emailConfigured).toBe(true);
  });

  it("variabel email berisi spasi saja tidak dihitung terkonfigurasi", () => {
    expect(loadConfig({ ...BASE, SMTP_HOST: "   " }).emailConfigured).toBe(false);
  });
});
