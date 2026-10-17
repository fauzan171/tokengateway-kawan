# Plan — Kawan (scope nontechnical-v1)

> Arah produk diperbarui 17 Oktober 2026: baca [scope aktif](../ACTIVE-SCOPE.md) terlebih dahulu. Keputusan agen, prioritas, dan pengurangan scope di sana mengesampingkan bagian lama yang bertentangan.

Status: rencana kerja untuk implementer. Fondasi NT-P0/NT-P1 dan backend NT-P2/NT-P3 sudah di-merge; UI NT-P3 belum lengkap. `ad32864` adalah commit konsolidasi historis, bukan HEAD saat ini. Gate NT-P1 lulus 2026-10-16. Sisa NT-P3 yang belum ditutup (WP-NT-P3-11, WP-NT-P3-14, ditambah WP-NT-P2-08 dan WP-NT-P2-09 yang dipindahkan) dirinci di `prompt-full.md` Tahap 1. NT-P4 dan seterusnya belum dimulai.
Baseline referensi: `f8ae8a6c328946dc62cd0712961a0632574581bf` (dipin, bukan `main`).

Dokumen ini menjawab: apa dikerjakan lebih dulu, apa yang bergantung pada apa, mana yang boleh paralel, dan kapan sebuah pekerjaan boleh dimulai atau disebut selesai. Requirement ada di `prd.md`; desain teknis di `sdd.md`; keputusan cakupan di `coverage.md`.

---

## 1. Aturan ID

| Prefix | Arti | Contoh |
|---|---|---|
| `NT-Pn` | Fase kerja (n = 0..10) | `NT-P3` |
| `WP-NT-Pn-mm` | Work package (mm = nomor urut dalam fase) | `WP-NT-P3-02` |
| `REQ-NT-nn` | Requirement produk di `prd.md` | `REQ-NT-25` |
| `SDD-n` | Bagian desain di `sdd.md` | `SDD-4` |
| `COV-nn` | Baris matriks cakupan di `coverage.md` | `COV-14` |

Setiap work package menyebut: requirement yang dipenuhi, bagian SDD yang mengatur, dependency, apakah boleh paralel, dan gate keluarnya.

---

## 2. Fase dan dependency

```text
NT-P0 Fondasi
  |
NT-P1 Auth & akun
  |
NT-P2 Koneksi & model  ----+
  |                         |
NT-P3 Chat inti <----------+
  |
NT-P4 Riwayat, folder, berbagi, ekspor
  |
NT-P5 Render & lampiran
  |
NT-P6 Dokumen & RAG
  |
NT-P7 Pencarian web & prompt tersimpan
  |
NT-P8 Media (gambar, vision, audio)
  |
NT-P9 Pengaturan, pemakaian, admin
  |
NT-P10 Pengerasan & rilis
```

Aturan dependency: fase tidak dimulai sebelum gate fase sebelumnya lulus, **kecuali** work package yang ditandai paralel-aman dan tidak berbagi file inti dengan pekerjaan fase berjalan.

**Titik kritis:** NT-P2 dan NT-P3 bergantung pada kontrak koneksi yang sama. Perubahan bentuk `Connection`/`ModelCache` setelah NT-P3 dimulai memaksa penulisan ulang pemilih model. Kontrak ini dibekukan di akhir NT-P2.

---

## 3. Work packages

Kolom **Paralel** bernilai `ya` bila paket boleh dikerjakan bersamaan dengan paket lain di fase yang sama tanpa berbagi file inti. Kolom **Dep** berisi ID yang harus selesai lebih dulu.

### NT-P0 — Fondasi

