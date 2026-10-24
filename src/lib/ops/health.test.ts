/**
 * FIX-24: liveness/readiness, metrik operasional, kebocoran informasi.
 */

import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import {
  checkWorker,
  liveness,
  operationalMetrics,
  publicReadiness,
  readiness,
} from "./health";

let temp: TempDb;
let db: Db;
let userId: string;
let migrationsDir: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  // Direktori migrasi kosong: tidak ada yang "belum diterapkan".
  migrationsDir = await mkdtemp(join(tmpdir(), "kawan-mig-"));
});

afterAll(async () => {
  await temp.cleanup();
  await rm(migrationsDir ?? "", { recursive: true, force: true });
});

describe("liveness", () => {
  it("selalu hidup dan tidak menyentuh DB", () => {
    const result = liveness(new Date("2026-01-01T00:00:00Z"));
    expect(result.alive).toBe(true);
    expect(result.checkedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe("readiness", () => {
  it("DB sehat + migrasi lengkap + worker segar → ready", async () => {
    await db.workerHeartbeat.create({
      data: { workerId: "w1", version: "0.2.0", capabilities: "[]", lastSeenAt: new Date() },
    });
    const report = await readiness({ db, migrationsDir });
    expect(report.ready).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(["database", "migrations", "worker"]);
  });

  it("tanpa tabel riwayat migrasi → unknown, bukan down palsu", async () => {
    await db.workerHeartbeat.create({
      data: { workerId: "w1", version: "0.2.0", capabilities: "[]", lastSeenAt: new Date() },
    });
    const report = await readiness({ db, migrationsDir });
    // Tidak dapat dipastikan bukan berarti tidak siap; readiness tidak boleh
    // menjatuhkan layanan karena ketidaktahuan.
    const check = report.checks.find((entry) => entry.name === "migrations");
    expect(["ok", "unknown"]).toContain(check?.state);
  });

  it("worker tanpa denyut → down, tidak ready", async () => {
    const report = await readiness({ db, migrationsDir });
    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "worker")?.state).toBe("down");
  });

  it("denyut basi dihitung mati walau ada job sukses", async () => {
    await db.workerHeartbeat.create({
      data: {
        workerId: "w1",
        version: "0.2.0",
        capabilities: "[]",
        lastSeenAt: new Date(Date.now() - 5 * 60_000),
      },
    });
    const check = await checkWorker(db, new Date(), 30_000);
    expect(check.state).toBe("down");
    expect(check.detail).toContain("detik lalu");
  });

  it("migrasi di disk yang belum diterapkan → down dengan nama migrasi", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kawan-mig2-"));
    await mkdir(join(dir, "20990101000000_belum"));
    // DB tes dibuat lewat push skema, jadi tabel riwayat migrasi harus dibuat
    // sendiri di sini; tanpanya hasilnya jujur "unknown", bukan "down".
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "_prisma_migrations" ("migration_name" TEXT NOT NULL, "finished_at" TEXT)',
    );
    await db.workerHeartbeat.create({
      data: { workerId: "w1", version: "0.2.0", capabilities: "[]", lastSeenAt: new Date() },
    });
    const report = await readiness({ db, migrationsDir: dir });
    expect(report.ready).toBe(false);
    const check = report.checks.find((entry) => entry.name === "migrations");
    expect(check?.state).toBe("down");
    expect(check?.detail).toContain("20990101000000_belum");
    await rm(dir, { recursive: true, force: true });
  });
});

describe("publicReadiness", () => {
  const ready = { ready: true, checks: [], checkedAt: "2026-01-01T00:00:00.000Z" };

  it("siap: hanya boolean + waktu, tanpa detail", () => {
    const result = publicReadiness(ready);
    expect(result).toEqual({ ready: true, checkedAt: ready.checkedAt });
    expect(Object.keys(result).sort()).toEqual(["checkedAt", "ready"]);
  });

  it("tidak siap: alasan ringkas, tanpa nama host/tabel/pesan driver", () => {
    const result = publicReadiness({
      ready: false,
      checkedAt: ready.checkedAt,
      checks: [
        { name: "database", state: "down", detail: "postgres://user:rahasia@db-internal:5432/x" },
      ],
    });
    expect(result.reason).toBe("database tidak siap");
    expect(JSON.stringify(result)).not.toContain("rahasia");
    expect(JSON.stringify(result)).not.toContain("db-internal");
    expect(JSON.stringify(result)).not.toContain("postgres");
  });
});

describe("operationalMetrics", () => {
  it("menghitung artefak, job, run, dan usage tanpa isi prompt", async () => {
    await db.job.create({
      data: { id: `job_${randomUUID()}`, kind: "chat.generate", payloadJson: "{}", state: "queued" },
    });
    await db.artifact.create({
      data: {
        id: `art_${randomUUID()}`,
        userId,
        format: "txt",
        displayName: "a.txt",
        mime: "text/plain",
        sizeBytes: 1234,
        sha256: "a".repeat(64),
        storageKey: "k",
        status: "ready",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await db.usageRecord.create({
      data: {
        id: `use_${randomUUID()}`,
        userId,
        model: "m",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        reported: 1,
      },
    });
    await db.usageRecord.create({
      data: { id: `use_${randomUUID()}`, userId, model: "m", reported: 0 },
    });

    const metrics = await operationalMetrics(db);
    expect(metrics.jobs["queued"]).toBeGreaterThanOrEqual(1);
    expect(metrics.artifacts.bytes).toBe(1234);
    expect(metrics.artifacts.expired).toBe(1);
    expect(metrics.usage.reportedTokens).toBe(15);
    // Usage tak terlapor TIDAK diisi angka karangan.
    expect(metrics.usage.estimatedTokens).toBe(0);
    expect(metrics.usage.unknownRuns).toBe(1);
  });

  it("metrik tidak memuat teks prompt atau berkas", async () => {
    await db.chat.create({
      data: { id: `chat_${randomUUID()}`, userId, title: "rahasia-pengguna", titleSource: "manual" },
    });
    const metrics = await operationalMetrics(db);
    expect(JSON.stringify(metrics)).not.toContain("rahasia-pengguna");
  });
});
