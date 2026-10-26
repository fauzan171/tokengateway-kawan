# PROMPT — DeepSeek Harness: eksekusi penuh paket kawan-next

Tempel blok di bawah ke DSH baru (goal/subagent mode). Isinya cukup self-contained untuk
mulai tanpa konteks lain. Diperbarui: 2026-10-25.

---

```
Kamu senior systems engineer. Kerjakan SELURUH paket kawan-next sampai selesai:
implementasi WP00–WP15 (termasuk WP06A/B/C), testing, dan perbaikan berulang
sampai semua gate hijau. Jangan berhenti di tengah; kalau ada yang gagal,
perbaiki lalu ulangi gate (loop), maksimal 3 iterasi per masalah sebelum kamu
catat sebagai blocker. Kerjakan sampai goal tercapai atau semua sisa pekerjaan
tercatat blocked_external dengan alasan konkret.

## LOKASI & BRANCH
- Repo: /home/hermes/workspace/projects/tokengateway-kawan
- Branch: merge/main-into-feat-nt-p1 (JANGAN ganti branch, JANGAN force-push)
- Remote: origin (github fauzan171). Push HEAD setelah tiap WP selesai.
- JANGAN menyentuh .claude/, .agent-teams/, .env, secret, kredensial.
- Jangan restart/mematikan proses lain di host (pm2 kawan/kawan-worker hanya
  menyusul instruksi deploy terpisah dari pemilik).

## SUMBER KEBENARAN (baca dulu, jangan mengarang)
- docs/research-planning/kawan-next/README.md      -> deliverable + urutan WP
- docs/research-planning/kawan-next/PRD.md         -> R01–R11 (beku)
- docs/research-planning/kawan-next/SDD.md         -> D01–D11 kontrak teknis
- docs/research-planning/kawan-next/IMPLEMENTATION-PLAN.md -> WP00–WP15 + DAG + scope file + perintah V0–V10
- docs/research-planning/kawan-next/ACCEPTANCE.md  -> T01–T16
- docs/research-planning/kawan-next/DECISIONS.md   -> O01–O07 keputusan pemilik
- docs/research-planning/kawan-next/REVIEW.md      -> 7 temuan review (sudah closed; jangan pelanggari)
- tests/fixtures/research/manifest.json            -> kontrak dataset 60 (40 dev + 20 held-out)
Ikuti teks spesifikasinya apa adanya. Kalau implementasi nyata bertentangan
dengan dokumen, berhenti dan catat konfliknya; JANGAN diam-diam ubah kontrak.

## KEADAAN SEKARANG (verifikasi ulang, jangan percaya buta)
- HEAD baseline WP00: 027e17d4. npm test baseline: 119 file / 1306 lulus.
- WP00 SELESAI: tests/fixtures/research/manifest.json ada; JANGAN diulang.
- WP01 SELESAI: AbortSignal.any di run.ts (worker abort + idle 90s + poll
  cancel/deadline 1s), fenced() transaksi, terminal sekali, cancelRun CAS.
  5 regresi baru + 1 tasks.test + 1 worker-lifecycle. npm test jadi 1317.
  JANGAN diulang.
- WP02 HAMPIR SELESAI (verifikasi dulu sebelum lanjut): task-view.tsx
  (first-task create, Idempotency-Key + sendingRef guard, snapshotSeq dedup
  runId:seq), tasks.ts getTaskSnapshot +snapshotSeq dalam $transaction,
  e2e/research.spec.ts ada. Tugasmu: jalankan gate WP02 (V3 + V1), selesaikan
  sisa e2e (port 3111, seluruh migrasi + worker), lalu tandai selesai.
- WP03–WP15: belum dimulai. Kerjakan berurutan sesuai DAG di
  IMPLEMENTATION-PLAN.md. Satu WP per sesi kerja; WP03 (schema/migrasi)
  dikerjakan sebelum menulis kode yang memakai kolom baru.

## URUTAN (DAG ringkas)
WP02-selesai → WP03 schema → (WP04 → WP05 & WP06A → WP06B → WP06C → WP07) →
WP08 loop 3 siklus → (WP09 → WP10 → WP11) & (WP12 → WP13) → WP14 QA → WP15.
WP12/13/15 (sandbox/code) jalur terpisah: tanpa kredensial provider live,
selesaikan fixture + catat blocked_external, JANGAN klaim pass dari mock.
Baca tabel WP di IMPLEMENTATION-PLAN.md untuk scope file persis per WP;
jangan menulis file di luar scope kolom WP itu.

## KEPUTUSAN SEARCH ENGINE (input pemilik, terapkan di WP05)
1. Jalur 3 dulu: perkuat SearXNG gratis — aktifkan engine anti-banting
   (bing, github, wikipedia), cache hasil + backoff supaya jarang kena
   limit/CAPTCHA. Tanpa key baru, tanpa dependensi baru.
2. Jalur 2 (opsional, di belakang setting): BYOK free-tier search key
   (Tavily/Serper) user tempel sendiri di Pengaturan, disimpan terenkripsi
   seperti Connection. Default off.
3. Jalur 1 (probe saja, jangan implement penuh): satu panggilan probe ke
   endpoint /anthropic/v1/messages gateway untuk mendeteksi dukungan search
   native; hasilnya dicatat di laporan, bukan diaktifkan.

## ATURAN KERAS
- DILARANG grep/find rekursif di src/generated/, node_modules/, .git/.
  Selalu --exclude-dir={src/generated,node_modules,.git}.
- Jangan dump file skema/modul besar; pakai sed -n / head / tail / grep skopa.
- Migrasi additive WAJIB dua provider (sqlite + postgresql) mengikuti pola
  folder existing, lalu: node scripts/check-migrations.mjs && npx prisma
  migrate deploy --schema prisma/schema.sqlite.prisma && npm run db:generate.
- DILARANG di migration.sql: BOOLEAN, SERIAL, UUID, JSONB, TIMESTAMPTZ,
  BYTEA, INTERVAL, CONCURRENTLY, IF NOT EXISTS, PRAGMA, AUTOINCREMENT.
  Boolean disimpan sebagai Int 0/1.
- Bahasa komentar/docstring/pesan galat/UI: Indonesia. Identifier verbatim.
- Jangan menambah dependensi kalau stdlib/terpasang cukup.
- Pertahankan perubahan manusia dan edit existing di tree; JANGAN
  reset/clean/stash otomatis. Jangan edit init migrasi lama.
- Inisiatif commit & push tiap WP selesai (path eksplisit, bukan git add .).
- Regresi baru wajib gagal dulu di kode lama (red-before-green) bila seam
  reproduksi tersedia.

## GATE WAJIB PER WP (semua hijau, tanpa kompromi)
1. npx tsc --noEmit -p tsconfig.json      -> 0 error
2. npx eslint <file yang berubah>        -> 0 error, 0 WARNING (warning = gagal)
3. node scripts/check-migrations.mjs      -> bila schema berubah (+ deploy
   ke dev.db + db:generate)
4. npm test                               -> tidak boleh turun dari baseline
   sebelumnya; test baru harus count >0
5. npm run build                          -> 0 (satu-satunya gate yang menangkap
   pelanggaran export route Next.js). rm -rf .next hanya bila cache korup.
6. Perintah V0–V10 sesuai WP (lihat IMPLEMENTATION-PLAN.md bagian bawah).
E2E Playwright: jalankan di config terisolasi (port sendiri, DB sendiri,
seluruh migrasi + worker); JANGAN menjalankan e2e pada port/DB live.

## LOOPING & KESIAPAN GOAL
- Test gagal → perbaiki → ulangi gate yang sama. Ulangi sampai lulus.
- Maksimum 3 iterasi per masalah; setelah itu catat blocker konkret di laporan
  dan lanjut WP lain yang independen.
- WP yang butuh kredensial/live (sandbox E2B, search live, model live):
  selesaikan fixture lokal, catat blocked_external, LANJUT — jangan macet.
- Jangan klaim selesai dari dokumen/mock/skip. Gate live yang tidak tersedia
  dicatat blocked_external, tidak pernah dianggap pass.
- Goal tercapai = semua WP status done/blocked_external + npm test & build
  hijau + laporan akhir ditulis.

## CARA MELAPOR
Tulis docs/research-planning/kawan-next/reports/eksekusi-dsh.md (append per WP):
ringkasan perubahan, output gate (angka nyata), hash commit, temuan terbuka,
blocked_external. Sebutkan jujur yang TIDAK dikerjakan + risikonya. Jangan
pernah mengaku tes/deploy lulus tanpa bukti output nyata.

MULAI DARI VERIFIKASI WP02 SEKARANG, lalu WP03, dan seterusnya sampai goal.
```
