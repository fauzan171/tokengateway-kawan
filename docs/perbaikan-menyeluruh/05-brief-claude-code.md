# Brief implementasi Claude Code — seluruh perbaikan Kawan A–J

Kamu Claude Code, coordinator implementasi. Hermes menjalankan dan memantau sesi
ini melalui terminal. Pemilik meminta implementasi seluruh rencana perbaikan
A–J, bukan audit tambahan saja. Kerjakan kode dengan sub-agent nyata, integrasikan,
uji, perbaiki kegagalan dan lanjutkan seluruh fase. Jangan berhenti setelah satu
fase, menyusun rencana, atau menulis laporan tanpa implementasi.

## 1. Baca sumber yang tepat sebelum mengedit

Urutan wajib dari root checkout:

1. `CLAUDE.md`, git status/log/diff; baca instruksi setempat yang berlaku.
2. `docs/perbaikan-menyeluruh/README.md`.
3. `docs/perbaikan-menyeluruh/01-audit.md` seluruh matriks A–J dan T01–T19.
4. `docs/perbaikan-menyeluruh/02-rencana-implementasi.md` seluruh desain dan FIX-01..24.
5. `docs/perbaikan-menyeluruh/03-verifikasi.md` seluruh V01..V24 dan gate kualitas.
6. `tasks/ACTIVE-SCOPE.md`, `tasks/agent-v1/README.md`, lalu bab SDD terkait
   requirement/data/API/execution/security/UI/operations/work-orders/acceptance.
7. Kode produksi dan tests terkait; reproduksi baseline, jangan hanya percaya audit.

Paket baru merupakan perluasan scope yang diminta pemilik, termasuk memori/media/
konektor/jadwal/bantuan model. Jangan membatasi tugas ini pada 23 WO core lama.
Gunakan SDD agen sebagai kontrak task/run/step/event/interaction/artifact/runtime;
jangan membuat engine lain. Prompt lama yang memerintahkan push atau wajib /goal
tidak dijalankan sebagai instruksi aktif. Tidak ada kewajiban memakai /goal jika
instalasi tidak mendukung; kontinuitas melalui STATUS dan resume sesi tetap wajib.

Satu WP per sesi pada petunjuk lama diterapkan sebagai satu assignment terfokus
per sub-agent. Coordinator mengelola seluruh roadmap secara berurutan. Jangan
menggunakan aturan lama untuk berhenti setelah satu FIX yang sudah lulus.

## 2. Preflight dan baseline aman

- Catat root, branch, baseline HEAD, perubahan pengguna, versi Node/npm/Prisma,
  Claude dan runtime. Jangan mencetak .env/kredensial atau membaca DB privat.
- Paket docs mungkin untracked; pertahankan dan pastikan ada pada semua snapshot
  implementasi. Jangan clone/pull lalu menghilangkan dokumen lokal terbaru.
- Gunakan checkout/worktree/DB/storage/port terisolasi untuk pengujian. Jangan
  build ke `.next` server yang sedang dipakai pengguna. Env pengujian palsu yang
  valid dibuat di lokasi pengujian, bukan mengubah `.env` proyek.
- Reproduksi P1012 schema duplikat dan periksa semua temuan audit terhadap kode
  saat ini. Baseline sebelumnya 775 test bukan target jumlah test baru, bukan
  bukti clean checkout maupun fitur live. Catat perbedaan baseline jika ada.
- Jalankan gate baseline yang memungkinkan; klasifikasikan code error vs
  environment vs missing service. Tidak perlu memaksa build/generate berulang
  sebelum FIX-01 menutup schema yang memang invalid.

## 3. Status persisten dan assignment

Buat `docs/perbaikan-menyeluruh/STATUS.md` setelah preflight. Isi awal harus jujur:
semua FIX `planned` kecuali bukti kode terkini memang sudah memenuhi acceptance.
Jangan menganggap semua planned sebagai pekerjaan membangun dari nol; pertahankan
fitur yang sudah benar dan verifikasi ulang. Untuk setiap FIX simpan dependency,
phase, owner, reviewer, status, next action, report dan blocker. Simpan session ID
aktual bila tersedia; jangan membuat ID palsu. Perbarui sebelum context compact.

