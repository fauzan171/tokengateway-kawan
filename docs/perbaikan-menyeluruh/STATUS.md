# STATUS implementasi A–J

Diperbarui: 2026-10-21. Coordinator: [CC] (sesi terminal Hermes).
Baseline: `126502da8f650c81ee26ae3e7a406d13ac8972f8` + perubahan pemilik yang
belum commit (`README.md`, `prisma/schema.prisma`).

## Preflight

| Item | Nilai |
|---|---|
| Root | `/home/hermes/workspace/projects/tokengateway-kawan` |
| Branch | `merge/main-into-feat-nt-p1` |
| Node / npm | v22.23.3 / 10.9.9 |
| Prisma | 7.10.0 (CLI + client), dua provider |
| Perubahan pengguna | `README.md` (status jujur), `prisma/schema.prisma` (hapus duplikat `User.connections` → T01 sudah tertutup) |
| Paket docs | `docs/perbaikan-menyeluruh/` untracked; dipertahankan |

Baseline yang dijalankan:

| Perintah | Hasil |
|---|---|
| `npm test` | 77 file, 775 test lulus, 133 dtk |
| `npm run typecheck` | Lulus |
| `node scripts/check-migrations.mjs` | Lulus (versi lama) |
| `python3 tasks/agent-v1/check_docs.py` | Lulus |
| `python3 tasks/nontechnical-v1/tools/check_docs.py` | Lulus |
| `prisma validate --schema prisma/schema.prisma` | Lulus (setelah perbaikan pemilik) |

Tidak tersedia lokal: PostgreSQL server, Docker, sandbox runtime, SMTP, OAuth
provider. Gate yang membutuhkannya dicatat `blocked_external`.

## Papan status

| FIX | Fase | Dependency | Status | Next action |
|---|---|---|---|---|
| FIX-01 | R0 | — | `verified_fixture` | — |
| FIX-02 | R0 | 01 | `verified_fixture` | — |
| FIX-03 | R0 | 01,02 | `planned` | state UI/replay/idempotensi |
| FIX-04 | R1 | 03,07 | `in_progress` | konteks server + migrasi judul selesai; sisa model picker & hardcoded |
| FIX-05 | R1 | 02,03,04 | `planned` | — |
| FIX-06 | R1 | 01,02,07 | `planned` | — |
| FIX-07 | R0 | 01 | `planned` | — |
| FIX-08 | R2 | 03,05,06,07 | `planned` | — |
| FIX-09 | R2 | 08,04 | `planned` | — |
| FIX-10 | R2 | 09,07 | `planned` | — |
| FIX-11 | R2 | 09,06 | `planned` | — |
| FIX-12 | R3 | 11,17 | `planned` | — |
| FIX-13 | R3 | 05,06,08 | `planned` | — |
| FIX-14 | R3 | 06,11,17 | `planned` | — |
| FIX-15 | R2/R3 | 09,11 | `planned` | — |
| FIX-16 | R3 | 04,11,17 | `planned` | — |
| FIX-17 | R4 | 07,09,11 | `planned` | — |
| FIX-18 | semua | 04 | `planned` | — |
| FIX-19 | R3/R4 | 09,08 | `planned` | — |
| FIX-20 | R4 | 07,08,09 | `planned` | — |
| FIX-21 | R4 | 08,20,24 | `planned` | — |
| FIX-22 | setelah single agent | 09,18,24 | `planned` | — |
| FIX-23 | semua | 01,02 | `planned` | — |
| FIX-24 | R0–R5 | 01 | `planned` | — |

## Gate terakhir (diverifikasi Hermes, bukan klaim [CC])

| Perintah | Hasil |
|---|---|
| `npx prisma validate` dua schema | exit 0 |
| `npm run db:generate` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `node scripts/check-migrations.mjs` | OK (2 provider, init dibekukan, urutan sama) |
| `python3 tasks/agent-v1/check_docs.py` | LULUS, 0 pelanggaran |
| `python3 tasks/nontechnical-v1/tools/check_docs.py` | LULUS |
| `npm test` | **79 file, 786 test lulus**, 138 dtk, exit 0 |
| `npx eslint` 8 berkas berubah | exit 0 |
| `npm run build` | **exit 0** — gagal sekali karena cache `.next` korup (`WasmHash._updateWithBuffer`), hijau setelah `rm -rf .next` |
| Fresh + upgrade populated dua provider | belum (tidak ada PostgreSQL lokal) |

## Run-3 [CC] (sesi baru, scope FIX-03, `--max-turns 120`)

Mati `API Error 400 upstream route rejected` pada turn 84 — pola sama dengan
run-2. Yang dihasilkan: `src/lib/chat/idempotency.ts` (baru) + `messages.ts`
dialihkan ke modul itu, digest kini memuat owner + operasi + chatId + payload.

