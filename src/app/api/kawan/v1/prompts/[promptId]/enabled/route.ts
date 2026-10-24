/**
 * Aktif/nonaktif prompt bawaan (WP-NT-P7-06, REQ-NT-64). Khusus admin.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { setPromptEnabled } from "@/lib/prompts/prompts";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/prompts/{promptId}/enabled";

type RouteContext = { params: Promise<{ promptId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { promptId } = await context.params;

    const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== "admin") {
      throw new ApiError({
        status: STATUS.FORBIDDEN,
        code: "FORBIDDEN",
        message: "Hanya admin yang boleh mengubah prompt bawaan.",
      });
    }

    const body = await readJson(request);
    const { updated } = await setPromptEnabled(db, { promptId, enabled: body["enabled"] });
    if (!updated) {
      throw new ApiError({
        status: STATUS.NOT_FOUND,
        code: "PROMPT_NOT_FOUND",
        message: "Prompt bawaan tidak ditemukan.",
      });
    }

    return jsonOk({ promptId, updated: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
