/**
 * Pembacaan jawaban (WP-NT-P8-04, REQ-NT-68).
 *
 * `POST /api/kawan/v1/media/speech` body `{ text }` → biner `audio/mpeg`,
 * bukan JSON: klien langsung membuat blob untuk diputar.
 */

import { REQUEST_ID_HEADER, requestId } from "@/lib/api/errors";
import { handleRouteError, readJson, requireContext } from "@/lib/api/route";
import { resolveMediaTarget } from "@/lib/media/config";
import { synthesizeSpeech } from "@/lib/media/audio";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/media/speech";

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);
    const text = typeof body["text"] === "string" ? body["text"] : "";

    const target = await resolveMediaTarget(db, userId);
    const speech = await synthesizeSpeech({ ...target, text });

    return new Response(new Blob([speech.bytes], { type: speech.mime }), {
      status: 200,
      headers: {
        "content-type": speech.mime,
        [REQUEST_ID_HEADER]: reqId,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
