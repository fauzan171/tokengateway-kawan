/**
 * Penjaga origin untuk mutasi ber-cookie (FIX-07, SDD-03 "same-origin/CSRF").
 *
 * Cookie sesi Auth.js memakai `SameSite=Lax`, tetapi itu tidak menutup semua
 * jalur: `Lax` masih mengirim cookie pada navigasi GET tingkat atas, dan
 * sebagian klien lama mengabaikannya. Karena itu setiap permintaan yang MENGUBAH
 * data diperiksa lagi di sini dengan aturan yang tegas: bila browser menyertakan
 * `Origin`, host-nya harus sama persis dengan host permintaan. Origin yang tidak
 * cocok ditolak 403 tanpa menyentuh route.
 *
 * Permintaan tanpa `Origin` dibiarkan lewat: itu bukan CSRF. Penyerang tidak
 * bisa memaksa browser korban mengirim permintaan tanpa `Origin`, sedangkan
 * klien non-browser (curl, worker internal, tes) memang tidak mengirimnya.
 *
 * Pembandingnya `Host`, bukan `x-forwarded-host`: header forwarded bisa dipalsukan
 * klien bila proxy tidak menimpanya, dan membandingkan Origin dengan nilai yang
 * bisa dipalsukan sama saja tidak memeriksa apa pun.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Metode yang tidak mengubah state; sisanya wajib lolos pemeriksaan. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(request: NextRequest): NextResponse {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  if (origin === null || origin === "") return NextResponse.next();

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    // Origin berbentuk "null" (iframe sandbox, redirect) atau sampah: bukan
    // permintaan sah dari aplikasi ini.
    return deny();
  }

  const host = request.headers.get("host");
  if (host === null || originHost !== host) return deny();

  return NextResponse.next();
}

function deny(): NextResponse {
  return NextResponse.json(
    { error: { code: "CROSS_ORIGIN_BLOCKED", message: "Permintaan lintas origin ditolak." } },
    { status: 403, headers: { "cache-control": "private, no-store" } },
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
