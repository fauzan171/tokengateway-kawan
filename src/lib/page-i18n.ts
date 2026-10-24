/**
 * Penerjemah untuk Server Component: `useT()` hanya tersedia di klien.
 * Bahasa dibaca dari cookie yang sama dengan `layout.tsx`.
 */

import { format, messages, type MessageKey } from "@/lib/i18n/messages";
import { readLocale } from "@/lib/i18n/server";

export async function serverT() {
  const locale = await readLocale();
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    format(messages[locale][key] ?? messages.id[key], vars);
}
