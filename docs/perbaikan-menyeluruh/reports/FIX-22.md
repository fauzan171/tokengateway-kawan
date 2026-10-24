# FIX-22 — Bantuan model kedua setelah kebutuhan terukur

Status: **verified_fixture**

## Masalah

Spesifikasi menuntut bukti manfaat sebelum membangun arsitektur multi-agent.
Risikonya konkret: fan-out tanpa batas, child yang membaca data pengguna lain,
child yang melewati kuota, dan kesimpulan "dua model setuju berarti benar" —
yang salah secara epistemik dan mahal secara biaya.

## Solusi

### `src/lib/tasks/multi-model.ts` — review terbatas, bukan swarm

Tahap pertama adalah **review/fallback model yang dipilih pengguna**, sesuai
spesifikasi. Yang ditegakkan:

| Aturan | Cara |
|---|---|
| budget child tidak pernah > parent | `childBudgetRatio = 0.5` untuk langkah & token; deadline = 50% sisa |
| kedalaman maksimum 1 | `MULTI_MODEL_LIMITS.maxDepth`; child tidak dapat punya child |
| jumlah child dibatasi | `maxChildren = 2` |
| child tidak lebih luas | tool child = irisan(tool parent, tool diminta); yang dibuang dilaporkan |
| provider tidak diganti diam-diam | model peninjau dipilih pengguna; beda koneksi = peringatan biaya/privasi eksplisit |
| peninjau = model utama ditolak | `REVIEWER_SAME_AS_PARENT` |
| batas ditegakkan saat eksekusi | `childWithinBudget()` mengembalikan `STEPS`/`TOKENS` |
| cancel parent mencakup child | `listActiveChildren()` memberi child nonterminal per parent |

### Agregasi yang jujur

`aggregateFindings()` mengelompokkan temuan per isu:

- isu yang muncul di ≥2 sumber → `agreed` (dengan daftar sumbernya);
- isu yang hanya di satu sumber → `disputed`, **bukan** dibuang dan bukan
  dirata-ratakan;
- selalu menyertakan `disclaimer`: kesepakatan dua model bukan bukti kebenaran,
  karena keduanya bisa salah dengan cara yang sama.

### Skema

Dua kolom aditif pada `TaskRun`: `parentRunId` (null = akar) dan `depth`
(default 0), plus index `(parentRunId, status)`. Migrasi manual dua provider,
nullable/default — tidak ada backfill, tidak ada data pengguna yang berubah.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/tasks/multi-model.ts` | **baru** — batas, rencana review, agregasi |
| `src/lib/tasks/multi-model.test.ts` | **baru** — 11 tes |
| `prisma/schema.prisma` | `TaskRun.parentRunId`, `TaskRun.depth`, index |
| `prisma/migrations/{sqlite,postgresql}/20261031000000_task_run_parent` | **baru** |

## Verifikasi

```
node scripts/check-migrations.mjs                              → OK (2 provider)
npx prisma migrate deploy --schema prisma/schema.sqlite.prisma → All migrations applied
npm run db:generate                                            → exit 0
npx tsc --noEmit -p tsconfig.json                              → 0 error
npx eslint src/lib/tasks/multi-model.ts                        → 0 error, 0 warning
npx vitest run src/lib/tasks/multi-model.test.ts               → 11 passed
```

## Tes (11)

- **Budget**: setiap child ≤ 50% langkah/token parent dan deadline lebih awal;
  jumlah child = batas; kedalaman 1.
- **Peninjau sama** dengan parent → ditolak.
- **Subset tool**: meminta `shell.exec`/`filesystem.write` → child hanya dapat
  `web.search`, dan catatan menyebut tool yang ditolak.
- **Beda koneksi** → catatan biaya/privasi muncul.
- **childWithinBudget**: dalam batas ok; melebihi langkah → `STEPS`; melebihi
  token → `TOKENS`.
- **Agregasi**: isu di dua sumber → `agreed` dengan sumber terurut; isu satu
  sumber → `disputed`; disclaimer selalu ada dan memuat "bukan bukti kebenaran";
  temuan kosong tidak membuat grup palsu.
- **listActiveChildren**: hanya child nonterminal (yang `completed` tidak ikut).

## Batas yang sengaja dilewati

- **Manfaat belum terukur.** Spesifikasi mensyaratkan peningkatan kualitas/
  latensi/biaya terukur pada dataset yang sama; tidak ada kredensial provider di
  sesi ini, jadi **tidak ada klaim manfaat**. Modul ini menyiapkan mekanismenya,
  bukan membuktikannya.
- **Tidak ada orkestrasi nyata.** `planReview()` menghasilkan rencana; belum ada
  kode yang benar-benar membuat `TaskRun` child, menjalankan model, atau
  membatalkan child saat parent cancel. Itu menunggu loop tool FIX-09/P1.
- **Bukan swarm.** Tidak ada fan-out rekursif, tidak ada diskusi antar-agent,
  tidak ada pemilihan provider otomatis berdasarkan biaya/privasi.
- **Kuota belum ditegakkan.** `UsageRecord` hanya mencatat; penegakan kuota per
  pengguna adalah pekerjaan tersendiri (lihat rencana K4).
- **Model judge bukan oracle.** Tidak ada penilaian "model A lebih benar dari
  model B"; agregasi hanya menyebut sumber dan perbedaan.
