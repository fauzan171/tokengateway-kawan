# PRD — Kawan (scope nontechnical-v1)

**Penulis**: tim produk tokengateway.ai.id
**Tanggal**: 14 Oktober 2026
**Status**: Draft untuk implementasi
**Pemangku kepentingan**: pemilik produk tokengateway.ai.id, implementer frontend/backend, reviewer keamanan, operator self-host

Dokumen ini adalah requirement produk untuk brief terbaru: pengguna nonteknis, chat selengkap ChatGPT untuk pemakaian pribadi, dengan gateway BYOK sebagai jalur default. Fitur overkill dikecualikan dan dicatat di `coverage.md`. Dokumen ini bukan klaim 100% Open WebUI dan bukan klaim identik ChatGPT.

---

## 1. Ringkasan Eksekutif

Kawan adalah aplikasi web chat AI multi-user yang dapat di-self-host. Pengguna masuk, menghubungkan gateway kompatibel [OI] miliknya sendiri (BYOK) dengan mengisi Base URL dan API Key, lalu langsung mengobrol dengan model dari gateway itu. Pengalaman inti — streaming, riwayat, edit dan regenerate, unggah dokumen untuk tanya jawab, pencarian web opsional, gambar, audio — disusun agar terasa familier bagi pengguna nonteknis yang biasa memakai ChatGPT.

Yang membedakan Kawan dari klon chat biasa: tidak ada saldo token, tidak ada billing, dan kredensial gateway tetap milik pengguna. Mode default menyimpan key terenkripsi di server Kawan lalu meneruskan request LLM; ini dijelaskan apa adanya di UI, bukan diklaim sebagai "key tidak pernah menyentuh server". Jalur Direct (key hanya di browser) ditunda pada v1 dan dicatat sebagai defer, bukan dijanjikan.

Nilai bisnisnya: Kawan menjadi wajah resmi produk `by tokengateway.ai.id` — antarmuka yang bisa dipakai siapa pun untuk mencoba gateway, dengan titik konversi ke pendaftaran gateway di `tokengateway.ai.id`.

## 2. Kontak

| Peran | Pemegang | Tanggung jawab |
|---|---|---|
| Pemilik produk | tokengateway.ai.id | Prioritas scope, keputusan default, persetujuan rilis |
| Mandor teknis | Integrator | Kontrak lintas modul, schema, review, gate kualitas |
| Implementer | Frontend / Backend | Work package pada `plan.md` |
| Reviewer keamanan | Penunjukan pemilik produk | Review secret, SSRF, upload, share, privacy |
| Operator self-host | Pengguna teknis yang memasang | Environment, backup, restore, upgrade |

Saluran keputusan: pemilik produk menetapkan scope; mandor teknis menetapkan cara implementasi; implementer mengerjakan work package yang sudah lolos Definition of Ready. Pertanyaan yang menghambat diberi jawaban default yang tercatat di bagian 8 agar tidak menahan pekerjaan.

## 3. Latar Belakang dan Konteks

### 3.1 Masalah

Pengguna nonteknis yang ingin memakai model AI lewat gateway miliknya sendiri biasanya terhenti pada tiga hal: (a) tidak tahu harus mengisi apa saat diminta endpoint dan key; (b) aplikasi chat yang ada dirancang untuk orang teknis sehingga penuh istilah, panel parameter, dan opsi yang membingungkan; (c) tidak ada jaminan yang jelas tentang apa yang terjadi pada key mereka. Akibatnya gateway punya kapabilitas tetapi tidak punya wajah yang nyaman dipakai.

### 3.2 Yang sudah ada

Open WebUI (commit `f8ae8a6c328946dc62cd0712961a0632574581bf`, versi 0.12.0) sudah menyelesaikan sebagian besar masalah ini secara teknis: ia punya konsep Connections tempat pengguna memasukkan URL dan key provider, riwayat chat dengan pohon pesan, streaming, berbagi, dan sebagainya. Tetapi cakupannya luas: workspace, admin panel, evaluasi, otomasi, channel, catatan, kalender, terminal, eksekusi kode, plugin, SCIM, LDAP, RBAC granular. Untuk pengguna nonteknis yang hanya ingin mengobrol dengan dokumennya, sebagian besar itu adalah permukaan yang membingungkan dan permukaan serangan yang harus dirawat.

### 3.3 Kenapa sekarang

Brief terbaru menetapkan target nonteknis dan mengecualikan fitur overkill. Ini mengubah prioritas: yang penting bukan kesetaraan fitur penuh, melainkan pengalaman onboarding, kualitas chat, dan kejujuran soal keamanan key. Paket full-parity lama tetap tersedia sebagai referensi alternatif tetapi bukan requirement default.

### 3.4 Riset pengguna

Belum ada wawancara pengguna formal pada tahap ini. Karena itu bagian pasar/pengguna (bagian 5) memakai asumsi yang ditandai eksplisit, bukan angka yang diarang. Riset lanjutan direkomendasikan sebelum rilis publik.

## 4. Tujuan dan Metrik Keberhasilan

### 4.1 Tujuan (Goals)

