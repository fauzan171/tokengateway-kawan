/**
 * Kamus teks UI (REQ-NT-70).
 *
 * `id` adalah sumber kebenaran: `en` bertipe `Record<MessageKey, string>`, jadi
 * kunci yang lupa diterjemahkan jadi galat kompilasi, bukan teks Indonesia yang
 * menyelinap di UI Inggris. Tidak ada dependensi i18n: pemakaiannya cuma
 * `t("kunci")`, dan pluralisasi Indonesia tidak butuh mesin sendiri.
 *
 * Placeholder ditulis `{nama}` dan diisi lewat argumen kedua `t()`.
 */

export const id = {
  "app.title": "Kawan — Chat AI by tokengateway.ai.id",
  "app.description": "Chat pribadi dengan kunci API milikmu sendiri.",
  "common.loading": "Memuat…",
  "common.retry": "Coba lagi",
  "common.save": "Simpan",
  "common.cancel": "Batal",
  "common.delete": "Hapus",
  "common.close": "Tutup",

  "settings.title": "Pengaturan",
  "settings.loading": "Memuat pengaturan…",
  "settings.loadFailed": "Gagal memuat pengaturan.",
  "settings.saveFailed": "Perubahan tidak tersimpan. Coba lagi.",
  "settings.theme": "Tema tampilan",
  "settings.theme.system": "Ikuti sistem",
  "settings.theme.light": "Terang",
  "settings.theme.dark": "Gelap",
  "settings.locale": "Bahasa",
  "settings.locale.id": "Indonesia",
  "settings.locale.en": "English",
  "settings.fontScale": "Ukuran font: {value}%",
  "settings.fontScale.aria": "{value} persen",
  "settings.sendOnEnter": "Enter mengirim pesan",
} as const;

export type MessageKey = keyof typeof id;

export const en: Record<MessageKey, string> = {
  "app.title": "Kawan — AI Chat by tokengateway.ai.id",
  "app.description": "Private chat with your own API key.",
  "common.loading": "Loading…",
  "common.retry": "Try again",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close": "Close",

  "settings.title": "Settings",
  "settings.loading": "Loading settings…",
  "settings.loadFailed": "Could not load settings.",
  "settings.saveFailed": "Changes were not saved. Try again.",
  "settings.theme": "Appearance",
  "settings.theme.system": "Follow system",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.locale": "Language",
  "settings.locale.id": "Indonesia",
  "settings.locale.en": "English",
  "settings.fontScale": "Font size: {value}%",
  "settings.fontScale.aria": "{value} percent",
  "settings.sendOnEnter": "Enter sends the message",
};

export const messages = { id, en } as const;

/** Isi `{nama}` dari `vars`; placeholder tanpa nilai dibiarkan apa adanya. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
