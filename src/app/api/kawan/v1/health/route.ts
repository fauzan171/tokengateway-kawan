/**
 * Endpoint kesiapan (FIX-24).
 *
 * `GET /api/kawan/v1/health` — publik, tanpa sesi: supervisor dan load balancer
 * harus bisa memanggilnya. Karena publik, isinya sengaja minimum: boolean +
 * alasan ringkas. Detail lengkap hanya di `admin/status` yang wajib sesi admin.
 */

import { requestId } from "@/lib/api/errors";
import { getDb } from "@/lib/db";
import { loadConfig } from "@/lib/config/env";
import { handleRouteError, jsonOk } from "@/lib/api/route";
import { liveness, publicReadiness, readiness } from "@/lib/ops/health";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/health";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const url = new URL(request.url);
    // `?liveness=1` untuk supervisor yang hanya ingin tahu prosesnya hidup;
    // sengaja tidak menyentuh DB supaya restart tidak dipicu DB yang sibuk.
    if (url.searchParams.get("liveness") === "1") {
      return jsonOk(liveness(), reqId);
    }

    const db = await getDb(loadConfig().databaseUrl);
    const report = await readiness({ db });
    const body = publicReadiness(report);
    return jsonOk(body, reqId, body.ready ? 200 : 503);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
