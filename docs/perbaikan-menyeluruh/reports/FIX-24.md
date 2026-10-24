# FIX-24 — Operasi, dokumentasi, dan gate rilis

Status: **verified_fixture**

## Masalah

Tidak ada cara membedakan tiga keadaan yang sangat berbeda:

1. proses hidup tetapi DB mati;
2. proses hidup, DB sehat, tetapi **worker mati** — gejalanya identik dengan
   "antrean kosong", jadi tidak terlihat;
3. kode sudah di-deploy tetapi **migrasi belum diterapkan** — keadaan yang
   pernah membuat `kawan-worker` crash-loop (tercatat di STATUS.md).

Tidak ada pembersihan terjadwal yang benar-benar berjalan, dan tidak ada
pemisahan antara endpoint publik dan admin, sehingga endpoint kesiapan mudah
membocorkan versi build, nama host DB, atau pesan galat driver.

## Solusi

### `src/lib/ops/health.ts` — tiga audiens, tiga kontrak

| Fungsi | Menyentuh | Untuk |
|---|---|---|
| `liveness()` | tidak ada | supervisor: restart hanya bila proses benar-benar mati |
| `readiness()` | DB, migrasi, denyut worker | load balancer / operator |
| `publicReadiness()` | — | membuang semua detail, sisakan boolean + satu alasan |
| `operationalMetrics()` | agregat saja | admin |

`checkMigrations()` membandingkan direktori migrasi di disk dengan
`_prisma_migrations`; migrasi yang belum diterapkan → `down` **dengan namanya**.
Bila tabel riwayat tidak ada, hasilnya `unknown` — bukan `down` palsu.

`checkWorker()` memakai denyut terakhir; worker yang sehat dengan antrean kosong
tetap terlihat hidup, dan worker mati terlihat **tanpa** perlu ada job.

Keputusan penting: `unknown` **tidak** menjatuhkan readiness. Tidak dapat
dipastikan bukan berarti tidak siap; menjatuhkannya akan memicu restart yang
merusak layanan sehat.

`operationalMetrics()` melaporkan job per state, run per status, byte artefak,
artefak kedaluwarsa, occurrence tertunggak, dan **usage reported vs unknown
terpisah**. `estimatedTokens` sengaja 0: tidak ada estimasi per baris yang akurat,
dan mengisinya berarti mencampur angka nyata dengan tebakan.

### `GET /api/kawan/v1/health` — publik, minimum

`?liveness=1` → tidak menyentuh DB. Tanpa parameter → readiness; status HTTP
503 saat tidak siap. Body hanya `{ready, checkedAt, reason?}`; `reason` berupa
"`<nama komponen>` tidak siap" — **tanpa** host, port, nama tabel, pesan driver,
atau versi.

### `scripts/cleanup.ts` + `npm run cleanup` — pembersihan nyata

Benar-benar memangkas: artefak kedaluwarsa (tombstone), job terminal > 30 hari,
idempotency key > 7 hari, occurrence lama > 30 hari, denyut worker basi > 7 hari.
`--dry-run` melaporkan tanpa menghapus. Dijalankan lewat `tsx` seperti worker,
karena klien Prisma yang digenerate berupa TypeScript — skrip `.mjs` gagal
`ERR_MODULE_NOT_FOUND`, dan itu ditemukan saat menjalankannya, bukan saat menulis.

Petunjuk cron ada di header skrip, dan perintahnya benar-benar ada di
`package.json`.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/ops/health.ts` | **baru** — liveness, readiness, metrik |
| `src/lib/ops/health.test.ts` | **baru** — 10 tes |
| `src/app/api/kawan/v1/health/route.ts` | **baru** — endpoint publik |
| `scripts/cleanup.ts` | **baru** — CLI pembersihan |
| `package.json` | skrip `cleanup` |

Tidak ada perubahan skema → tidak ada migrasi. Tidak ada dependensi baru.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json                     → 0 error
npx eslint src/lib/ops src/app/api/kawan/v1/health    → 0 error, 0 warning
npx vitest run src/lib/ops                            → 10 passed
DATABASE_URL=file:./dev.db npm run cleanup -- --dry-run → JSON laporan, exit 0
DATABASE_URL=file:./dev.db npm run cleanup            → JSON laporan, exit 0
```

## Tes (10)

- **liveness**: selalu hidup, tidak menyentuh DB, uptime ≥ 0.
- **readiness**: DB + migrasi + worker segar → ready, urutan check tetap;
  worker tanpa denyut → `down`; **denyut basi 5 menit → `down` walau ada job
  sukses**; migrasi di disk yang belum diterapkan → `down` dan **nama
  migrasinya disebut**; tanpa tabel riwayat → `unknown`, bukan `down` palsu.
- **publicReadiness**: siap → hanya 2 field; tidak siap → alasan ringkas, dan
  JSON **tidak memuat** "rahasia", "db-internal", maupun "postgres".
- **operationalMetrics**: job/artefak/usage terhitung; `reportedTokens` hanya
  dari `reported=1`; `estimatedTokens` 0; `unknownRuns` terpisah; **judul chat
  tidak muncul** di metrik.

## Batas yang sengaja dilewati

- **Backup/restore belum diuji ulang.** `scripts/backup.sh`/`restore.sh` sudah
  ada, tetapi gate "restore pada PostgreSQL populated" tidak dapat dijalankan —
  tidak ada server PostgreSQL di mesin ini. Dinyatakan `blocked_external`.
- **Sweeper jadwal belum dijalankan worker.** `sweepDueSchedules()` (FIX-21)
  belum dipanggil dari worker; menambahkannya berarti menambah job kind, yang
  harus lewat registry handler. Belum dilakukan.
- **Tidak ada dashboard.** Metrik tersedia sebagai fungsi; UI admin belum
  menampilkannya.
- **Feature flag belum ada.** Spesifikasi meminta flag default-off sampai gate
  lulus; belum ada mekanisme flag, jadi capability tetap satu-satunya gerbang.
- **Build/generate di checkout terpisah belum diuji** (tidak menimpa `.next`
  server aktif). Ini prosedur operator, bukan kode.
- **Tidak ada klaim SLO/latensi.** Tidak ada benchmark; angka p50/p95 belum
  diukur dan tidak dilaporkan sebagai fakta.
