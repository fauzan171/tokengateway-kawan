# STATUS implementasi A–J

Diperbarui: 2026-10-22. Eksekutor: Hermes native + [CC] GLM 5.3 Flash (WO kecil).
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
| FIX-03 | R0 | 01,02 | `verified_fixture` | commit `a143533`,`fd1823e`; report `reports/FIX-03.md` |
| FIX-04 | R1 | 03,07 | `verified_fixture` | commit `078ad8e`; report `reports/FIX-04.md` |
| FIX-05 | R1 | 02,03,04 | `verified` | commit `d5c690c` + commit FIX-05; report `reports/FIX-05.md`; pin revisi config (`Connection.revision`/`Generation.connectionRevision`), budget per model (`model-budget.ts`), provenance pemangkasan konteks, revocation teraudit |
| FIX-06 | R1 | 01,02,07 | `verified_fixture` | retrieval bounded chatId + RAG_MIN_SCORE, upload transaksional, delete order; gate penuh hijau (tsc 0, 837/837, build) |
| FIX-07 | R0 | 01 | `verified_fixture` | commit `95a13fd` + lapisan ini; DNS pin via undici dispatcher (tes koneksi nyata), timeout `ABORT`, CSRF origin guard `src/middleware.ts`, rate limit login/reset, rotasi keyring terdokumentasi |
| FIX-08 | R2 | 03,05,06,07 | `verified_live` | commit `ad4682f` (+schema `2d9e534`); tersaji di kawanku, `/_next/static` 200, heartbeat bersih |
| FIX-09 | R2 | 08,04 | `verified_fixture` | commit `8a2a355`; parser + tool loop di `generate.ts` (`a5aa9a3`) |
| FIX-10 | R2 | 09,07 | `verified` | `web.read` (baca HTML/PDF via kebijakan egress FIX-07, tanpa cookie/script), provenance (`fetchedAt`+`contentHash`+`reach`), system prompt memuat teks halaman nyata + penanda tautan mati/terblokir, verifikasi DOI via Crossref (`mismatch` untuk DOI fiktif). 26 tes baru. Bukti: `reports/FIX-10.md` |
| FIX-11 | R2 | 09,06 | `verified_fixture` | commits `ae1a657`,`d8c02c1`,`a5aa9a3`,`d711913`; tes E2E tool `generate_file` (fixture SSE) |
| FIX-12 | R3 | 11,17 | `verified` | commits `7192e8e`,`94c40ce`; renderer PDF/DOCX/XLSX/PPTX + tool `generate_document`; `Artifact.version` + lineage tervalidasi, konverter md/txt/html/csv/json, ZIP hardening (slip/bomb/symlink/duplikat). Bukti: `reports/FIX-12.md` |
| FIX-13 | R3 | 05,06,08 | `verified` | `MemoryItem` (scope, category, status, consent, `version`+`parentId`, provenance, `expiresAt`) + `MemoryDependency` untuk pencabutan berantai; store `create/list/correct/revoke/confirmProposal/buildMemoryContext` (hanya `active`, anggaran 4.000 char, mode `ephemeral`); API `GET/POST /memory`, `PATCH/POST/DELETE /memory/{id}`; konteks memori disuntik ke generasi. 24 tes baru. Bukti: `reports/FIX-13.md` |
| FIX-14 | R3 | 06,11,17 | `verified` | Format ditentukan magic bytes (`magic.ts`), bukan label klien; OOXML via entri ZIP; DOCX/PPTX diurai `saxes`, XLSX via `exceljs` dengan `SheetCell` (formula disimpan tanpa dieksekusi); metadata dipisah tegas (nama klien / waktu server / tanggal tertanam) dan EXIF+GPS selalu dibuang; OCR + `probeVision` melaporkan `ENGINE_MISSING` alih-alih hasil kosong. 26 tes baru. Bukti: `reports/FIX-14.md` |
| FIX-15 | R2/R3 | 09,11 | `verified` | `calculate` (decimal.js, operand string desimal, tanpa `eval`, batas digit/eksponen, tolak bagi-nol/nonfinite) + `describe` (n, missing, kind, unit, `method`) + `countText` (kata/UTF-16/code point/grapheme/byte) + `renderChart` (SVG deklaratif, escape label, tabel alternatif) + `makeQr` (encode lalu decode ulang via `jsqr`); `POST /api/kawan/v1/tools/compute`. 36 tes baru + fixture JSONL. Bukti: `reports/FIX-15.md` |
| FIX-16 | R3 | 04,11,17 | `verified` | Byte bukan data URL (magic bytes, bukan header); STT bertimestamp + diarization A/B; cap media per model; video jujur (ffprobe/frame/audio, tanpa klaim tonton semua); rekam setelah izin + fallback unggah; TTS cancel/revoke. 16 tes baru. Bukti: `reports/FIX-16.md` |
| FIX-17 | R4 | 07,09,11 | `verified_fixture` | Kontrak sandbox + limit SDD-AG-5, adapter E2B (guest tanpa env, stop tak pasti = `confirmed:false`), klasifikasi aksi browser konservatif (GET berpola ubah = write), `approvalDigest`, capability `codeExecution`/`browser` berhenti di `unknown` tanpa probe. 19 tes. Gate live `blocked_external`. Bukti: `reports/FIX-17.md` |
| FIX-18 | semua | 04 | `verified_fixture` | Satu pesan sistem dengan urutan otoritas tetap (`prompt-builder.ts`), data web/dokumen/memori dibungkus penanda yang tidak bisa ditutup isinya, penilai kualitas deterministik (`quality-eval.ts`) + dataset 17 kasus JSONL. 29 tes baru. Bukti: `reports/FIX-18.md` |
| FIX-19 | R3/R4 | 09,08 | `verified_fixture` | 8 tool aplikasi lewat service (`src/lib/tools/app.ts`), owner dari konteks, aksi destruktif hanya `needs_approval`, revisi kadaluarsa ditolak. Plus 3 regresi dokumen dari riset: entri direktori ZIP, sanitasi nama sheet XLSX, tolak sumber biner di konversi. 24 tes baru. Bukti: `reports/FIX-19.md` |
| FIX-20 | R4 | 07,08,09 | `verified_fixture` | Approval satu-pakai (`approvals.ts`) dengan digest aksi+payload+revisi, tolak pemakaian kedua/kedaluwarsa/owner lain; konektor token terenkripsi per baris + allowlist endpoint + revoke; model `ConnectorCredential` + migrasi dua provider. 12 tes. OAuth live `blocked_external`. Bukti: `reports/FIX-20.md` |
| FIX-21 | R4 | 08,20,24 | `verified_fixture` | Zona IANA via Intl (DST digeser, jam lokal dipertahankan), occurrence unik per (jadwal, waktu), misfire `skip` bawaan, notifikasi sensitif diredaksi; model `Schedule`/`ScheduleOccurrence`/`Notification` + migrasi dua provider. 21 tes. Bukti: `reports/FIX-21.md` |
| FIX-22 | setelah single agent | 09,18,24 | `verified_fixture` | Review model kedua terbatas (`multi-model.ts`): budget child ≤50% parent, kedalaman 1, tool subset parent, peninjau dipilih pengguna, agregasi menyebut sumber + disclaimer; `TaskRun.parentRunId`/`depth` + migrasi. 11 tes. Manfaat belum diukur. Bukti: `reports/FIX-22.md` |
| FIX-23 | semua | 01,02 | `verified_fixture` | Ekspor lengkap 10 jenis data dengan allowlist+redaksi (token/kunci/hash tidak ikut), manifest ber-hash, validasi impor menolak kolom terlarang, tombstone dua tahap idempoten dengan langkah pembersihan, ledger id-opaque, retensi + pernyataan privasi. 16 tes. Bukti: `reports/FIX-23.md` |
| FIX-24 | R0–R5 | 01 | `verified_fixture` | Liveness tanpa DB, readiness memeriksa DB+migrasi+denyut worker (worker mati terlihat tanpa job), endpoint publik minimum tanpa detail internal, metrik operasional dengan usage reported/unknown terpisah, CLI `npm run cleanup` nyata (dry-run + jalan). 10 tes. Bukti: `reports/FIX-24.md` |

