# Review lisensi dependensi (WP-NT-P10-07)

Tanggal: 2026-10-18. Perintah: `npm run check:licenses`.

```
Lisensi dependensi: 1216 paket, 0 ditolak, 0 tanpa lisensi.
```

22 lisensi unik. Yang mendominasi: MIT 970, ISC 79, Apache-2.0 73.

## Yang perlu diperhatikan

| Lisensi | Paket | Kewajiban bila Kawan didistribusikan |
|---|---|---|
| MPL-2.0 (25) | `lightningcss` (+13 varian platform), `axe-core`, `dompurify` (atau Apache-2.0) | Berkas MPL yang **diubah** wajib dibuka; memakai apa adanya cukup menyertakan pemberitahuan. Tidak menular ke kode Kawan. |
| LGPL-3.0-or-later (10 + 4 gabungan) | `@img/sharp-libvips-*` | Pustaka dinamis: cukup bisa diganti versinya + sertakan lisensi. Jangan menautkan statis ke biner Kawan. |
| EPL-2.0 (2) | `elkjs` | Pemberitahuan + sumber berkas yang diubah. Tidak menular. |
| CC-BY-4.0 (1) | `caniuse-lite` | Atribusi di dokumentasi produk. |
| Python-2.0 (1) | `argparse` (jalur build) | Pemberitahuan lisensi. |

Nol GPL/AGPL murni, nol lisensi proprietary. Tidak ada yang menghalangi Kawan
dijual sebagai produk berbayar.

## Batas review ini

- Hanya membaca field `license` dari `package-lock.json` dan `node_modules`.
  Lisensi yang hanya ada di berkas `LICENSE` tanpa field itu terhitung "tanpa
  lisensi" — saat ini nol.
- Tidak memeriksa lisensi **konten** yang diunduh saat runtime (model, korpus)
  maupun lisensi gateway pihak ketiga yang dipanggil pengguna.
- Jalankan ulang setiap kali `package-lock.json` berubah; CI melakukannya di job
  `check`.
