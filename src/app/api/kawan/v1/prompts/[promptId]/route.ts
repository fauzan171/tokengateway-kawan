/**
 * Satu prompt (WP-NT-P7-04): `DELETE` hanya untuk prompt pribadi.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { deletePrompt } from "@/lib/prompts/prompts";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/prompts/{promptId}";

type RouteContext = { params: Promise<{ promptId: string }> };

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { promptId } = await context.params;

    const { removed } = await deletePrompt(db, { userId, promptId });
    if (!removed) {
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "PROMPT_NOT_FOUND",
        message: "Prompt tidak ditemukan.",
      });
    }

    return jsonOk({ promptId, removed: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
