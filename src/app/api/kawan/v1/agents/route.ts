/**
 * Katalog agent (K5): `GET /api/kawan/v1/agents`.
 *
 * Yang dikembalikan hanya metadata yang dibutuhkan pemilih agent. `systemPrompt`
 * dan `tools` TIDAK PERNAH ikut: keduanya rincian internal server yang, kalau
 * bocor, memberi jalan menulis prompt yang menimpa kebijakan.
 *
 * Penyaringan audiens dilakukan di sini, bukan di klien: agent "admin" tidak
 * boleh sekadar disembunyikan dari tampilan.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { listAgents, type AgentAudience, type AgentDefinition } from "@/lib/agents/registry";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/agents";

/** Bentuk publik satu agent; sengaja tidak memuat systemPrompt/tools. */
export type AgentEntry = {
  id: string;
  version: number;
  label: string;
  description: string;
  defaultModelId: string;
  limits: { maxSteps: number; maxTokensPerRun: number; deadlineMs: number };
  audience: AgentAudience;
};

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

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    const audience: AgentAudience = user?.role === "admin" ? "admin" : "all";
    return jsonOk({ schemaVersion: 1, agents: listAgents(audience).map(toAgentEntry) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