Status: WP-NT-P0-01 sampai WP-NT-P0-07 selesai; gate NT-P0 lulus pada 2026-10-16 (typecheck, lint, test, build, uji klaim antrean, fixture provider). Bukti per WP ada di laporan mandor, bukan di tabel ini.

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P0-01 | Bootstrap proyek Next 15 + TypeScript strict + Tailwind + shadcn; skrip `typecheck`, `lint`, `test`, `test:e2e`, `build` | — | SDD-1.2 | — | tidak | `npm run build` lulus; skrip nyata ada di `package.json` |
| WP-NT-P0-02 | Setup Prisma + SQLite dev + Postgres prod; migrasi awal `User`, `Credential`, `Session` | REQ-NT-11 | SDD-2 | P0-01 | tidak | Migrasi jalan di dua provider pada CI |
| WP-NT-P0-03 | Registry konfigurasi + validasi env + `.env.example`; gagal start bila `ENCRYPTION_SECRET` salah | — | SDD-1.5 | P0-01 | ya | Uji: env hilang → pesan jelas |
| WP-NT-P0-04 | Layout aplikasi, tema, navigasi dasar, halaman galat/loading, responsif 360 px | REQ-NT-49 | SDD-7 | P0-01 | ya | Snapshot 360 px dan desktop |
| WP-NT-P0-05 | Utilitas bersama: klien HTTP, bentuk galat seragam, logger berredaksi, `X-Request-Id` | — | SDD-3.1, SDD-8.5 | P0-01 | ya | Uji unit redaksi + bentuk galat |
| WP-NT-P0-06 | Fixture provider tiruan (Unicode terbelah, timeout, 401, 429, usage ada/tidak) | — | SDD-9.1 | P0-01 | ya | Fixture dapat dipakai test integrasi |
| WP-NT-P0-07 | Runtime worker + tabel `Job` + klaim lease + heartbeat | — | SDD-8 | P0-02 | tidak | Uji klaim konkuren: satu pemenang |

**Gate NT-P0:** `build` lulus; migrasi jalan di dua provider; worker dapat mengklaim dan menyelesaikan job tiruan; fixture provider tersedia.

### NT-P1 — Auth dan akun dasar

Status: **fase NT-P1 SELESAI** — WP-NT-P1-01 sampai WP-NT-P1-06 selesai dan gate paketnya lulus pada 2026-10-16 (typecheck, lint, 156 test, build, `check-migrations` dua provider, `check_docs`, ditambah uji E2E mandor `scripts/e2e_kawan.py` 33/33 dan uji alur reset lewat HTTP). Bukti per WP ada di laporan mandor (`reports/nt-p1.md`), bukan di tabel ini.

| WP | Isi | REQ | SDD | Dep | Paralel | Gate | Status |
|---|---|---|---|---|---|---|---|
| WP-NT-P1-01 | Auth.js Credentials + tabel `User`/`Credential`/`Session` + cookie HttpOnly/SameSite; Argon2id | REQ-NT-11, REQ-NT-13 | SDD-5.1 | P0-02 | tidak | Login/logout E2E | selesai |
| WP-NT-P1-02 | Admin pertama atomik | REQ-NT-12 | SDD-5.1 | P1-01 | tidak | Uji konkurensi: tepat satu admin | selesai |
| WP-NT-P1-03 | Halaman masuk/daftar + validasi + pesan generik + atribusi branding | REQ-NT-11, SDD-7.6 | SDD-7.2 | P1-01 | ya | E2E daftar→masuk | selesai |
| WP-NT-P1-04 | Rate limit login berbasis DB | REQ-NT-15 | SDD-5.1 | P1-01 | ya | Percobaan ke-N+1 ditolak (Auth.js selalu 302; bukti dari ada-tidaknya sesi, bukan kode status) | selesai |
| WP-NT-P1-05 | Ganti sandi + ganti nama; pencabutan sesi lain | REQ-NT-14 | SDD-5.1 | P1-01 | ya | Sesi lain invalid setelah ganti sandi | selesai |
| WP-NT-P1-06 | Reset sandi token sekali pakai (mode tanpa SMTP: tautan ke admin) | REQ-NT-16 | SDD-5.1 | P1-01 | ya | Token sekali pakai; kedaluwarsa ditolak | selesai |

**Gate NT-P1:** alur daftar→masuk→logout lulus E2E; admin pertama terbukti atomik; cookie HttpOnly/SameSite terverifikasi. **LULUS** — keenam WP selesai.

Catatan verifikasi WP-NT-P1-04: batas bawaan 5 percobaan / 15 menit. Setelah batas terlampaui, kata sandi yang BENAR pun ditolak selama jendela berjalan — itu perilaku yang diminta, dan diuji lewat ketiadaan sesi karena Auth.js tidak pernah mengembalikan 429 di jalur `credentials`. Hitungan disimpan di tabel `LoginAttempt`, dibuktikan dengan membacanya dari koneksi database terpisah.

