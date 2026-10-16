/**
 * Endpoint Auth.js di `/api/auth/*` (SDD-5.1, SDD-3.1).
 *
 * Handler diambil dari instance tunggal di `@/lib/auth`, yang memuat
 * konfigurasi secara malas (`loadAuthConfig()`) saat permintaan pertama.
 * Karena `next build` meng-import modul ini tanpa env runtime, memuat
 * konfigurasi di sini akan menggagalkan build — sedangkan aplikasi memang
 * diminta gagal saat *start* (SDD-1.5), bukan saat build.
 *
 * Runtime Node dipakai karena konfigurasi menyentuh Prisma dan `node:crypto`.
 */

import { handlers } from "@/lib/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
