/**
 * Permintaan tautan reset kata sandi (REQ-NT-16, SDD-5.1).
 *
 * Balasan SELALU sukses generik: perbedaan "email terdaftar" dan "tidak
 * terdaftar" tidak boleh terlihat dari luar (REQ-NT-11). Yang berbeda hanya
 * jejaknya di server.
 *
 * Cara tautan disampaikan mengikuti konfigurasi operator (SDD-1.5):
 *   - email TIDAK dikonfigurasi (bawaan): tautan ditulis ke log admin dengan
 *     level `warn` dan penanda `action: "password_reset.link"`, supaya operator
 *     dapat meneruskannya. UI mengatakan keadaan ini apa adanya.
 *   - email dikonfigurasi: dicatat peringatan bahwa PENGIRIM BELUM ADA. v1
 *     tidak mengirim email apa pun; jangan berpura-pura sudah terkirim.
 *
 * Pembatas laju memakai tabel `LoginAttempt` yang sama dengan login, sehingga
 * endpoint ini tidak bisa dipakai membanjiri log.
 */

import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/api/logger";
import { requestId } from "@/lib/api/errors";
import { isRateLimited, recordAttempt } from "@/lib/auth/rate-limit";
import { requestReset, resetRateLimitKey } from "@/lib/auth/password-reset";
import { validateEmail } from "@/lib/auth/validation";

export const runtime = "nodejs";

const ROUTE = "/api/account/forgot-password";

/** Pesan yang sama untuk setiap permintaan: tidak membocorkan apa pun. */
const GENERIC_MESSAGE =
  "Bila email itu terdaftar, tautan reset kata sandi sudah dibuat. Periksa emailmu, atau hubungi admin bila email belum dikonfigurasi.";

/** Alamat klien untuk pembatas laju. Sama seperti jalur login: `x-forwarded-for`
 *  dipercaya karena Kawan berjalan di belakang reverse proxy operator. */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

/** Origin kanonik untuk tautan di log. Proxy meneruskan host asli; tanpa itu,
 *  jatuh ke origin permintaan. */
function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request): Promise<Response> {
  const reqId = requestId(request);
  const started = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format JSON tidak valid." }, { status: 400 });
  }

  const email = String((body as Record<string, unknown> | null)?.email ?? "");

  // Format email tidak valid: balas generik juga, supaya bentuk balasan tidak
  // bisa dipakai memetakan input. Tidak ada token yang dibuat.
  const formatError = validateEmail(email);

  try {
    const config = loadConfig();
    const db = await getDb(config.databaseUrl);

    // Batas laju memakai tabel dan jendela yang sama dengan login, tetapi kunci
    // yang DIBEDAKAN (`reset:`), supaya permintaan reset tidak mengunci jalur
    // login dan sebaliknya.
    const key = resetRateLimitKey({ email, ip: clientIp(request) });
    const status = await isRateLimited(db, {
      key,
      limit: config.loginRateLimitMax,
      windowSeconds: config.loginRateLimitWindowSeconds,
    });
    if (status.limited) {
      logger.warn(
        { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "rate_limited" },
        { action: "password_reset.rate_limited", retryAfterSeconds: status.retryAfterSeconds },
      );
      return NextResponse.json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti.", retryAfterSeconds: status.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(status.retryAfterSeconds) } },
      );
    }

    // Setiap permintaan dicatat SEBELUM dibuatkan token: `recordAttempt` adalah
    // yang membuat pembatas benar-benar bergerak. Tanpa ini, pemeriksaan
    // `isRateLimited` di atas selalu melihat nol baris dan batas tidak pernah
    // tercapai. Dicatat juga untuk email yang formatnya salah, supaya alamat
    // ngawur pun tidak bisa dipakai membanjiri log.
    await recordAttempt(db, { key });

    if (formatError === null) {
      const result = await requestReset(db, {
        email,
        ttlSeconds: config.passwordResetTtlSeconds,
      });

      if (result.token) {
        if (config.emailConfigured) {
          // Operator berniat memakai email, tetapi pengirimnya belum dibangun.
          // Tautan sengaja TIDAK ditulis ke log di cabang ini.
          logger.warn(
            { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "email_pending" },
            { action: "password_reset.email_not_implemented" },
          );
        } else {
          // Mode tanpa email: satu-satunya cara tautan sampai ke pengguna
          // adalah lewat log admin. Sertakan tautannya utuh.
          const resetUrl = `${requestOrigin(request)}/reset-sandi?token=${encodeURIComponent(result.token)}`;
          logger.warn(
            { requestId: reqId, route: ROUTE, latencyMs: Date.now() - started, result: "link_logged" },
            { action: "password_reset.link", resetUrl },
          );
        }
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (err) {
    if (err instanceof Error && err.name === "ConfigError") {
      return NextResponse.json({ error: "Konfigurasi server tidak valid." }, { status: 500 });
    }
    throw err;
  }
}
