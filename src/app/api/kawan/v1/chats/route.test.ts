import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import { createChat } from "@/lib/chat/chats";

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

const { GET, POST } = await import("./route");

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

describe("GET & POST /api/kawan/v1/chats", () => {
  beforeEach(async () => {
    temp = await createTempDb();
    db = temp.db;
    state.config = makeConfig();
    state.userId = "user_test_1";

    await db.user.create({
      data: {
        id: state.userId,
        email: "test@contoh.test",
        name: "Tester",
      },
    });
  });

  afterAll(async () => {
    await temp?.cleanup();
  });

  it("menolak tanpa sesi (401)", async () => {
    state.userId = "";
    const res = await GET(new Request("http://localhost/api/kawan/v1/chats"));
    expect(res.status).toBe(401);
  });

  it("POST membuat chat baru", async () => {
    const res = await POST(
      new Request("http://localhost/api/kawan/v1/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Diskusi Desain", modelRef: "gpt-4o" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("Diskusi Desain");
    expect(body.modelRef).toBe("gpt-4o");
    expect(body.id).toBeTruthy();
  });

  it("GET mengembalikan daftar berpaginasi kursor", async () => {
    await createChat(db, { userId: state.userId, title: "Chat Alpha" });
    await createChat(db, { userId: state.userId, title: "Chat Beta" });

    const res = await GET(new Request("http://localhost/api/kawan/v1/chats?limit=1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chats).toHaveLength(1);
    expect(body.nextCursor).toBeTruthy();

    const res2 = await GET(
      new Request(`http://localhost/api/kawan/v1/chats?limit=1&cursor=${body.nextCursor}`),
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.chats).toHaveLength(1);
    expect(body2.chats[0].id).not.toBe(body.chats[0].id);
  });
});
