/**
 * Server-side: tentukan bahasa dari cookie, tanpa menulis DB di setiap request.
 *
 * Cookie `kawan-locale` di-set oleh `PATCH /api/kawan/v1/settings` saat bahasa
 * diubah, sehingga `layout.tsx` bisa menyetel `lang` dan provider tanpa query.
 * Tanpa cookie, jatuh ke `id` — bukan tebakan dari `Accept-Language`, supaya
 * hasil render stabil dan tidak bergantung header peramban.
 */

import { cookies } from "next/headers";
import type { Metadata } from "next";
import { messages, type MessageKey } from "./messages";
import type { Locale } from "@/lib/settings/settings";

export const LOCALE_COOKIE = "kawan-locale";
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "id" || value === "en";
}

/** Bahasa aktif untuk render server; `id` bila cookie tidak ada/tidak sah. */
export async function readLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : "id";
}

/**
 * Metadata halaman mengikuti bahasa aktif.
 *
 * `metadata` statis dievaluasi sekali saat build, jadi judul tab tidak akan
 * pernah berubah bahasa. Halaman memakai `generateMetadata` + fungsi ini.
 * `id` sengaja bukan `metadata` statis: satu jalur kode, tidak ada dua sumber.
 */
export async function pageMetadata(key: string): Promise<Metadata> {
  const locale = await readLocale();
  const table = messages[locale] ?? messages.id;
  const judul = `meta.${key}.title` as MessageKey;
  const deskripsi = `meta.${key}.description` as MessageKey;
  return {
    title: table[judul] ?? messages.id[judul],
    description: table[deskripsi] ?? messages.id[deskripsi],
  };
}
