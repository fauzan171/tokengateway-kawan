# Handoff prompts — Kawan (scope nontechnical-v1)

Status: dokumen bantu. Bukan bagian rantai otoritas (PRD → SDD → plan → execution-prompt).
Isinya empat prompt siap tempel untuk agen lain, plus satu putusan kelayakan.

Dibuat: 2026-10-16, setelah gate NT-P0 lulus.

---

## 0. Putusan kelayakan (jawaban pertanyaan 2)

**SDD lengkap untuk lingkup yang dinyatakan? Ya.** Semua REQ-NT punya penempatan di
`coverage.md`, keputusan arsitektur terkunci di tabel SDD-10, dan non-goal ditulis eksplisit
di PRD §4.2. Yang tersisa bukan "kurang dokumen", melainkan empat pertanyaan terbuka PRD §8.4
yang memang menunggu pemilik produk (SMTP, mesin embedding acuan, keberadaan repo publik
Kawan, batas ukuran unggah).

**Siap jadi Manus? Tidak, dan itu bukan cacat.** Ini pertentangan arah, bukan kesenjangan
dokumen. Manus adalah agen otonom: eksekusi kode di sandbox, otomasi browser, orkestrasi
multi-agen, VM per sesi. Kawan mengecualikan tepat hal itu di tiga tempat:

- PRD §4.2 butir 6 — "Eksekusi kode arbitrer, terminal, plugin Python, worker otonom,
  subagent, pipeline evaluator" dinyatakan di luar lingkup.
- SDD-1.1 — prinsip "tanpa eksekusi kode, tanpa plugin Python, tanpa terminal".
- SDD-10 baris terakhir — keputusan "Tanpa eksekusi kode/plugin/terminal" dengan kondisi
  peninjauan "bila segmen teknis menjadi prioritas dan kontrol sandbox tersedia".

Menambah jalur Manus berarti mengubah PRD, bukan menambah dokumen. Itu keputusan pemilik
produk. Prompt di bagian 3 disiapkan untuk itu; jangan jalankan sebelum keputusan diambil.

---

## 1. Prompt agar Hermes menguasai proyek

```
Kamu akan mengambil alih proyek "Kawan" — aplikasi chat AI yang bisa di-self-host, untuk
pengguna nonteknis, memakai gateway tokengateway.ai.id sebagai sponsor. Kerjakan bagian
"Baca dulu" sampai selesai sebelum menyentuh kode apa pun. Jangan menulis kode pada balasan
pertama.

Repositori: /Users/mekari/tokengateway/tokengateway-chat
Paket dokumen aktif: tasks/nontechnical-v1/ (README.md, prd.md, sdd.md, plan.md, coverage.md,
execution-prompt.md, verification.md).

Urutan otoritas: instruksi terbaru pemilik produk → prd.md → sdd.md → plan.md →
execution-prompt.md. Bila dua dokumen bertentangan, yang lebih tinggi menang dan kamu
melaporkan pertentangannya, bukan memilih diam-diam.

Baca dulu, berurutan:
1. tasks/nontechnical-v1/README.md — baseline repo acuan (open-webui, commit terpin) dan
   aturan lisensi. Paket full-parity lama di tasks/prd.md, tasks/plan.md, tasks/sdd/,
   tasks/todo.md adalah referensi alternatif, bukan task aktif.
2. prd.md — kebutuhan, non-goal §4.2, metrik §4.3, default §8.1, fase §8.2, pertanyaan
   terbuka §8.4.
3. sdd.md — desain. Perhatikan terutama: SDD-1.1 (lima prinsip, termasuk "satu basis kode,
   satu image; worker = entry point berbeda dari image yang sama" dan larangan eksekusi
   kode), SDD-2 (skema tabel inti, termasuk Session dan ShareLink), SDD-3 (kontrak endpoint,
   termasuk aturan lintas endpoint §3.8), SDD-4 (lifecycle SSE, resume, cancel, idempotensi),
   SDD-5 (auth, envelope enkripsi kredensial, kebijakan egress SSRF, penanganan galat
   provider), SDD-6 (unggah, dokumen, RAG, keamanan konten), SDD-7 (frontend, aksesibilitas,
   mobile, bahasa, branding), SDD-8 (job, worker, operasional), SDD-9 (pengujian dan gate),
   SDD-10 (tabel keputusan dan kondisi peninjauan).
4. plan.md — fase NT-P0 sampai NT-P10, work package per fase, dependency, gate per fase.
5. coverage.md — pemetaan REQ-NT ke WP.
6. execution-prompt.md — peran mandor dan worker, aturan commit, bentuk laporan.

Setelah membaca, laporkan ringkas:
- Lima prinsip SDD-1.1 dengan kata sendiri.
- Isi non-goal PRD §4.2 yang paling menentukan bentuk produk.
- Fase mana yang sedang berjalan, WP mana yang berikutnya, dan dependency apa yang harus
  sudah lulus sebelum WP itu boleh dibuka.
- Satu kontrak yang dibekukan setelah NT-P2 dan konsekuensi bila bentuknya berubah setelah
  NT-P3 mulai.
- Empat pertanyaan terbuka PRD §8.4 dan siapa pemilik masing-masing.
- Satu keputusan SDD-10 beserta kondisi peninjauannya.

Aturan kerja yang berlaku terus:
- Bahasa percakapan dengan pemilik produk: Indonesia, ringkas. Bahasa berkas yang ditulis ke
  disk (kode, komentar, commit, dokumen, prompt): prosa normal, bukan ringkas.
- Satu basis kode, satu image. Worker dijalankan sebagai entry point berbeda dari image yang
  sama. Jangan menambah Redis di v1.
- Jangan menambah abstraksi yang tidak diminta, jangan menulis scaffolding "untuk nanti".
- Jangan pernah `git add .`. Commit memakai daftar path eksplisit.
- Worker tidak push. Push hanya dilakukan setelah gate fase lulus.
- Tidak ada dua worker menyentuh berkas yang sama pada waktu bersamaan.

Jangan mulai mengerjakan WP apa pun pada balasan ini. Tunggu sampai pemilik produk
menyetujui ringkasanmu.
```

