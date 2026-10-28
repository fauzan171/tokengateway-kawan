import { describe, expect, it } from "vitest";
import {
  CALL_AGENT_TOOL_NAME,
  DELEGATION_MAX_CHARS,
  callAgentTool,
  delegateToolText,
  parseCallAgentArgs,
  toolCallId,
} from "./delegate";
import { getAgentFile } from "./loader";

describe("callAgentTool", () => {
  it("enum target dibatasi ke sub-agen yang diizinkan", () => {
    const tool = callAgentTool(["researcher", "reviewer"]);
    expect(tool.function.name).toBe(CALL_AGENT_TOOL_NAME);
    const target = (tool.function.parameters.properties as Record<string, { enum?: string[] }>)
      .target_agent_id;
    expect(target?.enum).toEqual(["researcher", "reviewer"]);
  });

  it("daftar kosong tetap menghasilkan schema sah, bukan undefined", () => {
    const tool = callAgentTool([]);
    const target = (tool.function.parameters.properties as Record<string, { enum?: string[] }>)
      .target_agent_id;
    expect(target?.enum).toEqual([]);
  });
});

describe("parseCallAgentArgs", () => {
  it("objek sah dinormalisasi (trim)", () => {
    expect(
      parseCallAgentArgs({ target_agent_id: " researcher ", task_payload: " cari X " }),
    ).toEqual({ targetAgentId: "researcher", taskPayload: "cari X", context: "" });
  });

  it("context hilang → string kosong", () => {
    const args = parseCallAgentArgs({ target_agent_id: "a", task_payload: "b" });
    expect(args.context).toBe("");
  });

  it("menolak bukan objek", () => {
    expect(() => parseCallAgentArgs(null)).toThrow(/harus objek/);
    expect(() => parseCallAgentArgs(["a"])).toThrow(/harus objek/);
    expect(() => parseCallAgentArgs("teks")).toThrow(/harus objek/);
  });

  it("menolak target atau payload kosong", () => {
    expect(() => parseCallAgentArgs({ target_agent_id: "", task_payload: "b" })).toThrow(
      /target_agent_id wajib/,
    );
    expect(() => parseCallAgentArgs({ target_agent_id: "a", task_payload: "  " })).toThrow(
      /task_payload wajib/,
    );
  });
});

describe("berkas agen membatasi delegasi", () => {
  it("architect boleh memanggil researcher & reviewer; leaf tidak memanggil siapa pun", () => {
    expect(getAgentFile("architect")?.allowedSubAgents).toEqual(["researcher", "reviewer"]);
    expect(getAgentFile("researcher")?.allowedSubAgents).toEqual([]);
    expect(getAgentFile("reviewer")?.allowedSubAgents).toEqual([]);
  });

  it("tidak ada agen yang mengizinkan dirinya sendiri (anti-loop)", () => {
    for (const id of ["architect", "researcher", "reviewer"]) {
      expect(getAgentFile(id)?.allowedSubAgents).not.toContain(id);
    }
  });
});

describe("delegateToolText", () => {
  it("hasil sukses menyebut agen sumbernya", () => {
    const text = delegateToolText({ status: "ok", text: "temuan" }, "researcher");
    expect(text).toContain("researcher");
    expect(text).toContain("temuan");
  });

  it("kegagalan tetap jadi teks, tidak pernah string kosong", () => {
    const text = delegateToolText(
      { status: "failed", message: "gateway mati", errorCode: "UPSTREAM_ERROR" },
      "reviewer",
    );
    expect(text).toContain("UPSTREAM_ERROR");
    expect(text).toContain("gateway mati");
  });
});

describe("batas hasil", () => {
  it("DELEGATION_MAX_CHARS masuk akal untuk konteks lead", () => {
    expect(DELEGATION_MAX_CHARS).toBeGreaterThan(0);
    expect(DELEGATION_MAX_CHARS).toBeLessThanOrEqual(8_000);
  });
});

describe("toolCallId", () => {
  it("memakai id model bila ada, membuat id sendiri bila kosong", () => {
    expect(toolCallId("call_abc")).toBe("call_abc");
    expect(toolCallId(undefined)).toMatch(/^call_/);
    expect(toolCallId("  ")).toMatch(/^call_/);
  });
});
