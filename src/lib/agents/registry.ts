/**
 * K1: registry agent beku.
 *
 * Katalog agent yang boleh dipakai sebuah run, dibekukan di kode (bukan di DB):
 * menambah agent berarti mengubah kode dan menaikkan versinya, sehingga setiap
 * TaskRun bisa menyebut agent + versi yang benar-benar dipakai.
 *
 * Prompt agent "default" DITURUNKAN dari penyusun prompt yang sudah ada
 * (src/lib/chat/prompt-builder.ts) agar perilakunya setara perilaku sekarang dan
 * tidak menyimpang saat kebijakan di sana berubah. Bila prompt berubah, naikkan
 * `version` agent.
 */

import { composeSystemPrompt } from "@/lib/chat/prompt-builder";

export type AgentAudience = "all" | "admin";

export type AgentLimits = {
  maxSteps: number;
  maxTokensPerRun: number;
  deadlineMs: number;
};

export type AgentDefinition = {
  id: string;
  /** Naik setiap kali prompt/limit agent berubah; ikut disimpan di TaskRun. */
  version: number;
  label: string;
  description: string;
  systemPrompt: string;
  tools: readonly string[];
  defaultModelId: string;
  limits: AgentLimits;
  audience: AgentAudience;
};

/** Prompt agent default: kebijakan server + fakta kemampuan tanpa tool. */
const DEFAULT_SYSTEM_PROMPT = composeSystemPrompt({
  tools: [],
  webSearch: false,
  canSeeImages: false,
  canRunCode: false,
}).content;

const AGENTS: readonly AgentDefinition[] = Object.freeze([
  Object.freeze({
    id: "default",
    version: 1,
    label: "Kawan",
    description: "Asisten umum tanpa tool: menjawab dari pengetahuan model dan konteks yang diberikan.",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    tools: Object.freeze([] as string[]),
    defaultModelId: "deepseek-v4.1-flash",
    limits: Object.freeze({ maxSteps: 40, maxTokensPerRun: 50_000, deadlineMs: 900_000 }),
    audience: "all" as const,
  }),
]);

/** Agent yang boleh dipakai penonton ini; urutan katalog dipertahankan. */
export function listAgents(audience: AgentAudience): AgentDefinition[] {
  return AGENTS.filter((agent) => agent.audience === "all" || audience === "admin");
}

/** Agent berdasarkan id; null bila asing (pemanggil yang memutuskan galatnya). */
export function getAgent(id: string): AgentDefinition | null {
  return AGENTS.find((agent) => agent.id === id) ?? null;
}