---

## 2. Prompt agar Hermes melanjutkan pekerjaan (jalur Kawan, dipakai sekarang)

```
Lanjutkan proyek "Kawan" di /Users/mekari/tokengateway/tokengateway-chat.
Paket dokumen aktif: tasks/nontechnical-v1/. Urutan otoritas: instruksi terbaru pemilik
produk → prd.md → sdd.md → plan.md → execution-prompt.md.

Repositori sudah di GitHub: https://github.com/fauzan171/tokengateway-kawan.git
(branch default `main`). Clone bila kamu bekerja di mesin lain.

Keadaan saat ini:
- Fase NT-P0 (Fondasi) selesai; WP-NT-P0-01 sampai WP-NT-P0-07 lulus; gate NT-P0 lulus
  pada 2026-10-16 (typecheck, lint, test, build, uji klaim antrean, fixture provider).
  Bukti per WP ada di laporan mandor, bukan di plan.md.
- WP-NT-P1-01 sudah dikerjakan dan di-push (commit `4bab04a`). Isinya fondasi auth di
  `src/lib/auth/`: `password.ts` (Argon2id), `users.ts` (buat akun + admin pertama di satu
  transaksi), `session-store.ts` (buku besar sesi untuk pencabutan; tabel hanya menyimpan
  SHA-256 id sesi), `session.ts` (konfigurasi Auth.js, strategi JWT, callback `jwt` memuat
  ulang role/status dari database).
  Verifikasi yang sudah lulus: `npm run typecheck`, `npm run lint`, `npm test` (42 lulus),
  `npm run build`.
- Yang **belum** ada dari NT-P1-01, dan harus kamu tutup sebelum menganggap WP ini selesai:
  route handler Auth.js (`src/app/api/auth/[...nextauth]/route.ts`), dan unit test untuk
  keempat berkas auth (termasuk bukti admin pertama atomik di bawah dua transaksi bersamaan,
  serta `isSessionValid` menolak token yang dicabut dan token milik pengguna lain).
- plan.md baris status belum diperbarui untuk NT-P1-01. Perbarui.

Tugasmu sekarang:
1. Baca prd.md bagian auth dan akun, sdd.md SDD-5.1 dan SDD-7.2, coverage.md untuk REQ-NT
   yang bertanda NT-P1, dan plan.md blok NT-P1. Baca juga execution-prompt.md bagian 2
   (peran) dan bagian 6 (commit dan push).
2. Periksa dulu apa yang sudah ada di `src/lib/auth/` sebelum menugaskan apa pun. Jangan
   menyuruh worker menulis ulang berkas yang sudah lulus verifikasi.
3. Tentukan WP NT-P1 mana yang ready: dependency lulus, DoR terpenuhi, kontrak tidak sedang
   berubah. Urutan ketergantungan: WP-NT-P1-01 (Auth.js Credentials + User/Credential/Session
   + cookie HttpOnly/SameSite + Argon2id) membuka jalan; WP-NT-P1-02 (admin pertama, atomik)
   bergantung pada 01 — perhatikan bahwa logika admin pertama sudah ada di `users.ts`, jadi
   sisa WP-NT-P1-02 mungkin hanya bukti/pengujian, bukan penulisan ulang; WP-NT-P1-03 sampai
   06 boleh paralel setelah 01.
4. Pecah WP menjadi child work package bila menyentuh lebih dari 5 berkas inti atau lebih
   dari satu subsistem.
5. Tugaskan worker dengan batas eksplisit: berkas yang boleh disentuh, kontrak yang dipakai,
   perintah verifikasi. Jangan biarkan dua worker menyentuh berkas yang sama.
6. Setelah semua WP NT-P1 selesai, jalankan gate NT-P1: alur daftar → masuk → keluar lulus
   end-to-end, admin pertama terbukti atomik, cookie HttpOnly/SameSite terverifikasi.
7. Setelah gate lulus: commit dengan daftar path eksplisit (jangan pernah `git add .`),
   lalu push. Worker tidak push; kamu yang push.
8. Perbarui status di plan.md dan tulis laporan mandor dengan bukti per WP.

Peringatan kontrak: NT-P2 dan NT-P3 berbagi kontrak koneksi. Bentuk Connection dan ModelCache
dibekukan di akhir NT-P2. Mengubahnya setelah NT-P3 mulai memaksa penulisan ulang pemilih
model. Jangan mengubah bentuk itu selama NT-P2 tanpa keputusan pemilik produk.

Jangan membuka fase berikutnya tanpa perintah pemilik produk. Setiap fase dibuka terpisah
kecuali pemilik produk memerintahkan "lanjut semua fase" dengan checkpoint.
```

