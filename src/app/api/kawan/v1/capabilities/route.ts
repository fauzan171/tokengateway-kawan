/**
 * Kemampuan server yang boleh diketahui klien (WP-NT-P7-01, REQ-NT-51).
 *
 * `GET /api/kawan/v1/capabilities`
 *
 * Hanya boolean. Base URL, kunci, atau nama model tidak pernah ikut: klien
 * cukup tahu tombol mana yang pantas ditampilkan.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { readWebSearchConfig } from "@/lib/search/web";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/capabilities";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    await requireContext();
    return jsonOk({ webSearch: Boolean(readWebSearchConfig()) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
