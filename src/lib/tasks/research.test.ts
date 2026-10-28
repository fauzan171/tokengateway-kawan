/**
 * Uji loop riset (D1, WO-B3).
 *
 * Jalur model lewat fixture provider loopback (skenario `research`: balasan
 * dipilih dari penanda fase di pesan, karena semua fase memakai satu `modelId`).
 * Jalur tool (`web_search`/`web_read`) di-mock: loop riset tidak boleh menyentuh
 * jaringan nyata di suite; yang diuji di sini orkestrasi loop, durability, dan
 * penutupan run — bukan transport search/read (itu WO-B2/B4).
 *
 * Enam kasus wajib SDD-BACKEND §D1(6).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import { modelFor, setResearchVerdictAfter, startProviderFixture, type ProviderFixture } from "../../../tests/fixtures/provider-server";
import { createTask, cancelRun } from "./tasks";
import { runTaskRun } from "./run";
import type { GenerateConfig } from "@/lib/chat/generate";
import type { Db } from "@/lib/db";
import { CONNECTION_API_KEY_PURPOSE, encryptSecret } from "@/lib/secrets";

// Penghitung dipakai mock supaya tiap panggilan search menghasilkan URL baru:
// tanpa itu, "siklus ke-2" takkan menemukan bukti baru dan loop berhenti lebih
// awal (`no_new_evidence`), bukan menabrak `cycle_limit`.
const h = vi.hoisted(() => ({ searchCalls: 0 }));

vi.mock("@/lib/search/chain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/search/chain")>();
  return {
    ...actual,
    chainSearch: vi.fn(async () => {
      h.searchCalls += 1;
      const n = h.searchCalls;
      return {
        results: [
          { title: `Sumber ${n}-1`, url: `https://contoh.test/${n}-1`, snippet: "cuplikan satu", fetchedAt: new Date().toISOString() },
          { title: `Sumber ${n}-2`, url: `https://contoh.test/${n}-2`, snippet: "cuplikan dua", fetchedAt: new Date().toISOString() },
        ],
        provider: "direct" as const,
        attempts: [],
      };
    }),
  };
});

vi.mock("@/lib/sources/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sources/read")>();
  return {
    ...actual,
    readSource: vi.fn(async (input: string) => ({
      source: {
        url: input,
        title: `Halaman ${input}`,
        fetchedAt: new Date().toISOString(),
        contentHash: null,
        locator: null,
        reach: "reachable" as const,
        metadata: "verified" as const,
      },
      text: `Teks halaman ${input}`,
    })),
  };
});

const ENCRYPTION_KEY = Buffer.alloc(32, 7);

let fixture: ProviderFixture;
let temp: TempDb;
let db: Db;
let userId: string;

beforeAll(async () => {
  fixture = await startProviderFixture();
});

afterAll(async () => {
  await fixture.close();
});

beforeEach(async () => {
  setResearchVerdictAfter(1);
  h.searchCalls = 0;
  temp = await createTempDb();
  db = temp.db;
  userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });

  const connectionId = randomUUID();
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "gateway uji",
      baseUrl: fixture.baseUrl,
      apiKeyEncrypted: encryptSecret({
        plaintext: "kunci-uji",
        key: ENCRYPTION_KEY,
        keyId: "v1",
        aad: { rowId: connectionId, userId, purpose: CONNECTION_API_KEY_PURPOSE },
      }),
      apiKeyMask: "kunci-****",
      keyId: "v1",
      isActive: 1,
      status: "active",
    },
  });
});

function config(): GenerateConfig {
  const port = new URL(fixture.baseUrl).port;
  return {
    encryptionKey: ENCRYPTION_KEY,
    allowInsecureHttp: true,
    outboundAllowlist: [`127.0.0.1:${port}`],
  };
}

/** Admission agent riset (D1): satu-satunya cara membuat run loop riset. */
async function admission(input = "Riset topik uji") {
  return createTask(db, {
    userId,
    input,
    modelId: modelFor("research"),
    agentId: "research",
    idempotencyKey: null,
  });
}

async function eventsOf(runId: string) {
  return db.taskEvent.findMany({ where: { runId }, orderBy: { seq: "asc" } });
}