---

## 3. Prompt agar agen kode menyusun dokumen lebih rinci

Pakai hanya bila dokumen dianggap kurang rinci untuk pekerjaan yang akan datang. Ini menambah
rincian pada lingkup yang sudah ada; ia tidak mengubah arah produk.

```
Proyek "Kawan" di /Users/mekari/tokengateway/tokengateway-chat sudah punya paket dokumen di
tasks/nontechnical-v1/ (prd.md, sdd.md, plan.md, coverage.md). Lingkupnya tidak berubah.
Tugasmu menambah rincian yang masih kurang, bukan menulis ulang atau memperluas lingkup.

Yang kurang dan perlu ditambah:
1. Bentuk JSON permintaan dan respons per endpoint untuk endpoint di SDD-3, bukan hanya
   contoh payload onboarding yang sekarang ada satu-satunya. Sertakan bentuk galat yang
   seragam dan arti tiap kode status.
2. Kontrak SSE di SDD-4.4 sampai SDD-4.7: nama event, bentuk data, arti tiap event, dan
   aturan urutannya saat resume dan cancel.
3. Skema tabel lengkap untuk Chat, ChatMessage, ChatMessagePart, Connection, ModelCache,
   Document, DocumentChunk, UsageRecord — nama kolom, tipe, indeks, dan relasi. Sekarang
   SDD-2 baru menyebut sebagian.
4. Bentuk laporan mandor dan daftar perintah verifikasi per gate fase, supaya bentuk bukti
   seragam antar fase.

Batas:
- Jangan mengubah non-goal PRD §4.2. Jangan menambah eksekusi kode, terminal, plugin Python,
  worker otonom, subagent, atau pipeline evaluator.
- Jangan menambah Redis di v1. Jangan menambah layanan baru di luar SDD-1.1.
- Jangan mengubah keputusan di SDD-10 tanpa menandainya sebagai usulan perubahan beserta
  alasan dan kondisi peninjauan.
- Tulis dalam prosa normal, bahasa Indonesia, bergaya sama dengan sdd.md yang ada.
- Setiap rincian baru harus bisa dilacak ke REQ-NT atau ke keputusan SDD-10. Bila tidak bisa,
  jangan tulis; laporkan sebagai pertanyaan terbuka.
- Setelah selesai, jalankan tools/check_docs.py dan laporkan hasilnya apa adanya.
```

---

## 4. Prompt untuk membuka jalur Manus (hanya setelah keputusan pemilik produk)

Jangan jalankan sebelum pemilik produk memutuskan mengubah arah. Prompt ini menyentuh PRD,
dan itu wewenang pemilik produk.

```
Pemilik produk memutuskan Kawan memperluas arah ke kemampuan agen otonom setara Manus:
eksekusi kode di sandbox, otomasi browser, tugas panjang asinkron, orkestrasi multi-agen,
dan pengiriman artefak. Ini membatalkan sebagian non-goal PRD §4.2 butir 6 dan keputusan
SDD-10 baris "Tanpa eksekusi kode/plugin/terminal".

Kerjakan sebagai perubahan dokumen dulu, bukan kode:
1. Ajukan revisi PRD §4.2: butir mana yang dihapus, mana yang dipersempit, mana yang tetap
   dilarang (mis. eksekusi tanpa sandbox tetap dilarang).
2. Ajukan revisi SDD-1.1: prinsip batas proses harus berubah karena sandbox eksekusi adalah
   batas kepercayaan baru, bukan sekadar perbedaan sumber daya.
3. Ajukan keputusan baru di SDD-10: teknologi sandbox, isolasi jaringan, batas waktu dan
   memori per tugas, dan kondisi peninjauannya.
4. Ajukan fase baru di plan.md setelah NT-P10, dengan work package, dependency, dan gate.
   Sandbox dan otomasi browser tidak boleh masuk sebagai WP paralel di dalam fase lama.
5. Ajukan perubahan metrik PRD §4.3: metrik "kesalahan stream tak pulih" dan "overhead relay"
   tidak cukup untuk mengukur tugas otonom; usulkan metrik tingkat keberhasilan tugas dan
   waktu penyelesaian.
6. Tandai setiap perubahan sebagai usulan dengan alasan dan dampak biaya operasional.
   Jangan menulis kode sampai pemilik produk menyetujui revisi dokumen.
```
