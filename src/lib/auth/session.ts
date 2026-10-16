/**
 * Konfigurasi Auth.js (SDD-5.1).
 *
 * Strategi JWT + tabel `Session` untuk pencabutan. Setiap permintaan:
 *   1. `jwt` memverifikasi token masih punya baris sesi aktif.
 *   2. `jwt` memuat ulang role/status pengguna dari database — klaim di token
 *      tidak pernah dipercaya karena bisa basi (SDD-5.1).
 * Bila salah satu gagal, callback mengembalikan `null`; Auth.js membuang
 * cookie sesi, sehingga token yang dicabut/nonaktif gagal *tertutup*.
 *
 * Konfigurasi dimuat malas (fungsi), bukan saat modul di-import: `next build`
 * meng-import modul tanpa env runtime.
 */

import { randomUUID } from "node:crypto";
import type { NextAuthConfig, Session, User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { loadConfig } from "@/lib/config/env";
import { verifyPassword } from "./password";
import { createSession, isSessionValid } from "./session-store";
import { normalizeEmail, findUserById } from "./users";
import { clearAttempts, isRateLimited, rateLimitKey, recordAttempt } from "./rate-limit";

/** Umur token sesi (detik). Baris `Session` memakai umur yang sama. */
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

export type AuthConfig = NextAuthConfig & { secret: string };

/** Header yang dipakai Auth.js; dibaca lewat parameter `request` supaya
 *  konfigurasi tetap berupa fungsi murni (tanpa `next/headers`). */
function userAgentOf(request: Request | undefined): string | null {
  return request?.headers.get("user-agent") ?? null;
}

/**
 * Alamat klien untuk keperluan pembatasan login.
 *
 * `x-forwarded-for` hanya dipercaya karena Kawan memang dirancang berjalan di
 * belakang reverse proxy milik operator sendiri (alasan yang sama dengan
 * `trustHost`). Nilai pertama di daftar adalah klien asli; sisanya proxy.
 */
function clientIpOf(request: Request | undefined): string | null {
  if (!request) return null;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

/** `user` dari `authorize` membawa `userAgent` sebagai properti tambahan
 *  supaya `jwt` bisa mencatatnya tanpa membaca header lagi. */
type AuthorizedUser = { id: string; userAgent: string | null };

function buildAuthConfig(config: ReturnType<typeof loadConfig>): AuthConfig {
  const db = () => getDb(config.databaseUrl);

  return {
    secret: config.authSecret,
    // Kawan di-self-host di domain/IP apa pun, jadi host tidak bisa di-hardcode.
    // Tanpa ini Auth.js menolak setiap permintaan dengan `UntrustedHost` (500)
    // kecuali berjalan di Vercel. Kepercayaan host aman di sini karena aplikasi
    // memang dimaksudkan berjalan di belakang reverse proxy operator sendiri;
    // operator yang butuh pembatasan dapat memakai `AUTH_URL`/`AUTH_TRUST_HOST`.
    trustHost: true,
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
    // Tidak ada halaman login di WP ini; WP-NT-P1-03 yang menambahkannya.
    pages: { signIn: "/masuk" },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(credentials, request) {
          const email = normalizeEmail(String(credentials?.email ?? ""));
          const password = String(credentials?.password ?? "");
          if (!email || !password) return null;

          const client = await db();
          const key = rateLimitKey({ email, ip: clientIpOf(request) });

          // Pembatasan diperiksa SEBELUM kata sandi diverifikasi, supaya
          // percobaan ke-N+1 tidak sempat memakai waktu CPU Argon2. Pengguna
          // yang sudah dibatasi diperlakukan sama dengan kata sandi salah:
          // Auth.js tidak boleh memberi tahu penyerang bahwa ia sedang dibatasi.
          const status = await isRateLimited(client, {
            key,
            limit: config.loginRateLimitMax,
            windowSeconds: config.loginRateLimitWindowSeconds,
          });
          if (status.limited) return null;

          const user = await client.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, role: true, status: true, credential: true },
          });

          // Hash tiruan saat akun tidak ada: waktu balasan tidak membocorkan
          // email mana yang terdaftar (REQ-NT-11).
          const passwordHash = user?.credential?.passwordHash ?? DUMMY_HASH;
          const ok = await verifyPassword(passwordHash, password);

          // Akun nonaktif (`pending`) diperlakukan sebagai kegagalan kredensial,
          // bukan sebagai "akun belum aktif": pesan itu akan membocorkan bahwa
          // email tersebut terdaftar.
          if (!user || !ok || user.status !== "active") {
            await recordAttempt(client, { key });
            return null;
          }

          // Login berhasil: hitungan percobaan gagal sebelumnya dibuang supaya
          // pengguna sah tidak terkunci oleh percobaan orang lain.
          await clearAttempts(client, { key });

          // `userAgent` menumpang di objek user supaya `jwt` tidak perlu
          // membaca header lagi (Auth.js meneruskan properti tambahan).
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            userAgent: userAgentOf(request),
          } as AuthorizedUser & User;
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user, trigger, session }) {
        const client = await db();

        // Login baru: catat baris sesi supaya token ini bisa dicabut.
        // `sid` mentah disimpan di JWT; tabel hanya memegang hash-nya.
        if (user?.id) {
          const sid = randomUUID();
          await createSession(client, {
            userId: user.id,
            token: sid,
            expiresAt: new Date(Date.now() + SESSION_MAX_AGE_S * 1000),
            userAgent: (user as AuthorizedUser).userAgent ?? null,
          });
          token.sub = user.id;
          token["sid"] = sid;
          return token;
        }
        if (!token.sub) return null;

        // Permintaan berikutnya: token harus punya baris sesi aktif.
        const sid = typeof token["sid"] === "string" ? token["sid"] : null;
        if (!sid) return null;
        if (!(await isSessionValid(client, { userId: token.sub, token: sid }))) {
          return null;
        }

        // Muat ulang identitas; jangan pakai klaim lama (SDD-5.1).
        const fresh = await findUserById(client, token.sub);
        if (!fresh || fresh.status !== "active") return null;
        token.role = fresh.role;
        token.name = fresh.name;
        token.email = fresh.email;

        // Ganti nama lewat `unstable_update` (WP-NT-P1-05).
        if (trigger === "update" && typeof session?.name === "string") {
          token.name = session.name;
        }
        return token;
      },
      session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        return session;
      },
    },
  } satisfies NextAuthConfig as AuthConfig;
}

/** Dipakai bila akun tidak ditemukan, agar waktu verifikasi seragam. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000";

let cached: AuthConfig | null = null;

export async function loadAuthConfig(): Promise<AuthConfig> {
  if (cached) return cached;
  cached = buildAuthConfig(loadConfig());
  return cached;
}

export type { Session };
