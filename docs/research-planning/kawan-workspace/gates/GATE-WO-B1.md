# GATE — WO-B1 (migrasi schema additive kawan-workspace)

Worktree: `worktrees/wo-b1` · Branch: `wo/b1` · Base: `da7247c8` (feat/kawan-workspace)
Head iterasi 1: `96bc59d4` `feat(wo): B1 migrasi schema additive kawan-workspace`

Diff: `prisma/schema.prisma | 88 +++` (+88/-0), 2 direktori migrasi (sqlite + postgresql).

## Gate output (verbatim, final = setelah perbaikan S3)

```
$ node scripts/check-migrations.mjs
check-migrations: OK (2 provider, init dibekukan, urutan sama)
MIGR=0

$ npm run db:generate
GEN=0

$ npx tsc --noEmit -p tsconfig.json
TSC=0

$ npm test
 Test Files  122 passed (122)
      Tests  1326 passed (1326)
TEST=0
(basis 122/1325 → +1 tes penjaga USER_DATA_MAP; nol regresi)

$ npm run build
 ✓ Compiled successfully in 100s
BUILD=0
```

## QA (kawan-reviewer, read-only) — APPROVED, tanpa S1/S2

Dua temuan S3 diperbaiki di iterasi 2 sebelum merge:

- **S3-1 erasure/ekspor `SearchUsageDaily`**: tabel user-keyed baru tanpa relasi User
  → TIDAK dihapus `deleteUserData` dan TIDAK diekspor `exportUserData`; riwayat
  aktivitas pencarian akan selamat dari "hapus data saya" begitu writer D3 mendarat.
  Perbaikan: `tx.searchUsageDaily.deleteMany` di `src/lib/admin/users.ts` (dalam
  `$transaction`), `USER_DATA_MAP` + `EXPORT_SELECT` (`["id","provider","day","count"]`,
  URL/query mentah sengaja tidak ikut) + pembacaan di `exportUserData`, dan satu tes
  penjaga baru — dibuktikan **merah sebelum / hijau sesudah**.
- **S3-2 paritas tipe tanggal Postgres**: kelima `TIMESTAMP` diganti `TIMESTAMP(3)`
  agar seragam dengan migrasi `DATETIME`/`TIMESTAMP(3)` sebelumnya (preseden
  `20261030000000_schedule_notification`). DDL tetap valid di kedua provider.
- **S4** `Artifact.taskId` — komentar satu baris: provenance internal, bukan data
  pengguna, jadi tidak ikut ekspor artefak.

QA memverifikasi: init `00000000000000_init` + `_schema.sql` + `checksums.json`
TIDAK tersentuh; seluruh field/index/relasi persis spec; tidak ada kolom menyimpan
key/token; `RUN_FIELDS`/`toRunDto`/`toPublic` allowlist eksplisit → field baru tidak
bocor ke DTO.

## Cakupan yang TIDAK dibuktikan (kejujuran)

- DDL tidak dijalankan ke server Postgres/SQLite sungguhan; `check-migrations.mjs`
  hanya pemindai teks/urutan. Klaim "portabel" belum dibuktikan perilaku runtime.
- `SearchUsageDaily` baru punya pembaca/penulis non-tulis sampai writer D3 (WO-B2)
  mendarat; tes penjaga hanya membuktikan keanggotaan peta.
- Test integrasi `deleteUserData` end-to-end (butuh DB) belum ada.