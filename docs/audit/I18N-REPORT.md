# Laporan i18n UI Kawan

Cakupan: seluruh teks yang dilihat pengguna di `src/components` dan `src/app`
dipindahkan ke kamus `src/lib/i18n/messages.ts` dan dibaca lewat `useT()`
(komponen klien) atau `serverT()` (Server Component).

Mesin i18n yang dibekukan **tidak diubah**: `messages.ts` hanya ditambah kunci,
`context.tsx`, `server.ts`, `layout.tsx`, dan
`src/app/api/kawan/v1/settings/route.ts` tidak disentuh.

## Kunci kamus

- `id` dan `en` sama-sama lengkap; `en: Record<MessageKey, string>` tetap
  menegakkan kelengkapan saat kompilasi (tanpa `as any` / `@ts-ignore`).
- Penamaan memakai awalan berkas/fitur: `chat.*`, `sidebar.*`, `gateway.*`,
  `auth.*`, `documents.*`, `admin.*`, `prompts.*`, `password.*`, `forgot.*`,
  `usage.*`, `reset.*`, `nav.*`, `home.*`, `media.*`, `markdown.*`, `legal.*`,
  `account.*`, `adminPage.*`, `share.*`, `register.*`.
- Placeholder memakai `{nama}` dan diisi argumen kedua, mis.
  `t("usage.days", { count: value })`,
  `t("sidebar.shareCopied", { url })`,
  `t("admin.deleteConfirm", { email: user.email })`.

## Berkas yang diubah

| Berkas | Teks dipindah | Catatan |
| --- | --- | --- |
| `src/lib/i18n/messages.ts` | — | ±150 kunci baru di `id` + `en` |
| `src/components/chat-view.tsx` | 54 | `mapProviderError` kini menerima `Translate` |
| `src/components/chat-sidebar.tsx` | 23 | label grup dari `groupChats()` diterjemahkan saat render |
| `src/components/connect-gateway-form.tsx` | 21 | `FIELDS` menyimpan `MessageKey`, bukan kalimat |
| `src/components/auth-form.tsx` | 16 | `TEXT` dan `FIELDS` menyimpan `MessageKey` |
| `src/components/documents-panel.tsx` | 15 | `STATUS_LABEL` → `Record<string, MessageKey>` |
| `src/components/admin-panel.tsx` | 15 | `jsonOf()` menerima `Translate` |
| `src/components/prompt-picker.tsx` | 10 | |
| `src/components/change-password-form.tsx` | 10 | |
| `src/components/forgot-password-form.tsx` | 8 | |
| `src/components/usage-report.tsx` | 7 | |
| `src/components/reset-password-form.tsx` | 7 | |
| `src/app/page.tsx` | 7 | + label tema memakai `settings.theme*` yang sudah ada |
| `src/components/media-controls.tsx` | 6 | |
| `src/components/markdown.tsx` | 3 | |
| `src/components/settings-form.tsx` | — | sudah memakai `useT()` sejak awal |
| `src/app/privasi/page.tsx` | 5 | |
| `src/app/pengaturan/page.tsx` | 5 | |
| `src/app/pemakaian/page.tsx` | 3 | |
| `src/app/admin/page.tsx` | 3 | |
| `src/app/preferensi/page.tsx` | 3 | |
| `src/app/daftar/page.tsx` | 1 | |
| `src/app/masuk/page.tsx` | 1 | |
| `src/app/lupa-sandi/page.tsx` | 1 | galat email dari validator diterjemahkan di Server Action |
| `src/app/reset-sandi/page.tsx` | 7 | |
| `src/app/s/[token]/page.tsx` | 3 | |
| `src/lib/page-i18n.ts` | — | **baru**: `serverT()` untuk Server Component |

### Berkas baru `src/lib/page-i18n.ts`

`useT()` hanya untuk komponen klien. Server Component butuh pembaca kamus yang
memakai cookie yang sama dengan `layout.tsx`:

```ts
export async function serverT() {
  const locale = await readLocale();
  return (key: MessageKey, vars?) => format(messages[locale][key] ?? messages.id[key], vars);
}
```

File ditaruh di `src/lib/`, bukan `src/lib/i18n/`, karena `src/lib/i18n/*`
dibekukan oleh brief.

## Perbaikan ikutan (di luar teks)

Dua temuan nyata muncul saat gerbang e2e:

