/**
 * Sumber teks kebijakan privasi (REQ-NT-79).
 *
 * Satu sumber: halaman `/privasi` merender array ini, dan `docs/privacy.md`
 * adalah salinan manual dari isi yang sama. Bila mengubah di sini, ubah juga
 * berkas Markdown itu.
 */

export const PRIVACY_EFFECTIVE_DATE = "2026-10-18";

export type PrivacySection = {
  heading: string;
  body: readonly string[];
};

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    heading: "Data yang disimpan",
    body: [
      "Akun: alamat email dan nama tampilan.",
      "Percakapan: judul, pesan, dan lampiran yang kamu kirim.",
      "Dokumen: berkas yang kamu unggah beserta potongan teks yang dihasilkan darinya.",
      "Koneksi gateway: alamat gateway dan kunci API. Kunci disimpan terenkripsi, tidak pernah ditampilkan kembali setelah disimpan.",
      "Catatan pemakaian: jumlah token yang dilaporkan gateway, tanpa isi percakapan.",
      "Preferensi tampilan: tema, bahasa, dan ukuran huruf.",
    ],
  },
  {
    heading: "Di mana data berada",
    body: [
      "Semua data berada di database dan penyimpanan berkas pada server yang dijalankan operator Kawan.",
      "Pesan dikirim ke penyedia model yang dikonfigurasi operator lewat gateway yang kamu hubungkan sendiri. Kawan tidak menyimpan salinan terpisah untuk pihak lain.",
      "Bila operator mengaktifkan pencarian web, kata kunci pencarian dikirim ke mesin pencari yang dikonfigurasi operator.",
    ],
  },
  {
    heading: "Yang tidak dilakukan",
    body: [
      "Tidak ada harga, penagihan, atau saldo di dalam aplikasi ini. Pemakaian token hanya dicatat sebagai angka.",
      "Tidak ada pengiriman data ke pihak ketiga di luar penyedia model dan mesin pencari yang dikonfigurasi operator.",
      "Tidak ada iklan dan tidak ada pelacakan lintas situs.",
    ],
  },
  {
    heading: "Kontrol atas datamu",
    body: [
      "Hapus percakapan satu per satu kapan saja.",
      "Hapus dokumen beserta potongannya.",
      "Ekspor seluruh percakapan ke berkas JSON dari halaman Pengaturan.",
      "Minta admin menghapus akun; penghapusan akun membuang percakapan, dokumen, koneksi, catatan pemakaian, dan sesi milikmu.",
    ],
  },
  {
    heading: "Log",
    body: [
      "Log aplikasi tidak memuat kunci API, kata sandi, atau isi percakapan.",
      "Nilai yang berbentuk rahasia diganti penanda [REDACTED] sebelum ditulis.",
    ],
  },
];
