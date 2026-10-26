# GATE — WO-B2 (search chain Tavily → Jina → direct)

Worktree: `worktrees/wo-b2` · Branch: `wo/b2` · Base: `90ec7d71` (feat/kawan-workspace)

File: `src/lib/search/chain.ts` (baru), `src/lib/search/chain.test.ts` (baru),
`src/lib/search/web.ts` (`SNIPPET_MAX` diekspor — 1 baris).

## Gate output (verbatim, final = setelah perbaikan S3 QA)

```
$ npx vitest run src/lib/search/chain.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ npx tsc --noEmit -p tsconfig.json
TSC=0

$ npm test
 Test Files  124 passed (124)
      Tests  1341 passed (1341)
TEST=0
(basis 122/1325 → +2 file uji, +16 test; nol regresi)

$ npm run build
 ✓ Compiled successfully in 106s
BUILD=0
```

## QA (kawan-reviewer, read-only) — APPROVED, tanpa S1/S2

QA memverifikasi (bukan sekadar membaca diff):
- **Fail-closed**: `chainSearch` hanya `return` bila `results.length > 0`; kosong →
  `attempts EMPTY_RESULT` → lanjut; semua gagal → `SearchError("SEARCH_UNAVAILABLE", false)`.
  Tak ada jalur yang mengembalikan `[]` sebagai sukses. `direct` untuk query non-URL
  melempar (`canonicalUrl`), bukan sukses kosong.
- **AAD BYOK cocok**: `chain.ts` memakai `{rowId, userId, purpose:"connector.token"}`,
  identik dengan penulis `saveConnectorToken` (`connectors.ts:80,107`); `canonicalAad`
  menyusun urutan kunci sendiri → urutan properti pemanggil tak berpengaruh. Tidak ada
  bug dekripsi senyap.
- **Key tak bocor**: tavily/jina lewat header `authorization`, bukan URL; `attempts.error`
  hanya pesan generik/kode stabil; `fetchOutbound` memaksa `redirect:"manual"` (tak ada
  replay kredensial saat redirect); tak ada `console.*` yang mencetak key.
- **Kuota sebelum request**: `countSearch` di `chain.ts:257` sebelum `p.search` (`:258`);
  `ready` pakai `usedToday` yang sama → satu gate.

Temuan S3/S4 diperbaiki di iterasi 2 (tidak ada yang blocking):

- **S3 `direct` nol cakupan** → +2 tes: sukses (`provider:"direct"`, snippet cocok) dan
  gagal/non-URL → tetap `SEARCH_UNAVAILABLE` retryable:false. Ini justru jalur
  fail-closed paling berisiko, sebelumnya tak dibuktikan.
- **S3 tes "key tak bocor" tak memeriksa `attempts`** → assert `JSON.stringify(attempts)`
  lewat jalur sukses (tavily gagal → jina sukses).
- **S4 `resolveSearchKeys` nondeterministik** → `orderBy: { updatedAt: "desc" }`;
  hasil dekripsi kosong/whitespace dianggap tak-ada → fallback env tetap jalan.
- **S4 change-detector `expect(TIMEOUT_MS).toBe(8_000)`** → dihapus; `TIMEOUT_MS` kembali
  `const` (chain tak memakainya; hanya `SNIPPET_MAX` yang diekspor).
- **S3 kuota** → didokumentasikan sebagai batas LUNAK yang disengaja (overshoot ≤ derajat
  konkurensi; hitungan tidak hilang karena upsert atomik `@@unique`), logika tidak diubah.

## KEPUTUSAN KOORDINATOR yang membentuk implementasi

- **`@mozilla/readability` dibatalkan** (tidak terpasang; menambahnya akan memutasi
  `node_modules` bersama lintas worktree). `direct` memakai `readSource`/`stripNoise`
  existing apa adanya; kualitas ekstrak dicatat sebagai limitasi di komentar `chain.ts`.
- **SearXNG existing (`readWebSearchConfig`, `webSearch`) tidak diubah** — chain modul
  terpisah, chat lama tak berubah perilaku.

## Gap lintas-WO yang BELUM tertutup (dilaporkan, bukan diabaikan)

- **BYOK `provider:"tavily"|"jina"` belum punya PENULIS.** Pembaca `resolveSearchKeys`
  benar (AAD cocok), tetapi satu-satunya penulis kredensial `saveConnectorToken` dijaga
  `isConnectorProvider` (`google-drive|notion`). Tanpa WO yang menyimpan kredensial
  bertarget `tavily`/`jina`, cabang BYOK dorman dan selalu jatuh ke env admin
  (`TAVILY_API_KEY`/`JINA_API_KEY`). Fitur §D3 "BYOK dulu" belum terjangkau ujung-ke-ujung.
- **`chainSearch` belum dipanggil siapa pun** — konsumennya loop D1 (WO-B3), yang
  memblokir integrasi ujung-ke-ujung.

## Cakupan yang TIDAK dibuktikan (kejujuran)

- Tes chain meng-mock `@/lib/net`, jadi kebijakan SSRF (`policy.test.ts`) tidak diekspos
  di sini — SSRF diuji di suite-nya sendiri.
- Tidak ada panggilan jaringan nyata ke Tavily/Jina (mock); bentuk respons provider
  sungguhan belum diverifikasi.
- Jalur BYOK tidak diuji ujung-ke-ujung (tidak ada penulis; lihat gap di atas).