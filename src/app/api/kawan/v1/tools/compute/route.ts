/**
 * Endpoint tool deterministik (FIX-15).
 *
 * Model tidak menghitung angka; ia meminta hitungan ke sini. Semua hasil
 * dikembalikan sebagai string/objek terstruktur, tidak ada `eval`.
 *
 * `action` menentukan modul: `calculate`, `stats`, `count`.
 */

import { ApiError, STATUS, requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { CalcError, calculate, countText, describe } from "@/lib/tools/compute";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/tools/compute";

type Body = {
  action?: unknown;
  op?: unknown;
  operands?: unknown;
  precision?: unknown;
  rounding?: unknown;
  values?: unknown;
  kind?: unknown;
  unit?: unknown;
  text?: unknown;
  locale?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    await requireContext();
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || typeof body !== "object") {
      throw new ApiError({
        status: STATUS.BAD_REQUEST,
        code: "INVALID_BODY",
        message: "Body JSON wajib diisi.",
      });
    }

    try {
      switch (body.action) {
        case "calculate":
          return jsonOk(
            {
              result: calculate({
                op: body.op as never,
                operands: body.operands as string[],
                ...(body.precision !== undefined ? { precision: body.precision as number } : {}),
                ...(body.rounding !== undefined ? { rounding: body.rounding as never } : {}),
              }),
            },
            reqId,
          );
        case "stats":
          return jsonOk(
            {
              result: describe({
                values: body.values as (number | null)[],
                ...(body.kind !== undefined ? { kind: body.kind as "sample" | "population" } : {}),
                ...(body.unit !== undefined ? { unit: body.unit as string | null } : {}),
              }),
            },
            reqId,
          );
        case "count":
          return jsonOk(
            {
              result: countText(body.text as string, (body.locale as string | undefined) ?? "id"),
            },
            reqId,
          );
        default:
          throw new ApiError({
            status: STATUS.BAD_REQUEST,
            code: "INVALID_ACTION",
            message: "`action` harus calculate, stats, atau count.",
          });
      }
    } catch (err) {
      if (err instanceof CalcError) {
        throw new ApiError({
          status: STATUS.BAD_REQUEST,
          code: err.code,
          message: err.message,
        });
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
