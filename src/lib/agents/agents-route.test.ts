/**
 * K5: katalog agent publik — hanya metadata yang aman, disaring audiens.
 *
 * Dua lapis, pola sama dengan uji route lain di repo:
 *   - `toAgentEntry`: pemetaan tidak membawa systemPrompt/tools;
 *   - `GET`: sesi + role nyata di SQLite sementara menentukan audiens.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTempDb, type TempDb } from "../../../tests/helpers/auth-db";
import type { Config } from "@/lib/config/env";
import type { Db } from "@/lib/db";
import * as registry from "./registry";

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
  it("pengguna biasa hanya melihat agent audience 'all'", async () => {
    const { status, body } = await getAgents();
    expect(status).toBe(200);
    expect(body.agents.map((agent) => agent["id"])).toContain("default");
    expect(body.agents.every((agent) => agent["audience"] === "all")).toBe(true);
  });

  it("admin melihat agent khusus admin", async () => {
    await db.user.update({ where: { id: state.userId }, data: { role: "admin" } });
    const adminAgent = {
      ...registry.getAgent("default")!,
      id: "admin-only",
      audience: "admin" as const,
    };
    const original = registry.listAgents;
    const spy = vi.spyOn(registry, "listAgents").mockImplementation((audience) =>
      audience === "admin" ? [...original(audience), adminAgent] : original(audience),
    );
    try {
      const { body } = await getAgents();
      expect(body.agents.map((agent) => agent["id"])).toContain("admin-only");
    } finally {
      spy.mockRestore();
    }
  });

  it("tanpa sesi → 401", async () => {
    state.userId = "";
    const res = await GET(new Request("http://localhost/api/kawan/v1/agents"));
    expect(res.status).toBe(401);
  });

  it("respons tidak memuat systemPrompt maupun tools", async () => {
    const { body } = await getAgents();
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("systemPrompt");
    expect(raw).not.toContain("\"tools\"");
    expect(raw).not.toContain("Kebijakan server");
  });

  it("toAgentEntry hanya memetakan field publik", () => {
    const entry = toAgentEntry({
      id: "default",
      version: 1,
      label: "Kawan",
      description: "umum",
      systemPrompt: "RAHASIA-SYSTEM-PROMPT",
      tools: ["rahasia"],
      defaultModelId: "deepseek-v4.1-flash",
      limits: { maxSteps: 40, maxTokensPerRun: 50_000, deadlineMs: 900_000 },
      audience: "all",
    });
    expect(Object.keys(entry).sort()).toEqual(
      ["audience", "defaultModelId", "description", "id", "label", "limits", "version"].sort(),
    );
    expect(JSON.stringify(entry)).not.toContain("RAHASIA");
  });
});