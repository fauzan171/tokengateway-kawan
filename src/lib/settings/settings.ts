/**
 * Preferensi pribadi (REQ-NT-70, SDD-3.7).
 *
 * Nilai disimpan sebagai kolom eksplisit, bukan blob JSON, supaya tiap kunci
 * bisa divalidasi sendiri dan dibaca tanpa parse. Baris tidak dibuat saat
 * membaca: pengguna yang belum pernah mengubah apa pun memakai bawaan, dan
 * tabel tetap bersih sampai ada perubahan nyata.
 *
 * `fontScale` dijepit, bukan ditolak — slider yang meleset sedikit tidak
 * pantas jadi galat. Kunci yang tidak dikenal diabaikan; nilai tidak sah pada
 * kunci yang dikenal ditolak 400 dengan menyebut nama kuncinya.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import type { Db } from "@/lib/db";

export type Theme = "system" | "light" | "dark";
export type Locale = "id" | "en";

export type UserSettings = {
  theme: Theme;
  locale: Locale;
  /** Persen, 90..130. */
  fontScale: number;
  sendOnEnter: boolean;
};

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  locale: "id",
  fontScale: 100,
  sendOnEnter: true,
};

const THEMES: readonly Theme[] = ["system", "light", "dark"];
const LOCALES: readonly Locale[] = ["id", "en"];
export const FONT_SCALE_MIN = 90;
export const FONT_SCALE_MAX = 130;

function invalid(key: string, message: string): ApiError {
  return new ApiError({
    status: STATUS.BAD_REQUEST,
    code: "INVALID_SETTING",
    message: `${key}: ${message}`,
  });
}

function clampScale(value: number): number {
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(value)));
}

/** Preferensi tersimpan; baris tidak ada → bawaan (tanpa menulis apa pun). */
export async function readSettings(db: Db, userId: string): Promise<UserSettings> {
  const row = await db.userSetting.findUnique({ where: { userId } });
  if (!row) return DEFAULT_SETTINGS;
  return {
    theme: THEMES.includes(row.theme as Theme) ? (row.theme as Theme) : DEFAULT_SETTINGS.theme,
    locale: LOCALES.includes(row.locale as Locale) ? (row.locale as Locale) : DEFAULT_SETTINGS.locale,
    fontScale: clampScale(row.fontScale),
    sendOnEnter: row.sendOnEnter === 1,
  };
}

/** Ubah sebagian kunci; kunci lain dipertahankan. */
export async function writeSettings(
  db: Db,
  userId: string,
  patch: Record<string, unknown>,
): Promise<UserSettings> {
  const next: UserSettings = { ...(await readSettings(db, userId)) };

  if ("theme" in patch) {
    const value = patch["theme"];
    if (typeof value !== "string" || !THEMES.includes(value as Theme)) {
      throw invalid("theme", `harus salah satu dari ${THEMES.join(", ")}.`);
    }
    next.theme = value as Theme;
  }
  if ("locale" in patch) {
    const value = patch["locale"];
    if (typeof value !== "string" || !LOCALES.includes(value as Locale)) {
      throw invalid("locale", `harus salah satu dari ${LOCALES.join(", ")}.`);
    }
    next.locale = value as Locale;
  }
  if ("fontScale" in patch) {
    const value = patch["fontScale"];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw invalid("fontScale", "harus berupa angka.");
    }
    next.fontScale = clampScale(value);
  }
  if ("sendOnEnter" in patch) {
    const value = patch["sendOnEnter"];
    if (typeof value !== "boolean") {
      throw invalid("sendOnEnter", "harus boolean.");
    }
    next.sendOnEnter = value;
  }

  const data = {
    theme: next.theme,
    locale: next.locale,
    fontScale: next.fontScale,
    sendOnEnter: next.sendOnEnter ? 1 : 0,
  };
  await db.userSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return next;
}
