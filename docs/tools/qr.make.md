# Tool: qr.make (v1)

Membuat kode QR dan memverifikasinya lewat decode balik.

- Efek: **local**
- Hasil: SVG QR terverifikasi.

## Kapan dipakai

- Pengguna minta kode QR untuk tautan/teks pendek.
- Perlu QR yang terverifikasi bisa dibaca balik sebelum dikirim ke pengguna.

## Kapan JANGAN dipakai

- Teks panjang lebih dari 1.000 char — QR menjadi tak terbaca.
- Butuh QR dengan logo/error-correction tingkat tinggi.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| text | string | ya | maks 1.000 char | Isi QR. |

## Batas

| Aspek | Nilai |
|---|---|
| bytes | 64 KiB keluaran |
| jumlah | 1.000 char |
| waktu | 5 detik |

## Contoh

Valid:

```json
{"text":"https://contoh.id"}
```

Tidak valid:

```json
{"text":""}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| QR_INVALID | Teks kosong/terlalu panjang. | Pendekkan teks lalu ulangi. |
| QR_VERIFY_FAILED | Decode balik tidak cocok. | Jangan kirim QR; laporkan kegagalan ke pengguna. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
