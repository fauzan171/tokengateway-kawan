/**
 * Pemakaian token (SDD-3.7, REQ-NT-71/72).
 *
 * `GET /api/kawan/v1/usage?from=&to=&groupBy=day|model`
 *
 * Hanya jumlah token. Tidak ada harga, saldo, atau biaya di mana pun —
 * gateway tidak memberi tahu tarif, jadi angka rupiah apa pun akan karangan.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { parseUsageRange, usageByDay, usageByModel } from "@/lib/chat/usage";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/usage";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const params = new URL(request.url).searchParams;
    const groupBy = params.get("groupBy") ?? "day";
    if (groupBy !== "day" && groupBy !== "model") {
      throw new ApiError({ status: STATUS.BAD_REQUEST, code: "INVALID_GROUP", message: "groupBy harus day atau model." });
    }

    const { from, to } = parseUsageRange(params);
    const result =
      groupBy === "day"
        ? await usageByDay(db, { userId, from, to })
        : await usageByModel(db, { userId, from, to });
    return jsonOk(result, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
