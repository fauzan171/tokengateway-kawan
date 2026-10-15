import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./env";

const SECRET = randomBytes(32).toString("base64");
const BASE = { DATABASE_URL: "file:./dev.db", ENCRYPTION_SECRET: SECRET };

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
  });

  it("menyebut ENCRYPTION_SECRET dengan jelas saat variabelnya hilang", () => {
    const problems = problemsFrom({ DATABASE_URL: "file:./dev.db" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ENCRYPTION_SECRET");
    expect(problems[0]).toContain("wajib diisi");
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
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toContain("DATABASE_URL");
    expect(problems.join("\n")).toContain("ENCRYPTION_SECRET");
  });
});
