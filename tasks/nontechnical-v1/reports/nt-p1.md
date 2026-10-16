# Laporan mandor — NT-P1 (Auth dan akun dasar)

Tanggal: 2026-10-16
Pelaksana: mandor (orkestrator) + kuli [CC]; verifikasi oleh mandor
Baseline: `cea338a` (setelah WP-NT-P1-01)
Model kuli: TokenGateway `tg/deepseek-v4.1-flash`

Bukti per WP ada di dokumen ini, bukan di `plan.md` — sesuai aturan paket dokumen.

---

## Ringkasan

| WP | Status | Bukti utama |
|---|---|---|
| WP-NT-P1-01 | selesai (sebelum batch ini) | 74 test; runtime `/api/auth/*`; cookie `HttpOnly`/`SameSite=Lax` |
| WP-NT-P1-02 | selesai | `users.test.ts`: dua registrasi bersamaan → tepat satu admin |
| WP-NT-P1-03 | selesai | `/masuk` 200, `/daftar` 200, branding tampil, E2E daftar→masuk lulus |
| WP-NT-P1-04 | selesai | 5 percobaan gagal tercatat di tabel; percobaan ke-6 dengan sandi BENAR ditolak |
| WP-NT-P1-05 | selesai | Dua sesi; setelah ganti sandi sesi B dicabut, sesi A tetap hidup |
| WP-NT-P1-06 | selesai | Token dipakai 2× ditolak; token kedaluwarsa ditolak tanpa mengubah sandi; kedua sesi dicabut setelah reset |

Gate paket (typecheck, lint, test, build, `check-migrations`, `check_docs`) lulus.
**Gate NT-P1 LULUS** — keenam WP selesai.

---

## Perintah gate dan hasilnya

```
npm run typecheck                     rc=0
npm run lint                          rc=0
npm test                              rc=0   127 lulus (11 berkas)
npm run build                         rc=0
node scripts/check-migrations.mjs     rc=0   "OK (2 provider, migrasi identik)"
python3 tasks/nontechnical-v1/tools/check_docs.py   rc=0   HASIL: LULUS
python3 scripts/e2e_kawan.py http://127.0.0.1:3010  rc=0   33/33 lulus
```

Jumlah test naik dari 42 (NT-P0) → 74 (P1-01) → 93 (P1-03) → 108 (P1-05) → 112 (P1-04) → 127 (setelah penggabungan).

---

## Uji E2E mandor

`scripts/e2e_kawan.py` dijalankan terhadap server produksi yang benar-benar hidup
(`next start`, port 3010), memakai HTTP seperti pengguna sungguhan. Skrip ini
milik mandor, bukan milik kuli, dan mengosongkan tabel lebih dulu supaya
"pengguna pertama menjadi admin" benar-benar teruji.

Enam kelompok, 33 pemeriksaan, semuanya lulus:

1. **Halaman dasar** — `/`, `/masuk`, `/daftar` menjawab 200; branding
   `tokengateway.ai.id` tampil; `/pengaturan` tanpa sesi dialihkan dan isi
   terlindunginya tidak terkirim.
2. **Pendaftaran** — akun pertama menjadi `admin`/`active`; email duplikat,
   sandi terlalu pendek, dan konfirmasi tidak cocok semuanya ditolak; pesan
   galat tidak membocorkan keberadaan akun.
3. **Masuk** — sesi terbentuk dan berisi email yang benar; dua perangkat bisa
   masuk bersamaan; sandi salah tidak membuat sesi; akun `pending` tidak bisa
   masuk (REQ-NT-11).
4. **Rate limit (REQ-NT-15)** — 5 percobaan gagal tercatat di tabel
   `LoginAttempt` (dibaca dari koneksi database terpisah, jadi terbukti bukan
   memori proses); percobaan berikutnya dengan sandi **BENAR** ditolak; setelah
   hitungan dibuang, pemilik bisa masuk lagi.
5. **Ganti sandi (REQ-NT-14)** — dua perangkat masuk; ganti sandi melaporkan
   `revokedSessions`; perangkat A tetap masuk, perangkat B dicabut; sandi lama
   tidak berlaku; sandi baru berlaku; tanpa sesi → 401.
6. **Cookie sesi** — `authjs.session-token` dipasang, `HttpOnly`, `SameSite=Lax`;
   cookie jar menandai HttpOnly.

---

## Catatan teknis yang perlu diketahui peninjau

### Auth.js tidak pernah mengembalikan 429

Rencana awal WP-NT-P1-04 menyebut gate "uji 429 setelah N percobaan". Itu tidak
bisa dipakai: jalur `credentials` Auth.js **selalu** menjawab 302, baik saat
kredensial ditolak, saat akun nonaktif, maupun saat dibatasi. Kode status tidak
membedakan apa pun.

