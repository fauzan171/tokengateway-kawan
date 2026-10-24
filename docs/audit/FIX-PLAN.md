# Fix plan Kawan — urutan eksekusi

Rencana ini untuk agen pelaksana. Temuan `Terduga` wajib direproduksi dengan uji sempit sebelum perubahan; bila uji menyangkal dugaan, commit hanya bukti uji atau catat alasan tanpa mengubah perilaku. Pertahankan enam perubahan kerja yang sudah ada; jangan menimpa pekerjaan belum di-commit.

## Wave 1 — blokir keamanan dan kegagalan fungsi inti

Urutan: tutup jalur keluar yang dapat melewati SSRF; pulihkan diagnosis/generasi kosong; benahi status share setelah penghapusan. Keempat pekerjaan ini memblokir kepercayaan pada E2E dan keamanan.

### WO-01 — Validasi redirect semua panggilan keluar
- Temuan: AUD-03
- Tingkat: Kritis
- Berkas target: `src/lib/api/http.ts:45`, `src/lib/chat/generate.ts:243`, `src/lib/search/web.ts:85`, `src/lib/documents/embed.ts:141`, `src/lib/media/audio.ts:63`, `src/lib/media/images.ts:44`
- Akar penyebab: `fetch` mengikuti redirect otomatis sesudah URL awal divalidasi. `assertRedirectAllowed` tersedia tetapi tidak dipakai.
- Perubahan: set `redirect: "manual"` pada semua fetch keluar; pada 3xx, ambil `Location`, validasi URL tujuan dengan `assertRedirectAllowed` dan kebijakan tujuan, batasi lompatan; untuk POST/stream tentukan aturan aman (tolak redirect bila tidak bisa mempertahankan metode/body secara benar). Tambah satu uji server lokal yang mengembalikan 302 ke loopback/metadata dan pastikan target tidak dipanggil. Audit ulang DNS rebinding secara terpisah; jangan mengklaim tuntas hanya karena redirect tertutup.
- JANGAN diubah: `src/lib/net/policy.ts` aturan allowlist operator; pengiriman Authorization ke origin awal.
- Kriteria lulus: 3xx ke host privat/asal lain ditolak sebelum request kedua; semua jalur keluar memakai redirect manual; uji SSRF hijau.
- Perintah verifikasi: `npx vitest run src/security/ssrf.test.ts src/lib/net/policy.test.ts && npx tsc --noEmit -p tsconfig.json`
- Risiko: provider sah yang redirect bisa gagal; balik commit WO-01 bila regresi, lalu terapkan allowlist asal yang sempit setelah evaluasi.
- Perkiraan: L

### WO-02 — Tolak pohon generasi tanpa pesan user
- Temuan: AUD-01
- Tingkat: Tinggi
- Berkas target: `src/lib/chat/generate.ts:477-478`, `src/lib/chat/start-generation.ts:43-81`
- Akar penyebab: dua Generation lokal mempunyai assistant `parentId=NULL`; `buildAncestryPath` hanya berisi assistant, lalu `buildMessages` mengosongkannya. ID kedua baris juga tanpa prefiks `gen_`/`job_`, jadi di luar `startGeneration` saat ini; penulis eksternal belum diketahui.
- Perubahan: sebelum fetch, pastikan ancestry memuat `generation.userMessageId` dari chat yang sama dan `messages` memuat pesan user tidak kosong; jika tidak, tandai generasi `indeterminate`/galat setup yang spesifik tanpa mengirim request kosong. Cari sumber pembuatan dua baris tanpa Job melalui skrip/seed; jangan menambal `parentId` produksi tanpa bukti. Tambah satu uji dengan placeholder berinduk NULL yang memastikan tidak ada fetch dan status tidak menggantung.
- JANGAN diubah: `buildAncestryPath` untuk pohon valid; seed `dev.db` dan prompt asli.
- Kriteria lulus: payload `messages: []` tidak dikirim; kasus data cacat menghasilkan kode diagnostik eksplisit; generasi normal masih selesai.
- Perintah verifikasi: `npx vitest run src/lib/chat/generate.test.ts src/lib/chat/messages.test.ts && npx tsc --noEmit -p tsconfig.json`
- Risiko: data lama cacat berhenti lebih awal; rollback commit bila generasi valid terblokir, pertahankan uji reproduksi.
- Perkiraan: M

