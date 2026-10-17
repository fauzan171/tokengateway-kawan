/**
 * Uji klaim konkuren dan siklus lease (WP-NT-P0-07, SDD-8).
 *
 * Memakai SQLite sementara di direktori tmp: migrasi dijalankan apa adanya
 * dari prisma/migrations/sqlite, jadi uji ini juga membuktikan skema yang
 * dikirim benar-benar bisa dipakai klaim.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb, type Db } from "@/lib/db";
import { backoffMs, claim, complete, enqueue, fail, heartbeat, releaseExpired } from "./queue";
import { createWorker } from "./worker";

const MIGRATION = "prisma/migrations/sqlite/00000000000000_init/migration.sql";

let dir: string;
let db: Db;

// Database baru per uji: `releaseExpired` bekerja atas seluruh tabel, jadi
// job sisa uji sebelumnya akan ikut terhitung.
beforeEach(async () => {
  await closeDb();
  dir = mkdtempSync(join(tmpdir(), "kawan-queue-"));
  const file = join(dir, "test.db");

  // Migrasi dijalankan langsung dengan better-sqlite3 yang sudah ada.
  const raw = new Database(file);
  raw.exec(readFileSync(MIGRATION, "utf8"));
  raw.close();

  db = await getDb(`file:${file}`);
});

afterAll(async () => {
  await closeDb();
  rmSync(dir, { recursive: true, force: true });
});

const workerId = (n: number) => `worker-${n}`;

/** Menunggu sampai predikat benar; gagal bila melewati batas waktu. */
async function until(check: () => Promise<boolean>, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("kondisi tidak tercapai sebelum batas waktu");
}

describe("klaim job", () => {
  it("klaim konkuren: tepat satu pemenang", async () => {
    const id = await enqueue(db, { kind: "chat.generate", payload: { prompt: "hai" } });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, n) => claim(db, { workerId: workerId(n), id })),
    );

    const winners = results.filter((result) => result !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.id).toBe(id);
    expect(winners[0]!.attempts).toBe(1);

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("leased");
    expect(row.leaseOwner).toBe(`worker-${results.indexOf(winners[0])}`);
    expect(row.leaseToken).toBe(winners[0]!.leaseToken);
    expect(row.attempts).toBe(1);
  });

  it("dua worker mengambil dua job berbeda, bukan satu job yang sama", async () => {
    const first = await enqueue(db, { kind: "chat.generate", payload: {} });
    const second = await enqueue(db, { kind: "chat.generate", payload: {} });

    const results = await Promise.all(
      [0, 1].map((n) => claim(db, { workerId: workerId(n) })),
    );

    const ids = results.filter(Boolean).map((r) => r!.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.sort()).toEqual([first, second].sort());
  });

  it("job yang belum waktunya tidak diklaim", async () => {
    const future = new Date(Date.now() + 60_000);
    const id = await enqueue(db, { kind: "usage.aggregate", payload: {}, availableAt: future });

    expect(await claim(db, { workerId: workerId(9), id })).toBeNull();
  });

  it("job yang sudah habis percobaan tidak diklaim", async () => {
    const id = await enqueue(db, { kind: "document.extract", payload: {}, maxAttempts: 1 });
    const first = await claim(db, { workerId: workerId(0), id });
    expect(first).not.toBeNull();

    await fail(db, first!, new Error("gagal"), { random: () => 0 });
    expect(await claim(db, { workerId: workerId(1), id })).toBeNull();

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("failed");
  });
});

describe("lease", () => {
  it("heartbeat memperpanjang lease, lalu hilang saat token tidak cocok", async () => {
    const id = await enqueue(db, { kind: "chat.generate", payload: {} });
    const held = await claim(db, { workerId: workerId(0), id, leaseMs: 1_000 });

    const before = (await db.job.findUniqueOrThrow({ where: { id } })).leaseExpiresAt!;
    const now = new Date(before.getTime() + 500);
    expect(await heartbeat(db, held!, 60_000, now)).toBe(true);

    const after = (await db.job.findUniqueOrThrow({ where: { id } })).leaseExpiresAt!;
    expect(after.getTime()).toBe(now.getTime() + 60_000);

    // Lease habis mencabut token lama; chat tidak diklaim ulang otomatis.
    expect(await releaseExpired(db, new Date(after.getTime() + 1))).toEqual({
      requeued: 0,
      indeterminate: 1,
    });
    expect(await heartbeat(db, held!, 60_000, new Date(after.getTime() + 2))).toBe(false);
  });

  it("complete hanya berlaku untuk pemegang token", async () => {
    const id = await enqueue(db, { kind: "chat.generate", payload: {} });
    const held = await claim(db, { workerId: workerId(0), id });

    expect(await complete(db, { ...held!, leaseToken: "token-palsu" })).toBe(false);
    expect(await complete(db, held!)).toBe(true);

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("succeeded");
    expect(row.leaseToken).toBeNull();
  });
});