1. Pengguna nonteknis dapat menyelesaikan onboarding gateway tanpa bantuan: mengisi Base URL dan key, menekan Test koneksi, melihat jumlah model, dan mulai chat.
2. Pengalaman chat inti terasa lengkap: streaming, stop, edit dan regenerate dengan cabang, riwayat dengan pencarian/arsip/folder, berbagi dengan pencabutan, ekspor/impor.
3. Kredensial gateway ditangani secara jujur dan aman: terenkripsi di server pada mode default, tidak pernah dikembalikan ke browser dalam bentuk mentah, dan dijelaskan dengan bahasa yang bisa dipahami pengguna.
4. Kualitas output chat setara ekspektasi pengguna ChatGPT: markdown, blok kode dengan tombol salin, matematika, tabel, dan sitasi untuk jawaban berbasis dokumen.
5. Dokumen yang diunggah dapat ditanyai dengan jawaban yang menyertakan sitasi ke bagian sumber, dan status pemrosesan dokumen terlihat jelas.
6. Aplikasi dapat di-self-host dengan cara yang dapat diulang: konfigurasi env terdokumentasi, migrasi database, backup dan restore, serta langkah upgrade.
7. Branding `by tokengateway.ai.id` tampil konsisten dan menjadi jalur konversi ke gateway.

### 4.2 Non-Goals (di luar lingkup, dengan alasan)

1. **Kesetaraan fitur penuh Open WebUI.** Tidak diperlukan oleh target nonteknis dan menambah permukaan perawatan besar. Keputusan per fitur ada di `coverage.md`.
2. **Billing atau penjualan token.** Kawan tidak menagih; pengguna membayar gateway-nya sendiri.
3. **Menjadi perantara LLM dengan saldo sendiri.** Kawan tidak menyediakan kredit model.
4. **Klaim identik ChatGPT.** Yang disasar adalah rasa familiar, bukan kesamaan piksel atau nama fitur.
5. **Fitur enterprise**: SCIM, LDAP, RBAC granular per grup/resource, multi-tenant organisasi. Dikecualikan pada v1.
6. **Eksekusi kode arbitrer, terminal, plugin Python, worker otonom, subagent, pipeline evaluator.** Dikecualikan karena risiko dan karena bukan kebutuhan pengguna nonteknis.
7. **Multi-node dengan Redis sampai benar-benar dibutuhkan.** v1 dirancang untuk satu instance aplikasi + satu worker; penskalaan dicatat sebagai jalur lanjutan, bukan prasyarat.
8. **MCP tingkat lanjut** ditunda kecuali terbukti esensial (lihat `coverage.md`).
9. **Mode Direct (key hanya di browser)** ditunda pada v1, tetapi keputusan defaultnya dicatat terbuka: mode server menangani kredensial.

### 4.3 Metrik keberhasilan

Nilai "current" untuk metrik eksternal belum diketahui dan ditandai `unknown`; angka "target" adalah usulan yang harus divalidasi pemilik produk, bukan fakta. Metrik yang bisa diukur secara lokal pada aplikasi ditandai sebagai terukur internal.

| Metrik | Current | Target (usulan) | Cara mengukur |
|---|---|---|---|
| Penyelesaian onboarding gateway oleh pengguna nonteknis | unknown | ≥85% sesi onboarding berakhir dengan Test koneksi sukses | Event internal: `onboarding_started`, `connection_test_success` |
| Waktu dari registrasi ke pesan pertama | unknown | ≤3 menit median | Selisih timestamp `user_registered` → `first_message_sent` |
| Keberhasilan Test koneksi pada percobaan pertama | unknown | ≥80% untuk gateway yang valid | Rasio `connection_test_success` / `connection_test_attempt` |
| Chat yang memakai fitur lanjutan (edit/regenerate/branch) | unknown | ≥25% chat aktif | Rasio chat dengan ≥1 mutasi pohon |
| Chat yang mengunggah dokumen dan mendapat jawaban bersitasi | unknown | ≥20% chat aktif | Rasio chat dengan `citation_present=true` |
| Error stream yang tidak terpulihkan per 100 request | unknown | <2 | Penghitung error server per tipe |
| P95 latensi API non-provider (terukur internal) | unknown | ≤400 ms pada beban uji | Benchmark lokal dengan dataset uji tetap |
| P95 tambahan latensi relay stream (terukur internal) | unknown | ≤150 ms dari penerimaan provider | Benchmark lokal |
| Uptime instance self-host (terukur internal) | unknown | ≥99% per bulan pada operator rujukan | Monitoring operator |
| Insiden kebocoran kredensial | unknown | 0 | Review keamanan + uji canary secret |

## 5. Pasar dan Pengguna

### 5.1 Segmen

| Segmen | Deskripsi | Kebutuhan utama | Ukuran |
|---|---|---|---|
| Pengguna pribadi nonteknis | Orang yang punya akses ke gateway tetapi tidak ingin berurusan dengan istilah teknis | Onboarding jelas, chat yang familier, kejelasan soal key | unknown; perlu riset |
| Pengguna teknis ringan | Nyaman mengisi URL/key tetapi ingin antarmuka bersih | Kontrol parameter secukupnya, ekspor data, API | unknown |
| Operator self-host | Memasang Kawan untuk dirinya atau tim kecil | Instalasi, backup, upgrade, kontrol privasi | unknown |
| Pemilik gateway | tokengateway.ai.id | Konversi pengguna, branding, kepercayaan | internal |