Dua regresi ditinggalkan run-3, keduanya sudah ditutup Hermes:
1. `messages.test.ts` masih mengimpor `idempotencyDigest` dari `./messages`
   dengan tanda tangan lama → `tsc` TS2459 + 1 test gagal. Diperbaiki: impor
   dari `./idempotency`, assertion diperluas menguji owner/operasi/chatId ikut
   digest (bukan sekadar repeatable).
2. `npm run build` gagal `TypeError: Cannot read properties of undefined
   (reading 'length')` di `WasmHash._updateWithBuffer`. Bukan bug kode:
   `rm -rf .next` → build exit 0.

**Sisa FIX-03 yang belum dikerjakan:** state UI per chat/generation, draft
tidak hilang, abort stream saat navigasi, replay snapshot + cursor + dedup +
backoff + pruning, judul dari state. Backend idempotensi sudah selesai;
`src/components/chat-view.tsx` belum disentuh.

## Run-2 [CC] (resume sesi yang sama)

Mati `API Error 400` pada turn 23, bukan selesai. Yang bertambah dari run-2:
`README.md`, `capabilities/route.ts`, `admin/status.{ts,test.ts}`,
`chat/title.{ts,test.ts}`, `chat/transfer.ts`, `connections/model-cache.ts`,
`jobs/kinds.ts`, `jobs/queue.test.ts`. Diff total 21 file, +780/-201.
Audit `rm`/`mv`/`cp`/`ln`: hanya `.next` rusak dipindah ke
`~/.hermes/cache/scratch/`, tidak ada operasi destruktif di repo.

## Riwayat kegagalan yang sudah ditutup

Sesi [CC] mati `api_error` setelah 7 gagal di `npm test`. Dua akar, keduanya
diperbaiki tanpa melemahkan assertion:

1. `src/worker.test.ts` tidak memock `@/lib/jobs/worker-heartbeat` (modul baru
   FIX-24) sehingga `main()` crash sebelum `process.on` terdaftar; interval
   denyut juga terhitung sebagai timer shutdown. Perbaikan: `doMock` ditambah,
   `boot()` membersihkan timer setelah import.
2. `src/lib/chat/generate.test.ts` mengasumsikan 2 pesan. FIX-04 memang
   menyisipkan `buildRuntimeContext` (waktu/judul/model) setelah prompt bawaan.
   Perbaikan: assertion diperbarui ke kontrak baru bawaan → konteks server →
   prompt pengguna, bukan menghapus pemeriksaan.

## Run-4 [CC] (sesi baru, sisa FIX-03 sisi klien, `--max-turns 60`)

Mati `API Error 400 upstream route rejected` pada turn 26. Hasil bersih: satu
impor `useReducer` yang tidak terpakai (sudah dibuang). **Tidak ada perubahan
fungsional.** `src/components/chat-view.tsx` (1.069 baris) belum direstrukturisasi.

Pola empat run berturut-turut: gateway 9router menolak request setelah 23–84
turn pada sesi [CC] panjang, dengan payload konteks besar. Ini batas upstream,
bukan bug repo. Rencana: work-order per FIX dengan `--max-turns 40` dan wajib
menulis report sebelum turn habis.

## Sisa pekerjaan (jujur)

Commit `a143533` di `merge/main-into-feat-nt-p1`, sudah dipush. Gate final
dijalankan ulang setelah perbaikan lint: `tsc` 0, `eslint` 0 keluhan,
`chat-view` 7/7, `npm test` **787/787**, `npm run build` 0.

FIX tuntas: 01, 02, 03 (kecuali butir judul-dari-state), 24-baseline,
FIX-04 sebagian (konteks server). Belum disentuh: FIX-05…23, fase R1–R5.

`reports/FIX-03.md` sudah ditulis. Laporan untuk FIX-01/02/04 belum ada.

## Blocker eksternal

| Kebutuhan | FIX | Dampak |
|---|---|---|
| PostgreSQL server lokal | 01, 23, 24 | Gate upgrade populated PostgreSQL belum dijalankan di mesin ini; CI memilikinya |
| Sandbox/runtime kode & browser (E2B/Playwright template) | 17, 12 (konversi berat), 14 (OCR) | Capability harus `unconfigured`; implementasi fixture tetap dikerjakan |
| SMTP/API sender | 07, 21 | Reset email tetap jalur operator; tidak ada klaim kirim nyata |
| OAuth provider (Google) | 20 | Adapter + fixture; live gate `blocked_external` |
| Provider media (STT/TTS/image) | 16 | Probe nyata tidak dapat dijalankan |