Catatan verifikasi WP-NT-P1-05: `POST /api/account/password` mengambil token sesi dengan mendekode cookie HttpOnly di sisi server, bukan dengan menaruh `sid` di objek sesi — objek sesi ikut terkirim ke peramban lewat `/api/auth/session`, sehingga token mentah di sana akan terbaca JavaScript. Halaman `/pengaturan` disediakan sebagai antarmuka.

Catatan historis WP-NT-P1-06: tabel reset pernah ditambahkan ke snapshot init untuk development. Ini bukan prosedur upgrade yang aman. Jangan menghapus database pengguna atau mengubah init yang telah diterapkan. Sebelum perubahan schema berikutnya, perbaiki checker agar mendukung migrasi additive berpasangan dan uji upgrade pada salinan database. Bukti reset HTTP historis ada di laporan NT-P1.

### NT-P2 — Koneksi gateway dan model

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P2-01 | Modul enkripsi envelope AES-256-GCM + mask + rotasi (terdokumentasi) | REQ-NT-07 | SDD-5.2 | P0-03 | tidak | Uji unit: round-trip, AAD salah ditolak, canary tidak bocor |
| WP-NT-P2-02 | Model `Connection` + CRUD + aktivasi tunggal + hapus tanpa menghapus chat | REQ-NT-17, REQ-NT-10, REQ-NT-09 | SDD-2.2, SDD-3.2 | P2-01 | tidak | Uji: hanya satu aktif |
| WP-NT-P2-03 | Normalisasi baseUrl + validasi skema | REQ-NT-03 | SDD-3.2 | P2-01 | ya | Uji 8 kasus URL |
| WP-NT-P2-04 | Modul kebijakan keluar (SSRF) + allowlist operator | — | SDD-5.3 | P0-05 | ya | Uji: metadata endpoint ditolak |
| WP-NT-P2-05 | Klien gateway + `GET /models` + discovery + cache TTL | REQ-NT-02, REQ-NT-18, REQ-NT-20 | SDD-3.3 | P2-04 | tidak | Uji dengan fixture: model terbaca |
| WP-NT-P2-06 | Endpoint test koneksi + pemetaan galat (401/403/429/timeout/DNS) | REQ-NT-02 | SDD-3.2, SDD-5.4 | P2-05 | tidak | Semua jenis galat punya pesan |
| WP-NT-P2-07 | Layar onboarding "Hubungkan Gateway" + CTA tokengateway + teks keamanan jujur | REQ-NT-01, REQ-NT-04, REQ-NT-05, REQ-NT-06, REQ-NT-08 | SDD-7.2 | P2-06 | ya | E2E onboarding; snapshot teks |
| WP-NT-P2-08 | Pemilih model di chat + penyimpanan model per chat | REQ-NT-18, REQ-NT-19 | SDD-3.3 | P2-05 | ya | Buka chat lama memakai model tersimpan |
| WP-NT-P2-09 | Capability matrix: sembunyikan kontrol tak tersedia | REQ-NT-21, REQ-NT-69 | SDD-3.3 | P2-05 | ya | Uji: model tanpa visi → tak ada tombol gambar |

**Gate NT-P2 (pembekuan kontrak):** onboarding E2E lulus; key tidak pernah kembali ke browser (uji canary); kontrak `Connection`/`ModelCache` dibekukan dan dicatat sebagai revisi dokumen bila berubah.

**Kontrak dibekukan 2026-10-16 sebelum WP mana pun dikerjakan** (commit `d1bee88`): tabel `Connection` dan `ModelCache`, plus variabel konfigurasi `ENCRYPTION_KEY_ID`, `MODEL_CACHE_TTL_SECONDS`, `OUTBOUND_ALLOWLIST`, `ALLOW_INSECURE_HTTP`. Dibekukan mandor, bukan diserahkan ke worker, karena (a) peringatan kontrak di atas dan (b) konvensi migrasi SQUASH repo ini membuat dua WP yang sama-sama butuh tabel baru selalu bentrok di tiga berkas yang sama.

