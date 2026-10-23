# PROMPT — Lanjutkan FIX-16 → FIX-24 (tokengateway-kawan)

Tempel blok di bawah ke harness/agent baru. Isinya cukup untuk mulai tanpa konteks lain.

---

```
Kamu senior systems engineer. Kerjakan tiket FIX-16 sampai FIX-24 secara
BERURUTAN di repo ini sampai semua `verified` di STATUS.md dan semua gate hijau.

## LOKASI & BRANCH
- Repo: /home/hermes/workspace/projects/tokengateway-kawan
- Branch: merge/main-into-feat-nt-p1 (JANGAN ganti branch, JANGAN force-push)
- Remote: origin (github fauzan171). `git push origin HEAD` setelah tiap commit.
- HEAD saat prompt ini dibuat: a32dc2a (FIX-15). FIX-13/14/15 sudah `verified`.

## SUMBER KEBENARAN (baca dulu, jangan mengarang)
- docs/perbaikan-menyeluruh/STATUS.md          → papan status tiket
- docs/perbaikan-menyeluruh/02-rencana-implementasi.md → spesifikasi tiap FIX
- docs/perbaikan-menyeluruh/reports/FIX-*.md    → format laporan yang diharapkan
- tasks/agent-v1/                               → kontrak task/SDD
Ikuti teks spesifikasinya apa adanya; jangan menambah fitur di luar gate.

## ATURAN KERAS
- JANGAN modifikasi/hapus .claude/ atau .claude/worktrees/ atau worktree orchestrator.
- DILARANG grep/find rekursif di src/generated/, node_modules/, .git/.
  Selalu --exclude-dir={src/generated,node_modules,.git}.
- JANGAN dump file skema/modul besar. Pakai `sed -n`, `head`, `tail`, grep berskopa.
- Log terminal seminimal mungkin: saat test/lint hanya ambil baris ringkasan akhir
  atau jejak kegagalan saja.
- Selesaikan tiket N sampai LULUS GATE + TER-COMMIT + TER-PUSH sebelum menyentuh N+1.
- Inisiatif commit & push SENDIRI tiap tiket selesai. Jangan berhenti untuk minta izin.

## GATE WAJIB PER TIKET (semua harus hijau, tanpa kompromi)
1. npx tsc --noEmit -p tsconfig.json      → 0 error
2. npm run lint                           → 0 error, 0 WARNING (warning = gagal)
3. node scripts/check-migrations.mjs      → hanya jika ada perubahan skema
   + npx prisma migrate deploy --schema prisma/schema.sqlite.prisma (bila perlu)
   + npm run db:generate
4. npm test                               → SEMUA baseline lulus + tes baru lulus
   Baseline saat ini: 1012 passed / 94 file. Jangan sampai turun.

## LANGKAH PER TIKET
1. Baca spesifikasi tiket di 02-rencana-implementasi.md + baris STATUS.md.
2. Recon dengan `sed -n`/grep berskopa: cari modul, route, model Prisma, helper
   yang SUDAH ada. Pakai ulang, jangan tulis ulang (repo punya pola sendiri).
3. Implementasi modular + strongly typed, ikut konvensi sekitar.
   WAJIB: jalur positif (happy path) DAN jalur negatif (penolakan, batas,
   isolasi antar pengguna, input tidak sah) punya tes.
4. Kalau ada perubahan skema: migrasi manual untuk SQLite DAN PostgreSQL,
   lalu jalankan gate migrasi di atas.
5. Jalankan gate penuh. Kalau gagal, perbaiki sampai hijau — jangan lapor "hampir".
6. Tulis docs/perbaikan-menyeluruh/reports/FIX-NN.md (format lihat FIX-14/15):
   masalah, solusi, tabel perubahan, daftar tes, output gate, batas yang
   SENGAJA dilewati + alasan.
7. Ubah baris FIX-NN di STATUS.md: `planned` → `verified` + ringkasan bukti.
8. Commit + push:
   git add <path eksplisit per-file, JANGAN `.claude`>
   git commit -m "fix(FIX-NN): <ringkasan deskriptif>"
   git push origin HEAD
   Lalu laporkan: hash commit, output gate, file yang berubah.

## SCOPE TIKET BERIKUTNYA (ringkas — spesifikasi penuh ada di .md)
- FIX-16 (R3): media. Perbaiki capability gating; probe format/size/error gateway.
  STT → transkrip + timestamp, editable sebelum kirim. TTS → playback punya
  cancel/revoke URL. Image generation → Artifact (BUKAN dataUrl base64 menetap di
  history). Rekam mikrofon via MediaRecorder/getUserMedia SETELAH izin + tindakan
  pengguna; fallback upload kalau API/codec tidak ada.
  Video: ffprobe metadata → FFmpeg frame sampling + audio extract di runner → STT
  → rangkuman dengan timestamp/frame provenance. Batasi durasi/FPS/pixel/jumlah
  frame/output; JANGAN klaim sudah menonton semua frame. Generasi video hanya
  adapter provider yang benar-benar mendukung, dengan polling job, timeout, quota,
  cancellacion/ambiguity. Diarization = speaker A/B, BUKAN menebak identitas suara.
  Lulus: permission denied/codec unsupported/provider down punya fallback; video
  panjang dibatasi; sumber timestamp bisa dibuka; output tersimpan sesuai retention.
  Catatan: ffmpeg/ffprobe ADA di /home/hermes/.hermes/tools/ffmpeg-9.0.1-linux-x64/bin/
  (tidak di PATH). Modul existing: src/lib/media/{audio,images,config}.ts,
  route src/app/api/kawan/v1/media/{images,speech,transcribe}.
- FIX-17 (R4): sandbox/browser/screen sharing/akses perangkat. Adapter E2B ikut
  SDD-AG-5: satu runtime per run, user nonprivileged, filesystem sementara,
  CPU/RAM/wall caps, network default deny, tanpa DB/key/socket host.
- FIX-18 (semua tahap): eval profil; butuh FIX-04, FIX-10/13/15 untuk eval lanjut.
- FIX-19 (R3/R4): WO-AG-P0-03 + perluasan tools aplikasi.
- FIX-20 (R4): WO-AG-P3-02; tanda tangan digital (bukan QR/tulisan tangan).
- FIX-21 (R4): butuh FIX-08, FIX-20, FIX-24.
- FIX-22 (setelah single agent terukur): multi-agent; jangan kerjakan sebelum
  ada bukti kebutuhan.
- FIX-23 (semua tahap): setiap storage baru WAJIB integrasi cleanup.
- FIX-24 (R0–R5): metrik; mengikuti fitur baru.
Ubah nama file inventaris di .md kalau nomor tiket bergeser — jangan pakai asumsi.

## SETELAH FIX-24 SELESAI
Jalankan `npm run build` (build produksi bersih) dan laporkan tabel:
| Tiket | Commit SHA | Tes baru | Total tes lulus | Status di STATUS.md |

## CARA MELAPOR
Ringkas. Hanya: ringkasan perubahan, output gate (angka), hash commit.
Sebutkan dengan jujur batas yang TIDAK dikerjakan + risikonya. Jangan pernah
mengaku tes/deploy lulus tanpa bukti output nyata.

MULAI DARI FIX-16 SEKARANG.
```