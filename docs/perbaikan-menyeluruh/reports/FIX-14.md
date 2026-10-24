# FIX-14 — Office, OCR, vision, dan metadata

Status: **verified**

## Masalah

`extractText` hanya mengenal dua hal: `application/pdf` dan "selain itu teks".
Format dipilih dari **label klien**. Akibatnya:

- `.docx`/`.xlsx`/`.pptx` dikirim sebagai `application/pdf` akan masuk ke parser
  PDF dan gagal dengan pesan yang tidak berguna — atau lebih buruk, berkas biner
  apa pun diperlakukan sebagai teks UTF-8 dan chunk-nya jadi sampah yang tetap
  di-embed;
- PDF hasil pindai dilaporkan `NO_TEXT_LAYER` tanpa membedakan "dokumen kosong"
  dari "butuh OCR";
- tidak ada satu pun metadata yang bisa dibedakan: nama dari klien, waktu server,
  tanggal tertanam semuanya tercampur;
- tidak ada batas untuk mengirim gambar ke model vision.

## Solusi

### `src/lib/documents/magic.ts` — format dari byte

`detectFormat` memeriksa magic bytes: `%PDF-`, JPEG `FF D8 FF`, PNG, ZIP.
OOXML dibedakan dengan **membaca daftar entri ZIP** (`word/`, `xl/`, `ppt/`),
bukan dari nama berkas — jadi `.docx` yang di-rename tetap terdeteksi benar.
ZIP di-parse lewat `readZip` (FIX-12) sehingga limit anti-bomb tetap berlaku.

Format Office lama (`.doc/.xls/.ppt`, magic OLE2) → `unknown`, bukan ditebak:
parser-nya tidak ada, dan menebak berarti salah membaca.

`matchesClaimedMime` menolak ketidakcocokan label vs isi. `text/plain` dan
`text/markdown` sama-sama diterima untuk format `text` karena tidak ada cara
membedakannya dari byte.

### `src/lib/documents/office.ts` — DOCX, XLSX, PPTX

| Format | Cara | Hasil |
|---|---|---|
| DOCX | `word/document.xml` → `saxes` | paragraf = baris, `<w:t>` digabung per paragraf |
| PPTX | `ppt/slides/slideN.xml` urut numerik → `saxes` | satu slide = satu halaman bernomor |
| XLSX | `exceljs` | satu sheet = satu halaman + `cells[]` |

`saxes` adalah parser XML teruji (sudah ada sebagai dependensi transitif
`exceljs`) — **tidak** menambah dependensi baru, dan **tidak** memakai regex
atas XML.

`SheetCell` menyimpan `{sheet, cell (A1), kind: value|formula, text}`. Formula
disimpan sebagai `=SUM(B2:B2)` **tanpa dieksekusi**; nilai cache-nya tersimpan
sebagai sel terpisah — pembaca tidak boleh mengira keduanya sama.

Batas: 50 sheet, 20.000 sel. Relasi eksternal tidak pernah di-fetch: modul ini
hanya membaca entri ZIP di memori, tidak ada jalur jaringan sama sekali.

### `src/lib/documents/metadata.ts` — empat hal yang tidak boleh dicampur

| Field | Sumber | Dipercaya? |
|---|---|---|
| `clientFilename` | klien | tidak — label tampilan saja |
| `uploadedAt` | server | ya, fakta server |
| `embeddedCreated` | `docProps/core.xml` / PDF Info | tidak — bisa dikarang, dan itu dinyatakan di `unknown` |
| `embeddedAuthor` | idem | tidak diverifikasi |

EXIF/GPS **selalu** dibuang: `locationRetained: false` adalah konstanta, bukan
opsi. Foto tidak membuktikan tempat, dan menyebarkan koordinat membocorkan lokasi
tanpa diminta. Metadata yang tidak ada dilaporkan di `unknown`, tidak dikarang.

### `src/lib/documents/ocr.ts` — OCR berlabel keyakinan

- `ocrEnginePath()` memeriksa `KAWAN_TESSERACT_PATH` lalu `/usr/bin`,
  `/usr/local/bin`. Tidak ada di server ini → `ocrCapability()` menjawab
  `{available: false, reason: "ENGINE_MISSING"}`.
- `ocrImage` menjalankan Tesseract sebagai proses anak (`spawn`, stdin → stdout,
  timeout 60 s), bahasa `ind+eng`. Gagal → `OcrUnavailable` dengan alasan
  `ENGINE_MISSING` / `PAGES_EXCEEDED` / `ENGINE_FAILED` / `TIMEOUT`.
- `parseTsv` menghitung `confidence` rata-rata dari kolom confidence Tesseract.
  `needsReview: confidence < 70`. Prompt tidak pernah menyajikan teks OCR sebagai
  pasti; `confidence` **bukan** probabilitas jawaban benar dan itu ditulis di kode.
