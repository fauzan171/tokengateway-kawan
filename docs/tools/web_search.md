# Tool: web_search (v1)

Mencari di web (Tavily/Jina/direct); hasilnya snippet + URL, bukan jawaban.

- Efek: **read**
- Hasil: Daftar hasil {title, url, snippet} + provider yang dipakai.

## Kapan dipakai

- Butuh sumber terbaru di luar pengetahuan model.
- Perlu URL kandidat sebelum membaca satu halaman penuh.

## Kapan JANGAN dipakai

- Pertanyaan murni penalaran/perhitungan — tool lain lebih tepat.
- Sudah punya URL pasti dari pengguna — langsung web_read.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| query | string | ya | 1..400 char | Kata kunci pencarian. |
| limit | integer | tidak | 1..5 | Jumlah hasil maksimum. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | 8 query per run riset |
| waktu | 8 detik |
| bytes | 512 KiB |

## Contoh

Valid:

```json
{"query":"harga kopi arabika 2026"}
```

Tidak valid:

```json
{"query":""}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| SEARCH_UNAVAILABLE | Semua penyedia gagal / kuota habis / query murni-PII. | Catat gap bukti; jangan mengarang hasil, lanjutkan dengan bukti yang ada. |
| UNKNOWN_ARGUMENT | Ada argumen di luar skema. | Kirim hanya kunci query/limit. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