### WO-03 — Catat status upstream secara aman
- Temuan: AUD-02
- Tingkat: Sedang
- Berkas target: `src/lib/chat/generate.ts:257-260`, `src/lib/providers/errors.ts:87-106`
- Akar penyebab: status/body balasan non-2xx dibuang sebelum log/event, sehingga 400 dan 5xx menjadi kode umum.
- Perubahan: simpan hanya status HTTP, kode error provider dari allowlist bila ada, dan ID request upstream yang aman; jangan log body mentah, prompt, Authorization, atau header lain. Batasi pembacaan body error maksimum kecil sebelum parse; pisahkan kode `INVALID_UPSTREAM_REQUEST` untuk 400/422 agar pesan UI tidak menyebut gateway rusak.
- JANGAN diubah: redaksi logger `src/lib/api/logger.ts`; kontrak 401 gateway tidak mengeluarkan pengguna.
- Kriteria lulus: uji 400 mencatat status 400 tanpa data rahasia; pesan generasi dapat dibedakan dari 5xx; uji canary tetap hijau.
- Perintah verifikasi: `npx vitest run src/lib/chat/generate.test.ts src/security/canary.test.ts && npx tsc --noEmit -p tsconfig.json`
- Risiko: metadata provider dapat memuat rahasia bila tidak disaring; batalkan commit jika uji canary mendeteksi kebocoran.
- Perkiraan: M

### WO-04 — Status 404 halaman share
- Temuan: AUD-04, AUD-05, UX-11
- Tingkat: Tinggi
- Berkas target: `src/app/s/[token]/page.tsx:17-38`, `e2e/flow-e.spec.ts:51`
- Akar penyebab: `notFound()` pada segmen streaming Next setelah header 200 terkirim. Penghapusan user sendiri sudah menghapus ShareLink dalam transaksi.
- Perubahan: buat pemeriksaan token sebelum streaming/di batas route yang dapat menentukan status 404, atau gunakan route response eksplisit untuk halaman publik. Pertahankan halaman not-found dan `robots: noindex`. E2E harus menguji HTTP 404 dan ketiadaan konten snapshot setelah delete/revoke.
- JANGAN diubah: `src/lib/chat/share.ts` snapshot beku, token acak, atau aturan revoked/expired; jangan melemahkan assert flow E menjadi pemeriksaan teks saja.
- Kriteria lulus: token palsu, revoked, dan milik user terhapus memberi HTTP 404 pada `/s/[token]` dan API share; token aktif memberi 200 serta snapshot.
- Perintah verifikasi: `npx playwright test e2e/flow-e.spec.ts e2e/flow-d.spec.ts && npm run build`
- Risiko: Next streaming/caching dapat berubah; rollback commit bila halaman aktif tidak bisa dibuka.
- Perkiraan: M

## Wave 2 — data, alur, dan ketahanan

Urutan: setelah masalah keamanan dan status share jelas, benahi kegagalan assertion lalu konsistensi data dan skala. Setiap WO harus membuktikan kasusnya sendiri.

### WO-05 — Spesifikkan locator share E2E
- Temuan: AUD-05
- Tingkat: Sedang
- Berkas target: `e2e/flow-d.spec.ts:52`
- Akar penyebab: `getByText("Pesan untuk dibagikan")` tidak dibatasi pada satu pesan; pesan user juga muncul sebagai substring balasan assistant.
- Perubahan: pilih elemen pesan dalam daftar `<ol><li>` pada halaman share lewat role/struktur stabil; gunakan assertion jumlah tepat satu sebelum visibilitas. Jangan menghapus langkah snapshot/revoke.
- JANGAN diubah: aplikasi `src/app/s/[token]/page.tsx`; assertion isi snapshot setelah edit.
- Kriteria lulus: locator unik, flow D lulus ketika balasan assistant mengutip pesan user.
- Perintah verifikasi: `npx playwright test e2e/flow-d.spec.ts`
- Risiko: perubahan markup halaman dapat mematahkan locator; gunakan role semantik dan rollback commit bila tes kehilangan cakupan.
- Perkiraan: S

### WO-06 — Hapus data pengguna tanpa berkas hilang saat transaksi gagal
- Temuan: AUD-08
- Tingkat: Sedang
- Berkas target: `src/lib/admin/users.ts:115-148`, `src/lib/documents/storage.ts`
- Akar penyebab: file dihapus sebelum transaksi DB; kegagalan transaksi menyisakan metadata yang menunjuk file hilang.
- Perubahan: jadikan transaksi DB sumber kebenaran, lalu bersihkan file berdasarkan daftar storageKey yang telah dibaca; pada kegagalan pembersihan, catat pekerjaan retry aman tanpa membocorkan path pengguna. Uji injeksi kegagalan transaksi memastikan file tetap ada; uji kegagalan unlink memastikan retry mungkin.
- JANGAN diubah: penghapusan share/sesi/kredensial dalam transaksi dan aturan cegah hapus admin sendiri.
- Kriteria lulus: transaksi gagal tidak menghapus file; transaksi berhasil menghilangkan akses DB/share/sesi; file terhapus atau tercatat untuk retry.
- Perintah verifikasi: `npx vitest run src/lib/admin/users.test.ts src/lib/documents/remove.test.ts && npx tsc --noEmit -p tsconfig.json`
- Risiko: file yatim sementara jika proses mati; worker cleanup yang sudah ada dapat dipakai. Balik commit jika retensi file tak terkontrol.
- Perkiraan: M

