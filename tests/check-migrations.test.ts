/**
 * Uji perilaku `scripts/check-migrations.mjs` (FIX-01/T02).
 *
 * Checker dijalankan sebagai proses terpisah pada salinan sementara supaya uji
 * tidak menyentuh migrasi repo. Yang dibuktikan: init yang diubah ditolak,
 * urutan provider yang berbeda ditolak, dan kondisi repo saat ini lulus.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = "scripts/check-migrations.mjs";
const SOURCE = "prisma/migrations";

type Run = { ok: boolean; out: string };

function run(migrationsDir?: string): Run {
  try {
    const out = execFileSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, ...(migrationsDir ? { MIGRATIONS_DIR: migrationsDir } : {}) },
      stdio: "pipe",
    });
    return { ok: true, out };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("check-migrations", () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function copy(): string {
    const dir = mkdtempSync(join(tmpdir(), "kawan-migrations-"));
    temps.push(dir);
    cpSync(SOURCE, join(dir, "migrations"), { recursive: true });
    return join(dir, "migrations");
  }

  it("lulus pada migrasi repo saat ini", () => {
    const result = run();
    expect(result.ok, result.out).toBe(true);
    expect(result.out).toContain("init dibekukan");
  });

  it("menolak init yang diedit", () => {
    const dir = copy();
    writeFileSync(join(dir, "sqlite/00000000000000_init/migration.sql"), "-- diubah\n");
    const result = run(dir);
    expect(result.ok).toBe(false);
    expect(result.out).toContain("tidak cocok dengan checksum init");
  });

  it("menolak urutan migrasi yang berbeda antar provider", () => {
    const dir = copy();
    for (const provider of ["sqlite", "postgresql"]) {
      cpSync(
        join(dir, provider, "00000000000000_init"),
        join(dir, provider, "20260101000000_add_kolom"),
        { recursive: true },
      );
    }
    rmSync(join(dir, "postgresql/20260101000000_add_kolom"), { recursive: true });
    const result = run(dir);
    expect(result.ok).toBe(false);
    expect(result.out).toContain("daftar migrasi tidak sama");
  });

  it("menolak migrasi tambahan yang kosong", () => {
    const dir = copy();
    for (const provider of ["sqlite", "postgresql"]) {
      const target = join(dir, provider, "20260101000000_kosong");
      cpSync(join(dir, provider, "00000000000000_init"), target, { recursive: true });
      writeFileSync(join(target, "migration.sql"), "  \n");
    }
    const result = run(dir);
    expect(result.ok).toBe(false);
    expect(result.out).toContain("kosong");
  });
});
