# GATE — WO-F5 (integrasi aktivitas + metering → TaskView)

Worktree `worktrees/wo-f5` (`wo/f5`), basis `feat/kawan-workspace` `63ca31ec`.
Commit worktree `b5660632` (fitur) + `4c4bf497` (tanggapan QA);
squash-merge ke `feat/kawan-workspace`: `044eb055`. AUTO_PUSH=0 (lokal saja).

## Scope

`RunMeteringSummary` (WO-F4) sudah ada dan teruji tetapi **tidak pernah
dipanggil** — pengguna tidak melihat pemakaian token sama sekali. Sisa QA
WO-B5 juga mencatat dua hal: tipe `usage.*` mendeklarasikan `number` padahal
backend bisa mengirim `null`, dan komponen belum di-mount.

WO ini: mount komponen di `task-view.tsx` (hanya saat run terminal), perbaiki
tipe agar jujur soal `null`, dan satukan definisi kontrak `RunMetering`.

## Gate (verbatim, dijalankan koordinator di worktree wo-f5)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/components/run-metering-summary.tsx src/components/run-metering-summary.test.tsx src/components/task-view.tsx src/components/task-view.test.tsx src/lib/i18n/messages.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  130 passed (130)
      Tests  1414 passed (1414)
```
(basis 130 file / 1407 lulus di `63ca31ec`; +7 tes, nol regresi)

Catatan flake: run pertama suite penuh gagal 2 tes di
`src/lib/chat/generate.test.ts` (FIX-11/FIX-12, artefak file). Berkas itu
lulus 28/28 saat dijalankan sendirian, dan suite penuh hijau pada run
berikutnya — load-dependent (pola sama dengan FIX-05 di WO-B4), bukan
regresi WO ini (file tidak tersentuh diff).

### `npm run build`
```
(exit 0; route list normal)
```

## QA (agent `kawan-reviewer`, read-only)

Keputusan: **CHANGES-REQUESTED** (1×S2 + 3×S3) → seluruhnya ditanggapi.

### S2-1 (ditanggapi) — bukti gate tidak ada
Reviewer benar: saat review, `GATE-WO-F5.md` belum ditulis dan tabel status
belum punya baris F5, padahal commit fitur sudah ada. Gate dijalankan ulang
setelah perbaikan dan bukti itulah yang tercatat di dokumen ini.

### S3-1 (diperbaiki) — nama tes mengklaim kasus yang tidak diuji
Tes `F5: metering tampil setelah run terminal, dan run pra-D6 (null) tidak
merender` tidak punya assertion `null` sama sekali.
**Perbaikan:** dipisah menjadi `F5: run terminal tanpa metering (pra-D6) tidak
merender blok`, dan tes lama dinamai ulang sesuai isinya.

### S3-2 (diperbaiki) — transisi terminal via SSE tidak diuji
Semua tes memuat snapshot yang sudah `completed`; jalur nyata
(`run.completed` → `loadSnapshot` → `runActive` false → metering muncul)
tidak pernah dieksekusi.
**Perbaikan:** tes baru dengan snapshot awal `running` + frame
`run.completed`, stub mengembalikan snapshot kedua `completed` + metering.

### S3-3 (diperbaiki, bukan regresi F5) — banner stalled palsu
`catch` di efek SSE menangkap semua galat termasuk `AbortError` dari
`controller.abort()` saat efek dibersihkan setelah run terminal, lalu
`setStalled(true)`. Efek berikutnya langsung `return` (run terminal), jadi
banner tidak pernah dibersihkan.
**Perbaikan:** `if (!controller.signal.aborted) setStalled(true);`, plus
assertion di tes SSE bahwa banner tidak muncul setelah run terminal.

### S4 ditanggapi
- **S4-1 tipe terduplikasi.** `RunMetering` dideklarasikan ulang di komponen
  sementara sumbernya `src/lib/tasks/budget.ts`; drift akan lolos tsc.
  Kini `import type` dari sana (terhapus saat build) + `export type`.
  Konsekuensi: fixture tes harus memuat `consumed.totalTokens`.
- **S4-2 copy janggal.** `unreported` disisipkan sebagai `{count}` →
  "tidak dilaporkan token masuk". Kini angka tak dilaporkan menjadi kalimat
  sendiri, terpisah dari "… token masuk".
- **S4-3 "0 sumber dibaca".** Run non-riset tak pernah menulis `TaskSource`;
  segmen sumber kini disembunyikan bila `sourcesRead === 0`.
- **S4-4 `stopReason` belum disurfacekan.** Tetap di luar scope F5 (B3
  mencatatnya sebagai kandidat); acceptance WO-10 yang menentukan.

### Area diperiksa, bersih (dari reviewer)
- **Kontrak §D6.** `metering` dibaca dari `run`, `reported===false` → catatan
  estimasi, tanpa baris biaya, `null` → tidak dirender.
- **Kejujuran angka.** Tidak ada jalur `null` → "0"; `nf.format(null)` tidak
  pernah tercapai.
- **Gate terminal.** `usageJson`/`budgetJson` ditulis sebelum status terminal
  (`run.ts:518-533`, `research.ts:1185-1199`), jadi tidak ada snapshot
  terminal dengan metering basi.
- **Aksesibilitas.** Blok metering berada di dalam `<div aria-live="polite">`
  sehingga diumumkan saat muncul; `title` tidak diumumkan (tidak ganda).
  Premis reviewer bahwa blok di luar live region tidak tepat.
- **i18n.** `tasks.metering.unreported` ada di id + en; paritas kunci dijaga
  `messages.test.ts`.

## Tes

`src/components/run-metering-summary.test.tsx` (7 kasus, +2):
1. `reported=true` → angka id-ID dan sumber, tanpa catatan estimasi
2. `sourcesRead 0` → segmen sumber tidak dirender
3. `reported=false` → catatan estimasi tampil
4. angka `null` → "tidak dilaporkan", bukan 0, dan tidak disisipkan ke
   "… token masuk"
5. `metering null` → return null
6. `metering undefined` → return null
7. tanpa klaim biaya

`src/components/task-view.test.tsx` (+5):
1. `F5: metering tampil setelah run terminal`
2. `F5: run terminal tanpa metering (pra-D6) tidak merender blok`
3. `F5: run.completed via SSE memuat snapshot baru dan memunculkan metering`
   (+ banner stalled tidak menyala palsu)
4. `F5: run berjalan tidak menampilkan metering`
5. `B2d: sumber jawaban dirender...` (dari WO-B2d, tetap hijau)

## Sisa (dicatat, tidak memblokir)

- `stopReason` belum ditampilkan di UI (S4-4).
- Pemakaian hanya ringkasan akhir; tidak ada angka berjalan selama run —
  disengaja (SDD-FRONTEND §D6 meminta ringkasan, bukan progress).
- Belum ada e2e; bukti UI end-to-end milik WO-9.