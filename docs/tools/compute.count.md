# Tool: compute.count (v1)

Menghitung kata/UTF-16/code point/grapheme/byte dari teks.

- Efek: **read**
- Hasil: Tabel hitungan lima metrik.

## Kapan dipakai

- Pengguna minta jumlah kata/karakter yang akurat.
- Teks mengandung emoji/CJK dan hitungan naif menyesatkan.

## Kapan JANGAN dipakai

- Cukup taksiran panjang — jangan panggil tool.
- Butuh frekuensi kata — belum didukung.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| text | string | ya | - | Teks yang dihitung. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | maks 200.000 char |
| waktu | 2 detik |

## Contoh

Valid:

```json
{"text":"halo dunia"}
```

Tidak valid:

```json
{"text":""}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| CALC_INVALID | Teks kosong/tidak sah. | Kirim teks tidak kosong. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