**Catatan ketergantungan WP-NT-P2-08 dan WP-NT-P2-09.** Keduanya menyentuh pemilih model **di dalam chat**, sedangkan tabel `Chat` (beserta `Chat.modelRef`) baru dibuat di NT-P3 — saat kontrak NT-P2 dibekukan, tabel itu belum ada. Gate keduanya pun menuntut hal yang hanya bisa dibuktikan bila chat ada ("Buka chat lama memakai model tersimpan", "model tanpa visi → tak ada tombol gambar"). Karena itu keduanya **dipindahkan ke NT-P3**, ditempatkan setelah pohon pesan dan composer berdiri, dan tetap memakai `GET /api/kawan/v1/models` yang dibangun di NT-P2. Membangun komponennya sekarang akan menghasilkan komponen yatim tanpa tempat pakai.

### NT-P3 — Chat inti

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P3-01 | Model `Chat`/`ChatMessage`/`ChatMessagePart` + migrasi | REQ-NT-22 | SDD-2.2 | P2-02 | tidak | Migrasi dua provider; integritas parentId |
| WP-NT-P3-02 | Reducer pohon pesan + algoritma ancestry + deteksi siklus | REQ-NT-25, REQ-NT-27 | SDD-2.4 | P3-01 | tidak | Uji unit: ancestry, siklus ditolak |
| WP-NT-P3-03 | Endpoint kirim pesan + idempotensi | REQ-NT-22 | SDD-3.4, SDD-4.7 | P3-01 | tidak | Uji idempotensi: kunci sama → hasil sama |
| WP-NT-P3-04 | Job `chat.generate` + panggilan gateway + parsing stream | REQ-NT-22 | SDD-4.3 | P3-03, P0-07 | tidak | Fixture Unicode terbelah → teks utuh |
| WP-NT-P3-05 | Endpoint SSE + seq + buffer event | REQ-NT-22 | SDD-4.4 | P3-04 | tidak | Uji kontrak event meta/part/usage/done |
| WP-NT-P3-06 | Resume SSE dengan `afterSeq` + backoff klien | REQ-NT-22 | SDD-4.5 | P3-05 | tidak | Uji putus-tengah → tidak ada token hilang |
| WP-NT-P3-07 | Stop/cancel + penyimpanan partial | REQ-NT-23 | SDD-4.6 | P3-04 | ya | Uji: stop menyimpan partial; tak ada token setelahnya |
| WP-NT-P3-08 | Regenerate + cabang assistant sibling | REQ-NT-24 | SDD-3.4 | P3-02 | ya | Dua sibling; konteks mengikuti cabang aktif |
| WP-NT-P3-09 | Edit pesan (branch/inplace) + tolak saat streaming | REQ-NT-25, REQ-NT-26 | SDD-3.4 | P3-02 | ya | 409 saat streaming; sibling saat branch |
| WP-NT-P3-10 | Continue pada node assistant | REQ-NT-30 | SDD-3.4 | P3-04 | ya | Output lama tetap |
| WP-NT-P3-11 | UI chat: area pesan, composer, tombol stop/regenerate/edit, pemilih cabang | REQ-NT-22..27 | SDD-7.2 | P3-05 | tidak | E2E alur B |
| WP-NT-P3-12 | Pesan sistem per chat | REQ-NT-31 | SDD-3.4 | P3-03 | ya | Dikirim sebagai peran sistem |
| WP-NT-P3-13 | Judul otomatis + ganti manual | REQ-NT-29 | SDD-3.4 | P3-03 | ya | Judul muncul; ganti manual menang |
| WP-NT-P3-14 | Pemetaan galat provider di UI + tombol coba lagi | REQ-NT-28 | SDD-5.4 | P3-05 | ya | Setiap jenis galat punya tindakan |
| WP-NT-P3-15 | Pencatatan `UsageRecord` dari respons gateway | REQ-NT-71 | SDD-2.2 | P3-04 | ya | Satu pencatat di `lib/chat/usage.ts`; dipakai generasi, normalisasi dan integrasi diuji; konsolidasi 17 Oktober 2026 |

**Gate NT-P3:** alur B (edit/regenerate/cabang) lulus E2E; streaming tahan putus; tidak ada token hilang/ganda pada fixture.