### 5.2 Persona ringkas

- **Sari, pengguna nonteknis.** Diberi URL gateway dan key oleh timnya. Tidak tahu apa itu endpoint. Butuh: halaman onboarding yang menjelaskan apa yang harus diisi, tombol Test koneksi yang memberi umpan balik jelas, dan chat yang mirip ChatGPT. Frustrasi saat ini: istilah seperti "provider", "model ID", "temperature" tanpa penjelasan.
- **Budi, operator self-host.** Memasang Kawan di server kecil. Butuh: konfigurasi env yang jelas, migrasi database, backup/restore, dan tahu data disimpan di mana. Tidak ingin menarik Redis atau cluster.
- **Rina, admin ringan.** Mengelola beberapa pengguna. Butuh: daftar pengguna, menonaktifkan akun, menghapus data sesuai permintaan, dan melihat pemakaian dasar. Tidak butuh grup/RBAC granular.

### 5.3 Kebutuhan yang tidak dilayani paket ini

Organisasi enterprise dengan SSO, provisi otomatis, dan pemisahan resource lintas grup. Ini keputusan sadar; bila segmen itu menjadi prioritas, paket full-parity lama menjadi rujukan.

## 6. Nilai Produk

### 6.1 Nilai untuk pengguna

- **Tanpa istilah teknis di jalur utama.** Onboarding hanya meminta Nama koneksi, Base URL, dan API Key, dengan placeholder default dan tautan bantuan.
- **Kontrol penuh atas kredensial.** Key milik pengguna, disimpan terenkripsi, bisa diganti atau dihapus. Tidak ada key dari akun tokengateway yang dipakai diam-diam.
- **Rasa yang familier.** Sidebar riwayat, tombol salin kode, tombol regenerate, editor pesan, unggah lampiran, mode gelap — semua seperti yang sudah dikenal pengguna.
- **Bisa dibawa pindah.** Ekspor dan impor data chat serta pengaturan agar pengguna tidak terkunci.
- **Jawaban yang bisa diperiksa.** Saat menjawab dari dokumen, jawaban menunjuk sumbernya.

### 6.2 Nilai untuk tokengateway.ai.id

- Kanal akuisisi: pengguna yang belum punya gateway diarahkan mendaftar di `tokengateway.ai.id` melalui CTA yang jelas, tanpa memaksa.
- Kepercayaan: kejujuran soal cara key disimpan menjadi pembeda, bukan klaim yang berlebihan.
- Kemandirian: siapa pun dapat self-host; branding tetap tampil seperti relasi proyek hulu terhadap situsnya.

### 6.3 Nilai dibanding alternatif

| Alternatif | Kekurangan untuk segmen ini | Posisi Kawan |
|---|---|---|
| Open WebUI apa adanya | Permukaan luas, istilah teknis, banyak fitur tak terpakai | Scope terpilih, bahasa sederhana, jalur utama bersih |
| Aplikasi chat komersial | Key dan data di vendor; tidak bisa self-host | BYOK, self-host, kendali data |
| Skrip CLI | Tidak ramah nonteknis | Antarmuka web yang familier |

## 7. Detail Solusi

### 7.1 Prinsip desain

1. Jalur utama (onboarding → chat) bebas istilah teknis; istilah lanjutan disembunyikan di bagian Lanjutan.
2. Setiap layar punya empat keadaan yang dirancang: kosong, memuat, galat, dan sukses. Tidak ada layar yang hanya dirancang untuk keadaan sukses.
3. Keamanan backend tidak dikorbankan oleh kesederhanaan UI. Menyembunyikan kontrol adalah keputusan UX, bukan pengganti pemeriksaan izin di server.
4. Tidak ada kontrol yang terlihat bisa diklik tetapi tidak melakukan apa pun (inert). Fitur yang belum ada tidak ditampilkan.
5. Teks UI berbahasa Indonesia yang jelas; istilah teknis diberi penjelasan singkat saat pertama muncul.

### 7.2 Domain requirement

Setiap requirement punya ID tetap `REQ-NT-*`, dipetakan ke work package di `plan.md` dan ke baris matriks di `coverage.md`. Prioritas: P0 wajib rilis v1; P1 sebaiknya ada di v1; P2 ditunda ke v1.1. Requirement yang ditunda tidak boleh tampil sebagai kontrol aktif.

