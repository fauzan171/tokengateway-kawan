# Tool: generate_document (v2)

Membuat dokumen terstruktur (PDF/DOCX/XLSX) dengan judul, bab, tabel, dan gambar.

- Efek: **local**
- Hasil: Kartu artefak dokumen pada pesan; pemotongan dilaporkan lewat note doc-truncated.

## Kapan dipakai

- Pengguna meminta dokumen rapi: laporan, surat, rekap, proposal.
- Konten butuh struktur: heading, daftar, tabel.
- Pengguna menyebut format eksplisit (PDF/Word/Excel).
- Bentuk baku laporan/surat/rekap dipakai lewat template.

## Kapan JANGAN dipakai

- Cukup teks biasa di chat tanpa struktur.
- Pengguna hanya minta data tabular cepat — CSV generate_file lebih ringan.
- Butuh presentasi (PPTX) — jalur tool PPTX belum terpasang.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| format | string | ya | pdf | docx | xlsx | Format dokumen. |
| displayName | string | ya | maks 120 char | Nama dokumen. |
| doc | object | bersyarat | wajib bila tanpa template | Skema {title, blocks[]}. |
| template | string | bersyarat | laporan | surat | rekap | Template baku; menang atas doc bila keduanya dikirim. |
| data | object | bersyarat | - | Isi sesuai template. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | 500 blok, 20 gambar, 100 bullet, 12 kolom; 100 artefak/24 jam |
| bytes | 25 MiB per artefak; gambar 4 MiB |
| waktu | 15 detik |

## Contoh

Valid:

```json
{"format":"pdf","displayName":"l.pdf","doc":{"title":"L","blocks":[{"type":"paragraph","text":"Isi."}]}}
```

Tidak valid:

```json
{"format":"pdf","displayName":"l","doc":{"title":"","blocks":[]}}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| INVALID_TOOL_ARGS | Struktur doc/data tidak sesuai skema. | Baca pesan galat, perbaiki field yang disebut, ulangi sekali. |
| QUOTA_EXCEEDED | Kuota artefak harian tercapai. | Beri tahu pengguna dan tawarkan melanjutkan besok. |
| TOO_LARGE | Dokumen melebihi 25 MiB setelah render. | Pangkas konten atau pecah dokumen. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