### NT-P4 — Riwayat, folder, berbagi, ekspor

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P4-01 | Daftar chat berpaginasi kursor + pencarian | REQ-NT-32 | SDD-3.5 | P3-01 | tidak | Uji paginasi stabil saat data berubah |
| WP-NT-P4-02 | Sidebar riwayat + pengelompokan tanggal zona pengguna | REQ-NT-32 | SDD-7.2 | P4-01 | ya | Snapshot kelompok tanggal |
| WP-NT-P4-03 | Rename, hapus (konfirmasi), pin | REQ-NT-33 | SDD-3.5 | P4-01 | ya | E2E masing-masing |
| WP-NT-P4-04 | Arsip chat | REQ-NT-34 | SDD-3.5 | P4-01 | ya | Terarsip hilang dari daftar utama |
| WP-NT-P4-05 | Folder satu tingkat + pindah chat | REQ-NT-35 | SDD-2.2 | P4-01 | ya | Hapus folder tidak hapus chat |
| WP-NT-P4-06 | Berbagi: snapshot beku + halaman publik | REQ-NT-36, REQ-NT-41 | SDD-3.5 | P3-01 | tidak | Uji canary pada respons publik |
| WP-NT-P4-07 | Cabut berbagi + kedaluwarsa | REQ-NT-37, REQ-NT-38 | SDD-3.5 | P4-06 | tidak | Tautan dicabut → 404 segera |
| WP-NT-P4-08 | Ekspor Markdown + JSON | REQ-NT-39 | SDD-3.5 | P4-01 | ya | Round-trip isi + struktur |
| WP-NT-P4-09 | Impor JSON + validasi + tolak dangling | REQ-NT-39 | SDD-2.4 | P4-08 | ya | Impor rusak ditolak dengan pesan |
| WP-NT-P4-10 | Ekspor semua data pengguna | REQ-NT-40 | SDD-3.5 | P4-08 | ya | Arsip tanpa kredensial |

**Gate NT-P4:** alur D (berbagi dan cabut) lulus; ekspor/impor round-trip; canary publik bersih.

### NT-P5 — Render dan lampiran

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P5-01 | Render markdown + sanitasi HTML | REQ-NT-42, REQ-NT-44 | SDD-6.3 | P3-11 | tidak | Uji XSS: `<script>`, `onerror` |
| WP-NT-P5-02 | Blok kode + highlight + tombol salin | REQ-NT-42 | SDD-7.2 | P5-01 | ya | Salin menyalin isi |
| WP-NT-P5-03 | Matematika KaTeX inline/blok | REQ-NT-43 | SDD-7.1 | P5-01 | ya | Snapshot $...$ dan $$...$$ |
| WP-NT-P5-04 | Mermaid dari blok `mermaid` | REQ-NT-45 | SDD-7.1 | P5-01 | ya | Diagram tampil; teks tetap disalin |
| WP-NT-P5-05 | Lampiran gambar (gated visi) | REQ-NT-46 | SDD-7.2 | P2-09 | ya | Model tanpa visi: tak ada tombol |
| WP-NT-P5-06 | Pratinjau + hapus lampiran sebelum kirim | REQ-NT-48 | SDD-7.2 | P5-05 | ya | Hapus sebelum kirim tidak mengunggah |
| WP-NT-P5-07 | Composer: Enter/Shift+Enter/IME | REQ-NT-50 | SDD-7.2 | P3-11 | ya | Uji IME: Enter saat komposisi tidak kirim |
| WP-NT-P5-08 | Mode gelap/terang/sistem | REQ-NT-49 | SDD-7.2 | P0-04 | ya | Tema tersimpan |
| WP-NT-P5-09 | Audit aksesibilitas: fokus, label, kontras, aria-live | SDD-7.3 | SDD-7.3 | P5-01 | ya | Checklist WCAG AA terverifikasi |
| WP-NT-P5-10 | Audit mobile 360 px + safe area | SDD-7.4 | SDD-7.4 | P5-01 | ya | Snapshot 360 px tanpa gulir horizontal |

**Gate NT-P5:** render lengkap; XSS tertutup; checklist aksesibilitas dan mobile lulus.

