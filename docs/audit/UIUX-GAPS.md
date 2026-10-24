# Gap UI/UX Kawan — 19 Oktober 2026

Bukti utama: pembacaan `nl -ba src/components/*.tsx`, `nl -ba src/app/{loading,error,not-found}.tsx`, dan `rg -n 'aria-live|role="status"|min-h-11|size-9|opacity-0 group-hover' src/components src/app`. `Terduga` berarti dampak pada perangkat/pembaca layar belum diuji; ukuran/struktur kode tetap faktual. Ambang sentuh yang dipakai untuk rencana: 44×44 CSS px (`min-h-11 min-w-11`).

| ID / tingkat / status | Lokasi dan kondisi sekarang | Seharusnya / cara membuktikan |
|---|---|---|
| UX-01 Sedang / Terduga | `chat-view.tsx:799-834`: Salin, Edit, Regenerasi memakai `opacity-0 group-hover:opacity-100`, tanpa gaya `focus-within`; target hanya `p-1`. | Tampil saat fokus keyboard dan sentuh, target ≥44px. Tab melalui pesan tanpa mouse; periksa visibilitas serta kotak target pada 375px. |
| UX-02 Sedang / Terduga | `chat-view.tsx:978-1015`: textarea hanya placeholder, tombol Kirim/Stop `size-9` (36px); `:982-987` Enter selalu mengirim. | Beri nama aksesibel tetap untuk textarea; target 44px; hormati `sendOnEnter` pengguna. Uji Tab, Enter/Shift+Enter untuk kedua preferensi, komposisi IME, ukuran 375px. |
| UX-03 Sedang / Terduga | `chat-sidebar.tsx:52-65`: hanya 50 chat dimuat, `nextCursor` diabaikan; `:218-221` dapat menyatakan tidak ada hasil meski ada halaman lanjut. | Muat halaman berikut atau tampilkan tombol “Muat lagi”; buat 51 chat uji dan pastikan nomor 51 dapat dicapai. |
| UX-04 Sedang / Terduga | `chat-sidebar.tsx:249-275,281-353`: judul/aksi 32–36px, menu `div` tanpa `role="menu"`/Escape/arah fokus; hanya mousedown luar untuk menutup. | Target ≥44px, Escape menutup, fokus kembali ke pemicu, Tab tidak terjebak. Uji keyboard dari tombol “Aksi untuk…”. |
| UX-05 Sedang / Terduga | `documents-panel.tsx:151-164`: label unggah `min-h-9`; file input `sr-only` tanpa gaya `focus-within` pada label. `:173` status dinamis sudah ada. | Target ≥44px dan fokus terlihat; Tab ke input, unggah dari keyboard pada 375px. Pertahankan `role="status"` yang sudah benar. |
| UX-06 Sedang / Terduga | `media-controls.tsx:16,39-80`: tombol ikon `p-2` tanpa min 44px; label `aria-label` ada. | Semua kontrol media target ≥44px; ukur bounding box ketiga tombol saat fitur diaktifkan. |
| UX-07 Sedang / Terduga | `prompt-picker.tsx:91-158`: pemicu, daftar, hapus, simpan berpadding `px-2 py-1`; `:162` error tidak memakai `role="alert"`/`aria-live`; popup tanpa pengelolaan fokus. | Target 44px, pengumuman error, fokus masuk dan kembali setelah tutup, Escape. Uji keyboard dan pembaca layar setelah respons gagal. |
| UX-08 Sedang / Terduga | `settings-form.tsx:117-128`: opsi English tersimpan, tetapi `app/layout.tsx:27` selalu `<html lang="id">`; `chat-view.tsx:988` teks Indonesia tetap. | Pilihan bahasa mengubah teks UI dan `lang`; ganti ke English, muat ulang, periksa label/error dan atribut `html.lang`. |
| UX-09 Sedang / Terduga | `admin-panel.tsx:198-201`: API mengirim `nextCursor`, UI hanya menyebut “sisanya belum dimuat”, tanpa aksi. `:163-196` tabel `min-w-[40rem]` menggulir horizontal pada ponsel. | Tombol “Muat lagi” atau pagination; akses aksi setiap pengguna dengan 51 seed. Pada 375px, pastikan tombol aksi dapat dicapai lewat gulir jelas. |
| UX-10 Rendah / Terduga | `markdown.tsx:63-82`: klik salin gagal diam-diam bila clipboard ditolak; sukses hanya mengganti `aria-label` 1,5 detik. | Tampilkan status/alert yang diumumkan; blok clipboard dalam browser lalu periksa umpan balik. `:60` Mermaid menggunakan `dangerouslySetInnerHTML`; uji sanitasi tetap wajib sebelum perubahan. |
| UX-11 Tinggi / Terbukti | `s/[token]/page.tsx:35-38`: token palsu menampilkan halaman 404, namun status HTTP 200; `flow-e.spec.ts:51` mengharuskan 404. | Status halaman 404 sebelum streaming atau pengujian kebenaran via API share; `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/s/definitely-invalid-audit-token` menghasilkan `200`; API `/api/kawan/v1/share/definitely-invalid-audit-token` menghasilkan `404`. |

## Komponen yang sudah punya dasar aksesibilitas

- `source-list.tsx:15-22`: tautan punya teks dan `rel="noopener noreferrer"`; fokus/kontras pada browser nyata **belum diverifikasi**.
- `usage-report.tsx:96-125`: header tabel kolom/baris, kondisi kosong, dan tombol ekspor `min-h-11`; pembaca layar **belum diverifikasi**.
- Form auth: `auth-form.tsx:241-319`, `forgot-password-form.tsx:153-176`, `reset-password-form.tsx:166-191`, `change-password-form.tsx:137-152` menyediakan live status/alert dan submit 44px. `connect-gateway-form.tsx` memiliki status koneksi; fokus setelah error di semua form **belum diverifikasi**.
- `src/app/loading.tsx:2`, `error.tsx:10`, `not-found.tsx:15` punya status, retry, dan navigasi. Pengumuman saat transisi lambat **belum diverifikasi**.

## Pemeriksaan tambahan yang perlu dieksekusi

- Ukur kontras teks `text-muted-foreground`, `text-destructive`, dan fokus dengan alat WCAG pada tema terang/gelap. Baca kode saja tidak cukup; **Belum diverifikasi**.
- Uji 320px dan 375px untuk sidebar, composer, modal prompt, tabel admin, tabel pemakaian. Screenshot dan pengukuran overflow belum dibuat; **Belum diverifikasi**.
- Bandingkan paritas Open WebUI hanya untuk fungsi yang dijanjikan Kawan: riwayat, share/revoke, model, dokumen. Tidak ada spesifikasi paritas terukur di audit ini; **Belum diverifikasi**.