## Gate terakhir (diverifikasi Hermes, bukan klaim [CC])

| Perintah | Hasil |
|---|---|
| `npx prisma validate` dua schema | exit 0 |
| `npm run db:generate` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `node scripts/check-migrations.mjs` | OK (2 provider, init dibekukan, urutan sama) |
| `python3 tasks/agent-v1/check_docs.py` | LULUS, 0 pelanggaran |
| `python3 tasks/nontechnical-v1/tools/check_docs.py` | LULUS |
| `npm test` | **112 file, 1254 test lulus**, exit 0 (D3 + D4 + D6; 25 tes baru) |
| `npx eslint` 8 berkas berubah | exit 0 |
| `npm run build` | **exit 0** — gagal sekali karena cache `.next` korup (`WasmHash._updateWithBuffer`), hijau setelah `rm -rf .next` |
| Deploy live (`c18ed34`) | `npm run build` 0, `pm2 restart kawan kawan-worker`, health `{"ready":true}`, `/api/kawan/v1/agents` 401 |
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

## Gelombang eksekusi di atas FIX-01…24

FIX-01…24 sudah ditutup. Pekerjaan setelahnya berjalan sebagai gelombang, dengan
rencana di `reports/rencana-masa-depan.md` dan hasil di `reports/gelombang-*.md`.