### NT-P6 — Dokumen dan RAG

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P6-01 | Model `Document`/`DocumentChunk` + adapter penyimpanan | REQ-NT-54 | SDD-2.2, SDD-6.1 | P0-02 | tidak | Berkas di luar webroot; nama acak |
| WP-NT-P6-02 | Endpoint unggah + validasi MIME/ukuran + status | REQ-NT-54, REQ-NT-60 | SDD-3.6 | P6-01 | tidak | Tolak melebihi batas dengan pesan |
| WP-NT-P6-03 | Job `document.extract` + ekstraksi PDF/teks | REQ-NT-54 | SDD-6.1 | P6-02, P0-07 | tidak | Status queued→processing→ready |
| WP-NT-P6-04 | Chunking + metadata sumber (halaman/bagian) | REQ-NT-55 | SDD-6.1 | P6-03 | tidak | Metadata per chunk benar |
| WP-NT-P6-05 | Embedding opsional (job `document.embed`) | REQ-NT-56 | SDD-6.1 | P6-04 | ya | Dengan embedding: vektor tersimpan |
| WP-NT-P6-06 | Retrieval + filter userId di level query | REQ-NT-56, REQ-NT-58 | SDD-6.2 | P6-04 | tidak | Uji lintas pengguna: tak ada kebocoran |
| WP-NT-P6-07 | Fallback pencarian kata kunci tanpa embedding | REQ-NT-61 | SDD-6.2 | P6-04 | ya | Mode kata kunci bekerja; teks penjelasan tampil |
| WP-NT-P6-08 | Sitasi pada jawaban + endpoint lihat potongan | REQ-NT-57 | SDD-6.2 | P6-06 | tidak | Klik sitasi menampilkan potongan |
| WP-NT-P6-09 | Hapus dokumen + chunk + embedding + job pembersih yatim | REQ-NT-59 | SDD-6.4 | P6-04 | ya | Setelah hapus, retrieval tak menemukan |
| WP-NT-P6-10 | UI lampiran dokumen + status ingestion | REQ-NT-47, REQ-NT-54 | SDD-7.2 | P6-02 | ya | E2E alur C |

**Gate NT-P6:** alur C lulus; isolasi lintas pengguna terbukti; hapus dokumen bersih.

### NT-P7 — Pencarian web dan prompt tersimpan

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P7-01 | Integrasi mesin pencari (gated konfigurasi) | REQ-NT-51 | SDD-3.4 | P3-04 | ya | Tanpa konfigurasi: tombol tak ada |
| WP-NT-P7-02 | Sumber hasil pencarian pada jawaban | REQ-NT-52 | SDD-6.2 | P7-01 | ya | Tautan `noopener`, tab baru |
| WP-NT-P7-03 | Degradasi saat mesin pencari gagal | REQ-NT-53 | SDD-5.4 | P7-01 | ya | Jawaban tetap terkirim |
| WP-NT-P7-04 | Model `Prompt` + CRUD pribadi | REQ-NT-62 | SDD-2.2 | P0-02 | ya | Simpan/panggil/hapus |
| WP-NT-P7-05 | Variabel `{{isi}}` pada prompt | REQ-NT-63 | SDD-3.4 | P7-04 | ya | Tak ada placeholder tersisa |
| WP-NT-P7-06 | Prompt bawaan admin | REQ-NT-64 | SDD-3.7 | P7-04 | ya | Admin dapat menambah/menonaktifkan |

**Gate NT-P7:** pencarian web gated bekerja dan gagal dengan sopan; prompt dapat dipakai dari composer.

### NT-P8 — Media (gated)

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P8-01 | Generasi gambar (gated endpoint gateway) | REQ-NT-65 | SDD-3.3 | P2-09 | ya | Tanpa endpoint: tombol tak ada |
| WP-NT-P8-02 | Vision (gated kapabilitas model) | REQ-NT-66 | SDD-3.3 | P5-05 | ya | Model tanpa visi: tak ditawarkan |
| WP-NT-P8-03 | STT audio (gated) | REQ-NT-67 | SDD-3.3 | P5-07 | ya | Tanpa konfigurasi: kontrol tak tampil |
| WP-NT-P8-04 | TTS (gated, P2) | REQ-NT-68 | SDD-3.3 | P5-01 | ya | Tombol hanya bila tersedia |
| WP-NT-P8-05 | Uji capability matrix menyeluruh | REQ-NT-69 | SDD-3.3 | P8-01..04 | tidak | Tidak ada kontrol inert |

