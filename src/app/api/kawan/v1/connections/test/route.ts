/**
 * Endpoint uji koneksi gateway TANPA menyimpan (WP-NT-P2-06, REQ-NT-02,
 * SDD-3.2, SDD-5.4).
 *
 * `POST /api/kawan/v1/connections/test`
 *
 * Route ini sengaja hanya penyambung HTTP. Ia TIDAK menulis ulang normalisasi
 * URL (`src/lib/connections/url.ts`) maupun klien HTTP (`src/lib/providers/`):
 * keduanya dipanggil apa adanya, sehingga aturan `v1` tidak digandakan, header
 * `Authorization` tetap satu sumber, dan kebijakan keluar/SSRF tetap berlaku.
 *
 * Tiga keputusan bentuk yang mudah salah:
 *
 * 1. **Kegagalan uji adalah 200, bukan 4xx.** Key ditolak, timeout, atau daftar
 *    model kosong adalah HASIL uji (`{ ok: false, reason, message }`), bukan
 *    galat permintaan. Klien tidak boleh memperlakukannya sebagai request gagal.
 * 2. **Hanya input salah bentuk/value yang 4xx.** Body bukan objek JSON → 400.
 *    `baseUrl`/`apiKey` bertipe salah atau tidak sah → 422. Kegagalan
 *    normalisasi baseUrl (mis. `http://` saat `allowInsecureHttp` mati) termasuk
 *    di sini: uji belum sempat berjalan, jadi itu bukan hasil uji — sama seperti
 *    `createConnection` (kontrak `lib/connections`).
 * 3. **`apiKey` tidak pernah kembali.** Respons sukses hanya memuat
 *    `modelCount` dan beberapa contoh nama model; `apiKey` juga tidak pernah
 *    ditulis eksplisit ke log (SDD-3.1; REQ-NT-07). Body permintaan tidak
 *    dicatat sama sekali.
 *
 * Otorisasi: `userId` diturunkan dari sesi, tidak pernah dari body (SDD-3.1).
 * Route ini tidak menyentuh database — tidak ada yang disimpan.
 *
 * Batas jujur (dilaporkan WP-NT-P2-05): `reason` `DNS` dan `TLS` ada di kosakata
 * SDD-3.2 tetapi belum dapat dipicu dari sini, karena `fetchJson` (dibekukan)
 * merangkum seluruh kegagalan transport menjadi satu `UPSTREAM_UNAVAILABLE`.
 * Route tetap memetakan apa pun yang keluar dari `listModels` dengan benar:
 * kegagalan transport tampil sebagai `UPSTREAM_ERROR` + "Koneksi terputus."
 */

import { NextResponse } from "next/server";
import { ApiError, REQUEST_ID_HEADER, STATUS, requestId, toErrorResponse } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { auth } from "@/lib/auth";
import { loadConfig } from "@/lib/config/env";
import { normalizeBaseUrl } from "@/lib/connections/url";
import { fromApiError, type ProviderReason } from "@/lib/providers/errors";
import { listModels } from "@/lib/providers/gateway";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/connections/test";

/** Jumlah contoh nama model pada respons sukses. Beberapa saja, bukan seluruh
 *  daftar (SDD-3.2: `sampleModels`). */
const SAMPLE_MODEL_LIMIT = 3;

/** Sesi wajib ada. Identitas hanya dari sesi, bukan dari body (SDD-3.1). */
async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError({
      status: STATUS.UNAUTHORIZED,
      code: "UNAUTHORIZED",
      message: "Belum masuk.",
    });
  }
  return userId;
}

/** Body JSON; galat parse jadi 400, bukan 500. */
async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_JSON",
      message: "Format JSON tidak valid.",
    });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_JSON",
      message: "Body harus berupa objek JSON.",
    });
  }
  return body as Record<string, unknown>;
}

/** `baseUrl` harus berupa teks. String kosong diserahkan ke `normalizeBaseUrl`
 *  supaya pesan "wajib diisi" hanya punya satu sumber. */
function readBaseUrl(body: Record<string, unknown>): string {
  const raw = body["baseUrl"];
  if (typeof raw !== "string") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "BAD_URL",
      message: "Base URL harus berupa teks.",
    });
  }
  return raw;
}