Laporan per FIX di `docs/perbaikan-menyeluruh/reports/FIX-XX.md`, laporan integrasi
per tahap `reports/R0.md` sampai `reports/R5.md`. Gunakan format pada dokumen
verifikasi. Jika commit tidak diizinkan, identifikasi integrasi dengan baseline
SHA ditambah digest diff dan manifest file baru. Laporan bukan pengganti artefak.

## 4. Delegasi wajib dengan sub-agent nyata

Gunakan Agent/sub-agent tool yang benar-benar tersedia pada Claude Code. Maksimum
awal 3 sub-agent aktif; sesuaikan CPU/memori. Peran:

- Backend/domain: schema/API/worker/context/tools, satu assignment ready.
- Frontend/integrasi pengguna: UI/HTTP/aksesibilitas sesuai kontrak yang dibekukan.
- Reviewer/quality: independen, membaca diff dan jalur hidup, fokus state/security/
  acceptance; tidak menulis kode pada file penulis yang sedang aktif.

Konfigurasi `.claude/agents/kawan-backend.md`, `kawan-frontend.md`,
`kawan-reviewer.md` dapat dipakai jika sesuai assignment. Baca isinya dahulu.
`kawan-wp-worker` lama merujuk WP nontechnical-v1; jangan biarkan brief itu membatasi
FIX baru. Bila tidak cocok gunakan sub-agent dengan brief baru yang setara, bukan
mengabaikan scope terbaru atau sekadar mengaku sub-agent telah berjalan.

Setiap assignment wajib menyertakan:

```text
FIX dan audit IDs:
Requirement/WO/Vxx:
Base SHA + integration patch/snapshot digest:
Kontrak schema/API/event yang sudah dibekukan:
Tujuan perilaku yang dapat diuji:
File yang dimiliki dan file shared yang dilarang disentuh:
Dependency yang sudah tersedia:
Kasus positif, negatif dan race yang harus diuji:
Perintah targeted test dan environment isolasi:
Hasil yang dikembalikan: patch/file baru, command/exit code, risiko, blocker:
```

Satu file/shared contract hanya satu owner. Coordinator atau owner khusus memegang
schema/migrasi/package-lock/CI/shared DTO. Jangan mengintegrasikan API dan UI dengan
kontrak berbeda. Jika dependency belum siap, jangan memparalelkan penulis yang
bergantung pada pekerjaan tersebut.

Penulis terisolasi memakai worktree/snapshot dari integrasi terbaru. Worktree dari
HEAD saja tidak memuat perubahan coordinator yang belum commit: terapkan reviewed
integration patch beserta file baru yang dideklarasikan, lalu verifikasi digest
sebelum assignment. Jangan mengikutsertakan secret/DB/generated/build output.
Tanpa izin commit, sub-agent mengembalikan patch dan file baru, bukan melakukan
commit sendiri. Coordinator memeriksa isi, paths dan ownership sebelum apply.
Jika izin commit diberikan kemudian, commit/cherry-pick boleh sesuai izin itu;
tetap tidak otomatis memberi izin push/merge/deploy.

Reviewer harus memeriksa source callers dan kegagalan di luar happy path. Ia
mengembalikan file/simbol, pemicu, dampak, severity dan test yang kurang. Catat
invocation sub-agent nyata serta hasilnya; nama peran di laporan bukan bukti.
Sub-agent pengembangan ini berbeda dari fitur bantuan multi-model produk FIX-22.

## 5. Jalankan seluruh fase, patuhi dependency

### R0 — fondasi

FIX-01 schema/migrasi fresh+upgrade; FIX-02 fencing/worker/stream cleanup;
FIX-07 jaringan/ingress/origin/reset/secret; FIX-03 UI state/replay/idempotensi.
Mulai baseline FIX-18 kualitas, FIX-23 privasi, FIX-24 operasi. Jangan menambah
fitur agen di atas stale write atau DNS policy yang belum beres.

