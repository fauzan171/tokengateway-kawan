# Kebijakan privasi Kawan

> Salinan manual dari `src/lib/legal/privacy.ts`. Sumber kebenaran ada di berkas
> TS itu; bila teks di sini berbeda, halaman `/privacy` yang benar.

Berlaku sejak 18 Oktober 2026.

## Data yang disimpan

- Akun: alamat email dan nama tampilan.
- Percakapan: judul, pesan, dan lampiran yang kamu kirim.
- Dokumen: berkas yang kamu unggah beserta potongan teks yang dihasilkan darinya.
- Koneksi gateway: alamat gateway dan kunci API. Kunci disimpan terenkripsi, tidak pernah ditampilkan kembali setelah disimpan.
- Catatan pemakaian: jumlah token yang dilaporkan gateway, tanpa isi percakapan.
- Preferensi tampilan: tema, bahasa, dan ukuran huruf.

## Di mana data berada

- Semua data berada di database dan penyimpanan berkas pada server yang dijalankan operator Kawan.
- Pesan dikirim ke penyedia model yang dikonfigurasi operator lewat gateway yang kamu hubungkan sendiri. Kawan tidak menyimpan salinan terpisah untuk pihak lain.
- Bila operator mengaktifkan pencarian web, kata kunci pencarian dikirim ke mesin pencari yang dikonfigurasi operator.

## Yang tidak dilakukan

- Tidak ada harga, penagihan, atau saldo di dalam aplikasi ini. Pemakaian token hanya dicatat sebagai angka.
- Tidak ada pengiriman data ke pihak ketiga di luar penyedia model dan mesin pencari yang dikonfigurasi operator.
- Tidak ada iklan dan tidak ada pelacakan lintas situs.

## Kontrol atas datamu

- Hapus percakapan satu per satu kapan saja.
- Hapus dokumen beserta potongannya.
- Ekspor seluruh percakapan ke berkas JSON dari halaman Pengaturan.
- Minta admin menghapus akun; penghapusan akun membuang percakapan, dokumen, koneksi, catatan pemakaian, dan sesi milikmu.

## Log

- Log aplikasi tidak memuat kunci API, kata sandi, atau isi percakapan.
- Nilai yang berbentuk rahasia diganti penanda [REDACTED] sebelum ditulis.

Kebijakan ini dapat berubah; versi terbaru selalu ada di halaman ini.
