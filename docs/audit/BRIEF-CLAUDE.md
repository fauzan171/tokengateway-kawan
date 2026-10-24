# Tugas: Eksekusi FIX-PLAN.md Kawan

Root: `/home/hermes/workspace/projects/tokengateway-kawan`

Kamu **eksekutor**. Mandor (Codex) sudah menyelesaikan audit di `docs/audit/`. Bacalah lebih dulu, urut:

1. `docs/audit/FIX-PLAN.md` — **sumber perintah utama**. Ikuti urutan gelombangnya.
2. `docs/audit/AUDIT-2026-10-19.md` — konteks temuan (`AUD-01`…`AUD-09`).
3. `docs/audit/UIUX-GAPS.md` — konteks gap UI/UX (`UX-01`…`UX-11`).

## Cara mengerjakan

Kerjakan **satu work order per commit**, urut Wave 1 → Wave 2 → Wave 3. Jangan melompat. Untuk tiap WO:

1. Baca berkas target yang disebut di WO itu sebelum mengubah.
2. Terapkan perubahan minimal sesuai kolom **Perubahan**. Jangan melebar ke berkas lain.
3. Hormati kolom **JANGAN diubah** secara mutlak.
4. Jalankan **Perintah verifikasi** milik WO itu. Kalau merah, perbaiki sampai hijau. Jangan tandai selesai kalau belum hijau.
5. Commit dengan pesan yang disarankan di bagian "Urutan commit". **Jangan `git push`.**

Setelah semua gelombang selesai, jalankan gerbang penuh dan pastikan hijau:

```
npx tsc --noEmit -p tsconfig.json
npx eslint .
npx vitest run
npx playwright test
npm run build
```

## Larangan mutlak

- **JANGAN `git push`.** Commit lokal saja.
- **JANGAN deploy, jangan `pm2 restart`, jangan jalankan `wrangler`.**
- **JANGAN sentuh `dev.db`** atau DB mana pun. Tidak ada `DELETE`/`UPDATE`/`ALTER`. Migrasi skema hanya kalau WO-nya meminta eksplisit.
- **JANGAN buka, ubah, atau cetak `.env`/`.dev.vars`.** Rahasia → `[REDACTED]`.
- **JANGAN hapus atau `skip` test yang gagal** supaya gerbang hijau. Perbaiki kodenya. Kalau benar-benar mustahil, tinggalkan gagal dan laporkan.
- **JANGAN menyentuh `docs/audit/`** — itu milik mandor.
- **JANGAN refactor** di luar ruang lingkup WO. Diff sekecil mungkin yang benar.
- Kalau sebuah WO ternyata salah atau tidak bisa dikerjakan, **jangan dipaksa**: tulis alasannya di laporan akhir dan lanjut ke WO berikutnya.

## Catatan penting soal AUD-01

Codex menemukan dua baris `UPSTREAM_ERROR` di `dev.db` berasal dari pesan assistant ber-`parentId` `NULL` sehingga `messages: []` terkirim dan gateway balas 400. Baris itu **bukan artefak jalur produksi** — kemungkinan berasal dari skrip diagnosa manual. WO-02 hanya meminta penjagaan di kode, bukan pembenahan data. Jangan bersihkan `dev.db`.

## Laporan akhir

Setelah selesai, tulis `docs/audit/EXECUTION-REPORT.md` berisi:

- Tabel: WO → status (`Selesai`/`Sebagian`/`Dilewati`) → hash commit → hasil perintah verifikasi.
- Keluaran gerbang penuh di akhir (perintah + hasil + jumlah test).
- WO yang gagal/ dilewati beserta alasan teknis konkret.
- Hal yang kamu temukan tapi tidak ada di plan — jangan dikerjakan, cukup dilaporkan.

Bahasa Indonesia.