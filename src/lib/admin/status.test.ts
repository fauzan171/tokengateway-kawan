/**
 * Uji status sistem (REQ-NT-77, SDD-8.5).
 *
 * Dua hal yang dibuktikan: database yang gagal tidak melempar (status tetap
 * kembali dengan `ok: false`), dan komponen opsional yang tidak dikonfigurasi
 * hanya bernilai `false` — bukan galat.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { systemStatus } from "./status";

let temp: TempDb;
let db: Db;

function makeConfig(): Config {
  return {
    databaseUrl: `file:${temp.file}`,
    encryptionKey: Buffer.alloc(32, 7),
    encryptionKeyId: "v1",
    authSecret: "rahasia-sesi-uji",
    loginRateLimitMax: 5,
    loginRateLimitWindowSeconds: 900,
    passwordResetTtlSeconds: 3600,
    emailConfigured: false,
    modelCacheTtlSeconds: 600,
    outboundAllowlist: [],
    allowInsecureHttp: false,
    maxUploadBytes: 10 * 1024 * 1024,
  };
}

beforeAll(() => {
  // Semua env opsional dikosongkan: keadaan "tidak dikonfigurasi".
  vi.stubEnv("WEBSEARCH_BASE_URL", "");
  vi.stubEnv("MEDIA_IMAGE_MODEL", "");
  vi.stubEnv("MEDIA_STT_MODEL", "");
  vi.stubEnv("MEDIA_TTS_MODEL", "");
  vi.stubEnv("EMBEDDING_BASE_URL", "");
  vi.stubEnv("EMBEDDING_MODEL", "");
});

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await temp?.cleanup();
});

describe("systemStatus", () => {
  it("tanpa media/websearch/embedding → semua opsional false, database ok", async () => {
    const status = await systemStatus(db, { config: makeConfig() });

    expect(status.database.ok).toBe(true);
    expect(status.optional).toEqual({
      webSearch: false,
      imageGen: false,
      stt: false,
      tts: false,
      embedding: false,
    });
    expect(status.version).not.toBe("");
  });

  it("$queryRaw melempar → database.ok false, tidak melempar", async () => {
    const broken = {
      ...db,
      $queryRaw: async () => {
        throw new Error("koneksi putus");
      },
    } as unknown as Db;

    const status = await systemStatus(broken, { config: makeConfig() });

    expect(status.database.ok).toBe(false);
    expect(status.worker).toEqual({ lastHeartbeat: null, pendingJobs: 0, failedJobs: 0 });
    expect(status.counts).toEqual({ users: 0, chats: 0, documents: 0 });
  });

  it("menghitung job dan detak worker terakhir", async () => {
    await db.job.create({
      data: { id: randomUUID(), kind: "uji", payloadJson: "{}", state: "queued" },
    });
    await db.job.create({
      data: { id: randomUUID(), kind: "uji", payloadJson: "{}", state: "failed" },
    });
    const heartbeatAt = new Date("2026-10-18T08:00:00.000Z");
    await db.job.create({
      data: {
        id: randomUUID(),
        kind: "uji",
        payloadJson: "{}",
        state: "leased",
        heartbeatAt,
        leaseExpiresAt: new Date(heartbeatAt.getTime() + 60_000),
      },
    });

    const status = await systemStatus(db, { config: makeConfig() });

    expect(status.worker.pendingJobs).toBe(1);
    expect(status.worker.failedJobs).toBe(1);
    expect(status.worker.lastHeartbeat).toBe(heartbeatAt.toISOString());
  });
});