**Gate NT-P8:** capability matrix terbukti; tidak ada kontrol mati.

### NT-P9 — Pengaturan, pemakaian, admin

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P9-01 | Pengaturan pribadi (tema, bahasa, font, preferensi kirim) | REQ-NT-70 | SDD-3.7 | P0-04 | ya | Perubahan langsung berlaku |
| WP-NT-P9-02 | Halaman Pemakaian (harian, per model, reported flag) | REQ-NT-71, REQ-NT-72 | SDD-3.7 | P3-15 | tidak | `reported:false` → "tidak tersedia" |
| WP-NT-P9-03 | Ekspor pemakaian CSV | REQ-NT-73 | SDD-3.7 | P9-02 | ya | Kolom jelas |
| WP-NT-P9-04 | Admin: daftar pengguna, aktif/nonaktif | REQ-NT-74 | SDD-3.7 | P1-02 | tidak | Nonaktif tidak bisa login; sesi dicabut |
| WP-NT-P9-05 | Admin: hapus pengguna + data pribadi | REQ-NT-75 | SDD-2.6 | P9-04 | tidak | Uji lintas tabel: tidak ada sisa |
| WP-NT-P9-06 | Admin: tutup registrasi publik | REQ-NT-76 | SDD-3.7 | P9-04 | ya | Halaman daftar menjelaskan |
| WP-NT-P9-07 | Admin: status sistem | REQ-NT-77 | SDD-8.5 | P9-04 | ya | Komponen opsional mati tidak memblokir |
| WP-NT-P9-08 | Halaman kebijakan privasi | REQ-NT-79 | SDD-7.2 | P9-04 | ya | Halaman ada dan tertaut |
| WP-NT-P9-09 | Audit redaksi log menyeluruh | REQ-NT-78 | SDD-8.5 | P0-05 | ya | Uji canary log bersih |

**Gate NT-P9:** alur E lulus; canary log dan ekspor bersih.

### NT-P10 — Pengerasan dan rilis

| WP | Isi | REQ | SDD | Dep | Paralel | Gate |
|---|---|---|---|---|---|---|
| WP-NT-P10-01 | Uji beban ringan + penetapan SLO | — | SDD-1.4 | P3-15 | tidak | Angka SLO ditetapkan dari hasil |
| WP-NT-P10-02 | Uji keamanan lengkap (canary, SSRF, XSS, lintas pengguna) | — | SDD-9.3 | P9-09 | tidak | Semua lulus |
| WP-NT-P10-03 | Prosedur backup/restore + uji restore | — | SDD-8.6 | P0-02 | ya | Restore ke instance bersih berhasil |
| WP-NT-P10-04 | Dokumentasi operator (env, migrasi, upgrade, rollback) | — | SDD-8.4 | P0-03 | ya | Dokumen ada dan akurat |
| WP-NT-P10-05 | Uji E2E alur A–E penuh | — | SDD-9.1 | P9-08 | tidak | Semua alur lulus |
| WP-NT-P10-06 | Pemeriksa konsistensi dokumen di CI | — | — | P10-05 | ya | `check_docs.py` exit 0 |
| WP-NT-P10-07 | Review lisensi/merek sebelum aset apa pun dipakai | — | — | P0-01 | ya | Catatan review ada |

**Gate NT-P10:** semua P0 lulus; tidak ada kontrol inert; tidak ada klaim berlebihan; rilis disetujui pemilik produk.

---

## 4. Pekerjaan paralel-aman

Paket berikut boleh dikerjakan bersamaan karena tidak menyentuh file inti yang sama. Aturan: **satu pemilik per file**. Bila dua paket perlu file yang sama, salah satu menunggu; integrasi dilakukan satu mandor.

