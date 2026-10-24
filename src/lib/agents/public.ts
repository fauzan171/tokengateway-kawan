/**
 * Bentuk publik katalog agent (K5).
 *
 * Dipisah dari `route.ts` karena Next.js hanya mengizinkan handler route
 * diekspor dari berkas route. Menaruh pemetaan di sini juga membuat aturan
 * "systemPrompt dan tools tidak pernah keluar" bisa diuji tanpa HTTP.
 */

import type { AgentAudience, AgentDefinition } from "./registry";

export type AgentEntry = {
  id: string;
  version: number;
  label: string;
  description: string;
  defaultModelId: string;
  limits: { maxSteps: number; maxTokensPerRun: number; deadlineMs: number };
  audience: AgentAudience;
};

/** Field publik saja. `systemPrompt` dan `tools` sengaja tidak dipetakan. */
export function toAgentEntry(agent: AgentDefinition): AgentEntry {
  return {
    id: agent.id,
    version: agent.version,
    label: agent.label,
    description: agent.description,
    defaultModelId: agent.defaultModelId,
    limits: {
      maxSteps: agent.limits.maxSteps,
      maxTokensPerRun: agent.limits.maxTokensPerRun,
      deadlineMs: agent.limits.deadlineMs,
    },
    audience: agent.audience,
  };
}