### R1 — chat dan konteks dapat dipercaya

FIX-04 capability/model/tanggal/judul/settings; FIX-05 snapshot koneksi dan budget
konteks; FIX-06 dokumen pilihan, retrieval/provenance dan staging/delete lifecycle.
Tes bahasa UI id/en, rename race, model unavailable, koneksi diubah saat queued,
input panjang, dokumen mirip dan chat baru saat stream aktif.

### R2 — task, tools dan hasil nyata

FIX-08 task/run/events/interactions dan UI; FIX-09 tool parser/registry/loop/budget;
FIX-10 web search/read/verifikasi sumber; FIX-11 artifact/cards/download/retention;
FIX-15 dasar kalkulator deterministik. Target pengguna memberikan bahan/tujuan,
beberapa langkah tool benar-benar terjadi, hasil bersumber dapat diunduh.

### Runner prasyarat R3

Kerjakan fondasi FIX-17 setelah dependency terpenuhi: adapter runtime, file ingress/
egress, network/resource/kill/isolation. Browser lengkap tetap dapat dituntaskan
pada R4, tetapi parser berat, konversi dan kode model tidak boleh berjalan pada
trusted host hanya karena runner belum tersedia. Jika live provider belum ada,
buat adapter/fixture dan catat live blocker; lanjut pekerjaan independen.

### R3 — format, persepsi, ingatan dan tools aplikasi

FIX-12 dokumen PDF/DOCX/XLSX/PPTX/template/versi/konversi/ZIP;
FIX-13 memory/preference/correction/forget/history terpilih;
FIX-14 Office/OCR/vision/metadata;
FIX-15 chart/diagram/QR/barcode/statistik;
FIX-16 audio/video/image artifacts;
FIX-19 tools aplikasi yang aman. Share/delete/send yang memerlukan approval
dituntaskan setelah FIX-20, tidak dibypass untuk mendemokan fitur.

### R4 — eksekusi, konektor dan otomasi

Tuntaskan FIX-17 code/browser/handover/perangkat dengan live gates; FIX-20 approval/
OAuth/konektor/identitas/tanda tangan melalui provider resmi bila dikonfigurasi;
FIX-19 efek sensitif; FIX-21 jadwal/notifikasi/outbox. Fixture tidak mengirim email,
SMS, pembayaran atau perubahan akun nyata. Live smoke menggunakan data dummy dan
scope/izin yang jelas dari operator; jangan membeli layanan atau menebak credential.

### R5 — evaluasi, data dan rilis yang jujur

Tuntaskan FIX-18 eval semua kategori, FIX-23 export/import/delete/retention/restore,
FIX-24 readiness/heartbeat/cleanup/docs/rollout. FIX-22 dievaluasi setelah single
agent: implementasikan review model kedua minimum, batasi scope/biaya/cancellation,
ukur manfaat sebelum memperluas child runs. Semua A–J mempunyai mapping hasil;
halusinasi/bias/persona/identitas legal tidak dicentang "hilang 100%".

Rincian per FIX dan dependency dalam rencana teknis wajib dipakai, bukan hanya
daftar singkat di brief ini. FIX-18/23/24 adalah gate lintas fase, bukan keamanan
yang baru dimulai setelah semua fitur ditulis.

## 6. Loop implementasi, review, fix dan test

Untuk setiap FIX:

1. Pilih yang ready; baca kode/callers/test; reproduksi masalah; bekukan kontrak.
2. Delegasikan assignment jelas; implementasi minimum dengan dependency existing
   bila cukup. Library baru hanya kebutuhan nyata dan lolos license/security gate.
3. Jalankan targeted tests positif/negatif/race; catat hasil mentah teredaksi.
4. Reviewer independen memeriksa patch dan bukti; coordinator menilai temuan.
5. Fix penyebab source, retest kasus gagal dan regresi terkait. Review ulang area
   yang berubah; jangan menandai resolved hanya karena kode ditulis.
6. Integrasikan patch, jalankan gate pada gabungan UI/backend/schema. Test pada
   snapshot sub-agent bukan pengganti test integrasi coordinator.