| Gelombang | Paket paralel | Alasan aman |
|---|---|---|
| G1 | P0-03, P0-04, P0-05, P0-06 | Modul berbeda: konfigurasi, layout, utilitas, fixture |
| G2 | P1-03, P1-04, P1-05, P1-06 | Layar dan endpoint berbeda setelah P1-01 stabil |
| G3 | P2-03, P2-04, P2-07, P2-08, P2-09 | Normalisasi, kebijakan keluar, layar, pemilih model terpisah |
| G4 | P3-07, P3-08, P3-09, P3-10, P3-12, P3-13, P3-14, P3-15 | Operasi pohon dan UI berbeda setelah P3-05 stabil |
| G5 | P5-02, P5-03, P5-04, P5-06, P5-07, P5-08, P5-09, P5-10 | Elemen render dan audit terpisah |
| G6 | P6-05, P6-07, P6-09, P6-10 | Jalur embedding, fallback, pembersihan, UI |
| G7 | P8-01, P8-02, P8-03, P8-04 | Masing-masing gated dan terpisah |
| G8 | P10-03, P10-04, P10-06, P10-07 | Operasi, dokumentasi, CI, review |

**Tidak boleh paralel:** semua paket yang menulis `prisma/schema.prisma` atau migrasi. Perubahan schema diserialkan oleh mandor.

---

## 5. Definition of Ready (DoR)

Sebuah work package boleh mulai dikerjakan hanya bila seluruh butir berikut benar:

1. ID work package ada di tabel fase ini dan requirement terkait terdaftar.
2. Bagian SDD yang mengatur sudah dibaca oleh pelaksana.
3. Dependency yang tercantum sudah lulus gate.
4. Kontrak input/output (DTO, bentuk galat, event) sudah tertulis dan tidak berubah-ubah.
5. Perilaku baseline yang relevan sudah diverifikasi dari sumber lokal, **bukan diasumsikan**. Bila belum, tandai `PERLU-BUKTI` dan selesaikan dulu.
6. Cakupan file yang akan disentuh sudah diketahui dan tidak beririsan dengan paket paralel lain.
7. Cara menguji sudah jelas: perintah, fixture, dan hasil yang diharapkan.
8. Tidak ada pertanyaan terbuka yang memblokir; bila ada, ada default yang tercatat di `prd.md` 8.1.

## 6. Definition of Done (DoD)

Sebuah work package disebut selesai hanya bila:

1. Perilaku yang diminta berjalan nyata (bukan stub, bukan mock produksi).
2. Test fokus lulus; test regresi terkait lulus.
3. `npm run typecheck`, `npm run lint`, `npm run build` lulus.
4. Tidak ada `TODO` kosong, kode mati, atau kontrol inert.
5. Tidak ada kredensial di diff (pemeriksaan pola + canary).
6. Bukti disertakan: perintah, exit code, hasil ringkas, dan bukti sanitasi.
7. Dokumentasi yang terpengaruh (bila ada) diperbarui.
8. Gate fase diperbarui bila ini paket terakhir fase.

## 7. Handoff antar pelaksana

Setiap serah terima menyertakan:

```text
Work package: WP-NT-Pn-mm
Requirement: REQ-NT-nn
SDD: SDD-n
Yang berubah: daftar file
Kontrak baru/berubah: DTO, event, bentuk galat
Perintah verifikasi: ... (exit code, hasil)
Fixture yang dipakai: ...
Perilaku baseline yang diverifikasi: sumber + temuan
Yang belum selesai / risiko: ...
Paket berikutnya yang bergantung: ...
```

Aturan handoff: pelaksana berikutnya tidak boleh mengubah kontrak yang sudah dibekukan tanpa mencatatnya sebagai revisi dokumen. Bila kontrak harus berubah, mandor memutuskan dan mencatat dampaknya ke paket yang sudah selesai.

## 8. Risiko jadwal

| Risiko | Gejala awal | Mitigasi |
|---|---|---|
| Kontrak koneksi berubah setelah NT-P3 | Pemilih model ditulis ulang | Bekukan di gate NT-P2 |
| Streaming sulit diuji | Bug token hilang muncul terlambat | Fixture provider dipaksa ada di NT-P0 |
| RAG kualitas rendah | Pengguna mengabaikan dokumen | Uji fixture dokumen tetap sejak NT-P6 |
| Scope merembet ke full parity | Muncul paket di luar tabel | Perubahan scope butuh keputusan pemilik produk |
| Dokumen dan kode menyimpang | Implementer salah arah | `check_docs.py` di CI setiap perubahan dokumen |