Bukti yang sah adalah **ketiadaan sesi**: setelah batas terlampaui, percobaan
dengan kata sandi yang benar pun tidak menghasilkan sesi. Uji memakai cara itu.
Gate di `plan.md` sudah diperbarui mengikuti kenyataan ini.

### Token sesi diambil dengan mendekode cookie, bukan dari objek sesi

`POST /api/account/password` perlu tahu token sesi yang sedang dipakai untuk
mempertahankannya saat mencabut sesi lain. Token itu **tidak** ditaruh di objek
sesi: objek sesi ikut terkirim ke peramban lewat `/api/auth/session`, sehingga
token mentah di sana akan terbaca JavaScript — tepat hal yang dihindari cookie
HttpOnly. Route handler mendekode cookie sesi di sisi server dengan `decode`
dari `next-auth/jwt`.

### Akun non-pertama berstatus `pending`

Hanya pengguna pertama yang menjadi `admin`/`active`. Pendaftar berikutnya
`pending` sampai diaktifkan admin. Karena itu uji E2E yang butuh akun aktif
kedua mengaktifkannya langsung di database sebagai fixture — bukan kelemahan
aplikasi, melainkan perilaku yang diminta REQ-NT-11.

### Migrasi: tabel ditambahkan ke migrasi init

Repo memakai satu migrasi init (`00000000000000_init`) dan
`prisma/migrations/_schema.sql` sebagai acuan; `check-migrations.mjs` menuntut
kedua salinan provider identik. Menambahkan `LoginAttempt` ke migrasi init
mengikuti konvensi itu (bandingkan commit `58f284c` yang menambahkan tabel `Job`
dengan cara sama). Perubahan bersifat aditif murni: 9 baris ditambah, 0 dihapus.

---

## Cacat yang ditemukan dan diperbaiki selama batch ini

Semuanya di perkakas orkestrasi mandor, bukan di produk.

### 1. Timeout membuang hasil kerja kuli

`run_worker` melempar `TimeoutExpired`; seluruh blok `try` di `run_task` melompat
ke `except`, sehingga berkas yang **sudah** ditulis kuli tidak pernah dihitung.
Kuli halaman `/masuk` dan `/daftar` menulis ketiga berkasnya dan lint/typecheck
lulus, tetapi dilaporkan `error`.

Perbaikan: timeout ditangkap di dalam `run_worker`, exit code 124, log parsial
tetap dibaca, verifikasi mandor tetap dijalankan. Status baru `passed_timeout`.

### 2. Kuota provider tercampur dengan kode buruk

Pemeriksaan "tidak ada perubahan" dijalankan sebelum pemeriksaan `rate_limited`,
sehingga kuli yang mati kehabisan kuota dilaporkan `no_changes` — terbaca seperti
kuli malas. Urutan dibalik; penanda kuota juga menangkap `quota_exceeded`.

### 3. Commit kuli tidak terhitung sebagai hasil kerja

`claude` kadang commit atas inisiatif sendiri meski brief tidak menyuruh. Kuli
yang commit meninggalkan working tree bersih, sehingga pekerjaan yang
benar-benar ada dilaporkan `no_changes`. Sekarang `HEAD` diambil sebelum dan
sesudah; commit di antaranya dicatat di `new_commits` dan dihitung sebagai hasil.

### 4. `node` ABORT karena warisan variabel pm2

Kuli rate limit dilaporkan `verify_failed` padahal kelima gate-nya lulus:
`node scripts/check-migrations.mjs` mencetak "OK (2 provider, migrasi identik)"
lalu mati `Aborted (core dumped)`, rc 134.

Akar masalahnya: sesi agen berjalan di bawah pm2, yang menyetel
`NODE_CHANNEL_FD=3` dan `NODE_CHANNEL_SERIALIZATION_MODE=json` untuk proses
anaknya. Warisan itu diteruskan ke subprocess, sehingga `node` mengira dirinya
proses anak berkanal IPC di fd 3 dan abort saat keluar — setelah pekerjaannya
selesai dan keluarannya benar.

Gejalanya menyesatkan: `node apa-saja.mjs` selalu rc 134, sementara perintah
yang dibungkus npm lolos karena npm menormalkan env-nya sendiri.

Bukti: `node /tmp/trivial.mjs` rc 134 → rc 0 setelah variabel dibuang;
`node --check public/app.js` rc −6 → rc 0; `check-migrations` rc 134 → rc 0.

Perbaikan: `load_env()` di dispatcher membuang `NODE_CHANNEL_FD`,
`NODE_CHANNEL_SERIALIZATION_MODE`, `NODE_APP_INSTANCE`, `instance_var`, `pm_id`,
dan `pm2_home`.

