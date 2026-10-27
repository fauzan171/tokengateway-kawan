# Tool: web_read (v1)

Membaca satu URL publik dan mengembalikan teks ter-ekstrak yang dipotong.

- Efek: **read**
- Hasil: Teks ter-ekstrak terpotong + judul + URL final.

## Kapan dipakai

- Perlu isi halaman yang sudah ditemukan lewat web_search.
- Pengguna menyebut URL yang harus dibaca utuh.

## Kapan JANGAN dipakai

- Hanya perlu ringkasan kandidat — cukup snippet dari web_search.
- URL bukan http/https atau menunjuk alamat internal.

## Argumen

| Nama | Tipe | Wajib | Batas | Keterangan |
|---|---|---|---|---|
| url | string | ya | maks 2.048 char | URL publik yang dibaca. |
| maxChars | integer | tidak | 1.000..6.000 | Panjang teks yang diambil. |

## Batas

| Aspek | Nilai |
|---|---|
| jumlah | 8 halaman per run riset |
| waktu | 10 detik |
| bytes | 2 MiB |

## Contoh

Valid:

```json
{"url":"https://contoh.id/artikel"}
```

Tidak valid:

```json
{"url":""}
```

## Kegagalan

| Kode | Arti | Tindakan model |
|---|---|---|
| BLOCKED | Situs menolak akses (401/402/403). | Jangan ulangi URL ini; catat sebagai gap. |
| PAYWALL | Halaman di balik login/paywall. | Pakai sumber lain; jangan mengarang isinya. |
| UNSUPPORTED_TYPE | Tipe konten tidak didukung. | Pilih sumber bertipe teks/HTML. |
| TOO_LARGE | Halaman melebihi batas ukuran. | Gunakan snippet web_search untuk halaman ini. |
| NO_TEXT | Tidak ada teks yang bisa diekstrak. | Pakai sumber lain. |
| UNREACHABLE | Situs tidak dapat dihubungi. | Coba URL lain; jangan mengulang berkali-kali. |

---

Dokumen ini DIHASILKAN dari src/lib/tools/catalog.ts (satu sumber, tiga
pembaca — P8/D5). Ubah katalognya, lalu regenerasi; jangan sunting manual.
