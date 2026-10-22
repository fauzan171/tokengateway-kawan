/**
 * Satu artefak (FIX-11): `GET` unduh, `DELETE` hapus.
 *
 * Selalu `Content-Disposition: attachment` — HTML/SVG tidak pernah dirender di
 * origin aplikasi. `nosniff` mencegah browser menebak tipe lain.
 */

import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { deleteArtifact, openArtifactBytes } from "@/lib/artifacts/create";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/artifacts/{artifactId}";

type RouteContext = { params: Promise<{ artifactId: string }> };

/** Nama ASCII untuk fallback; RFC 5987 `filename*` membawa UTF-8 sebenarnya. */
function disposition(displayName: string): string {
  const ascii = displayName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(displayName)}`;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { artifactId } = await context.params;

    const { artifact, bytes } = await openArtifactBytes(db, userId, artifactId);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": artifact.mime,
        "content-length": String(bytes.byteLength),
        "content-disposition": disposition(artifact.displayName),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const { artifactId } = await context.params;

    await deleteArtifact(db, userId, artifactId);
    return jsonOk({ artifactId, deleted: true }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
