/**
 * Preferensi pribadi (SDD-3.7, REQ-NT-70): `GET` baca, `PATCH` ubah sebagian.
 *
 * `PATCH` juga menulis cookie `kawan-locale` supaya `layout.tsx` bisa menyetel
 * `lang` dan kamus tanpa query DB tiap request.
 */

import { cookies } from "next/headers";
import { requestId } from "@/lib/api/errors";
import { handleRouteError, jsonOk, readJson, requireContext } from "@/lib/api/route";
import { LOCALE_COOKIE, LOCALE_MAX_AGE, isLocale } from "@/lib/i18n/server";
import { readSettings, writeSettings } from "@/lib/settings/settings";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/settings";

export async function GET(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    return jsonOk({ settings: await readSettings(db, userId) }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();
  try {
    const { userId, db } = await requireContext();
    const body = await readJson(request);
    const settings = await writeSettings(db, userId, body);

    if (isLocale(body["locale"])) {
      (await cookies()).set(LOCALE_COOKIE, settings.locale, {
        path: "/",
        maxAge: LOCALE_MAX_AGE,
        sameSite: "lax",
        httpOnly: false,
      });
    }

    return jsonOk({ settings }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