describe("loop riset (D1)", () => {
  it("selesai satu siklus bila bukti cukup", async () => {
    const { runId } = await admission();
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("completed");
    expect(run.stopReason).toBe("sufficient_evidence");
    expect(run.researchCycle).toBe(1);

    // Satu siklus saja: discovery tepat sekali.
    const discovery = (await eventsOf(runId)).filter(
      (row) => row.kind === "phase.started" && (JSON.parse(row.payloadJson).data as { phase?: string }).phase === "discovery",
    );
    expect(discovery).toHaveLength(1);

    // Jawaban akhir tersimpan durable (teks sintesis), bukan dibiarkan kosong.
    const assistant = await db.taskMessage.findUniqueOrThrow({ where: { id: run.assistantMessageId! } });
    expect(assistant.text).toContain("Jawaban akhir");
  });

  it("berhenti pada cycle_limit", async () => {
    setResearchVerdictAfter(99); // selalu belum cukup → loop menabrak batas siklus
    const { runId } = await admission();
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("completed");
    expect(run.stopReason).toBe("cycle_limit");
    expect(run.researchCycle).toBe(3);

    // Tidak ada siklus ke-4.
    const discoveryCycles = (await eventsOf(runId))
      .filter((row) => row.kind === "phase.started")
      .map((row) => JSON.parse(row.payloadJson).data as { phase?: string; cycle?: number })
      .filter((data) => data.phase === "discovery")
      .map((data) => data.cycle);
    expect(discoveryCycles).toEqual([1, 2, 3]);
  });

  it("cancel di tengah siklus", async () => {
    setResearchVerdictAfter(99);
    const { runId, taskId } = await admission();

    const running = runTaskRun(db, config(), runId, new AbortController().signal);
    // Tunggu satu siklus tuntas, baru minta cancel: loop melihat niat cancel di
    // batas siklus berikutnya (`stopNow`), bukan di tengah fase.
    await vi.waitFor(
      async () => {
        expect(await db.taskEvent.findFirst({ where: { runId, kind: "cycle.summary" } })).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    await cancelRun(db, { userId, taskId, runId });
    await running;

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("cancelled");
    expect(run.stopReason).toBe("user_cancel");

    const rows = await eventsOf(runId);
    expect(rows[rows.length - 1]!.kind).toBe("run.cancelled");
    // Terminal sekali; tidak ada event setelahnya.
    expect(rows.filter((row) => row.kind === "run.cancelled")).toHaveLength(1);
    expect(rows.filter((row) => row.seq > rows[rows.length - 1]!.seq)).toHaveLength(0);
  });

  it("lease hilang → LeaseLost, tidak ada baris langkah tertulis", async () => {
    const { runId } = await admission();
    const fence = { held: async () => false, heldFresh: async () => false };

    await expect(runTaskRun(db, config(), runId, new AbortController().signal, fence)).rejects.toThrow();

    // Tidak ada mutasi stale: run tetap queued, tanpa langkah, tanpa run.started.
    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("queued");
    expect(await db.taskStep.count({ where: { runId } })).toBe(0);
    expect(await db.taskEvent.count({ where: { runId, kind: "run.started" } })).toBe(0);
  });

  it("lease hilang DI TENGAH tulisan → transaksi rollback, langkah tidak tertinggal", async () => {
    setResearchVerdictAfter(99);
    const { runId } = await admission();

    // Lolos beberapa pemeriksaan dulu (run.started, framing, step pertama),
    // lalu lease dicabut: yang diuji adalah rollback transaksi terfence, bukan
    // penolakan di gerbang masuk.
    let calls = 0;
    const fence = {
      held: async () => {
        calls += 1;
        return calls <= 6;
      },
      heldFresh: async () => true,
    };

    await expect(runTaskRun(db, config(), runId, new AbortController().signal, fence)).rejects.toThrow();

    // Run berhenti di tengah: sudah ada tulisan sah sebelumnya, tidak ada
    // penutupan palsu. Baris `running` tanpa receipt boleh tertinggal — SDD
    // D1(2) menetapkannya direkap `failed` saat langkah itu diulang.
    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(["running", "queued"]).toContain(run.status);
    expect(run.finishedAt).toBeNull();

    // Yang penting: tidak ada tulisan setengah jadi yang menghasilkan seq ganda,
    // dan langkah yang tertinggal masih bisa direkap (bukan `succeeded` palsu).
    const rows = await eventsOf(runId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index + 1));
    expect(await db.taskStep.count({ where: { runId, status: "succeeded", resultDigest: null } })).toBe(0);
  });

  it("resume idempotent: researchCycle tidak direset, baris lama tidak ditimpa", async () => {
    // Invokasi A: siklus 1 tuntas, memberi digest nyata untuk langkah framing.
    const a = await admission();
    await runTaskRun(db, config(), a.runId, new AbortController().signal);
    const framing = await db.taskStep.findFirstOrThrow({ where: { runId: a.runId, ordinal: 1 } });
    expect(framing.phase).toBe("framing");
    expect(framing.status).toBe("succeeded");

    // Invokasi B: mensimulasikan re-claim job setelah crash di siklus 1 —
    // langkah framing sudah durable, `researchCycle` sudah 1.
    const b = await admission();
    const seededAt = new Date(Date.now() - 60_000);
    await db.taskStep.create({
      data: {
        id: randomUUID(),
        runId: b.runId,
        ordinal: 1,
        kind: "model",
        phase: "framing",
        cycle: 1,
        argsDigest: framing.argsDigest,
        status: "succeeded",
        startedAt: seededAt,
        finishedAt: seededAt,
      },
    });
    await db.taskRun.update({ where: { id: b.runId }, data: { researchCycle: 1 } });

    await runTaskRun(db, config(), b.runId, new AbortController().signal);

    // Loop melanjutkan dari siklus 2, bukan mengulang siklus 1 dari nol.
    const resumed = await db.taskRun.findUniqueOrThrow({ where: { id: b.runId } });
    expect(resumed.researchCycle).toBe(2);

    // Baris langkah lama dipakai apa adanya: startedAt tidak ditulis ulang.
    const kept = await db.taskStep.findUniqueOrThrow({
      where: { runId_ordinal: { runId: b.runId, ordinal: 1 } },
    });
    expect(kept.startedAt?.getTime()).toBe(seededAt.getTime());
    expect(kept.argsDigest).toBe(framing.argsDigest);
  });

  it("anggaran durable terbaca saat resume: sisa token habis → budget_limit", async () => {
    // S2-1: `budgetJson` ditulis `{max, consumed:{...}}`. Kalau parser membaca
    // bentuk flat, run ini akan mulai dari nol dan tetap memanggil model — tes
    // ini gagal bila bentuk durable tidak terbaca.
    const { runId } = await admission();
    await db.taskRun.update({
      where: { id: runId },
      data: {
        budgetJson: JSON.stringify({
          max: 24_000,
          consumed: { promptTokens: 23_000, completionTokens: 1_000, searches: 0, reads: 0, toolCalls: 0, unreportedCalls: 0 },
          estimatorVersion: 1,
        }),
      },
    });

    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run.status).toBe("completed");
    expect(run.stopReason).toBe("budget_limit");
    // Tidak ada panggilan model: sisa 0 < reservasi `maxOutputTokens`.
    expect(await db.taskStep.count({ where: { runId, kind: "model" } })).toBe(0);
  });

  it("usage tak dilaporkan → metering estimasi, bukan tagihan nyata", async () => {
    // S3-3: `reported` dulu diturunkan dari `completionTokens > 0`, padahal
    // usage absen diisi reservasi penuh — angkanya selalu > 0.
    const { runId } = await admission();
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const run = await db.taskRun.findUniqueOrThrow({ where: { id: runId } });
    const usage = JSON.parse(run.usageJson ?? "{}") as { reported?: boolean; estimated?: boolean };
    // Fixture `research` selalu mengirim usage di chunk terakhir.
    expect(usage.reported).toBe(true);
    expect(usage.estimated).toBe(false);
  });

  it("seq monoton tanpa duplikat", async () => {
    setResearchVerdictAfter(2);
    const { runId } = await admission();
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const rows = await eventsOf(runId);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.map((row) => row.seq)).toEqual(rows.map((_, index) => index + 1));
  });
});
describe("D4 — fokus onboarding di prompt riset", () => {
  /** Menaruh snapshot config pada run, seperti yang dilakukan admission. */
  async function setFocus(runId: string, focus: unknown) {
    await db.taskRun.update({
      where: { id: runId },
      data: { configJson: JSON.stringify({ schemaVersion: 1, focus }) },
    });
  }

  function lastBody(): string {
    return JSON.stringify(fixture.requests[fixture.requests.length - 1]!.body);
  }

  it("preset fokus masuk sebagai kalimat peran system", async () => {
    const { runId } = await admission();
    await setFocus(runId, "riset");
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const body = lastBody();
    expect(body).toContain("Fokus pengguna saat ini: riset mendalam");
    expect((await db.taskRun.findUniqueOrThrow({ where: { id: runId } })).status).toBe("completed");
  });

  it("custom dipotong 200 karakter dan karakter kontrol hilang", async () => {
    const { runId } = await admission();
    await setFocus(runId, `custom:${"a".repeat(150)}\n${"b".repeat(100)}`);
    await runTaskRun(db, config(), runId, new AbortController().signal);

    const body = lastBody();
    expect(body).not.toContain("b".repeat(51));
    expect(body).toContain("a".repeat(150));
  });

  it("focus null / JSON rusak → prompt tanpa kalimat fokus, run tetap selesai", async () => {
    const { runId } = await admission();
    await setFocus(runId, null);
    await runTaskRun(db, config(), runId, new AbortController().signal);
    expect(lastBody()).not.toContain("Fokus pengguna saat ini");

    const second = await admission("Riset kedua");
    await db.taskRun.update({ where: { id: second.runId }, data: { configJson: "{rusak" } });
    await runTaskRun(db, config(), second.runId, new AbortController().signal);
    expect(lastBody()).not.toContain("Fokus pengguna saat ini");
    expect((await db.taskRun.findUniqueOrThrow({ where: { id: second.runId } })).status).toBe("completed");
  });
});
