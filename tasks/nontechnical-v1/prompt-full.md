# Prompt eksekusi penuh — Kawan sampai 100%

> Arah produk diperbarui 17 Oktober 2026: baca [scope aktif](../ACTIVE-SCOPE.md) terlebih dahulu. Keputusan agen, prioritas, dan pengurangan scope di sana mengesampingkan bagian lama yang bertentangan.

Status: dokumen bantu, bukan bagian rantai otoritas.
Dibuat: 2026-10-17, setelah audit branch `feat/nt-p1-auth`. Diperbarui 2026-10-17 setelah
konsolidasi selesai dan dokumen basi dibersihkan.

Dipakai setelah pemilik produk memerintahkan "lanjutkan sampai selesai". Prompt membuka
seluruh sisa fase sekaligus, tetapi tetap dengan checkpoint: satu fase tidak boleh dibuka
sebelum gate fase sebelumnya lulus dan dilaporkan.

---

## Prompt

```
Kamu melanjutkan proyek "Kawan" di /Users/mekari/tokengateway/tokengateway-chat sampai
seluruh lingkup tasks/nontechnical-v1/ selesai 100%. Pemilik produk sudah memberi perintah
"lanjut sampai selesai", jadi kamu tidak perlu menunggu izin per fase — tetapi kamu tetap
wajib berhenti di setiap gate fase, menjalankan verifikasinya, dan melaporkan hasilnya
sebelum membuka fase berikutnya.

Urutan otoritas: instruksi terbaru pemilik produk -> prd.md -> sdd.md -> plan.md ->
execution-prompt.md. Bila dua dokumen bertentangan, yang lebih tinggi menang dan kamu
melaporkan pertentangannya, bukan memilih diam-diam.

## Baca dulu, sebelum menyentuh kode

1. tasks/nontechnical-v1/prd.md — kebutuhan, non-goal §4.2, metrik §4.3, default §8.1,
   fase §8.2, pertanyaan terbuka §8.4.
2. tasks/nontechnical-v1/sdd.md — SDD-1.1 (lima prinsip), SDD-2 (skema), SDD-3 (kontrak
   endpoint), SDD-4 (lifecycle SSE, resume, cancel, idempotensi), SDD-5 (auth, enkripsi,
   egress SSRF, galat provider), SDD-6 (unggah, dokumen, RAG), SDD-7 (frontend,
   aksesibilitas, mobile, bahasa), SDD-8 (job, worker, operasional), SDD-9 (pengujian dan
   gate), SDD-10 (keputusan dan kondisi peninjauan).
3. tasks/nontechnical-v1/plan.md — daftar WP per fase. Ini daftar kerja yang harus habis.
4. tasks/nontechnical-v1/coverage.md — setiap REQ-NT harus punya WP pemilik. Bila ada REQ
   tanpa WP, laporkan sebelum mulai.
5. tasks/nontechnical-v1/verification.md dan execution-prompt.md — bentuk bukti, peran,
   aturan commit.
6. tasks/nontechnical-v1/handoff-prompts.md §4 (riwayat transisi agen).

Jangan menulis kode pada balasan pertama. Laporkan dulu ringkasan pemahaman dan daftar WP
yang akan dikerjakan, per fase.

## Keadaan yang terverifikasi saat prompt ini dibuat

Verifikasi ulang semuanya sebelum mulai; jangan percaya bagian ini buta.

- `main` = `ad32864` (`merge: NT-P1 auth and NT-P2/NT-P3 chat backend`). NT-P1, NT-P2, dan
  hampir seluruh NT-P3 sudah di-merge. Tahap 0 di bawah sudah dikerjakan.
- Backend NT-P3 sudah ada dan punya tes: chats, messages, tree, generate, stream-parse,
  sse, start-generation, stop, regenerate, edit, continue, system-prompt, title, usage.
- Route NT-P3 sudah ada semua di src/app/api/kawan/v1/chat/**.
- `GET /api/kawan/v1/models` ada dan lulus tes, tetapi TIDAK ADA komponen yang memanggilnya.
- `src/components/chat-view.tsx` hanya punya kirim dan stop. Tidak ada edit, regenerate,
  continue, pemilih cabang, pesan sistem, ganti judul, pemilih model, maupun tombol coba
  lagi.
- Konsolidasi 17 Oktober 2026: generasi memakai `recordUsage` dari `src/lib/chat/usage.ts`; implementasi duplikat di generate.ts dihapus.
- README.md, plan.md, dan handoff-prompts.md sudah diselaraskan dengan keadaan `main`;
  teks "fitur chat belum tersedia" di src/app/page.tsx sudah diganti.
- .github/workflows/ci.yml tidak punya job e2e. Snapshot Playwright darwin-only.
- NT-P4 sampai NT-P10 belum ada satu baris pun.

## Aturan kerja yang berlaku terus

- Satu basis kode, satu image. Worker = entry point berbeda dari image yang sama.
- Jangan menambah Redis di v1. Jangan menambah layanan baru di luar SDD-1.1.
- Jangan menambah abstraksi yang tidak diminta. Jangan menulis scaffolding "untuk nanti".
- Jangan pernah `git add .`. Commit memakai daftar path eksplisit.
- Worker tidak push. Push hanya setelah gate fase lulus, dan hanya kamu yang push.
- Tidak ada dua worker menyentuh berkas yang sama pada waktu bersamaan.
- Bahasa percakapan dengan pemilik produk: Indonesia, ringkas. Bahasa berkas yang ditulis
  ke disk (kode, komentar, commit, dokumen): prosa normal.
- Setiap WP non-trivial meninggalkan satu bukti yang bisa dijalankan (assert-based
  self-check atau satu berkas tes kecil), tanpa framework baru.
- Jangan pernah menyederhanakan: validasi input di batas kepercayaan, penanganan galat yang
  mencegah kehilangan data, keamanan, aksesibilitas.

## Urutan kerja

### Tahap 0 — Konsolidasi (wajib pertama)

1. Konsolidasi historis sudah selesai. Periksa git status/log; jangan mengulang merge branch lama.
2. Selesaikan konflik. Setelah merge, jalankan ulang seluruh verifikasi di atas main:
   `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`,
   `node scripts/check-migrations.mjs`, `npx prisma migrate deploy` untuk SQLite dan
   PostgreSQL.
3. Perbaiki tiga dokumen basi sekaligus, karena semuanya menyangkut keadaan repo:
   - README.md:9 — nyatakan fase yang benar-benar selesai dan fitur yang benar-benar ada.
   - plan.md:3 — samakan dengan header bagian NT-P1 yang menyatakan fase SELESAI; hapus
     kontradiksi internal.
   - handoff-prompts.md §2 — hapus klaim bahwa route handler Auth.js dan unit test auth
     belum ada; keduanya sudah ada.
4. Hapus atau sambungkan teks "fitur chat belum tersedia" / "Koneksi menyusul" /
   "Versi 0.1.0 — fondasi antarmuka" di src/app/page.tsx.
5. Gate tahap 0: seluruh perintah di butir 2 lulus, tidak ada dokumen yang menyatakan fase
   belum selesai padahal sudah. Laporkan.

### Tahap 1 — Menutup NT-P3

Kerjakan berurutan, satu worker per berkas.

1. WP-NT-P3-15 — konsolidasi selesai 17 Oktober 2026: generate.ts memakai recordUsage dari usage.ts. Jangan menghapus implementasi yang kini dipakai generasi. Bukti pada laporan audit scope dan test generate/usage.
2. WP-NT-P2-08 — pemilih model di UI. Komponen memanggil `GET /api/kawan/v1/models`,
   menampilkan daftar model dari koneksi aktif, dan mengirim `modelRef` saat membuat chat.
   Tanpa ini `Chat.modelRef` selalu null dan generate.ts selalu memakai DEFAULT_MODEL.
3. WP-NT-P2-09 — matriks kapabilitas. Model yang tidak mendukung gambar/alat tidak boleh
   ditawarkan pada fitur yang membutuhkannya. Minimal: tandai kapabilitas di data model dan
   pakai untuk menyaring pilihan.
4. WP-NT-P3-11 (sisa) — UI lengkap: edit pesan, regenerate, continue, pemilih cabang
   (sibling), pesan sistem, ganti judul manual. Semua route-nya sudah ada; tugasmu
   menyambungkan, bukan menulis ulang backend.
5. WP-NT-P3-14 — pemetaan galat provider di UI. Setiap jenis galat (kredensial ditolak,
   kuota habis, model tidak ada, jaringan putus, galat server) punya pesan yang bisa
   dimengerti pengguna nonteknis dan tombol coba lagi yang mengulang permintaan yang sama.
   Jangan menampilkan kode galat mentah ke pengguna.
6. Gate NT-P3: kirim, stream, resume setelah putus, stop, regenerate, edit, continue,
   pilih cabang, ganti model, ganti judul — semuanya lulus lewat HTTP dan lewat UI. Jalankan
   scripts/e2e_kawan.py dan perluas bila ada alur yang belum tercakup. Laporkan bukti per WP.

### Tahap 2 — NT-P4: riwayat, folder, berbagi, ekspor

WP-NT-P4-01 sampai 10 sesuai plan.md: daftar dan paginasi percakapan, pencarian, folder dan
pemindahan, ganti judul, hapus dan arsip, tautan berbagi dengan masa berlaku dan pencabutan,
ekspor Markdown, ekspor JSON, impor, dan UI-nya.

Perhatikan keamanan: tautan berbagi harus punya token yang tidak bisa ditebak, bisa
dicabut, dan punya masa berlaku. Ekspor tidak boleh membocorkan kredensial atau data
pengguna lain.

Gate NT-P4: percakapan bertahan setelah reload, paginasi tidak kehilangan pesan, tautan
berbagi mati setelah dicabut dan setelah kedaluwarsa, ekspor-impor round-trip menghasilkan
isi yang sama.

### Tahap 3 — NT-P5: render dan lampiran

WP-NT-P5-01 sampai 10: render Markdown dengan sanitasi, highlight kode, KaTeX, Mermaid,
lampiran gambar, penanganan IME di composer, serta audit aksesibilitas dan mobile.

Sanitasi bukan opsional: keluaran model adalah input tidak tepercaya. Setiap HTML dari
model harus lewat sanitizer dengan daftar tag dan atribut yang eksplisit.

Gate NT-P5: uji injeksi XSS lewat keluaran model tidak tereksekusi; markdown rusak tidak
membuat UI hancur; IME (komposisi) tidak terkirim setengah jadi; navigasi keyboard penuh;
layout 360px tidak overflow.

### Tahap 4 — NT-P6: dokumen dan RAG

WP-NT-P6-01 sampai 10: unggah dokumen, validasi tipe dan ukuran, chunking, embedding,
penyimpanan vektor, retrieval, penyisipan konteks ke prompt, sitasi, dan UI-nya.

Pertanyaan terbuka PRD §8.4 (mesin embedding acuan, batas ukuran unggah) harus dijawab
pemilik produk sebelum WP embedding dibuka. Bila belum dijawab, kerjakan bagian yang tidak
bergantung padanya dan laporkan yang tertahan.

Gate NT-P6: dokumen besar tidak menghabiskan memori, retrieval hanya mengambil dokumen milik
pengguna yang sama, sitasi menunjuk sumber yang benar.

### Tahap 5 — NT-P7: pencarian web dan prompt tersimpan

WP-NT-P7-01 sampai 06. Pencarian web harus lewat kebijakan egress SSRF yang sama dengan
panggilan provider. Prompt tersimpan per pengguna, bisa dibuat, dipakai, diubah, dihapus.

Gate NT-P7: permintaan ke alamat internal ditolak, hasil pencarian diberi atribusi,
prompt tersimpan tidak terlihat oleh pengguna lain.

### Tahap 6 — NT-P8: media, vision, audio

WP sesuai plan.md. Hormati matriks kapabilitas dari Tahap 1: model tanpa vision tidak boleh
menerima gambar.

Gate NT-P8: unggahan ditolak bila model tidak mendukung; berkas besar dan tipe tidak dikenal
ditolak dengan pesan jelas.

### Tahap 7 — NT-P9: pengaturan, pemakaian, admin

WP sesuai plan.md: halaman pengaturan akun, pengelolaan koneksi, ringkasan pemakaian dari
UsageRecord, dan tampilan admin (pengguna, status, pencabutan sesi).

Gate NT-P9: pengguna biasa tidak bisa membuka tampilan admin; pencabutan sesi langsung
berlaku; angka pemakaian cocok dengan baris UsageRecord.

### Tahap 8 — NT-P10: hardening dan rilis

WP sesuai plan.md: audit keamanan, pengecekan kebocoran rahasia di log, rate limit,
penanganan galat terpusat, dokumentasi operasional, dan rilis.

Gate NT-P10: seluruh suite lulus, tidak ada rahasia di log, README akurat, tag rilis dibuat.

### Tahap 9 — CI dan penutup

1. Tambahkan job e2e ke .github/workflows/ci.yml. Snapshot Playwright saat ini darwin-only;
   buat snapshot lintas platform atau ganti ke assertion struktural yang tidak bergantung
   pada piksel, lalu rebaseline.
2. Jalankan `python3 tasks/nontechnical-v1/tools/check_docs.py` dan perbaiki temuannya.
3. Perbarui plan.md, coverage.md, dan README.md ke keadaan akhir.
4. Laporkan ringkasan akhir: WP selesai, gate yang lulus beserta perintahnya, WP yang
   tertahan beserta alasannya, dan pertanyaan terbuka PRD §8.4 yang masih menunggu pemilik
   produk.

## Bentuk laporan per fase

Setiap gate fase dilaporkan dengan bentuk yang sama:

- Fase dan WP yang dikerjakan, beserta berkas utama yang berubah.
- Perintah verifikasi yang dijalankan, persis seperti yang diketik, dan hasilnya apa adanya.
- Bukti perilaku: perintah HTTP atau langkah UI yang membuktikan alur berjalan.
- Yang sengaja tidak dikerjakan beserta alasannya.
- Risiko atau utang teknis yang tersisa.

Jangan menyatakan fase selesai tanpa bukti yang dijalankan. Bila ada yang gagal, laporkan
gagalnya, bukan melewatinya.
```