/** `apiKey` wajib berupa teks tidak kosong — selaras `requireApiKey` di
 *  `lib/connections` (kontrak dibekukan). Kunci kosong tidak diuji: gateway
 *  BYOK tidak bisa dinilai tanpa kredensial, dan form uji selalu punya isinya. */
function readApiKey(body: Record<string, unknown>): string {
  const raw = body["apiKey"];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "INVALID_API_KEY",
      message: "API key wajib diisi.",
    });
  }
  return raw.trim();
}

/** Respons 200 bentuk SDD-3.2, baik sukses maupun gagal uji. */
function testResponse(payload: unknown, reqId: string): Response {
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      [REQUEST_ID_HEADER]: reqId,
      // Isi ini bergantung kredensial pengguna; jangan di-cache bersama.
      "cache-control": "private, no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  try {
    const userId = await requireUserId();
    const body = await readJsonObject(request);
    const baseUrlRaw = readBaseUrl(body);
    const apiKey = readApiKey(body);

    const config = loadConfig();
    const normalized = normalizeBaseUrl(baseUrlRaw, {
      allowInsecureHttp: config.allowInsecureHttp,
    });
    if (!normalized.ok) {
      // Uji belum berjalan, jadi ini bukan hasil uji: 422 dengan `code` dari
      // kosakata normalisasi (BAD_URL | BAD_SCHEME | BAD_HOST), sama seperti
      // `normalizeOrThrow` di `lib/connections`.
      throw new ApiError({
        status: STATUS.UNPROCESSABLE,
        code: normalized.reason,
        message: normalized.message,
      });
    }

    let failure: { reason: ProviderReason; message: string } | null = null;
    let modelCount = 0;
    let sampleModels: string[] = [];

    try {
      const result = await listModels({
        baseUrl: normalized.url,
        apiKey,
        outbound: {
          allowInsecureHttp: config.allowInsecureHttp,
          allowlist: config.outboundAllowlist,
        },
      });
      if (result.ok) {
        modelCount = result.models.length;
        sampleModels = result.models.slice(0, SAMPLE_MODEL_LIMIT).map((model) => model.id);
      } else {
        failure = { reason: result.reason, message: result.message };
      }
    } catch (err) {
      // `listModels` melempar `ApiError` hanya untuk kegagalan yang sudah
      // dipetakan (mis. BAD_URL dari kebijakan keluar) — itu tetap hasil uji.
      // Galat lain (bug programmer) dibiarkan naik jadi 500.
      if (err instanceof ApiError) {
        const mapped = fromApiError(err);
        failure = { reason: mapped.reason, message: mapped.message };
      } else {
        throw err;
      }
    }

    if (failure) {
      // Body permintaan TIDAK dicatat (memuat kunci API). Hanya hasil uji.
      logger.warn(
        { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "test_failed" },
        { method: "POST", reason: failure.reason },
      );
      return testResponse({ ok: false, reason: failure.reason, message: failure.message }, reqId);
    }

    logger.info(
      { requestId: reqId, userId, route: ROUTE, latencyMs: Date.now() - started, result: "test_ok" },
      { method: "POST", modelCount },
    );
    return testResponse({ ok: true, modelCount, sampleModels }, reqId);
  } catch (err) {
    return handleError(err, reqId, started);
  }
}

/** `ApiError` diteruskan apa adanya; `ConfigError` dan galat tak dikenal
 *  disembunyikan sebagai 500 generik (SDD-3.1). */
function handleError(err: unknown, reqId: string, started: number): Response {
  if (err instanceof ApiError) {
    logger.warn(
      { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "error" },
      { method: "POST", code: err.code, status: err.status },
    );
    return toErrorResponse(err, reqId);
  }
  if (err instanceof Error && err.name === "ConfigError") {
    return toErrorResponse(
      new ApiError({
        status: STATUS.INTERNAL,
        code: "CONFIG_ERROR",
        message: "Konfigurasi server tidak valid.",
      }),
      reqId,
    );
  }
  return toErrorResponse(err, reqId);
}
