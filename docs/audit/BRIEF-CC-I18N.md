# BRIEF-CC-I18N.md — Sapu string UI ke kamus id/en

Proyek: `/home/hermes/workspace/projects/tokengateway-kawan`. Bahasa laporan: Indonesia.

## Konteks

WO-09 (FIX-PLAN) memilih opsi 1: UI benar-benar bilingual. Mesin i18n sudah dipasang di commit `dfb269d` — **jangan diubah, jangan ditulis ulang**:

- `src/lib/i18n/messages.ts` — kamus. `id` sumber kebenaran, `en` bertipe `Record<MessageKey, string>`.
- `src/lib/i18n/context.tsx` — `LocaleProvider`, `useT()`, `useLocale()`.
- `src/lib/i18n/server.ts` — `readLocale()`, cookie `kawan-locale` (sudah ditulis oleh route settings).
- `src/app/layout.tsx` — `html lang` dinamis + provider (sudah).
- `src/app/api/kawan/v1/settings/route.ts` — set cookie (sudah).
- `src/components/settings-form.tsx` — **contoh pola yang harus ditiru** (sudah).

## Tugas

Pindahkan seluruh teks yang dilihat pengguna ke kamus, lalu pakai `useT()`.

**Berkas sasaran** (perkiraan jumlah string, urut terbanyak):
`chat-view.tsx` 54, `chat-sidebar.tsx` 23, `connect-gateway-form.tsx` 21, `auth-form.tsx` 16, `documents-panel.tsx` 15, `admin-panel.tsx` 15, `prompt-picker.tsx` 10, `change-password-form.tsx` 10, `forgot-password-form.tsx` 8, `usage-report.tsx` 7, `reset-password-form.tsx` 7, `src/app/page.tsx` 7, `media-controls.tsx` 6, `settings-form.tsx` 3 (sudah), `markdown.tsx` 3.

Temukan sisanya sendiri: `grep -rnoE '"[A-Z][a-zA-Z ,.:!?%()\x27-]{6,}"' src/components src/app --include=*.tsx`.

## Aturan

1. **Kunci kamus pakai awalan berkas**: `chat.send`, `chat.placeholder`, `auth.signIn`, `admin.title`. Jangan pakai kalimat sebagai kunci.
2. **Placeholder** pakai `{nama}` dan diisi lewat argumen kedua: `t("chat.tokens", { count })`.
3. **`en` wajib lengkap.** Kunci baru di `id` tanpa pasangan di `en` gagal kompilasi — itu tujuannya, jangan diakali `as any` atau `@ts-ignore`.
4. **Jangan terjemahkan**: nama produk (Kawan, TokenGateway), istilah teknis (API Key, Base URL, SSE), nama model, teks yang datang dari server, nama rute.
5. **Uji jangan diturunkan cakupannya.** `*.test.tsx` yang mencari teks Indonesia tetap harus lulus. Kalau komponen diuji tanpa provider, bungkus dengan `LocaleProvider locale="id"` — jangan longgarkan assertion.
6. **Jangan sentuh**: `src/lib/i18n/*`, `src/app/layout.tsx`, `src/app/api/kawan/v1/settings/route.ts`, `docs/audit/*`, `dev.db`, `.env`.
7. Satu berkas logis per commit. Pesan biasa saja; **jangan tambah trailer bantuan AI apa pun.**

## Gerbang (wajib hijau sebelum berhenti)

```
npx tsc --noEmit -p tsconfig.json     # exit 0
npx eslint .                          # exit 0
npx vitest run                        # 0 gagal
npx playwright test                   # 0 gagal
npm run build                         # exit 0
npm run check:docs                    # LULUS
```

**Jangan** `git push`, **jangan** deploy, **jangan** `pm2 restart`.

## Laporan akhir

Tulis `docs/audit/I18N-REPORT.md`: jumlah string dipindah per berkas, kunci kamus yang ditambah, perintah gerbang + hasil mentahnya, apa yang sengaja tidak diterjemahkan dan kenapa, sisa yang belum.