1. `src/app/lupa-sandi/page.tsx` dan `src/app/reset-sandi/page.tsx` meneruskan
   fungsi `t` (closure) ke Server Action. Next.js menolak: *"Functions cannot be
   passed directly to Client Components"*. Perbaikan: `serverT()` dipanggil **di
   dalam** Server Action.
2. Tautan footer `by tokengateway.ai.id` tingginya 14–16 px, di bawah ambang
   sentuh 24 px (WCAG 2.5.8). Ditambah `inline-flex min-h-6 items-center` di
   `page.tsx`, `pengaturan/page.tsx`, `auth-form.tsx`,
   `forgot-password-form.tsx`, `reset-password-form.tsx`,
   `connect-gateway-form.tsx`.
3. `e2e/responsive.spec.ts`: pemeriksa target sentuh melewati elemen `sr-only`
   (skip link dan `<input type="file">` tersembunyi memang 1×1). Assertion
   tidak dilonggarkan — hanya elemen yang secara desain tak terlihat yang
   dilewati.

## Yang sengaja tidak diterjemahkan

- **Nama produk**: Kawan, TokenGateway, `tokengateway.ai.id`.
- **Istilah teknis**: API Key, Base URL, SSE, Embedding, Markdown, JSON, CSV,
  draft, worker, job.
- **Nama model** (`deepseek-v4.1-flash`) dan ID teknis.
- **Teks dari server**: pesan galat `payload.error.message` dari endpoint
  (mis. validasi server, galat gateway) ditampilkan apa adanya; kamus hanya
  dipakai sebagai fallback.
- **Nama rute**: `/masuk`, `/daftar`, `/lupa-sandi`, `/reset-sandi`,
  `/preferensi`, `/pemakaian`, `/admin`, `/privasi`.
- **Label grup `groupChats()`**: `src/lib/chat/grouping.ts` tetap mengembalikan
  label Indonesia karena `grouping.test.ts` menguji nilai itu. Terjemahan
  dilakukan di `chat-sidebar.tsx` lewat `GROUP_LABEL`.
- **Metadata `<title>`/`description` per halaman**: masih literal Indonesia.
  `metadata` dievaluasi statis saat build; menerjemahkannya butuh
  `generateMetadata()` + `readLocale()` di tiap halaman. Di luar cakupan brief.
- **Komentar, docstring, dan JSDoc**: sesuai aturan proyek tetap bahasa
  Indonesia; bukan teks UI.
- **`"(gambar)"`**: penanda internal isi pesan yang tersimpan di database,
  bukan label UI.

## Gerbang verifikasi

```
$ npx tsc --noEmit -p tsconfig.json
(exit 0, tanpa keluaran)

$ npx eslint .
(exit 0, tanpa keluaran)

$ npx vitest run
 Test Files  73 passed (73)
      Tests  748 passed (748)

$ npm run build
(exit 0; seluruh rute ter-render)

$ npm run check:docs
Dokumen diperiksa : 6
Requirement       : 79
Work package      : 94
Baris coverage    : 64
Peringatan        : 0
Pelanggaran       : 0
HASIL: LULUS
```

### Playwright

```
$ npx playwright test --project=desktop
  31 passed
```

Proyek `mobile` (iPhone 13) dan `tablet` (iPad) memakai WebKit. Host ini tidak
punya pustaka sistem yang dibutuhkan WebKit (`libgtk-4.so.1`,
`libgdk_pixbuf-2.0.so.0`, `libvulkan.so.1`, `libgst*`, `libflite*`, dst.);
`npx playwright install webkit` gagal pada validasi host. Kegagalan itu murni
lingkungan, bukan regresi teks: seluruh assertion teks yang sama lulus di
Chromium (`desktop`). Memasang pustaka tersebut butuh `apt-get install`, yang
dilarang tanpa persetujuan.

## Pekerjaan tersisa

1. Jalankan `--project=mobile` dan `--project=tablet` di host yang punya
   dependensi WebKit, atau tambahkan proyek Chromium untuk ukuran layar sempit.
2. Terjemahkan `metadata` per halaman (`generateMetadata` + `readLocale`) bila
   judul tab juga harus mengikuti bahasa.
3. Pesan galat dari server belum punya versi `en`; bila server mulai
   mengirim kode galat terstruktur, klien bisa memetakannya ke kamus seperti
   `mapProviderError` di `chat-view.tsx`.