### WO-07 — Paginasi riwayat dan ekspor besar
- Temuan: AUD-07, UX-03
- Tingkat: Sedang
- Berkas target: `src/components/chat-sidebar.tsx:52-65`, `src/lib/chat/chats.ts:225-231`, `src/lib/chat/transfer.ts:84-114`
- Akar penyebab: sidebar mengabaikan `nextCursor`; ekspor melakukan satu query pesan per chat dan memuat seluruh data sekaligus.
- Perubahan: konsumsi cursor di sidebar dengan “Muat lagi” dan reset saat filter berubah; hilangkan pemakaian route `listChats` tanpa batas bila masih dipakai; batch pesan untuk ekspor atau stream dengan batas yang dijelaskan ke pengguna. Ukur jumlah query pada 100 chat.
- JANGAN diubah: urutan chat `updatedAt,id`, kepemilikan `{userId}`, format ekspor yang sudah ada.
- Kriteria lulus: chat ke-51 dapat dipilih; ekspor 100 chat tidak mengeluarkan 100 query pesan; keluaran tetap sama.
- Perintah verifikasi: `npx vitest run src/lib/chat/chats.test.ts src/lib/chat/library.test.ts && npx playwright test e2e/flow-c.spec.ts`
- Risiko: cursor/filter salah dapat menduplikasi chat; rollback bila urutan/tampilan regresi.
- Perkiraan: L

## Wave 3 — aksesibilitas dan konsistensi antarmuka

Urutan: sesudah alur inti stabil, rapikan interaksi keyboard, ukuran target, bahasa, dan umpan balik. Perubahan visual diverifikasi pada viewport kecil.

### WO-08 — Target sentuh dan fokus kontrol chat
- Temuan: AUD-09, UX-01, UX-02, UX-04, UX-05, UX-06, UX-07
- Tingkat: Sedang
- Berkas target: `src/components/chat-view.tsx:799-834`, `src/components/chat-sidebar.tsx:249-275`, `src/components/documents-panel.tsx:151-164`, `src/components/media-controls.tsx:16-80`, `src/components/prompt-picker.tsx:91-158`
- Akar penyebab: tombol 32–36px/`py-1` dan visibilitas hanya saat hover. Popup sidebar/prompt tidak mengelola fokus.
- Perubahan: target aksi interaktif `min-h-11 min-w-11`; tampilkan aksi pesan pada `group-focus-within` dan perangkat tanpa hover; tambahkan Escape dan pemulihan fokus popup; beri textarea label aksesibel tetap. Jaga susunan 320px tanpa overflow composer.
- JANGAN diubah: logika kirim, stop, regenerasi, pemilihan model, atau upload.
- Kriteria lulus: semua aksi yang disebut dapat dijangkau Tab, fokus terlihat, target ≥44px, popup menutup dengan Escape; uji 320px/375px.
- Perintah verifikasi: `npx vitest run src/components/chat-view.test.tsx src/components/media-controls.test.tsx src/components/prompt-picker.test.tsx && npx playwright test e2e/render.spec.ts`
- Risiko: target besar mengubah kepadatan sidebar; balik commit bila kontrol menutup konten penting.
- Perkiraan: M

### WO-09 — Bahasa UI sesuai preferensi
- Temuan: AUD-06, UX-08
- Tingkat: Sedang
- Berkas target: `src/components/settings-form.tsx:117-128`, `src/app/layout.tsx:27`, `src/components/chat-view.tsx:988`
- Akar penyebab: locale disimpan tetapi tidak dikonsumsi untuk teks/hint maupun atribut `lang`.
- Perubahan: petakan semua string UI yang terlihat ke kamus `id/en` secukupnya; pada perubahan locale dan reload, ubah `html.lang` dan label/status/form. Jangan menampilkan opsi English sampai cakupan minimum UI utama lengkap; bila scope terlampau luas, hapus opsi English sampai implementasi siap.
- JANGAN diubah: kontrak API, data chat pengguna, preferensi tema/font.
- Kriteria lulus: English mengubah menu, chat, auth, status/galat utama dan `html.lang=en`; Indonesia tetap benar.
- Perintah verifikasi: `npx vitest run src/lib/settings/settings.test.ts && npx playwright test e2e/render.spec.ts e2e/auth.spec.ts`
- Risiko: string E2E yang mengandalkan Indonesia berubah; gunakan locale default `id`, rollback bila default berubah.
- Perkiraan: L

