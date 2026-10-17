/**
 * Uji endpoint `GET /api/kawan/v1/models` (WP-NT-P2-05, SDD-3.3).
 *
 * Sesi, konfigurasi, dan logger diganti supaya route dapat diuji tanpa server
 * HTTP. Database, enkripsi, cache, dan klien gateway tetap yang asli: koneksi
 * dibuat lewat `createConnection` (kunci dienkripsi sungguhan), lalu route
 * mendekripsinya kembali. `fetch` dipalsukan sehingga tidak ada jaringan nyata.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import { createConnection } from "@/lib/connections/connections";
import type { Db } from "@/lib/db";

const state = vi.hoisted(() => ({
  userId: "",
  config: null as unknown as Config,
}));

vi.mock("@/lib/auth", () => ({
  auth: async () => (state.userId ? { user: { id: state.userId } } : null),
}));

vi.mock("@/lib/config/env", () => ({
  loadConfig: () => state.config,
}));

vi.mock("@/lib/api/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  redact: (v: unknown) => v,
  REDACTED: "[REDACTED]",
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

const { GET } = await import("./route");

const BASE = "https://gateway.contoh.test/v1";
const KEY = "sk-uji-panjang-sekali-abc1";

let temp: TempDb;
let db: Db;

function makeConfig(overrides: Partial<Config> = {}): Config {
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
    outboundAllowlist: ["gateway.contoh.test"],
    allowInsecureHttp: false,
    ...overrides,
  };
}

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  state.userId = randomUUID();
  state.config = makeConfig();
  await db.user.create({ data: { id: state.userId, email: `${state.userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

function modelsResponse(ids: string[]): Response {
  return Response.json({ data: ids.map((id) => ({ id })) }, { status: 200 });
}

function mockFetch(): ReturnType<typeof vi.spyOn> {
  const spy = vi.spyOn(globalThis, "fetch");
  spy.mockResolvedValue(modelsResponse(["gpt-4o-mini"]));
  return spy;
}

async function seedActiveConnection(): Promise<string> {
  const conn = await createConnection(db, state.config, {
    userId: state.userId,
    name: "Gateway Saya",
    baseUrl: BASE,
    apiKey: KEY,
  });
  return conn.id;
}

function request(query = ""): Request {
  return new Request(`http://localhost/api/kawan/v1/models${query}`);
}

describe("GET /api/kawan/v1/models", () => {
  it("tanpa koneksi aktif → 404 dengan pesan jelas, bukan daftar kosong", async () => {
    const res = await GET(request());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NO_ACTIVE_CONNECTION");
    expect(body.error.message).not.toBe("");
  });

  it("belum masuk → 401 UNAUTHORIZED", async () => {
    state.userId = "";
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("pengambilan pertama memanggil gateway, mengembalikan connectionId/fetchedAt/models", async () => {
    const connectionId = await seedActiveConnection();
    const spy = mockFetch();

    const res = await GET(request());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");

    const body = await res.json();
    expect(body.connectionId).toBe(connectionId);
    expect(typeof body.fetchedAt).toBe("string");
    expect(body.models).toEqual([{ id: "gpt-4o-mini" }]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("panggilan kedua memakai cache (tidak memanggil gateway lagi)", async () => {
    await seedActiveConnection();
    const spy = mockFetch();

    await GET(request());
    await GET(request());

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("refresh=1 memaksa pengambilan baru walau cache masih berlaku", async () => {
    await seedActiveConnection();
    const spy = mockFetch();

    await GET(request());
    await GET(request("?refresh=1"));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("respons TIDAK pernah memuat apiKey atau ciphertext (REQ-NT-07)", async () => {
    await seedActiveConnection();
    mockFetch();

    const text = await (await GET(request())).text();

    expect(text).not.toContain(KEY);
    expect(text).not.toContain("apiKeyEncrypted");
    expect(text).not.toContain("v1:"); // tidak ada potongan envelope
  });

  it("kegagalan gateway menjadi galat yang dipetakan, bukan 200 kosong", async () => {
    await seedActiveConnection();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: { message: "nope" } }, { status: 401 }),
    );

    const res = await GET(request());
    // 401 gateway → 502, bukan 401 (SDD-5.4).
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Key ditolak oleh gateway.");
  });
});
