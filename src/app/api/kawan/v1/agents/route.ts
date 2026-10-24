/**
 * Katalog agent (K5): `GET /api/kawan/v1/agents`.
 *
 * Yang dikembalikan hanya metadata yang dibutuhkan pemilih agent. `systemPrompt`
 * dan `tools` TIDAK PERNAH ikut: keduanya rincian internal server yang, kalau
 * bocor, memberi jalan menulis prompt yang menimpa kebijakan.
 *
 * Penyaringan audiens dilakukan di sini, bukan di klien: agent "admin" tidak
 * boleh sekadar disembunyikan dari tampilan.
 *
 * Pemetaan `toAgentEntry` sengaja tinggal di `lib/agents/public.ts`, bukan di
 * berkas ini: Next.js menolak export selain handler route dari `route.ts`
 * (build gagal "not a valid Route export field").
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { listAgents, type AgentAudience } from "@/lib/agents/registry";
import { toAgentEntry } from "@/lib/agents/public";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/agents";

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
