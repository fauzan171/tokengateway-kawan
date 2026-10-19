"use client";

/**
 * Bahasa aktif untuk komponen klien (REQ-NT-70).
 *
 * Bahasa dioper dari server lewat cookie `kawan-locale` di root layout, bukan
 * dibaca sendiri oleh tiap komponen: satu sumber, tidak ada kedipan teks saat
 * hidrasi. `useT()` mengembalikan fungsi penerjemah sehingga komponen cukup
 * menulis `t("settings.title")`.
 */

import { createContext, useContext, useMemo } from "react";
import { format, messages, type MessageKey } from "./messages";
import type { Locale } from "@/lib/settings/settings";

const LocaleContext = createContext<Locale>("id");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function useT(): Translate {
  const locale = useContext(LocaleContext);
  return useMemo(() => {
    const table = messages[locale] ?? messages.id;
    return (key: MessageKey, vars?: Record<string, string | number>) =>
      format(table[key] ?? messages.id[key] ?? key, vars);
  }, [locale]);
}
