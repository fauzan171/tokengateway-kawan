import { describe, expect, it } from "vitest";
import { getAgentFile, listAgentFiles, parseAgentFile } from "./loader";

const SEED = `---
id: uji
name: Agen Uji
role: Pengujian
description: "Deskripsi dengan: titik dua"
model: deepseek-v4.1-flash
greeting: "Halo! Saya agen uji."
allowed_sub_agents: ["a", "b"]
---

# Badan

Prompt sebenarnya.
`;

describe("parseAgentFile", () => {
  it("memisahkan metadata dan badan prompt", () => {
    const agent = parseAgentFile("uji.md", SEED);
    expect(agent.id).toBe("uji");
    expect(agent.name).toBe("Agen Uji");
    // Titik dua di dalam string berkutip tidak memotong field.
    expect(agent.description).toBe("Deskripsi dengan: titik dua");
    expect(agent.allowedSubAgents).toEqual(["a", "b"]);
    expect(agent.body).toBe("# Badan\n\nPrompt sebenarnya.");
  });

  it("allowed_sub_agents kosong → []", () => {
    const agent = parseAgentFile("uji.md", SEED.replace('["a", "b"]', "[]"));
    expect(agent.allowedSubAgents).toEqual([]);
  });

  it("menolak frontmatter yang tidak ditutup", () => {
    expect(() => parseAgentFile("rusak.md", "---\nid: x\n")).toThrow(/tidak ditutup/);
  });

  it("menolak field wajib yang hilang", () => {
    expect(() => parseAgentFile("rusak.md", "---\nid: x\n---\n\nisi\n")).toThrow(/wajib ada/);
  });

  it("menolak badan prompt kosong", () => {
    expect(() =>
      parseAgentFile("rusak.md", "---\nid: x\nname: X\nrole: R\ndescription: D\ngreeting: G\n---\n\n"),
    ).toThrow(/kosong/);
  });

  it("menolak array bukan bentuk inline", () => {
    const broken = SEED.replace('allowed_sub_agents: ["a", "b"]', "allowed_sub_agents: a");
    expect(() => parseAgentFile("rusak.md", broken)).toThrow(/array inline/);
  });
});

describe("berkas agen di repo", () => {
  const agents = listAgentFiles();

  it("memuat katalog lengkap: teknis + nonteknis", () => {
    expect(agents.map((agent) => agent.id).sort()).toEqual([
      "architect",
      "ide-konten",
      "marketing",
      "penerjemah",
      "penulis",
      "researcher",
      "reviewer",
      "sosmed",
      "tutor",
    ]);
  });

  it("setiap allowed_sub_agents menunjuk agen yang ada", () => {
    const ids = new Set(agents.map((agent) => agent.id));
    for (const agent of agents) {
      for (const target of agent.allowedSubAgents) {
        expect(ids.has(target), `${agent.id} → ${target}`).toBe(true);
      }
    }
    expect(getAgentFile("architect")?.allowedSubAgents).toEqual(["researcher", "reviewer"]);
    expect(getAgentFile("researcher")?.allowedSubAgents).toEqual([]);
  });
});