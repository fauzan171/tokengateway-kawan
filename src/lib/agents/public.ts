/**
 * Bentuk publik katalog agent.
 *
 * Dipisah dari `route.ts` karena Next.js hanya mengizinkan handler route
 * diekspor dari berkas route. Menaruh pemetaan di sini juga membuat aturan
 * "body (system prompt) tidak pernah keluar" bisa diuji tanpa HTTP.
 */

import type { AgentFile } from "./loader";

export type AgentEntry = {
  id: string;
  name: string;
  role: string;
  description: string;
  model: string;
  greeting: string;
};

/** Field publik saja. `body` dan `allowedSubAgents` sengaja tidak dipetakan. */
export function toAgentEntry(agent: AgentFile): AgentEntry {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    description: agent.description,
    model: agent.model,
    greeting: agent.greeting,
  };
}