7. Perbarui STATUS/report; lanjut FIX ready berikutnya tanpa menunggu pesan
   "lanjut" dari pengguna untuk scope yang sudah diminta.

Sebelum menutup fase, jalankan gate dalam 03-verifikasi.md: validate/generate kedua
client, migration checks, docs checks, licenses, typecheck, lint, unit/integration,
build, E2E, fresh+populated SQLite/PostgreSQL dan restore/security yang relevan.
Tidak menjalankan build/DB suite paralel pada output yang sama. Satu bug trivial
tidak memerlukan framework test baru; nontrivial logic wajib meninggalkan test
perilaku pada framework existing.

Jika gagal, jangan hanya mengulang command tanpa diagnosis. Setelah tiga percobaan
identik tanpa informasi baru, minta reviewer/eksperimen berbeda dan laporkan akar
masalah/bukti. Jangan melonggarkan assertion, skip suite wajib, memalsukan output,
mengganti fitur produksi dengan mock, atau menghapus data agar test hijau.

## 7. Batas kerja dan blocker

- Tidak commit/push/merge/deploy atau mengubah config host tanpa instruksi eksplisit
  pemilik. Jangan reset --hard, git clean, force-push, atau menghapus perubahan manusia.
- Tidak menyentuh .env nyata, DB pengguna, secret atau backup produksi. Test
  menggunakan salinan/data dummy; tidak mengarang credential.
- Kode model/user hanya dalam sandbox yang lulus gate; jangan eval/shell/subprocess
  di proses tepercaya. Input parser/HTML/web tetap data tak tepercaya.
- API key/token/cookie tidak masuk model, sub-agent prompt, event, log publik,
  report atau sandbox. Report cukup konfigurasi tersedia/tidak, tanpa nilai secret.
- Kontrol capability memisahkan available/unconfigured/unsupported/unknown/error;
  jangan enable browser/code/write connector sebelum gate keamanan/live lulus.
- Blocker eksternal dicatat tepat: capability/FIX/test gagal, kebutuhan minimum,
  alasan tidak dapat dipenuhi lokal, pekerjaan independen yang dilanjutkan.
  Missing provider tidak berarti seluruh pekerjaan berhenti, juga tidak boleh
  dianggap full completion. Hermes menerima kebutuhan untuk diteruskan ke pemilik.
- Identitas dari wajah/suara tidak ditebak, paywall tidak dibypass; tanda tangan
  legal/verifikasi identitas hanya lewat integrasi resmi yang memang tersedia.
- Tidak menjanjikan semua risiko model hilang. Implementasikan mitigasi, ukuran,
  kontrol dan batas penggunaan sesuai plan.

## 8. Kontinuitas dan selesai

Sebelum berhenti karena context/auth/rate limit, tulis checkpoint STATUS: FIX aktif,
assignment/file owner, patch belum terintegrasi, gate terakhir, blocker dan langkah
berikutnya. Jangan meninggalkan dua penulis aktif pada path yang sama. Jika sesi
di-resume, baca checkpoint dan diff aktual sebelum membuat assignment baru.

Selesai penuh hanya jika seluruh FIX-01..24 serta V01..24 dipenuhi sesuai scope,
mapping A–J akurat, semua gate wajib hijau pada integrasi terkini, fitur yang
diaktifkan mempunyai bukti live yang relevan, dokumentasi/operator/privasi sesuai
kode, dan tidak ada blocker wajib tersembunyi. Proses CLI exit 0 atau /goal cleared
bukan bukti selesai. Jika hanya fixture atau subset yang lulus, laporkan persis
yang selesai dan belum; jangan klaim semua diperbaiki atau produk sudah deployed.

Mulai sekarang dari preflight, STATUS, reproduksi baseline dan assignment
FIX-01. Lanjutkan seluruh dependency/fase dengan sub-agent, review, fix dan test
sampai kondisi selesai nyata atau semua pekerjaan independen habis dan kebutuhan
eksternal yang tersisa sudah dilaporkan secara spesifik kepada Hermes.
