/**
 * Ekspor CSV pemakaian (REQ-NT-73, SDD-3.7).
 *
 * `GET /api/kawan/v1/usage/export.csv?from=&to=` — baris mentah, bukan agregat.
 * Token saja: tidak ada kolom biaya (REQ-NT-72).
 */

import { REQUEST_ID_HEADER, requestId } from "@/lib/api/errors";
import { handleRouteError, requireContext } from "@/lib/api/route";
import { parseUsageRange, usageCsv, usageRowsForExport } from "@/lib/chat/usage";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/usage/export.csv";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { from, to } = parseUsageRange(new URL(request.url).searchParams);
    const rows = await usageRowsForExport(db, { userId, from, to });

    return new Response(usageCsv(rows), {
      headers: {
        [REQUEST_ID_HEADER]: reqId,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="pemakaian.csv"',
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