### WO-10 — Pagination admin dan pengumuman error prompt
- Temuan: UX-07, UX-09
- Tingkat: Sedang
- Berkas target: `src/components/admin-panel.tsx:198-201`, `src/components/prompt-picker.tsx:162`
- Akar penyebab: admin menerima `nextCursor` tetapi tidak menyediakan navigasi; error prompt tidak live.
- Perubahan: tombol Muat lagi admin yang mengirim cursor, menggabungkan tanpa duplikat, dan memberi status loading/error; prompt error gunakan `role="alert"`, sukses simpan/hapus beri status singkat.
- JANGAN diubah: endpoint admin, izin peran, konfirmasi hapus.
- Kriteria lulus: pengguna ke-51 dapat dicapai; kegagalan prompt diumumkan; tabel tetap dapat diakses di 375px.
- Perintah verifikasi: `npx vitest run src/lib/admin/users.test.ts src/components/prompt-picker.test.tsx && npx playwright test e2e/flow-e.spec.ts`
- Risiko: cursor usang menghasilkan duplikat; dedupe ID, rollback bila daftar tidak stabil.
- Perkiraan: M

### WO-11 — Umpan balik clipboard dan preferensi Enter
- Temuan: UX-02, UX-10
- Tingkat: Rendah
- Berkas target: `src/components/chat-view.tsx:978-987`, `src/components/markdown.tsx:63-82`
- Akar penyebab: Enter hardcoded mengirim walau `sendOnEnter` tersimpan; clipboard error ditelan.
- Perubahan: baca preferensi `sendOnEnter` yang sudah ada untuk memutuskan Enter/Shift+Enter; saat salin berhasil/gagal tampilkan status live yang tidak menaruh isi kode di announcement.
- JANGAN diubah: isi Markdown, sanitasi Mermaid, pemrosesan pesan/attachment.
- Kriteria lulus: kedua mode Enter dan IME benar; clipboard ditolak memberi umpan balik aksesibel.
- Perintah verifikasi: `npx vitest run src/components/chat-view.test.tsx src/components/markdown.test.tsx src/lib/settings/settings.test.ts`
- Risiko: kebiasaan Enter pengguna berubah; default tetap perilaku sekarang dan rollback jika pengiriman tak sengaja meningkat.
- Perkiraan: S

## Kriteria lulus global

- Semua gerbang: `npx tsc --noEmit -p tsconfig.json`, `npx eslint .`, `npx vitest run`, `npx playwright test`, `npm run check:docs`, `node scripts/check-licenses.mjs`, `npm run build` berexit 0; catat jumlah dan durasi baru.
- Tidak ada payload kosong ke gateway; kasus normal mengalir lengkap; 400 dapat didiagnosis tanpa rahasia.
- SSRF redirect ke alamat privat ditolak pada setiap jalur keluar; `Session` dan share user yang dihapus tidak bisa dipakai; HTTP `/s/[token]` untuk invalid/revoked/deleted adalah 404.
- Tidak ada regresi silang pengguna, enkripsi, idempotensi, cancel, atau penghapusan data.
- UI keyboard dan 320/375px lulus pemeriksaan WO terkait; default Indonesia tetap utuh.

## Urutan commit yang disarankan

Satu WO satu commit: `fix(net): validate outbound redirects` (WO-01); `fix(chat): reject empty generation ancestry` (WO-02); `fix(chat): record safe upstream failure metadata` (WO-03); `fix(share): return 404 before page streaming` (WO-04); `test(e2e): scope shared message locator` (WO-05); `fix(admin): make user file deletion recoverable` (WO-06); `fix(chat): page history and batch export` (WO-07); `fix(ui): expose keyboard actions and touch targets` (WO-08); `fix(i18n): apply selected locale` (WO-09); `fix(ui): page admin users and announce prompt errors` (WO-10); `fix(ui): honor send key and announce clipboard result` (WO-11).

## Larangan untuk eksekutor

- Jangan baca/cetak/ubah/commit `.env`, key, token, OAuth secret, connection string, plaintext kredensial, prompt pengguna, atau body error upstream mentah.
- Jangan deploy, restart PM2, push, ubah DB hidup, atau jalankan migrasi tanpa mandat terpisah.
- Jangan ubah skema tanpa migrasi SQLite dan PostgreSQL terpisah serta uji rollback.
- Jangan hapus, skip, atau lemahkan test gagal hanya agar hijau; khusus flow E, jangan ganti cek HTTP 404 dengan cek teks semata.
- Jangan menimpa enam perubahan working tree yang sudah ada; inspeksi diff sebelum edit.
- Jangan menganggap dua baris Generation tanpa Job sebagai bukti bug produksi sampai asalnya terlacak.
