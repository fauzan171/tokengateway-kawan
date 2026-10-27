# GATE — WO-B3 (loop riset + tool web_search/web_read)

Worktree `worktrees/wo-b3` (`wo/b3`), basis `feat/kawan-workspace` `80ac9889`.
Commit worktree `115de110`; squash-merge ke `feat/kawan-workspace`: `0fe46ff6`.
AUTO_PUSH=0 (lokal saja).

## Gate (verbatim, dijalankan koordinator di worktree wo-b3)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/lib/agents/registry.ts src/lib/tasks/run.ts src/lib/tasks/research.ts src/lib/tasks/research.test.ts src/lib/tools/catalog.ts src/lib/tools/registry.ts src/lib/tools/registry.test.ts tests/fixtures/provider-server.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  129 passed (129)
      Tests  1385 passed (1385)
```
(basis 128 file / 1383 lulus di `eb4e9ac4`; +1 file, nol regresi)

### `npm run build`
```
BUILD_EXIT=0
```

Catatan lingkungan: build pertama gagal `ENOSPC` — root `/dev/sda1` 100% penuh
(77G/77G). Penyebab: 10.686 direktori DB sementara uji `kawan-*` di
`/home/hermes/.hermes/cache/scratch` lebih tua dari 1 hari. Setelah dibersihkan
(5.9G bebas), build lulus. Bukan masalah kode.

## QA (agent `kawan-reviewer`, read-only)

Putaran 1: **CHANGES-REQUESTED — S2-1 blocking**.

### S2-1 (blocking) — anggaran tidak durable
`saveBudget` menulis `{max, consumed:{promptTokens,…}}` tetapi `parseBudget`
membaca bentuk **flat**. Setiap resume/takeover mengembalikan seluruh hitungan
ke nol; batas 24k token dan 24 tool per run bisa dilewati berulang lintas
resume. **Diperbaiki:** `parseBudget` membaca `consumed` (fallback flat untuk
baris lama) dan memvalidasi tiap angka (`Number.isFinite`, `>= 0`).
Tes baru: `anggaran durable terbaca saat resume: sisa token habis →
budget_limit` — seed `consumed` 23k/1k lalu asersi run berhenti `budget_limit`
tanpa satu pun langkah model. Gagal bila parser kembali membaca flat.

### S3 diperbaiki dalam gelombang yang sama
- **S3-1 token budget dienforce setelah dispatch** → kini dicek di awal
  `modelTurn` (reserve); habis → `budget_limit`, final parsial, synthesis
  dilewati. Jalur `budget_limit` dari token sebelumnya tidak mungkin.
- **S3-3 `usageJson.reported` = `estimated`** (keduanya dari
  `completionTokens > 0`, yang selalu > 0 karena usage absen diisi reservasi) →
  kini dilacak `budget.unreportedCalls` per panggilan; `reported =
  unreportedCalls === 0`. Tes: `usage tak dilaporkan → metering estimasi`.
- **S3-5 tes lease tidak menjangkau tulisan** → tes baru mencabut lease SETELAH
  enam pemeriksaan (run.started + framing berjalan), lalu menegaskan transaksi
  terfence rollback: tak ada `succeeded` tanpa `resultDigest`, seq tetap
  monoton tanpa duplikat.
- **S3-6 fixture rapuh terhadap taint** → `userText` membuang pesan hasil tool
  (awalan `HASIL TOOL (data tak tepercaya`) sebelum memilih fase, sehingga
  halaman hasil `web_read` tidak bisa menggeser pemilihan balasan.

### S3-2 diterima sebagai shortcut (non-blocking, diputuskan koordinator)
SDD D1(2) menjanjikan reuse langkah via `argsDigest` yang sama. Implementasi
tetap berkunci ordinal karena **teks hasil tidak durable** — `TaskStep` hanya
menyimpan `resultDigest`, jadi langkah yang "direuse" akan mengembalikan hasil
kosong (jawaban kosong untuk model, bukti kosong untuk tool). Jalur skip yang
benar sudah durable lewat jalur lain: `readUrls`/`TaskSource` mencegah baca
ulang sumber, `researchCycle` mencegah ulang siklus. Dicatat di kode sebagai
`shortcut: resume mengulang panggilan model/tool yang sudah sukses, tambah
ketika TaskStep menyimpan teks hasil`.

### Tidak ditemukan (bukti baca kode, diverifikasi koordinator)
- Regresi `finish()`: jalur non-riset tidak pernah mengirim `stopReason` → null,
  sama seperti HEAD; `errorCode` identik. Tidak menimpa jalur sukses. (Satu-satunya
  perubahan semantik: `finish()` kini menulis kolom `stopReason` saat pemanggil
  mengirimnya — sebelumnya parameter itu hanya masuk payload event.)
- Terminal ganda: `finish` early-return `isTerminalRun` + CAS `cancelRun`.
- Kebocoran apiKey ke event/log/pesan: hanya di header Authorization.
- SSRF: semua fetch lewat `fetchOutbound`/`assertOutboundAllowed`.
- Taint: hasil tool hanya masuk sebagai pesan `user` berlabel, setelah instruksi fase.

## Sisa (dicatat, tidak memblokir)

- Belum ada tes untuk `no_new_evidence`, `provider_error`, deadline jalur riset,
  dan injeksi prompt (§D1(6) hanya mewajibkan enam kasus, semuanya ada + 3 tes
  tambahan).
- `RunDto` belum memuat `stopReason`/`researchCycle`/`usageJson` — konsumen API
  belum bisa membaca penyebab terminal walau kolomnya durable. Kandidat WO-F5.
- Dispatch `agentId === "research"` hardcode, belum capability-based (§D1(1)).