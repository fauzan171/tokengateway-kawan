/**
 * Prompt pengguna (SDD-3.7, REQ-NT-62): `GET` daftar, `POST` simpan.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createPrompt, listPrompts } from "@/lib/prompts/prompts";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/prompts";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ prompts: await listPrompts(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);
    const prompt = await createPrompt(db, { userId, title: body["title"], body: body["body"] });
    return jsonOk({ prompt }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
