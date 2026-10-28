# GATE — integrasi `@use-pith/core` ke loop riset

Basis `feat/kawan-workspace` `810995e4`. Dua sub-paket, masing-masing
commit sendiri (aturan: commit bertahap, bukan di akhir).

| Sub-paket | Commit | Isi |
| --- | --- | --- |
| 1 | `77208daf` | `src/lib/sources/read.ts` ekstraksi isi pakai Pith |
| 2 | `2165889d` | `page_read` menyimpan teks nyata untuk validasi/resume |

## Koreksi premis instruksi

Tiga premis pada instruksi awal tidak cocok dengan repo; diverifikasi sebelum
menulis kode:

1. `src/lib/tasks/search/chain.ts` **tidak ada**. Jalur nyata: `src/lib/search/chain.ts`.
2. **Jina Reader tidak dipakai.** `chain.ts:210` memanggil `https://s.jina.ai/`
   yaitu Search API, bukan `r.jina.ai` (Reader). Tidak ada yang diganti di sini.
3. **Tidak ada Readability** di `src/` sebelumnya. `read.ts` memakai regex
   `pickMainContent()` buatan sendiri, bukan Readability.

## Penyimpangan sadar: `createEngine()` TIDAK dipakai

Instruksi meminta `createEngine()` dari Pith. Itu **ditolak dengan alasan
keamanan**: `scrapeUrlCore()`/`engine.scrape()` memanggil `fetch` global sendiri
(`node_modules/@use-pith/core/dist/index.js:443`, robots di `:674`), sehingga
melewati `fetchOutbound` dan seluruh kebijakan egress FIX-07 — allowlist, DNS
pinning lewat dispatcher, validasi per-hop redirect, larangan HTTP polos.

Yang dipakai hanya fungsi **murni** dari paket:

- `htmlToMarkdown(html, url)` → `{title, markdown, text}`; HTML diambil sendiri
  lewat `fetchOutbound` yang sudah ada.
- `isQuoteSupportedByText` diuji, **tidak dipasang** (lihat bawah).

Konsekuensi: jaringan, redirect, dan allowlist tetap milik kita. Pith hanya
menjadi pustaka parsing.

## Sub-paket 1 — ekstraksi isi (`77208daf`)

`read.ts`: hapus `stripNoise()`, `pickMainContent()`, `htmlToText()` (≈90 baris
regex). Ganti `extractContent()` → `htmlToMarkdown()` + `tidy()` (Pith
mempertahankan indentasi sumber: `"A\n       B"`). Judul: `og:title` dulu, lalu
`extracted.title`.

Efek: boilerplate (nav/footer/cookie/modal) hilang walau halaman tidak punya
`<article>`/`<main>` — Readability memilih wadah utama sendiri.

Test: `src/lib/sources/sources.test.ts` +1 (boilerplate lintas wadah). 24/24 lulus.

## Sub-paket 2 — bukti untuk validasi (`2165889d`)

Sitasi terverifikasi **tidak** dipetakan ke `TaskSource`. Alasan:

- `TaskSource` tidak punya kolom kutipan/locator/verified; memetakannya butuh
  migrasi additive dua provider untuk data yang belum punya konsumen.
- `isQuoteSupportedByText` hanya menerima substring literal (case/spasi
  dinormalkan). Snippet provider (Tavily) sering parafrase, jadi memakainya
  sebagai gerbang akan menandai bukti sah sebagai palsu.

Yang nyata kurang: `page_read` selalu `snippet: null`, jadi fase validasi dan
resume lintas-restart hanya melihat `(dibaca N karakter)` tanpa isi. Kini
snippet berisi potongan teks hasil ekstraksi (≤ `maxExcerptCharsPerSource`), dan
`evidenceText()` memotongnya lagi ke `EVIDENCE_EXCERPT_CHARS = 1_200` per sumber
(8 × 1.200 ≈ 2.400 token, aman di `maxInputTokens = 24.000`).

Tavily tetap discovery links saja; parsing/reading didelegasikan ke Pith lokal.

Test: `src/lib/tasks/research.test.ts` +1 (snippet `page_read` berisi teks dan
muncul di badan prompt validasi). 14/14 lulus.

## Gate

| Gate | Hasil |
| --- | --- |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, tanpa output |
| `npx eslint src/lib/tasks/research.ts src/lib/tasks/research.test.ts src/lib/sources/read.ts src/lib/sources/sources.test.ts` | exit 0, tanpa output |
| `node scripts/check-migrations.mjs` | OK — 2 provider, init dibekukan, urutan sama |
| `npm test` | lihat GATE-WO-9 (basis 1385) + 2 test baru |
| `npm run build` | lihat bawah |

## Risiko yang harus diketahui

`npm audit` setelah pemasangan: 24 kerentanan repo-wide (6 low, 4 moderate,
13 high, 1 critical). `@use-pith/core` sendiri tertandai high lewat
`@mozilla/readability` dan `zod` (versi lama). Semua berada di jalur parsing
HTML lokal, bukan di jalur kredensial; tetap perlu ditinjau bila paket ini naik
versi.

Pith juga membawa `jsdom@24` bersarang + `robots-parser`, sementara repo sudah
punya `jsdom@30` di devDependencies. Dua versi hidup berdampingan; tidak
bertabrakan karena Pith memakai salinannya sendiri.