#### NT1 — Onboarding gateway BYOK (jalur default)

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-01 | P0 | Setelah login pertama tanpa koneksi aktif, pengguna melihat layar "Hubungkan Gateway" dengan tiga isian: Nama koneksi, Base URL, API Key. Placeholder Base URL `https://api.tokengateway.ai.id/v1`. | Layar tampil otomatis; tiga isian terlihat; placeholder benar; tidak ada istilah tak dijelaskan. |
| REQ-NT-02 | P0 | Tombol "Test koneksi" memanggil `GET {baseUrl}/models` di server, menampilkan sukses beserta jumlah model atau pesan gagal yang dapat ditindaklanjuti. | Sukses menampilkan jumlah model; gagal menampilkan sebab ringkas; URL dengan/tanpa trailing slash tidak menghasilkan `/v1/v1/models`. |
| REQ-NT-03 | P0 | Base URL dinormalisasi: trailing slash dibuang, `v1` tidak digandakan, skema http/https divalidasi. | Unit test normalisasi untuk 8 kasus termasuk `.../v1`, `.../v1/`, tanpa `v1`, dengan query. |
| REQ-NT-04 | P0 | Simpan hanya setelah Test koneksi sukses, kecuali pengguna memilih "Simpan tanpa uji" yang ditandai jelas dan membuat koneksi berstatus draft (tidak bisa dipakai chat sampai diuji). | Koneksi draft tidak muncul sebagai pilihan model; status terlihat. |
| REQ-NT-05 | P0 | Di bawah isian URL ada tautan kecil "Pakai gateway tokengateway.ai.id? Daftar di sini" menuju `https://tokengateway.ai.id` (tab baru, `rel="noopener noreferrer"`). | Tautan membuka tab baru; atribut keamanan ada. |
| REQ-NT-06 | P0 | Bila gagal atau belum punya gateway, tampil kartu CTA "Belum punya API key? Dapatkan di tokengateway.ai.id" dengan tombol menuju situs. | CTA tampil pada keadaan gagal dan kosong. |
| REQ-NT-07 | P0 | API Key yang tersimpan tidak pernah dikembalikan ke browser; UI hanya menampilkan mask seperti `sk-...abc1`. | Respons API tidak memuat key mentah/ciphertext; UI menampilkan mask; tidak ada key di log/analytics. |
| REQ-NT-08 | P0 | Penjelasan keamanan ditulis jujur: mode default menyimpan key terenkripsi di server Kawan dan meneruskan request LLM. Tidak ada klaim "key tidak pernah menyentuh server". | Teks UI diuji snapshot; tidak ada frasa menyesatkan. |
| REQ-NT-09 | P1 | Pengguna dapat mengubah atau menghapus koneksi; menghapus koneksi tidak menghapus riwayat chat. | Hapus koneksi sukses; chat lama tetap ada dengan catatan modelnya. |
| REQ-NT-10 | P1 | Bila hanya ada satu koneksi, ia otomatis aktif; bila lebih dari satu, hanya satu aktif pada satu waktu. | Uji: menambah koneksi kedua tidak mengubah model aktif tanpa aksi pengguna. |

**Alur utama NT1:** pengguna baru login → layar Hubungkan Gateway → isi Nama/URL/Key → tekan Test koneksi → server memanggil `/models` → sukses menampilkan jumlah model → Simpan → koneksi menjadi aktif → diarahkan ke chat dengan model pertama terpilih. **Alur gagal:** Test gagal → pesan sebab (401/403/timeout/DNS/tidak ada model) → CTA tokengateway tampil → pengguna dapat memperbaiki atau menyimpan draft.

#### NT2 — Auth dan akun dasar

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-11 | P0 | Registrasi dengan email dan kata sandi, login, logout. Kata sandi di-hash Argon2id. | Registrasi gagal pada email duplikat dengan pesan generik; login gagal tidak mengungkap email terdaftar. |
| REQ-NT-12 | P0 | Pengguna pertama menjadi admin secara atomik; dua registrasi bersamaan tidak boleh keduanya menjadi admin. | Uji konkurensi: tepat satu admin. |
| REQ-NT-13 | P0 | Sesi berbasis cookie HttpOnly, SameSite=Lax, Secure pada HTTPS; token sesi tidak disimpan di localStorage. | Inspeksi cookie pada uji E2E. |
| REQ-NT-14 | P1 | Ganti kata sandi dan ganti nama tampilan. | Ganti sandi menginvalidasi sesi lain. |
| REQ-NT-15 | P1 | Batas percobaan login (rate limit) yang dapat dikonfigurasi. | Percobaan berlebih menghasilkan 429 dengan pesan yang jelas. |
| REQ-NT-16 | P1 | Lupa kata sandi via tautan reset berbasis token sekali pakai dan kedaluwarsa; bila email belum dikonfigurasi operator, tautan ditampilkan di log admin dan UI menjelaskan keadaan ini. | Token sekali pakai; kedaluwarsa ditolak. |

#### NT3 — Multi koneksi dan pemilihan model

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-17 | P0 | Pengguna dapat menyimpan beberapa koneksi gateway (nama, URL, key) dan memilih satu sebagai aktif. | Daftar koneksi tampil; memilih aktif mengubah daftar model. |
| REQ-NT-18 | P0 | Pemilih model di chat menampilkan model dari koneksi aktif, dengan pencarian dan pengelompokan bila banyak. | Daftar model berasal dari koneksi aktif; pencarian menyaring tanpa request ulang berlebihan. |
| REQ-NT-19 | P0 | Model yang dipilih disimpan per chat, bukan global; membuka chat lama memakai model yang tersimpan bila masih tersedia. | Buka chat lama memakai model tersimpan; bila model hilang, tampil peringatan dan fallback terpilih. |
| REQ-NT-20 | P1 | Cache daftar model dengan masa berlaku dan tombol segarkan manual. | Segarkan manual memicu request baru; cache tidak menahan model baru lebih dari TTL. |
| REQ-NT-21 | P1 | Menampilkan kapabilitas model yang diketahui (visi, tool) bila gateway mengumumkannya; jika tidak diketahui, jangan menampilkan kontrol yang bergantung padanya. | Model tanpa visi tidak menampilkan tombol lampiran gambar aktif. |

