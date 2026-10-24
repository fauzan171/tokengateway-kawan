# Changelog

Semua perubahan penting pada Kawan. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
versi mengikuti [Semantic Versioning](https://semver.org/lang/id/).

## [0.2.0] - 2026-10-21

### Ditambahkan

- Ekspor percakapan ke **PDF**, **DOCX**, dan **XLSX** melalui
  `GET /api/kawan/v1/chats/{chatId}/transfer?format=pdf|docx|xlsx`, plus tiga entri
  baru di menu sidebar. Tanpa dependensi baru: PDF ditulis sebagai PDF 1.4 minimal di
  server; DOCX/XLSX adalah wadah OOXML (ZIP berisi XML) dengan penulis ZIP sendiri.
- Pencarian web melalui SearXNG, dengan kebijakan egress yang menghormati konfigurasi
  (`OUTBOUND_ALLOWLIST`, `ALLOW_INSECURE_HTTP`) alih-alih konstanta statis.
- Pemulihan generasi menggantung (`reconcileGenerations`) saat worker start dan shutdown.
- Penyimpanan rahasia memakai envelope terenkripsi (`src/lib/secrets/envelope.ts`).
- Pelacakan pemakaian token (`recordUsage`).
- Pengambilan konten dari dokumen yang diunggah (`src/lib/documents/`) sebagai lampiran
  composer.

### Diubah

- `src/worker.ts` menggabungkan jalur dokumen, pembersihan orphan, dan pemulihan generasi
  dalam satu daur hidup yang sama.
- Permintaan keluar memakai `fetchOutbound`: `redirect: "manual"` dengan validasi
  allowlist pada setiap lompatan, menggantikan `redirect: "error"` yang menolak semua
  redirect tanpa memeriksanya.
- Teks `home.aboutBody` tidak lagi menyatakan "fitur chat belum tersedia" — percakapan,
  pencarian web, dan ekspor sudah berjalan.

### Diperbaiki

- Penulis ZIP mencatat offset local header di byte 42 central directory, bukan 38;
  pergeseran dua byte ini membuat DOCX dan XLSX ditolak semua pembaca meski diawali
  `PK\x03\x04`.
- `[Content_Types].xml` XLSX mendeklarisikan tipe untuk `workbook.xml` dan `worksheet+xml`
  dengan benar; sebelumnya tipe `sheet.main+xml` ditempelkan ke `sheet1.xml`.

### Catatan

- Belum ada: pembuatan gambar, transkripsi suara, sintesis suara, dan embedding
  (endpoint 9Router terkait membalas 400; tidak ada model embedding).
- PDF memakai font inti WinAnsi sehingga karakter di luar Latin-1 tampil sebagai `?`.

## [0.1.0] - 2026-10-17

### Ditambahkan

- Fondasi antarmuka dan autentikasi: Next.js 15 App Router, React 19, Prisma,
  login kredensial dan SSO Google, isolasi data per pengguna.
- Ekspor dan impor percakapan dalam Markdown serta JSON (`kawan.chat.v1`) dengan
  round-trip yang mempertahankan struktur pohon cabang.