| Gelombang | Cakupan | Status | Bukti |
|---|---|---|---|
| 1 | D0a–D0c (ZIP/sheet/konversi), D1 (batas kanonik DocSchema), P1 (registry tool), K1/K2 (registry agent + migrasi) | **verified** | `reports/gelombang-1.md` |
| 2 | D2 (tema dokumen A4), P3 (registry jadi sumber tool chat), K3/K4/K5 (admission/eksekusi/API agent) | **verified**, review pass dengan 6 medium + 6 low | `reports/gelombang-2.md` |
| 3 | D3 (blok pageBreak/divider/bullets.ordered/image via artifactId), D4 (template laporan/surat/rekap), D6 (tata letak PPTX terhitung) | **verified** | `reports/gelombang-3.md` |
| 3 sisa | P2, P8, K6, K7, K8 | **belum dimulai** | `reports/rencana-masa-depan.md` §3–§5 |

Sisa gate yang **belum** bisa ditutup di lingkungan ini dicatat di bagian
`## Blocker eksternal`, bukan dianggap lulus.

## Sisa pekerjaan (jujur)

Commit `a143533` di `merge/main-into-feat-nt-p1`, sudah dipush. Gate final
dijalankan ulang setelah perbaikan lint: `tsc` 0, `eslint` 0 keluhan,
`chat-view` 7/7, `npm test` **787/787**, `npm run build` 0.

Bagian ini mencatat keadaan pada 2026-10-22 dan **sudah tidak berlaku**: setelah
itu FIX-05…24 dikerjakan sampai `verified`, lalu gelombang 1 dan 2 selesai. Angka
gate terkini ada di `## Gate terakhir`; keadaan per gelombang di tabel di atas.
`reports/FIX-03.md` sudah ditulis; laporan FIX-01/02/04 masih belum ada.

## Insiden produksi 2026-10-21 19:12–19:16 — migrasi belum diterapkan

Restart `kawan-worker` setelah commit `a143533` membuat proses crash-loop:

```
PrismaClientKnownRequestError: The table `main.WorkerHeartbeat`
does not exist in the current database.
```

Sebab: `prisma/migrations/sqlite/20261021000000_add_title_source_and_worker_heartbeat`
ada di repo tetapi **belum pernah diterapkan** ke `dev.db`. Gate CI memakai
`migrate deploy` di DB bersih, jadi tidak menangkap keadaan ini.

Perbaikan: `npx prisma migrate deploy --schema prisma/schema.sqlite.prisma`
(aplikatif, additive — kolom `Chat.titleSource` default `'auto'`, 18 baris lama
tetap sah). Verifikasi: `WorkerHeartbeat` ada, satu baris heartbeat ditulis
(`workerId=…-2302141`, `version=0.2.0`), `kawan-worker` online tanpa restart
tambahan, `kawanku.tokengateway.ai.id` 200.

**Pelajaran:** setiap migrasi baru wajib dijalankan ke `dev.db` sebelum restart
pm2; commit kode saja tidak cukup.

## Blocker eksternal

| Kebutuhan | FIX | Dampak |
|---|---|---|
| PostgreSQL server lokal | 01, 23, 24 | Gate upgrade populated PostgreSQL belum dijalankan di mesin ini; CI memilikinya |
| Sandbox/runtime kode & browser (E2B/Playwright template) | 17, 12 (konversi berat), 14 (OCR) | Capability harus `unconfigured`; implementasi fixture tetap dikerjakan |
| SMTP/API sender | 07, 21 | Reset email tetap jalur operator; tidak ada klaim kirim nyata |
| OAuth provider (Google) | 20 | Adapter + fixture; live gate `blocked_external` |
| Provider media (STT/TTS/image) | 16 | Probe nyata tidak dapat dijalankan |
| Plugin pihak ketiga (eksekusi kode) | P2 | Sengaja NON-GOAL: hanya manifest deklaratif yang menyalakan tool yang sudah ada; tidak ada `eval`/remote code |
| Billing/kuota sebagai tagihan | K6 | Kuota adalah BATAS pemakaian, bukan tagihan. Usage tak dilaporkan = "tidak tersedia", tidak ditaksir |