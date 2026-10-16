/**
 * Uji cache daftar model (WP-NT-P2-05, REQ-NT-20, SDD-3.3).
 *
 * Memakai SQLite sementara dari `tests/helpers/auth-db.ts`: skema `ModelCache`
 * yang dikirim repo dijalankan apa adanya, jadi uji ini sekaligus membuktikan
 * kolom `connectionId` unik dan `fetchedAt` benar-benar dipakai sebagai dasar
 * TTL.
 *
 * TTL diuji dengan menyuntikkan `now` — bukan dengan memalsukan timer — supaya
 * sifat yang dibuktikan persis seperti yang diminta: umur dihitung dari
 * `fetchedAt` di DATA.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Db } from "@/lib/db";
import type { GatewayModel } from "@/lib/providers/gateway";
import { getCachedModels, putCachedModels } from "./model-cache";

const TTL = 600;
const MODELS: GatewayModel[] = [
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4o", capabilities: { vision: true } },
];

let temp: TempDb;
let db: Db;
let connectionId: string;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  connectionId = randomUUID();
  const userId = randomUUID();
  await db.user.create({ data: { id: userId, email: `${userId}@contoh.test` } });
  await db.connection.create({
    data: {
      id: connectionId,
      userId,
      name: "Gateway Uji",
      baseUrl: "https://api.contoh.test/v1",
      apiKeyEncrypted: "v1:test:test:test:test",
      apiKeyMask: "sk-...abc1",
      keyId: "v1",
      isActive: 1,
      status: "active",
    },
  });
});

afterAll(async () => {
  await temp.cleanup();
});

const T0 = new Date("2026-10-16T00:00:00.000Z");

describe("getCachedModels", () => {
  it("null bila belum pernah diisi", async () => {
    expect(await getCachedModels(db, { connectionId, ttlSeconds: TTL, now: T0 })).toBeNull();
  });

  it("dalam TTL: cache dipakai, fetchedAt dari DATA dipertahankan", async () => {
    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });

    const dalam = await getCachedModels(db, {
      connectionId,
      ttlSeconds: TTL,
      now: new Date(T0.getTime() + (TTL - 1) * 1000),
    });

    expect(dalam?.models).toEqual(MODELS);
    expect(dalam?.fetchedAt.getTime()).toBe(T0.getTime());
  });

  it("tepat pada TTL: sudah kedaluwarsa (batas eksklusif)", async () => {
    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });

    expect(
      await getCachedModels(db, {
        connectionId,
        ttlSeconds: TTL,
        now: new Date(T0.getTime() + TTL * 1000),
      }),
    ).toBeNull();
  });

  it("setelah TTL: null, sehingga pemanggil mengambil ulang", async () => {
    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });

    expect(
      await getCachedModels(db, {
        connectionId,
        ttlSeconds: TTL,
        now: new Date(T0.getTime() + (TTL + 1) * 1000),
      }),
    ).toBeNull();
  });

  it("JSON rusak diperlakukan sebagai cache kosong, bukan galat", async () => {
    await db.modelCache.create({
      data: { id: randomUUID(), connectionId, modelListJson: "{bukan json", fetchedAt: T0 },
    });

    expect(await getCachedModels(db, { connectionId, ttlSeconds: TTL, now: T0 })).toBeNull();
  });
});

describe("putCachedModels", () => {
  it("upsert: satu baris per koneksi, pengambilan ulang menimpa", async () => {
    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });
    const T1 = new Date(T0.getTime() + 60_000);
    await putCachedModels(db, { connectionId, models: [{ id: "baru" }], now: T1 });

    expect(await db.modelCache.count({ where: { connectionId } })).toBe(1);
    const cached = await getCachedModels(db, { connectionId, ttlSeconds: TTL, now: T1 });
    expect(cached?.models).toEqual([{ id: "baru" }]);
    expect(cached?.fetchedAt.getTime()).toBe(T1.getTime());
  });

  it("kapabilitas ikut tersimpan dan kembali utuh (round-trip)", async () => {
    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });
    const cached = await getCachedModels(db, { connectionId, ttlSeconds: TTL, now: T0 });

    // Model tanpa kapabilitas tetap tidak punya field itu setelah round-trip.
    expect(cached?.models[0]).not.toHaveProperty("capabilities");
    expect(cached?.models[1]?.capabilities).toEqual({ vision: true });
  });

  it("koneksi berbeda punya baris cache masing-masing", async () => {
    const userId2 = randomUUID();
    await db.user.create({ data: { id: userId2, email: `${userId2}@contoh.test` } });
    const lain = randomUUID();
    await db.connection.create({
      data: {
        id: lain,
        userId: userId2,
        name: "Gateway Lain",
        baseUrl: "https://api.lain.test/v1",
        apiKeyEncrypted: "v1:test:test:test:test",
        apiKeyMask: "sk-...xyz9",
        keyId: "v1",
        isActive: 1,
        status: "active",
      },
    });

    await putCachedModels(db, { connectionId, models: MODELS, now: T0 });
    await putCachedModels(db, { connectionId: lain, models: [{ id: "lain" }], now: T0 });

    expect(await db.modelCache.count()).toBe(2);
    const cachedLain = await getCachedModels(db, { connectionId: lain, ttlSeconds: TTL, now: T0 });
    expect(cachedLain?.models).toEqual([{ id: "lain" }]);
  });
});
