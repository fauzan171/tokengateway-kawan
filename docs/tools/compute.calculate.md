# Tool: compute.calculate (v1)

Kalkulasi desimal presisi tinggi tanpa eval: hitung dan statistik dasar.

- Efek: **read**
- Hasil: Angka/hasil statistik sebagai teks terstruktur.

## Kapan dipakai

- Pengguna minta perhitungan eksak (bukan taksiran).
- Statistik deskriptif dari daftar angka.
- Butuh angka yang konsisten antar-jawaban.

## Kapan JANGAN dipakai

- Pengguna minta taksiran kasar saja — hitung manual di teks.
- Operasi di luar himpunan yang didukung.
- Operan bukan string desimal.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| op | string | ya | hitung | statistik | Jenis operasi. |
| operand | string | bersyarat | utk op=hitung | Ekspresi desimal. |
| items | array | bersyarat | utk op=statistik | Daftar angka. |

## Batas

| Aspek | Nilai |
|---|---|
| bytes | 8 KiB masuk |
| jumlah | digit/eksponen dibatasi |
| waktu | 2 detik |

## Contoh

Valid:

```json
{"op":"hitung","operand":"12.5*8"}
```

Tidak valid:

```json
{"op":"hitung","operand":"eval(process)"}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| CALC_INVALID | Ekspresi/operan tidak sah. | Tulis ulang operan sebagai ekspresi desimal yang didukung. |
| CALC_DIV_ZERO | Pembagian nol. | Periksa penyebut sebelum mengulang. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
