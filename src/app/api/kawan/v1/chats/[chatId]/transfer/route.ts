/**
 * Ekspor satu chat (REQ-NT-39/40, SDD-3.5).
 *
 * `GET ?format=md` → Markdown, tanpa `format` → JSON `kawan.chat.v1`.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { exportChatJson, exportChatMarkdown } from "@/lib/chat/transfer";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats/{chatId}/transfer";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;

    if (new URL(request.url).searchParams.get("format") === "md") {
      const markdown = await exportChatMarkdown(db, userId, chatId);
      return new Response(markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="kawan-${chatId}.md"`,
          "cache-control": "private, no-store",
          "x-request-id": reqId,
        },
      });
    }

    return jsonOk({ chat: await exportChatJson(db, userId, chatId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