#### NT4 — Chat lengkap (streaming, edit, regenerate, cabang)

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-22 | P0 | Kirim pesan dan terima jawaban sebagai stream token demi token melalui SSE. | Uji dengan fixture provider yang mengirim potongan Unicode terbelah; teks akhir utuh, tidak ada token hilang/ganda. |
| REQ-NT-23 | P0 | Tombol Stop menghentikan generasi; sebagian output yang sudah diterima tetap tersimpan dan ditandai terhenti. | Stop saat streaming menyimpan partial dan menutup koneksi; tidak ada token tambahan setelah stop. |
| REQ-NT-24 | P0 | Regenerate membuat jawaban alternatif dari pesan pengguna yang sama; jawaban lama tetap dapat dipilih. | Dua sibling assistant; navigasi antar cabang mengubah isi yang ditampilkan dan konteks request berikutnya. |
| REQ-NT-25 | P0 | Edit pesan pengguna membuat cabang baru dari parent yang sama; mengirim ulang menghasilkan jawaban baru; cabang lama tetap ada. | Pohon pesan: sibling user; konteks request mengikuti cabang aktif saja. |
| REQ-NT-26 | P0 | Mengedit pesan pengguna yang sedang diproses ditolak dengan pesan jelas, kecuali generasi dibatalkan lebih dulu. | 409 dengan pesan yang dapat ditindaklanjuti. |
| REQ-NT-27 | P0 | Riwayat percakapan menjadi sumber kebenaran; memuat ulang halaman mempertahankan cabang aktif. | Reload mempertahankan leaf aktif. |
| REQ-NT-28 | P0 | Kegagalan provider (401, 429, timeout, koneksi putus) ditampilkan sebagai galat yang bisa ditindaklanjuti, dengan tombol Coba lagi. | Setiap jenis galat punya pesan dan tindakan; tidak ada kegagalan yang diam. |
| REQ-NT-29 | P1 | Judul chat dibuat otomatis dari pesan pertama, dapat diganti manual. | Judul otomatis muncul dalam beberapa detik; ganti manual menang. |
| REQ-NT-30 | P1 | Lanjutkan jawaban (continue) pada node assistant terpilih tanpa menghapus output lama. | Output lama tetap; tambahan menyambung. |
| REQ-NT-31 | P1 | Pesan sistem per chat (system prompt) dengan editor sederhana. | Pesan sistem dikirim sebagai peran sistem; tersimpan per chat. |

#### NT5 — Riwayat, pencarian, arsip, folder, berbagi

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-32 | P0 | Sidebar riwayat dikelompokkan per tanggal (Hari ini, Kemarin, 7 hari terakhir, Lebih lama), dengan pencarian teks. | Pengelompokan benar terhadap zona waktu pengguna; pencarian menyaring judul dan isi. |
| REQ-NT-33 | P0 | Ganti nama, hapus, dan pin chat. | Rename dengan Enter/Escape; hapus meminta konfirmasi; pin menaikkan posisi. |
| REQ-NT-34 | P0 | Arsip chat untuk menyembunyikan dari daftar utama tanpa menghapus. | Chat terarsip hilang dari daftar utama dan tampil di tampilan arsip. |
| REQ-NT-35 | P1 | Folder sederhana (satu tingkat) untuk mengelompokkan chat; memindahkan chat ke folder. | Buat/ubah/hapus folder; chat dapat dipindah; menghapus folder tidak menghapus chat. |
| REQ-NT-36 | P0 | Bagikan chat sebagai tautan publik hanya-baca berisi snapshot cabang aktif saat dibagikan. | Tautan publik menampilkan isi beku; perubahan chat setelahnya tidak mengubah tautan. |
| REQ-NT-37 | P0 | Pemilik dapat mencabut tautan berbagi; setelah dicabut tautan menampilkan 404. | Cabut berbagi langsung berlaku; tidak ada cache yang menampilkan snapshot lama. |
| REQ-NT-38 | P1 | Opsi kedaluwarsa tautan berbagi. | Tautan kedaluwarsa menampilkan halaman jelas. |
| REQ-NT-39 | P0 | Ekspor chat ke Markdown dan JSON; impor JSON dari ekspor Kawan. | Ekspor/impor round-trip mempertahankan isi dan struktur pohon. |
| REQ-NT-40 | P1 | Ekspor semua data pengguna (semua chat + pengaturan) dalam satu arsip. | Arsip dapat diunduh; tidak memuat kredensial. |
| REQ-NT-41 | P0 | Snapshot berbagi publik tidak pernah memuat kredensial, pesan sistem privat, atau metadata internal. | Uji canary: string rahasia tidak muncul di respons publik. |