- `probeVision(model)` hanya menjawab boleh/tidak sebelum gambar dikirim:
  `maxPixels: 1568`, `requiresConsent: true`.

### `src/lib/documents/extract.ts` — dispatcher

`extractText` sekarang memilih parser dari magic bytes, dan `mime` klien hanya
dipakai untuk mendeteksi `MIME_MISMATCH`. Kode galat baru:
`UNSUPPORTED_FORMAT`, `MIME_MISMATCH`, `OCR_UNAVAILABLE`.

PDF tanpa lapisan teks → `OCR_UNAVAILABLE` dengan pesan yang menyebut OCR belum
dikonfigurasi. Bukan `NO_TEXT_LAYER` lagi: pengguna perlu tahu berkasnya **bisa**
dibaca kalau OCR dipasang, bukan bahwa dokumennya kosong.

`uploadDocument` menolak `MIME_MISMATCH` di depan (415) supaya pengguna tahu saat
unggah, bukan setelah job ekstraksi gagal.

## Tes (26 baru, `src/lib/documents/office.test.ts`)

Fixture OOXML dibangun nyata dengan `writeZip`, jadi XML benar-benar diurai:

- **deteksi**: PDF/teks/OOXML dari byte; docx vs xlsx vs pptx dari entri ZIP;
  ZIP biasa bukan OOXML; OLE2 → `unknown`; `matchesClaimedMime` positif & negatif.
- **DOCX**: paragraf bergabung jadi baris, paragraf kosong dibuang; tanpa teks →
  `NO_TEXT_LAYER`; tanpa `word/document.xml` → `EXTRACT_FAILED`.
- **PPTX**: urut numerik (`slide10` setelah `slide2`, bukan urutan string); tanpa
  slide → `NO_TEXT_LAYER`.
- **XLSX**: sheet jadi halaman, sel `B2` punya sheet+alamat+nilai; `C3` =
  `{kind: "formula", text: "=SUM(B2:B2)"}` — formula tidak dieksekusi; workbook
  rusak → `EXTRACT_FAILED`.
- **dispatcher**: MIME tidak cocok ditolak sebelum diurai; OLE2 dan PNG →
  `UNSUPPORTED_FORMAT`; DOCX membawa `format: "docx"`; teks biasa tetap jalan.
- **metadata**: nama klien / waktu unggah / tanggal tertanam dibedakan; tanggal
  tertanam ditandai "tidak diverifikasi"; metadata hilang → `unknown`, bukan
  dikarang; EXIF/GPS → `strippedFields` berisi `gps`, `locationRetained: false`;
  PDF `CreationDate` + `Author` terbaca.
- **OCR/vision**: `parseTsv` memisahkan baris dan menghitung keyakinan (90/80/40 →
  70); keyakinan < 70 → `needsReview`; mesin tidak ada → `ENGINE_MISSING` dan
  `ocrImage` melempar `OcrUnavailable`; halaman 999 → `PAGES_EXCEEDED` sebelum
  mesin dijalankan; `probeVision` menolak model non-vision dan menandai consent.

Satu tes lama disesuaikan: `run-extract.test.ts` "PDF rusak" dulu memakai teks
biasa berlabel PDF. Dengan deteksi magic bytes itu kini benar ditolak sebagai
`MIME_MISMATCH`, jadi fixture diganti `%PDF-1.7\nrusak tanpa xref` agar tetap
menguji jalur "PDF rusak".

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → 976 passed (93 file)   [950 baseline + 26]
```

Tidak ada perubahan skema → tidak ada migrasi.

## Batas yang disengaja

- **OCR tidak terpasang di server ini.** `ocrCapability()` melaporkan
  `ENGINE_MISSING` dan jalur OCR diuji sebagai penolakan eksplisit, bukan
  keberhasilan. Memasang Tesseract + `ind/eng` traineddata adalah langkah
  deployment, bukan kode.
- **PDF pindai belum benar-benar di-OCR.** Render halaman PDF → gambar
  membutuhkan `pdftoppm`/poppler yang juga tidak ada. Yang ada: deteksi, kontrak,
  dan alasan yang jelas.
- **DOCX memakai `saxes` langsung, bukan `mammoth`.** `mammoth` tidak terpasang;
  menambah dependensi untuk mengambil teks mentah tidak sepadan. Konsekuensinya
  tabel Word dibaca sebagai baris teks, bukan struktur tabel.
- **XLSX: gaya, komentar, dan gambar tidak dibaca.** Yang dibutuhkan gate adalah
  sheet/cell/nilai tetap terlacak, dan itu terpenuhi.
- **EXIF tidak diurai sama sekali** — hanya dideteksi keberadaannya lalu dibuang.
  Tanggal kamera tidak ditampilkan; tambahkan pembaca EXIF bila ada kebutuhan.
- **Deteksi paywall/vision tidak memanggil model.** `probeVision` adalah
  penilaian dari nama model, bukan capability discovery dari provider.
