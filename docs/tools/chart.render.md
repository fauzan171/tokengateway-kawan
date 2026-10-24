# Tool: chart.render (v1)

Diagram SVG deklaratif (batang/lini) dengan label ter-escape.

- Efek: **local**
- Hasil: SVG + tabel alternatif.

## Kapan dipakai

- Pengguna minta visualisasi data kecil.
- Perlu alternatif tabel dari diagram.

## Kapan JANGAN dipakai

- Data belum berbentuk deret angka berlabel.
- Butuh diagram interaktif/peta — tidak didukung.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| kind | string | ya | bar | line | Jenis diagram. |
| series | array | ya | maks 30 titik | Data berlabel. |

## Batas

| Aspek | Nilai |
|---|---|
| bytes | 64 KiB keluaran |
| jumlah | 30 titik, label 60 char |
| waktu | 5 detik |

## Contoh

Valid:

```json
{"kind":"bar","series":[{"label":"a","value":1}]}
```

Tidak valid:

```json
{"kind":"pie"}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| CHART_INVALID | Bentuk series/kind tidak sah. | Kirim ulang dengan kind bar/line dan series berlabel. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