#### NT6 — Render pesan dan lampiran

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-42 | P0 | Render markdown: heading, list, tabel, tautan, kutipan, blok kode dengan highlight dan tombol salin. | Snapshot render untuk tiap elemen; tombol salin menyalin isi. |
| REQ-NT-43 | P0 | Render matematika (KaTeX) inline dan blok. | Uji $...$ dan $$...$$. |
| REQ-NT-44 | P0 | Render aman: HTML mentah dari model disanitasi; skrip tidak dieksekusi. | Uji XSS: `<script>` tidak jalan; `onerror` tidak jalan. |
| REQ-NT-45 | P1 | Render diagram Mermaid dari blok kode `mermaid`. | Diagram tampil; blok tetap bisa disalin sebagai teks. |
| REQ-NT-46 | P0 | Lampirkan gambar ke pesan bila model mendukung visi. | Model tanpa visi tidak menampilkan tombol lampiran gambar. |
| REQ-NT-47 | P0 | Lampirkan dokumen (PDF, teks) untuk tanya jawab; lihat NT8. | Unggah memicu ingestion; status terlihat. |
| REQ-NT-48 | P1 | Pratinjau lampiran dan hapus lampiran sebelum kirim. | Pratinjau tampil; hapus sebelum kirim tidak mengunggah. |
| REQ-NT-49 | P1 | Mode gelap/terang/sistem; responsif untuk layar kecil. | Tema tersimpan; layout tidak rusak pada 360 px. |
| REQ-NT-50 | P1 | Composer: Enter kirim, Shift+Enter baris baru, dukungan IME. | Uji IME: Enter saat komposisi tidak mengirim. |

#### NT7 — Pencarian web (capability gated)

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-51 | P1 | Pencarian web dapat diaktifkan per pesan; bila tidak dikonfigurasi, tombol tidak ditampilkan (bukan ditampilkan mati). | Tanpa konfigurasi: tombol tidak ada; dengan konfigurasi: tombol ada dan berfungsi. |
| REQ-NT-52 | P1 | Hasil pencarian ditampilkan sebagai sumber yang dapat diklik pada jawaban. | Sumber muncul; tautan membuka tab baru dengan `noopener`. |
| REQ-NT-53 | P1 | Kegagalan mesin pencari tidak menggagalkan jawaban; jawaban tetap dikirim dengan catatan sumber tidak tersedia. | Uji: mesin pencari error → jawaban tetap ada. |

#### NT8 — Unggah dokumen dan tanya jawab RAG sederhana

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-54 | P0 | Unggah PDF dan teks; ekstraksi teks berjalan sebagai job dengan status terlihat (Menunggu, Memproses, Siap, Gagal). | Status transisi tercatat; gagal menampilkan sebab dan tombol coba lagi. |
| REQ-NT-55 | P0 | Potongan dokumen disimpan dengan metadata sumber (nama file, halaman/bagian, urutan). | Metadata tersimpan untuk setiap chunk. |
| REQ-NT-56 | P0 | Pencarian relevansi sederhana (embedding bila tersedia; fallback pencarian kata kunci) untuk mengambil potongan relevan. | Uji dengan dokumen fixture: potongan relevan terambil untuk pertanyaan yang diketahui. |
| REQ-NT-57 | P0 | Jawaban berbasis dokumen menyertakan sitasi ke sumber (nama file + halaman/bagian) yang dapat diklik untuk melihat potongan. | Sitasi ada; membuka sitasi menampilkan potongan sumber. |
| REQ-NT-58 | P0 | Dokumen terisolasi per pengguna; pencarian tidak pernah mengembalikan potongan milik pengguna lain. | Uji lintas pengguna: tidak ada kebocoran. |
| REQ-NT-59 | P1 | Hapus dokumen menghapus juga potongan dan embedding terkait. | Setelah hapus, pencarian tidak menemukan potongan; tidak ada file yatim. |
| REQ-NT-60 | P1 | Batas ukuran dan tipe file yang dapat dikonfigurasi; penolakan menjelaskan sebab. | Unggah melebihi batas ditolak dengan pesan jelas. |
| REQ-NT-61 | P1 | Bila embedding tidak dikonfigurasi, fitur tetap bekerja dengan pencarian kata kunci dan UI menjelaskan keterbatasannya. | Mode kata kunci aktif; teks penjelasan tampil. |

#### NT9 — Prompt tersimpan sederhana

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-62 | P1 | Pengguna dapat menyimpan prompt pribadi (judul + isi) dan memanggilnya dari composer. | Simpan/panggil/hapus prompt; isi tersalin ke composer. |
| REQ-NT-63 | P1 | Prompt dapat disisipkan variabel sederhana `{{isi}}` yang diisi saat dipakai. | Variabel diisi sebelum kirim; tidak ada placeholder tersisa. |
| REQ-NT-64 | P2 | Prompt bawaan yang dapat diaktifkan admin. | Admin dapat menambah/menonaktifkan prompt bawaan. |

