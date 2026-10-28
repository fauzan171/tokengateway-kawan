/**
 * Katalog agent publik — hanya metadata yang aman, dibaca dari `agents/*.md`.
 *
 * Dua lapis, pola sama dengan uji route lain di repo:
 *   - `toAgentEntry`: pemetaan tidak membawa badan prompt / allowed_sub_agents;
 *   - `GET`: sesi nyata di SQLite sementara; katalog datang dari berkas agen.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
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

const { GET } = await import("@/app/api/kawan/v1/agents/route");
const { toAgentEntry } = await import("@/lib/agents/public");

let temp: TempDb;
let db: Db;

beforeEach(async () => {
  temp = await createTempDb();
  db = temp.db;
  state.userId = randomUUID();
  state.config = {
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
  await db.user.create({ data: { id: state.userId, email: `${state.userId}@contoh.test` } });
});

afterAll(async () => {
  await temp.cleanup();
});

type AgentBody = {
  schemaVersion: number;
  agents: Array<Record<string, unknown>>;
};

async function getAgents(): Promise<{ status: number; body: AgentBody }> {
  const res = await GET(new Request("http://localhost/api/kawan/v1/agents"));
  return { status: res.status, body: (await res.json()) as AgentBody };
}

describe("GET /api/kawan/v1/agents", () => {
  it("mengembalikan agen dari agents/*.md beserta greeting", async () => {
    const { status, body } = await getAgents();
    expect(status).toBe(200);
    const ids = body.agents.map((agent) => agent["id"]);
    expect(ids).toEqual(expect.arrayContaining(["architect", "researcher", "reviewer"]));
    for (const agent of body.agents) {
      expect(typeof agent["name"]).toBe("string");
      expect(typeof agent["role"]).toBe("string");
      expect(typeof agent["greeting"]).toBe("string");
      expect((agent["greeting"] as string).length).toBeGreaterThan(0);
    }
  });

  it("tanpa sesi → 401", async () => {
    state.userId = "";
    const res = await GET(new Request("http://localhost/api/kawan/v1/agents"));
    expect(res.status).toBe(401);
  });

  it("respons tidak memuat badan prompt maupun allowed_sub_agents", async () => {
    const { body } = await getAgents();
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("allowedSubAgents");
    expect(raw).not.toContain("allowed_sub_agents");
    expect(raw).not.toContain("systemPrompt");
    // Kalimat pertama badan prompt architect tidak boleh ikut.
    expect(raw).not.toContain("merancang, bukan menulis");
  });

  it("toAgentEntry hanya memetakan field publik", () => {
    const entry = toAgentEntry({
      id: "arsitek",
      name: "Arsitek",
      role: "Arsitektur",
      description: "umum",
      model: "deepseek-v4.1-flash",
      greeting: "Halo!",
      allowedSubAgents: ["rahasia-sub"],
      body: "RAHASIA-SYSTEM-PROMPT",
    });
    expect(Object.keys(entry).sort()).toEqual(
      ["description", "greeting", "id", "model", "name", "role"].sort(),
    );
    expect(JSON.stringify(entry)).not.toContain("RAHASIA");
  });
});