**Ini juga menjelaskan teka-teki lama** `node --check` yang selalu SIGABRT di
mesin ini dan sempat diakali dengan `vm.Script` di `check_frontend.py` dashboard.
Akal-akalan itu tidak lagi diperlukan.

### 5. Kuli tidak boleh menyentuh `session.ts` dan `src/app/**`

Kedua tugas paralel dilarang menyentuh berkas itu supaya tidak bentrok, sehingga
modul `rate-limit.ts` dan `password-change.ts` sempat menjadi **yatim**: ada,
teruji, tetapi tidak dipanggil kode aplikasi mana pun.

Penyambungan dilakukan mandor setelah kedua cabang digabung:
`src/lib/auth/session.ts` memanggil rate limit di `authorize`,
`src/app/api/account/password/route.ts` memanggil `changePassword`, dan
`src/app/pengaturan/page.tsx` + `src/components/change-password-form.tsx`
menyediakan antarmukanya.

**Pelajaran untuk brief berikutnya:** larangan "jangan sentuh berkas X" harus
disertai keterangan siapa yang menyambungkan modul ke titik pakainya, atau
tugasnya akan menghasilkan modul yatim.

### 6. Instruksi mandor salah soal migrasi (WP-NT-P1-06)

Brief pertama P1-06 melarang worker menyentuh migrasi init dan menyuruhnya
membuat direktori migrasi baru, dengan alasan "migrasi yang sudah dirilis tidak
boleh diubah". Worker **berhenti dan melaporkan** konflik tanpa menulis satu
baris pun — dan laporannya benar.

Faktanya `scripts/check-migrations.mjs` baris 85 memakai `if (sql !== reference)`:
setiap `migration.sql` harus byte-identik dengan `_schema.sql` yang berisi skema
**lengkap**. Direktori migrasi baru mustahil lulus. Konvensi repo ini memang
**squash**, dan itu disengaja — commit `58f284c` menambahkan tabel `Job` dengan
cara menambahkan ke migrasi init, dan tabel `LoginAttempt` juga begitu.

Asumsi "sudah dirilis" juga keliru: repo punya 0 tag, PostgreSQL belum dipakai,
dan `dev.db` adalah data uji yang di-ignore git.

Biaya kesalahan ini: 514 detik dan $13,88 untuk satu worker yang membaca lalu
berhenti. Itu **harga instruksi stop-and-report yang bekerja** — dia menangkap
kesalahan mandor sebelum ada kerusakan.

**Pelajaran:** brief yang melarang menyentuh berkas adalah klaim tentang repo.
Periksa dulu, jangan salin praktik umum.

**Konsekuensi yang harus ditinjau sebelum rilis pertama:** karena konvensi
squash, database yang sudah ada tidak mendapat tabel baru saat migrasi init
berubah. Selama pengembangan `dev.db` cukup dibangun ulang. Begitu ada
deployment nyata (PostgreSQL produksi), konvensi ini harus diganti dengan
migrasi tambahan — dan `check-migrations.mjs` ikut disesuaikan.

---

## Batas yang jujur

- **Fase NT-P1 selesai; gate NT-P1 lulus.** Fase berikutnya (NT-P2, koneksi gateway) **belum dibuka** — menunggu perintah pemilik produk.
- **Pengiriman email belum ada.** REQ-NT-16 dipenuhi dengan cara yang diminta untuk mode tanpa email: tautan reset ditulis ke log admin dan UI menjelaskan keadaan itu. Bila operator mengkonfigurasi SMTP, rute hanya menulis peringatan bahwa pengirim belum dibangun — **tidak** ada email yang benar-benar terkirim.
- Uji E2E mengosongkan tabel `dev.db` sebelum berjalan. Itu disengaja dan dicetak sebagai peringatan; jangan dijalankan pada database yang berisi data sungguhan.
- `npm test` hanya mencakup unit test. Cakupan E2E ada di `scripts/e2e_kawan.py` yang dijalankan terpisah.
- `dev.db` dipakai untuk menjalankan Kawan di VPS ini (`pm2 kawan`, port 3010). Ini lingkungan pengembangan, bukan produksi: PostgreSQL belum dipakai.
- Konsekuensi konvensi migrasi squash (lihat cacat #6): database yang sudah ada tidak mendapat tabel baru; `dev.db` harus dibangun ulang. **Harus ditinjau sebelum rilis pertama.**
- Worker P1-06 kena batas `--max-turns 100` tepat sebelum menulis laporan, sehingga laporannya kosong (exit code 1, `passed_worker_exit`). Verifikasi mandor yang menentukan: keenam gate dijalankan ulang dan lulus, dan 16 berkas hasilnya diperiksa satu per satu. Tidak ada kerusakan, tetapi **batas turn untuk tugas sebesar ini sebaiknya dinaikkan**.
