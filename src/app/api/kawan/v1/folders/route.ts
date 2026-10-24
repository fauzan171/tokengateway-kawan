/**
 * Folder satu tingkat (REQ-NT-35, SDD-2.2): `GET` daftar, `POST` buat.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { createFolder, listFolders } from "@/lib/chat/folders";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/folders";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ folders: await listFolders(db, userId) }, reqId);
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
    const folder = await createFolder(db, userId, body.name);
    return jsonOk({ folder }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
