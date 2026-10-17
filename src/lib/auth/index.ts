/**
 * Titik masuk Auth.js (SDD-5.1).
 *
 * Satu instance `NextAuth` dirakit di sini, lalu:
 *   - `handlers` dipakai ulang oleh route handler
 *     `src/app/api/auth/[...nextauth]/route.ts` (satu sumber kebenaran,
 *     tidak ada instance kedua), dan
 *   - `auth()` dipanggil Server Component / route handler lain untuk membaca
 *     sesi saat ini.
 *
 * Konfigurasi dimuat malas lewat `loadAuthConfig()` — dipanggil per
 * permintaan, bukan saat modul di-import — sehingga `next build` tidak
 * menyentuh env runtime.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import { loadAuthConfig } from "./session";

/**
 * `session.user.id` bertipe `string` (bukan `string | undefined`): kolom
 * `User.id` selalu ada, dan callback `session` di `session.ts` mengisinya dari
 * `token.sub`. Augmentasi ini membuat pemanggil tidak perlu `as`/`any`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const nextAuth = NextAuth(async () => loadAuthConfig());

export const { handlers, auth } = nextAuth;
