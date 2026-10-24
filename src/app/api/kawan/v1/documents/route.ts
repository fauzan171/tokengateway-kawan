/**
 * Dokumen pengguna (SDD-3.6): `GET` daftar, `POST` unggah multipart.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { loadConfig } from "@/lib/config/env";
import { listDocuments, uploadDocument } from "@/lib/documents/upload";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/documents";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ documents: await listDocuments(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();

    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get("file");
    } catch {
      file = null;
    }
    if (!(file instanceof File)) {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_UPLOAD",
        message: "Berkas tidak ditemukan pada permintaan.",
      });
    }

    const document = await uploadDocument(db, loadConfig(), {
      userId,
      filename: file.name,
      mime: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });
    return jsonOk({ document }, reqId, 201);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
