/**
 * Katalog agent: `GET /api/kawan/v1/agents`.
 *
 * Daftar dibaca dari `agents/*.md` (loader), bukan dari kode: menambah agen
 * berarti menambah berkas, tanpa menyentuh route.
 *
 * Yang dikembalikan hanya metadata yang dibutuhkan katalog dan sapaan pembuka.
 * Badan markdown (system prompt) dan `allowed_sub_agents` TIDAK PERNAH ikut:
 * keduanya rincian internal server.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { listAgentFiles } from "@/lib/agents/loader";
import { toAgentEntry } from "@/lib/agents/public";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/agents";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    await requireContext();
    return jsonOk({ schemaVersion: 1, agents: listAgentFiles().map(toAgentEntry) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
