# Tool: generate_file (v1)

Membuat berkas teks yang dapat diunduh pengguna (markdown, teks, JSON, CSV).

- Efek: **local**
- Hasil: Kartu artefak yang dapat diunduh pada pesan.

## Kapan dipakai

- Pengguna meminta berkas unduhan berisi teks/data.
- Hasil kerja lebih cocok disimpan sebagai lampiran daripada bagian chat.
- Data tabular kecil diminta sebagai CSV.

## Kapan JANGAN dipakai

- Pengguna minta dokumen rapi berjudul/bab/tabel — pakai generate_document.
- Konten masih diskusi; belum diminta menjadi berkas.
- Data tabular besar — CSV generate_file tetap tepat, bukan dokumen berformat.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| format | string | ya | md | txt | json | csv | Format berkas keluaran. |
| displayName | string | ya | maks 120 char | Nama berkas yang ditampilkan. |
| content | string | bersyarat | wajib utk md/txt/json | Isi berkas. |
| rows | array | bersyarat | wajib utk csv | Baris data CSV. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | 100 artefak/24 jam per pengguna |
| bytes | 25 MiB per artefak |
| waktu | 15 detik |

## Contoh

Valid:

```json
{"format":"md","displayName":"catatan.md","content":"# Catatan Isi."}
```

Tidak valid:

```json
{"format":"pdf","displayName":"x"}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| INVALID_TOOL_ARGS | Argumen tidak sesuai skema. | Perbaiki argumen sesuai batas lalu ulangi; jangan mengulang tanpa perubahan. |
| QUOTA_EXCEEDED | Kuota artefak harian tercapai. | Sampaikan ke pengguna bahwa batas harian tercapai dan tawarkan lanjut besok. |
| TOO_LARGE | Hasil render melebihi 25 MiB. | Kecilkan isi atau pecah menjadi beberapa berkas. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
