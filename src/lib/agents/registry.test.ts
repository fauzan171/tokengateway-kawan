/**
 * K1: registry agent beku — penyaringan audiens, id asing, batas waras.
 */

import { describe, expect, it } from "vitest";
import { getAgent, listAgents } from "./registry";

describe("registry agent", () => {
  it("memuat agent default", () => {
    const agent = getAgent("default");
    expect(agent).not.toBeNull();
    expect(agent?.version).toBe(1);
    expect(agent?.defaultModelId).toBe("deepseek-v4.1-flash");
    expect(agent?.systemPrompt.length).toBeGreaterThan(0);
    expect(agent?.tools).toEqual([]);
  });

  it("listAgents('all') tidak memuat agent khusus admin", () => {
    const ids = listAgents("all").map((agent) => agent.id);
    expect(ids).toContain("default");
    for (const agent of listAgents("all")) {
      expect(agent.audience).toBe("all");
    }
    // Admin melihat setidaknya semua yang dilihat pengguna biasa.
    const adminIds = listAgents("admin").map((agent) => agent.id);
    expect(adminIds).toEqual(expect.arrayContaining(ids));
  });

  it("getAgent('asing') mengembalikan null", () => {
    expect(getAgent("asing")).toBeNull();
  });

  it("setiap agent punya limit positif dan id unik", () => {
    const agents = listAgents("admin");
    expect(new Set(agents.map((agent) => agent.id)).size).toBe(agents.length);
    for (const agent of agents) {
      expect(agent.limits.maxSteps).toBeGreaterThan(0);
      expect(agent.limits.maxTokensPerRun).toBeGreaterThan(0);
      expect(agent.limits.deadlineMs).toBeGreaterThan(0);
      expect(agent.version).toBeGreaterThan(0);
    }
  });
});