#### NT10 — Kemampuan media (capability gated)

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-65 | P1 | Generasi gambar bila gateway mengumumkan endpoint gambar; tombol tersembunyi bila tidak tersedia. | Tanpa endpoint gambar: tombol tidak ada. Dengan: gambar dihasilkan dan dapat diunduh. |
| REQ-NT-66 | P1 | Analisis gambar (vision) bila model mendukung. | Model tanpa visi: lampiran gambar tidak ditawarkan. |
| REQ-NT-67 | P1 | Transkripsi audio (STT) bila dikonfigurasi; unggah audio menjadi teks di composer. | Tanpa konfigurasi: kontrol tidak tampil. Dengan: audio menjadi teks. |
| REQ-NT-68 | P2 | Text-to-speech membacakan jawaban bila dikonfigurasi. | Tombol baca tampil hanya bila tersedia. |
| REQ-NT-69 | P0 | Fitur yang tidak tersedia di gateway aktif tidak ditampilkan sebagai kontrol mati; UI menjelaskan bahwa kemampuan bergantung gateway. | Uji capability matrix: tidak ada kontrol inert. |

#### NT11 — Pengaturan pribadi dan pemakaian (non-billing)

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-70 | P0 | Pengaturan pribadi: tema, bahasa, ukuran font, preferensi kirim. | Perubahan berlaku langsung dan tersimpan. |
| REQ-NT-71 | P0 | Halaman Pemakaian menampilkan pemakaian token dari respons gateway (prompt/completion/total) per hari dan per model, bila gateway melaporkannya. | Bila usage tidak dilaporkan, UI menampilkan "tidak tersedia", bukan angka nol yang menyesatkan. |
| REQ-NT-72 | P0 | Tidak ada harga, saldo, atau klaim biaya. | Tidak ada string mata uang/harga di UI pemakaian. |
| REQ-NT-73 | P1 | Ekspor data pemakaian ke CSV. | CSV dapat diunduh dengan kolom yang jelas. |

#### NT12 — Admin dasar dan privasi

| ID | Prio | Requirement | Acceptance ringkas |
|---|---|---|---|
| REQ-NT-74 | P0 | Admin melihat daftar pengguna (email, status, tanggal daftar), dapat menonaktifkan/mengaktifkan akun. | Nonaktif tidak bisa login; sesi aktif dicabut. |
| REQ-NT-75 | P0 | Admin dapat menghapus akun beserta data pribadinya (chat, dokumen, koneksi). | Setelah hapus, tidak ada data tersisa yang dapat dikaitkan; uji lintas tabel. |
| REQ-NT-76 | P0 | Admin dapat menonaktifkan registrasi publik. | Dengan registrasi tertutup, halaman daftar menjelaskan dan tidak menerima pendaftaran. |
| REQ-NT-77 | P1 | Admin dapat melihat ringkasan sistem: versi, status database, status worker, jumlah pengguna/chat. | Halaman status memuat tanpa memblokir bila komponen opsional mati. |
| REQ-NT-78 | P0 | Log dan pesan galat tidak memuat kredensial, key, atau isi prompt pengguna secara default. | Uji canary: string rahasia tidak muncul di log. |
| REQ-NT-79 | P1 | Halaman kebijakan privasi yang menjelaskan apa yang disimpan dan di mana. | Halaman ada dan dapat ditautkan. |

### 7.3 Alur pengguna kunci

**Alur A — Pengguna baru sampai chat pertama.**
1. Buka aplikasi → halaman masuk/daftar.
2. Daftar dengan email dan sandi → sesi dibuat.
3. Tidak ada koneksi aktif → layar Hubungkan Gateway.
4. Isi Nama ("Gateway Saya"), Base URL (`https://api.tokengateway.ai.id/v1`), API Key.
5. Tekan Test koneksi → server memanggil `/models` → sukses, "12 model ditemukan".
6. Simpan → koneksi aktif → diarahkan ke chat, model pertama terpilih.
7. Kirim pesan pertama → jawaban streaming.

*Keadaan gagal:* Test gagal karena 401 → pesan "Key ditolak oleh gateway. Periksa kembali." + CTA tokengateway. Timeout → "Gateway tidak merespons dalam 10 detik." DNS → "Alamat gateway tidak ditemukan."

**Alur B — Edit dan regenerate dengan cabang.**
1. Pengguna punya percakapan A→B→C (A user, B assistant, C user).
2. Edit pesan A menjadi A' → A' menjadi sibling A; B dan C tetap ada di cabang lama.
3. Kirim A' → B' assistant baru.
4. Regenerate B' → B'' sibling.
5. Pengguna berpindah antar cabang dengan panah kiri/kanan; konteks request berikutnya hanya memuat ancestry cabang aktif.

**Alur C — Unggah dokumen dan tanya jawab.**
1. Lampirkan `laporan.pdf` → job ekstraksi dibuat, status "Memproses".
2. Status "Siap" → pengguna bertanya "Apa kesimpulan laporan ini?"
3. Server mengambil potongan relevan → mengirim konteks + pertanyaan ke model.
4. Jawaban memuat sitasi [1] `laporan.pdf hlm. 3`; klik sitasi menampilkan potongan.

