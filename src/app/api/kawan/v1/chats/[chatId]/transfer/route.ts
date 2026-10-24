/**
 * Ekspor satu chat (REQ-NT-39/40, SDD-3.5).
 *
 * `GET ?format=md` → Markdown; `pdf` → PDF; `docx` → DOCX; `xlsx` → XLSX.
 * Tanpa `format` → JSON `kawan.chat.v1`.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import {
  exportChatDocxBytes,
  exportChatJson,
  exportChatMarkdown,
  exportChatPdfBytes,
  exportChatXlsxBytes,
} from "@/lib/chat/transfer";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/chats/{chatId}/transfer";

type RouteContext = { params: Promise<{ chatId: string }> };

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { chatId } = await context.params;
    const format = new URL(request.url).searchParams.get("format");

    if (format === "md") {
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

    if (format === "pdf" || format === "docx" || format === "xlsx") {
      const transcript = await exportChatJson(db, userId, chatId);
      const bytes =
        format === "pdf"
          ? exportChatPdfBytes({ title: transcript.chat.title, messages: transcript.messages })
          : format === "docx"
            ? exportChatDocxBytes({ title: transcript.chat.title, messages: transcript.messages })
            : exportChatXlsxBytes({ title: transcript.chat.title, messages: transcript.messages });

      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type":
            format === "pdf"
              ? "application/pdf"
              : format === "docx"
                ? DOCX_MIME
                : XLSX_MIME,
          "content-disposition": `attachment; filename="kawan-${chatId}.${format}"`,
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