describe("percobaan ulang dan idempotensi", () => {
  for (const kind of ["chat.generate", "document.embed"]) {
    it(`${kind}: lease habis tidak mengulang panggilan provider berbayar`, async () => {
      const id = await enqueue(db, { kind, payload: {} });
      await claim(db, { workerId: workerId(0), id, leaseMs: 0 });
      expect(await releaseExpired(db, new Date(Date.now() + 1000))).toEqual({ requeued: 0, indeterminate: 1 });
      expect(await claim(db, { workerId: workerId(1), id })).toBeNull();
    });
    it(`${kind}: kegagalan ambigu tidak diulang otomatis`, async () => {
      const id = await enqueue(db, { kind, payload: {} });
      const held = await claim(db, { workerId: workerId(0), id });
      expect(await fail(db, held!, new Error("connection lost"))).toBe("indeterminate");
      expect(await claim(db, { workerId: workerId(1), id })).toBeNull();
    });
  }
  it("gagal dengan sisa percobaan: kembali queued dengan backoff ke depan", async () => {
    const id = await enqueue(db, { kind: "document.extract", payload: {}, maxAttempts: 3 });
    const held = await claim(db, { workerId: workerId(0), id });
    const now = new Date();

    const state = await fail(db, held!, new Error("provider mati"), { now, random: () => 0 });
    expect(state).toBe("queued");

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("queued");
    expect(row.leaseToken).toBeNull();
    expect(row.lastError).toBe("provider mati");
    expect(row.availableAt.getTime()).toBe(now.getTime() + backoffMs(1, () => 0));
    expect(row.availableAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("gagal pada kind tidak idempoten: indeterminate, bukan percobaan ulang", async () => {
    const id = await enqueue(db, { kind: "email.send", payload: {}, maxAttempts: 3 });
    const held = await claim(db, { workerId: workerId(0), id });

    expect(await fail(db, held!, new Error("SMTP timeout"))).toBe("indeterminate");

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("indeterminate");
    expect(await claim(db, { workerId: workerId(1), id })).toBeNull();
  });

  it("lease habis: idempoten kembali queued, tidak idempoten indeterminate", async () => {
    const ok = await enqueue(db, { kind: "usage.aggregate", payload: {} });
    const risky = await enqueue(db, { kind: "email.send", payload: {} });

    await claim(db, { workerId: workerId(0), id: ok, leaseMs: 0 });
    await claim(db, { workerId: workerId(1), id: risky, leaseMs: 0 });

    const swept = await releaseExpired(db, new Date(Date.now() + 1_000));
    expect(swept).toEqual({ requeued: 1, indeterminate: 1 });

    expect((await db.job.findUniqueOrThrow({ where: { id: ok } })).state).toBe("queued");
    expect((await db.job.findUniqueOrThrow({ where: { id: risky } })).state).toBe("indeterminate");
  });

  it("backoff tumbuh lalu dibatasi jitter 50-100 persen", () => {
    expect(backoffMs(1, () => 0)).toBe(2_500);
    expect(backoffMs(1, () => 1)).toBe(5_000);
    expect(backoffMs(2, () => 0)).toBe(5_000);
    expect(backoffMs(99, () => 1)).toBe(300_000);
  });
});

describe("worker", () => {
  const controller = () => new AbortController();

  it("mengklaim job tiruan lalu menyelesaikannya", async () => {
    const id = await enqueue(db, { kind: "chat.generate", payload: { prompt: "hai" } });
    const seen: string[] = [];

    const worker = createWorker({
      db,
      workerId: workerId(0),
      idleMs: 1,
      handlers: {
        "chat.generate": async (job) => {
          seen.push(JSON.parse(job.payloadJson).prompt);
        },
      },
    });

    const signal = controller().signal;
    const loop = worker.run(signal);
    await until(async () => (await db.job.findUniqueOrThrow({ where: { id } })).state === "succeeded");
    worker.stop();
    signal.dispatchEvent(new Event("abort"));
    await loop;

    expect(seen).toEqual(["hai"]);
    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("succeeded");
    expect(row.attempts).toBe(1);
    expect(row.leaseToken).toBeNull();
  });

  it("handler gagal: job kembali queued dengan pesan galat", async () => {
    const id = await enqueue(db, { kind: "usage.aggregate", payload: {}, maxAttempts: 3 });

    const worker = createWorker({
      db,
      workerId: workerId(1),
      idleMs: 1,
      handlers: {
        "usage.aggregate": async () => {
          throw new Error("agregasi meledak");
        },
      },
    });

    const signal = controller().signal;
    const loop = worker.run(signal);
    // `attempts` naik saat klaim, sebelum handler jalan; tunggu pembukuan
    // kegagalan yang sesungguhnya.
    await until(async () => (await db.job.findUniqueOrThrow({ where: { id } })).lastError !== null);
    worker.stop();
    signal.dispatchEvent(new Event("abort"));
    await loop;

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("queued");
    expect(row.lastError).toBe("agregasi meledak");
    expect(row.leaseToken).toBeNull();
  });

  it("shutdown handler kooperatif juga menutup lease sebagai indeterminate", async () => {
    const id = await enqueue(db, { kind: "chat.generate", payload: {} });
    let started = false;
    const worker = createWorker({
      db, workerId: workerId(3), idleMs: 1,
      handlers: {
        "chat.generate": async (_job, signal) => {
          started = true;
          await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
        },
      },
    });
    const loop = worker.run(new AbortController().signal);
    await until(async () => started);
    worker.stop();
    await loop;
    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("indeterminate");
    expect(row.leaseToken).toBeNull();
  });

  it("shutdown saat handler berjalan: job jadi indeterminate, bukan queued", async () => {
    const id = await enqueue(db, { kind: "email.send", payload: {} });

    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const worker = createWorker({
      db,
      workerId: workerId(2),
      idleMs: 1,
      shutdownGraceMs: 20,
      handlers: {
        "email.send": async () => {
          await held;
        },
      },
    });

    const signal = controller().signal;
    const loop = worker.run(signal);
    await until(async () => (await db.job.findUniqueOrThrow({ where: { id } })).state === "leased");

    worker.stop();
    await loop; // grace 20 ms habis, handler belum selesai

    const row = await db.job.findUniqueOrThrow({ where: { id } });
    expect(row.state).toBe("indeterminate");
    expect(row.leaseToken).toBeNull();
    release();
  });
});