**Alur D — Berbagi dan mencabut.**
1. Buka menu chat → Bagikan → tautan `.../share/<token>` dibuat (snapshot cabang aktif).
2. Pengguna lain membuka tautan tanpa login → melihat isi beku hanya-baca.
3. Pemilik mengubah chat → tautan tidak berubah.
4. Pemilik mencabut → tautan menampilkan 404.

**Alur E — Admin menghapus pengguna.**
1. Admin buka daftar pengguna → pilih pengguna → Hapus.
2. Konfirmasi yang menyebutkan apa yang akan dihapus.
3. Sistem menghapus chat, dokumen, koneksi, sesi pengguna tersebut.
4. Uji: tidak ada baris tersisa yang dapat dikaitkan ke pengguna.

### 7.4 Acceptance dan definisi selesai produk

- Semua requirement P0 memiliki test otomatis yang lulus dan tercatat di `coverage.md` dan `plan.md`.
- Requirement P1 yang tidak selesai dipindahkan ke P2 dengan catatan, bukan ditandai selesai diam-diam.
- Semua alur A–E lulus pada uji end-to-end dengan data sintetis.
- Pemeriksa konsistensi dokumen (`tools/check_docs.py`) lulus.
- Tidak ada kontrol inert; capability matrix menegakkan hal ini (REQ-NT-69).
- Tidak ada klaim ChatGPT identik atau 100% Open WebUI di UI, dokumen, atau materi rilis.

## 8. Rilis

### 8.1 Keputusan default (bukan pertanyaan terbuka)

Default berikut dipilih agar pekerjaan tidak tertahan. Perubahan memerlukan keputusan pemilik produk dan dicatat sebagai revisi dokumen.

| Area | Keputusan default | Alasan |
|---|---|---|
| Model kredensial | Mode server (terenkripsi AES-256-GCM) sebagai default; Direct ditunda | Brief meminta default server; kejujuran soal key lebih mudah dijaga pada satu jalur |
| Database dev | SQLite | Self-host sederhana |
| Database prod | PostgreSQL | Kebutuhan produksi; SQLite untuk pengguna tunggal tetap didukung |
| Deployment | Satu instance aplikasi + satu worker + Postgres (opsional) + penyimpanan lokal/objek | Menghindari Redis/orkestrasi sampai terbukti perlu |
| Bahasa UI default | Indonesia | Target nonteknis lokal |
| Fitur RAG | Embedding bila dikonfigurasi; fallback kata kunci | Agar fitur tetap bekerja tanpa mesin embedding |
| Pencarian web | Nonaktif secara default; aktif bila dikonfigurasi | Menghindari panggilan keluar tak terduga |
| Generasi gambar/audio | Nonaktif secara default; aktif bila gateway mendukung | Capability gated |
| Multi-node/Redis | Ditunda | YAGNI sampai ada bukti beban |
| Baseline referensi | Dipin pada `f8ae8a6c328946dc62cd0712961a0632574581bf`, bukan `main` | Menghindari perubahan tak terduga |

### 8.2 Fase rilis

| Fase | Isi | Gate keluar |
|---|---|---|
| v1.0-alpha | NT1–NT4 (onboarding, auth, koneksi, chat inti) | Semua P0 NT1–NT4 lulus; alur A dan B lulus E2E |
| v1.0-beta | NT5–NT8, NT10 (riwayat/berbagi, render, web search, RAG, media) | P0 NT5–NT8 lulus; alur C dan D lulus |
| v1.0 | NT9, NT11, NT12 (prompt, pengaturan, admin) + pengerasan | Semua P0 lulus; pemeriksa konsistensi lulus; review keamanan selesai |
| v1.1 | P1 tersisa, mode Direct, MCP bila esensial | Keputusan pemilik produk |

### 8.3 Risiko rilis

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Key bocor lewat log/ekspor | Kepercayaan hancur | Uji canary secret di CI; redaksi terpusat |
| Kualitas jawaban dokumen buruk | Fitur dianggap rusak | Fixture dokumen tetap untuk regresi; sitasi diuji |
| Gateway pengguna bervariasi | Banyak jalur gagal | Normalisasi URL + pesan galat spesifik + fallback model |
| Scope merembet ke full parity | Rilis mundur | `coverage.md` sebagai kontrak; perubahan scope butuh keputusan pemilik |
| Dokumen dan kode menyimpang | Implementer salah arah | Pemeriksa konsistensi di CI; review per fase |

### 8.4 Pertanyaan terbuka

| Pertanyaan | Pemilik | Tenggat | Default sementara |
|---|---|---|---|
| Apakah email reset sandi dikonfigurasi pada rilis pertama? | Pemilik produk | Sebelum v1.0-beta | Tautan reset ditampilkan ke admin bila SMTP belum ada |
| Mesin embedding mana yang menjadi rujukan uji? | Mandor teknis | Sebelum v1.0-beta | Fallback kata kunci diuji lebih dulu |
| Apakah repo publik Kawan sudah ada? | Pemilik produk | Sebelum rilis | Metadata About memakai nilai konfigurasi env, bukan URL karangan |
| Batas ukuran unggahan default? | Pemilik produk | Sebelum v1.0-beta | 25 MB per file |
