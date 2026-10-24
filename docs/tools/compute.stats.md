# Tool: compute.stats (v1)

Statistik deskriptif (n, hilang, jenis, satuan, metode) untuk data kecil.

- Efek: **read**
- Hasil: Ringkasan deskriptif terstruktur.

## Kapan dipakai

- Pengguna minta ringkasan kualitatif kolom data.
- Perlu tahu jumlah nilai hilang sebelum olah lanjutan.

## Kapan JANGAN dipakai

- Butuh angka agregat (mean/median) — pakai calculate statistik.
- Data belum berbentuk daftar nilai.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| items | array | ya | - | Daftar nilai. |
| unit | string | tidak | - | Satuan bila ada. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | maks 1.000 butir |
| waktu | 2 detik |

## Contoh

Valid:

```json
{"items":["1","2","x"]}
```

Tidak valid:

```json
{"items":"bukan-array"}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| CALC_INVALID | Masukan bukan daftar nilai. | Kirim ulang sebagai array nilai. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
