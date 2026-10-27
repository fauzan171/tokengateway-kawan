# GATE — WO-B2d (provenance/sitasi minimal: TaskSource → sumber jawaban)

Worktree `worktrees/wo-b2d` (`wo/b2d`), basis `feat/kawan-workspace` `10d79e70`.
Commit worktree `a3667b30` (fitur) + `b6d41a48` (perbaikan QA);
squash-merge ke `feat/kawan-workspace`: `e6f21551`. AUTO_PUSH=0 (lokal saja).

## Scope

`TaskSource` sudah mencatat `search_result` dan `page_read` per run
(`research.ts:693-704`, `:776-785`) tetapi tidak pernah keluar ke klien —
snapshot hanya memakai kolomnya untuk menghitung `metering.sourcesRead`.
WO ini mengekspos **halaman yang benar-benar dibaca** sebagai `run.sources`
dan merendernya di TaskView.

Tanpa schema, tanpa migrasi, tanpa perubahan route (GET snapshot meneruskan
DTO apa adanya).

## Gate (verbatim, dijalankan koordinator di worktree wo-b2d)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/lib/tasks/tasks.ts src/lib/tasks/budget.test.ts src/components/task-view.tsx src/components/task-view.test.tsx src/lib/i18n/messages.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  130 passed (130)
      Tests  1407 passed (1407)
```
(basis 130 file / 1403 lulus di `10d79e70`; +4 tes, nol regresi)

### `npm run build`
```
(exit 0; route list normal)
```

Catatan checkout baru: `npm run db:generate` (`node scripts/make-sqlite-schema.mjs
&& prisma generate && prisma generate --schema prisma/schema.prisma`) wajib
dijalankan sebelum `tsc`/`build` — `prisma7.config.ts` memilih schema dari
prefix `DATABASE_URL`, jadi memanggil `prisma generate` langsung tanpa
`DATABASE_URL=file:...` gagal mencari `prisma/schema.sqlite.prisma`.

## QA (agent `kawan-reviewer`, read-only)

Keputusan: **APPROVED** dengan 2 temuan S3 — keduanya diperbaiki sebelum merge.

### S3-1 (diperbaiki) — urutan sumber tidak deterministik
`tx.taskSource.findMany({ where: { runId } })` tanpa `orderBy`. SQLite biasanya
stabil menurut rowid, PostgreSQL tidak menjamin urutan heap; `toRunSources`
memakai urutan masukan dan "yang pertama menang" untuk `finalUrl` duplikat,
jadi urutan daftar dan judul pemenang bisa berubah antar-request.
**Perbaikan:** `orderBy: [{ accessedAt: "asc" }, { id: "asc" }]`.

### S3-2 (diperbaiki) — judul tidak dibatasi
`extractTitle` mengambil `<title>`/`og:title` utuh sementara batas halaman
2 MB; dengan `maxSourcesRead: 8` satu snapshot bisa membawa judul raksasa.
SDD-BACKEND §D6(5) menuntut DTO hanya memuat "URL/judul sumber bounded".
**Perbaikan:** `title: (row.title ?? url).slice(0, 300)`.

### Diterima sebagai sisa (dicatat)
- **S4-1 sumber tidak live.** `task-view.tsx` hanya memuat ulang snapshot untuk
  kind berawalan `run.`; `source.added` diabaikan, jadi blok sumber baru terisi
  saat run terminal. Mengikutkan `source.added` berarti satu GET per sumber —
  sengaja tidak diambil; acceptance WO-9 yang menentukan apakah perlu.
- **S4-2** tidak ada e2e sumber; tes yang ada bukan tes kosong (proyeksi murni +
  render dengan `href`/`rel`/teks benar-benar diperiksa).
- **S4-3 penamaan.** IMPLEMENTATION-PLAN menyebut `sourceRefs`; payload memakai
  `sources`. Tidak ada SDD yang menetapkan nama field dan sifatnya additive.

### Area diperiksa, bersih
1. **Tidak ada kebocoran isi halaman.** Proyeksi hanya `{title, url}`;
   `snippet`, `textHash`, `textChars`, provider, `stepId` tidak keluar
   (`textHash` di-`select` hanya karena dipakai `toRunMetering`).
2. **`finalUrl` bukan vektor SSRF.** Hanya `page_read` yang dibuat setelah baca
   sukses, dan `readSource` memvalidasi tiap lompatan lewat
   `assertRedirectAllowed` (`src/lib/net/policy.ts:363-381`).
3. **XSS aman.** Judul/URL dirender sebagai teks React; `target="_blank"` +
   `rel="noopener noreferrer"`; skema non-http ditolak di egress gate dan
   disaring React 19.
4. **Kontrak DTO additive.** `sources` hanya di jalur snapshot; `toRunDto`
   (list/create/follow-up/cancel) tidak berubah — pola sama `metering` WO-B5.
5. **Invarian snapshot utuh.** Query `taskSource` tetap di dalam `$transaction`
   yang sama (satu query dipakai bersama metering), jadi `snapshotSeq`, pesan,
   dan sumber berasal dari satu snapshot.
6. **Owner.** `taskSource` difilter `runId` milik run yang sudah lolos
   `findFirst({ id: activeRunId, taskId })` + filter `userId`; lintas pengguna 404.

## Tes

`src/lib/tasks/budget.test.ts` (+2 kasus):
1. `sumber jawaban: hanya page_read, dedupe per URL final, judul jatuh ke URL`
   (+ judul 1000 char → 300)
2. `snapshot API mengekspos sumber run; run tanpa TaskSource tetap array kosong`
   (+ urutan mengikuti `accessedAt`, bukan urutan insert)

`src/components/task-view.test.tsx` (+2 kasus):
1. `B2d: sumber jawaban dirender sebagai tautan aman; tanpa sumber tidak ada blok`
2. `B2d: run tanpa sumber tidak merender blok sumber`

## Sisa (dicatat, tidak memblokir)

- Sumber belum tampil selama run berjalan (hanya setelah terminal) — lihat S4-1.
- Tidak ada e2e untuk blok sumber; bukti UI end-to-end milik WO-9.
- `title` URL non-ASCII/tak terpotong di tengah entitas HTML tidak dinormalisasi;
  nilai mentah provider dipakai apa adanya (teks React, bukan HTML).