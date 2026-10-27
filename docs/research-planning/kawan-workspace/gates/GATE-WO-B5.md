# GATE — WO-B5 (metering D6: budget.ts + settle + DTO snapshot)

Worktree `worktrees/wo-b5` (`wo/b5`), basis `feat/kawan-workspace` `d544d52e`.
Commit worktree `ff803527`; squash-merge ke `feat/kawan-workspace`: `38e12270`.
AUTO_PUSH=0 (lokal saja).

## Gate (verbatim, dijalankan koordinator di worktree wo-b5)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/lib/tasks/budget.ts src/lib/tasks/budget.test.ts src/lib/tasks/research.ts src/lib/tasks/tasks.ts src/lib/tasks/run.ts src/lib/tasks/run.test.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  130 passed (130)
      Tests  1403 passed (1403)
```
(basis 129 file / 1385 lulus di `0fe46ff6`; +1 file, +18 tes, nol regresi)

### `npm run build`
```
(exit 0; route list normal)
```

Catatan: pada checkout baru `npm run db:generate` hanya menghasilkan klien
Postgres bila `.env`/`DATABASE_URL` tidak menunjuk `file:`. Untuk gate SQLite
di worktree, jalankan
`DATABASE_URL=file:./prisma/dev.db npx prisma generate` sebelum `tsc`.
Bukan perubahan kode — perilaku `prisma7.config.ts` yang memilih schema dari
`DATABASE_URL`.

## QA (agent `kawan-reviewer`, read-only)

Putaran 1: **CHANGES-REQUESTED** — 1×S1 + 3×S2. Putaran 2: **APPROVED**.

### S1 (blocking) — settle gagal meninggalkan run menggantung
`settle()` memutasi `ctx.budget` lebih dulu, lalu `settleUsage` melempar
`Error("Gagal menyimpan anggaran run…")` bila 8 percobaan CAS habis. Galat itu
tidak tertangkap (hanya `ResearchProviderError` yang ditangani) → job
`indeterminate` tetapi `TaskRun` tetap `running` tanpa event terminal.
**Diperbaiki:** durable ditulis lebih dulu, memori disinkronkan sesudahnya;
catch-all di `runResearchRun` menutup run `indeterminate` sebelum rethrow.
Pengecualian: `LeaseLost` (worker lain sudah mengambil alih — menulis justru
menabrak pemilik baru) dan `fence.heldFresh() === false` (lease berpindah di
antara pemeriksaan dan penutup).

### S2 diperbaiki dalam gelombang yang sama
- **Pra-terminal menimpa baris terminal.** Penulisan `stopReason`+`usageJson`+
  `usage.updated` kini di dalam `fenced()` dengan penjaga `isTerminalRun`;
  bila run sudah terminal (`cancel`/`deadline` masuk setelah pemeriksaan),
  tidak ada tulisan dan tidak ada `finish` kedua. Tanpa ini snapshot
  `run.stopReason` bisa bertentangan dengan event penutup.
- **Metering nol untuk run lama.** `toRunMetering` mengembalikan `null` bila
  `budgetJson` dan `usageJson` sama-sama null. Objek bernilai nol adalah klaim
  ("pemakaian 0"), sedangkan SDD-FRONTEND §D6 butuh membedakan "belum ada data"
  dari "nol".
- **Jalur agen umum tidak menulis `usageJson`.** `run.ts` kini menulis kolom itu
  di transaksi `usage.updated` yang sama, sehingga metering agen `default`
  (mayoritas run) tidak lagi selalu kosong.
- **`catch` membuang `defaultMax`.** `readStoredBudget` pada JSON rusak
  mengembalikan `emptyStoredBudget(defaultMax)`. Tanpa ini `max` jatuh ke 0 →
  resume langsung `budget_limit` tanpa satu pun panggilan model, dan settle
  berikutnya menulis `max: 0` permanen.

### S3 diperbaiki
- **`revision` dipakai sebagai penghitung CAS anggaran.** `revision` adalah
  penanda transisi status run (ETag/If-Match, `policyRevision`); menaikkannya
  tiap panggilan model membuat angka itu berbohong soal state run. CAS kini
  pada nilai `budgetJson` (`where: { id, budgetJson: row.budgetJson }`), kolom
  `revision` tidak disentuh settle.
- **Impor dinamis `appendEvent`.** Diganti impor statis.

### S3 diterima sebagai sisa (non-blocking, dicatat)
- Tes CAS paralel berjalan di SQLite; serialisasi SQLite bisa membuatnya lulus
  tanpa membuktikan CAS benar di PostgreSQL. Butuh repro terpisah (tidak ada
  Postgres live di mesin ini).
- Guard `written === false` dan catch-all `indeterminate` belum punya tes
  khusus; yang diuji hanya jalur `LeaseLost` (tes lease di tengah tulisan).
- Siklus impor `tasks → budget → tasks` aman di ESM (semua binding dipakai saat
  panggil, tak ada evaluasi top-level) tetapi patut dicatat saat refactor.

## Bukti kontrak D6

- **Satu penulis bentuk durable:** `budgetJson` hanya ditulis di
  `budget.ts` (`updateMany`); `research.ts` hanya membaca lewat `parseBudget`.
  Ini menutup akar bug S2-1 WO-B3 (tulis nested, baca flat).
- **`budget.updated` per settle**, dipancarkan di transaksi yang sama dengan
  penulisan → `seq` konsisten dengan `lastEventSeq`; tidak ada emisi ganda.
- **`usage.updated`** dipancarkan jalur riset dan jalur agen umum dengan bentuk
  sama (`reported`, token, `estimated`).
- **DTO** `{usage:{reported,promptTokens,completionTokens,totalTokens},
  consumed, sourcesRead}`; tanpa `estimatedCostUsd`; `stopReason` di level run.
  Tidak ada key/prompt/isi halaman di DTO — `sources` diproyeksikan ke
  `kind/finalUrl/requestedUrl/textHash` dan hanya jumlahnya yang keluar.
- `getTaskSnapshot` tetap satu `$transaction`; query `taskSource` tambahan ada
  di dalamnya sehingga kursor dan teks tetap konsisten.

## Tes (SDD D6(6) + tambahan)

`src/lib/tasks/budget.test.ts` (6 kasus):
1. `usage reported dari stream terbaca apa adanya`
2. `tanpa usage → reported:false dan angka null, bukan nol` (+ run pra-D6 → `metering === null`)
3. `settleUsage CAS: dua settle bersamaan tidak menghilangkan delta` (+ 3 event `budget.updated`)
4. `sourcesRead dihitung dari TaskSource page_read unik`
5. `snapshot API mengekspos metering; run lama (kolom null) tetap valid`
6. `budgetJson rusak tidak membuang batas default (max tetap)`

`src/lib/tasks/run.test.ts`: `usage final jalur umum ditulis durable ke usageJson (D6)`.

## Sisa (dicatat, tidak memblokir)

- `src/components/run-metering-summary.tsx` mendeklarasikan `promptTokens: number`
  padahal backend bisa mengirim `null` (`Intl.NumberFormat.format(null)` → "0"),
  dan komponen belum dipanggil dari `task-view.tsx` — perbaikan milik WO-F5.
- Jalur SSE live/reconnect dan `e2e/` belum diuji untuk metering.
