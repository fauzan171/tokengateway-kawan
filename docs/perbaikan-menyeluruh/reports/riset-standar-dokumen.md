# Riset standar dokumen (PDF/Excel) & dokumentasi tool

Status: **riset; tidak ada kode yang diubah**. Satu-satunya berkas yang ditulis tugas
ini adalah laporan ini.

Tanggal: 2026-10-23. Penulis: riset-dokumen (tim kawan-riset-masa-depan).
Checkout: `/home/hermes/workspace/projects/tokengateway-kawan`, branch
`merge/main-into-feat-nt-p1`. Baseline status: FIX-01..16 `verified`, FIX-17..24 `planned`.

Metode: baca kode (bukan asumsi) + **eksekusi probe** untuk setiap klaim perilaku yang
bisa diuji tanpa DB/jaringan. Probe dijalankan dengan `npx tsx` di checkout ini,
berkas probe sementara dihapus setelah dipakai; tidak ada perubahan repo. Klaim yang
hanya berasal dari membaca kode ditandai *(kode)*; klaim hasil eksekusi ditandai
**(terbukti)** dengan keluaran apa adanya.

---

## 0. Ringkasan keputusan

1. **Skema dokumen kanonik sudah ada dan sudah benar arahnya** (`DocSchema` di
   `src/lib/artifacts/document.ts`): `{title, blocks[]}` dengan lima tipe blok.
   Yang belum ada bukan skema, melainkan **batas per tipe blok**, **validasi yang
   konsisten antar-renderer**, dan **keseragaman presentasi**.
2. **Tiga cacat nyata ditemukan dan terbukti** (bukan opini): nama sheet XLSX bisa
   membuat render gagal total, hasil DOCX/XLSX/PPTX buatan Kawan sendiri tidak bisa
   dibaca balik oleh Kawan (`detectFormat` → `zip`), dan konversi artefak biner ke
   teks meloloskan byte biner sebagai Markdown. Ketiganya murah diperbaiki dan
   wajib masuk sebelum fitur dokumen ditambah.
3. **Dokumentasi tool belum ada untuk pengguna maupun model.** `buildCapabilityBlock`
   hanya menyebut *nama* tool; tidak ada "kapan dipakai", "batas", "kegagalan".
   Standar dokumentasi diusulkan sebagai **data di satu tempat** yang dipakai prompt,
   panel UI, dan berkas `docs/tools/*.md` — supaya tidak ada drift janji.
4. Urutan kerja diusulkan **D0 (tutup tiga cacat) → D1 (batas skema) → D2 (tema) →
   D3 (blok baru satu per satu) → D4 (template) → D5 (dokumentasi tool)**. Tidak ada
   langkah yang butuh dependensi baru.

---

## 1. Inventaris: yang benar-benar ada hari ini

### 1.1 Skema dokumen — `src/lib/artifacts/document.ts` (67 baris)

```ts
type DocBlock =
  | { type: "heading"; text: string; level?: 1|2|3 }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; text: string; language?: string };
type DocSchema = { title: string; blocks: DocBlock[] };
```

Batas yang **ditegakkan**: `MAX_BLOCKS = 500`, `MAX_TEXT = 20_000` per field `text`
(dipotong, bukan ditolak), `level` selain 2/3 jatuh ke 1, blok tak dikenal dibuang,
baris tabel yang panjangnya ≠ jumlah header dibuang.

Batas yang **tidak ditegakkan** (terbukti):

| Probe | Keluaran |
|---|---|
| tabel 5.000 baris | `rows kept: 5000` |
| bullets 5.000 butir | `bullets kept: 5000` |
| satu header sel 30.000 char | `header len: 30000` |

Artinya `MAX_TEXT` hanya berlaku untuk `text`, bukan `headers`/`items`/`title`.
Satu dokumen 500 blok × 20.000 char = 10 juta char tetap "sah", dan `title` tidak
punya batas sama sekali.

### 1.2 Renderer — `render.ts`, `render-binary.ts` (158 baris)

| Format | Pustaka | Perilaku nyata |
|---|---|---|
| pdf | pdfkit | font inti Helvetica/Courier, semua karakter > U+00FF diganti `?` (`latin1()`, baris 20) *(kode)*; tabel diratakan jadi baris `a | b | c`; tidak ada paginasi eksplisit (mengandalkan pdfkit) |
| docx | docx | `HeadingLevel` 1–3, bullets, tabel asli (ada `tblBorders`), code Courier New |
| xlsx | exceljs | **satu sheet** bernama `doc.title.slice(0,31)`; hanya blok `table` jadi grid, blok lain diratakan ke satu sel kolom A |
| pptx | pptxgenjs | 12 blok per slide, semua teks di `x:0.5, y:1.3 + used*0.6` |

### 1.3 Format & lifecycle — `format.ts`, `create.ts`, `zip.ts`

- 10 format: md, txt, json, csv, html, xlsx, docx, pdf, zip, png. MIME per format lengkap.
- `MAX_ARTIFACT_BYTES = 25 MiB`, retensi 7 hari, kuota 100/hari, unduhan
  `attachment` + `nosniff` + `CSP: default-src 'none'; sandbox`, 404 (bukan 403) untuk
  artefak orang lain.
- `MAX_ARTIFACTS_PER_RUN = 10` **dideklarasikan tapi tidak dipakai** (grep: hanya
  didefinisikan di `format.ts`). Batas nyata hari ini adalah `toolCalls.slice(0, 3)`
  di `generate.ts` baris 1130.
- ZIP: batas entri 256, 50 MiB, rasio 100, kedalaman 8; tolak traversal/symlink/duplikat.

### 1.4 Jalur ekspor percakapan — `src/lib/chat/document-export.ts` (295 baris)

Penulis PDF **kedua** (tangan sendiri: content stream + xref), DOCX/XLSX dari XML
mentah, semua lewat `zipBytes` STORE. Ukuran halaman PDF di sini `[0 0 612 842]`
(terbukti), sedangkan jalur pdfkit menghasilkan `[0 0 612 792]` (terbukti). Dua
jalur PDF = dua hasil visual berbeda untuk produk yang sama.

### 1.5 Tool yang benar-benar bisa dipanggil model

`CHAT_TOOLS = [GENERATE_FILE_TOOL, GENERATE_DOCUMENT_TOOL]` — **dua** tool:

| Tool | Format | Argumen |
|---|---|---|
| `generate_file` | md, txt, json, csv | `format`, `displayName`, `content` atau `rows` |
| `generate_document` | pdf, docx, xlsx | `format`, `displayName`, `doc` (DocSchema) |

Di luar itu: `compute`/`chart`/`qr` hanya lewat HTTP `POST /api/kawan/v1/tools/compute`
(tidak terdaftar sebagai tool model); `web.read`/`verifyDoi` dipakai internal oleh
`enrichSources`, bukan tool; `pptx` sengaja ditolak route (`FORMAT_NOT_READY`) dan
ditolak validator tool.

### 1.6 Dokumentasi tool yang ada hari ini

Satu-satunya "dokumentasi tool" yang dibaca model adalah
`buildCapabilityBlock` (`src/lib/chat/prompt-builder.ts`):

```
Tool yang benar-benar tersedia: generate_file, generate_document. Tool lain tidak ada.
```

Isinya: **nama saja**. Tidak ada kapan dipakai, batas ukuran, bentuk argumen, atau
apa yang harus dilakukan model saat tool gagal. Untuk pengguna tidak ada apa pun
(tidak ada panel Tools, tidak ada `docs/tools/`).

---

## 2. Temuan (cacat yang terbukti, bukan dugaan)

### T1 — Nama sheet XLSX bisa menggagalkan render total · severity tinggi

`renderXlsxBytes` memakai `doc.title.slice(0, 31)` sebagai nama sheet. ExcelJS
menolak nama yang memuat `* ? : \ / [ ]` atau kosong:

| Judul dokumen | Hasil |
|---|---|
| `Laporan Bulanan` | `OK 6056` |
| `Laporan/2026: Q1` | `ERR Worksheet name Laporan/2026: Q1 cannot include any of the following characters: * ? : \ / [ ]` |
| `Rekap [final]` | `ERR Worksheet name ...` |

Konsekuensi: judul yang sangat wajar ("Laporan/2026: Q1") membuat `generate_document`
gagal. Di jalur tool kegagalannya **diam** (catch kosong → catatan `file-failed`);
di jalur API, galat ExcelJS bukan `ArtifactError` sehingga jatuh ke
`INTERNAL_ERROR` 500 *(kode: `toErrorResponse` memetakan galat tak dikenal ke 500)*.

### T2 — Dokumen OOXML buatan Kawan tidak bisa dibaca balik oleh Kawan · severity tinggi

`readZip` menolak entri direktori (nama berakhiran `/`) dengan `ZIP_UNSAFE_PATH`
(`zip.ts` baris 32). Docx/exceljs/pptxgenjs **selalu** menulis entri direktori:

| Berkas hasil render | Entri direktori | `readZip` |
|---|---|---|
| docx (22 entri) | `word/`, `word/_rels/`, `docProps/`, `_rels/`, `word/theme/` | `ZIP_UNSAFE_PATH` |
| xlsx (16 entri) | `_rels/`, `xl/`, `xl/_rels/`, … | `ZIP_UNSAFE_PATH` |
| pptx (39 entri) | `_rels/`, `ppt/`, `ppt/slides/`, … | `ZIP_UNSAFE_PATH` |

Rantai akibatnya (terbukti):

```
detectFormat(renderDocxBytes(...))  -> "zip"      (seharusnya "docx")
detectFormat(renderXlsxBytes(...))  -> "zip"      (seharusnya "xlsx")
detectFormat(renderPptxBytes(...))  -> "zip"      (seharusnya "pptx")
extractText(DOCX_MIME, renderDocxBytes(...))  -> "Arsip ZIP tidak bisa dibaca sebagai dokumen"
```

Jadi pengguna yang mengunduh DOCX buatan Kawan lalu mengunggahnya kembali ditolak
`MIME_MISMATCH` di `uploadDocument`. Ini juga membuat klaim "input dan output
Office saling konsisten" tidak benar hari ini.

Catatan penting: penolakan traversal tetap harus ada. Yang salah adalah memperlakukan
**entri direktori** sebagai traversal — direktori adalah bagian sah format ZIP/OOXML.
Perbaikan minimal: tolak `..`/`.`/absolut/drive/backslash seperti sekarang, tetapi
**lewati** (bukan tolak) entri yang berakhiran `/`, dengan tetap menghitungnya ke
`maxEntries`.

### T3 — Konversi artefak biner ke teks meloloskan byte biner · severity tinggi

`convertArtifact` menolak target biner, tetapi **tidak memeriksa sumber**. Route
`POST /api/kawan/v1/artifacts` mengambil `sourceFormat` dari baris DB dan
me-cast-nya ke union teks:

```ts
sourceFormat === "json" ? … : sourceFormat === "csv" ? … : { format: sourceFormat as "md"|"txt"|"html", content: text }
```

Probe dengan format sumber `pdf`:

```
format keluar: md | isi: "%PDF-1.3\n%âã"
```

Hasilnya artefak `.md` berisi byte PDF. Bukan galat, bukan konversi — sampah yang
tampak seperti keberhasilan. Perbaikan minimal: tolak eksplisit sumber di luar
md/txt/html/json/csv dengan kode `CONVERSION_UNSUPPORTED` (sudah ada) sebelum
membaca isi.

### T4 — Tata letak PPTX meluber keluar slide · severity sedang

Slide bawaan pptxgenjs = `LAYOUT_16x9` = 10 × 5,625 inci. Rumus
`y = 1.3 + used*0.6` untuk 12 blok menghasilkan y blok ke-8 = 5,5 inci dan blok
ke-12 = 7,9 inci (terbukti) — jauh di bawah tepi slide. Selain itu semua blok
`table` diletakkan di `y: 1.3` yang sama sehingga tabel kedua menimpa yang pertama
*(kode, baris 141–144)*.

### T5 — Tabel dan bullets tidak berbatas, tetapi tabel juga tidak muat

Selain T1–T4, kombinasi batas yang tidak ada (§1.1) dengan tata letak tetap
menghasilkan dokumen yang "sah" tetapi tidak terbaca: tabel 30 kolom di PPTX lolos
render (terbukti `pptx wide table ok`) tanpa peringatan apa pun.

### T6 — Dua penulis PDF, dua ukuran halaman

`render-binary.ts` (pdfkit) → `/MediaBox [0 0 612 792]`; `document-export.ts`
(tangan) → `[0 0 612 842]` (keduanya terbukti). Ekspor percakapan dan dokumen
buatan model tidak akan pernah sama tampilannya. Bukan bug fatal, tetapi harus
diputuskan: satu ukuran halaman (A4 = 595×842 pt) untuk keduanya.

### T7 — Batas & kegagalan pencarian web tidak pernah sampai ke pengguna

`SearchError.retryable` dihitung rapi (`429`/`5xx` → true), tetapi `generate.ts`
menangkap semua galat dengan `catch {}` dan hanya menyetel `searchFailed = true`
*(kode)*. Model tidak pernah tahu pencarian gagal karena apa, dan pengguna hanya
melihat catatan `web-search-unavailable` tanpa alasan. Untuk "dokumentasi tool yang
jelas" ini penting: kegagalan yang tidak bisa dijelaskan tidak bisa didokumentasikan.

---

## 3. Usulan skema dokumen kanonik v2

Prinsip: **aditif, satu tipe blok = satu renderer = satu tes**. Skema yang ada
dipertahankan; tidak ada format dokumen kedua.

```ts
type DocSchemaV2 = {
  /** Judul dokumen; dipakai sebagai judul halaman dan nama sheet (disanitasi). */
  title: string;                       // <= 200 char, wajib, tidak boleh kosong
  /** Opsional; tanpa ini semua renderer memakai tema bawaan. */
  meta?: {
    theme?: "kawan-default" | "kawan-formal";  // preset di src/lib/artifacts/theme.ts
    subtitle?: string;                          // <= 200 char
    author?: string;                            // <= 120 char
    createdAt?: string;                         // ISO-8601; default waktu render
    lang?: string;                              // BCP-47, default "id"
  };
  blocks: DocBlockV2[];                // <= 500 (tetap)
};

type DocBlockV2 =
  | { type: "heading"; text: string; level?: 1|2|3 }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[]; ordered?: boolean }
  | { type: "table"; headers: string[]; rows: string[][];
      caption?: string; align?: ("left"|"right"|"center")[] }
  | { type: "code"; text: string; language?: string; caption?: string }
  // --- baru, bertahap; masing-masing boleh ditolak renderer lama ---
  | { type: "image"; artifactId: string; alt: string; caption?: string; widthPct?: number }
  | { type: "pageBreak" }
  | { type: "divider" };
```

Alasan tiap keputusan:

- **`image` merujuk `artifactId`, bukan base64.** Byte sudah punya rumah
  (`Artifact`, retensi 7 hari, owner-checked). Base64 di dalam DocSchema akan
  menggandakan ukuran dokumen di DB dan membuka jalan untuk menyelundupkan byte
  yang tidak lewat validasi gambar.
- **`pageBreak` dan `divider` murah** (satu panggilan di pdfkit/docx, diabaikan di
  xlsx dengan catatan) dan langsung menutup keluhan "dokumen panjang tidak bisa
  dipisah bab".
- **`ordered` pada bullets** menutup kebutuhan daftar bernomor tanpa menambah tipe
  blok baru.
- **`caption` pada table/code** adalah satu string; ia yang membuat "Tabel 1 —"
  mungkin tanpa sistem penomoran otomatis (penomoran otomatis = TOC = ditunda).
- **`theme` bukan bagian tiap blok**, melainkan satu field tingkat dokumen, supaya
  renderer tidak perlu membaca gaya per blok.
- **DITOLAK dengan sadar**: `html` mentah (XSS lewat renderer), `toc` otomatis,
  `header`/`footer` per halaman, catatan kaki, dan kolom multi-sheet XLSX. Semuanya
  menambah mesin tata letak; belum ada satu pun kebutuhan nyata yang menuntutnya.

### 3.1 Batas kanonik (satu tabel, ditegakkan di `parseDocSchema`)

| Entitas | Batas | Perilaku saat lewat |
|---|---|---|
| `title` | 200 char | dipotong |
| `blocks` | 500 | tolak `INVALID_DOC_SCHEMA` (seperti sekarang) |
| `text` (heading/paragraph/code) | 20.000 char | dipotong (seperti sekarang) |
| total karakter seluruh blok | 200.000 | tolak `DOC_TOO_LARGE` |
| `bullets.items` | 100 butir | sisanya dibuang + `truncated: true` |
| satu item bullets | 500 char | dipotong |
| `table.headers` | 12 kolom | tolak `TABLE_TOO_WIDE` |
| `table.rows` | 2.000 baris | sisanya dibuang + `truncated: true` |
| satu sel tabel | 500 char | dipotong |
| `code.language` | 32 char, `[a-z0-9+#-]` | jatuh ke `undefined` |
| `image` per dokumen | 20 | sisanya dibuang + `truncated: true` |
| `caption`/`alt`/`subtitle` | 200 char | dipotong |
| nama sheet XLSX | hasil sanitasi `* ? : \ / [ ]` → `-`, trim, ≤31, kosong → `Sheet1` | otomatis |

Angka 12 kolom dipilih karena PDF A4 dengan font 11pt hanya muat ~12 kolom rata-rata
sebelum terpotong; PPTX 10 inci muat ~8. Batas per format boleh lebih ketat
(`pptx: 8 kolom, 8 blok/slide`) tetapi **tidak boleh lebih longgar** dari tabel ini.

`truncated: true` harus dikembalikan ke pemanggil dan diteruskan sebagai catatan
`doc-truncated` pada pesan — memotong diam-diam adalah bentuk lain dari berbohong.

### 3.2 Aturan validasi yang sekarang hilang

1. `title` kosong setelah trim → tolak (sudah ada), **tapi juga** batasi 200 char.
2. `table.rows` hari ini hanya membuang baris yang panjangnya salah. Perlu juga:
   baris kosong dibuang, sel non-string di-`String()` (jangan buang seluruh baris).
3. Blok tak dikenal dibuang — pertahankan, tetapi hitung dan kembalikan jumlahnya
   supaya model bisa memperbaiki diri (`unknownBlocks: n`).

---

## 4. Usulan tema & template

### 4.1 Tema (`src/lib/artifacts/theme.ts`, satu objek beku)

```ts
type DocTheme = {
  id: "kawan-default" | "kawan-formal";
  page: { size: "A4"; marginPt: number };        // 595 x 842 pt
  font: { body: string; heading: string; mono: string; bodyPt: number };
  heading: { h1Pt: number; h2Pt: number; h3Pt: number };
  table: { headerBold: boolean; borderPt: number; zebra: boolean };
  colors: { text: string; muted: string; accent: string };
};
```

Satu objek dipakai **keempat** renderer. Tanpa ini, "standar dokumen Kawan" hanya
berarti "bawaan pustaka masing-masing", yang memang keadaan hari ini.

**Batas jujur font**: PDF hari ini memakai font inti (Helvetica/Courier) dan
mengganti karakter > U+00FF dengan `?`. Artinya emoji, CJK, dan tanda kutip tipografis
hilang di PDF. Dua pilihan, dan hanya satu yang boleh dijanjikan:

- **A (murah, dipilih sekarang)**: pertahankan font inti, nyatakan batas Latin-1 di
  dokumentasi tool dan di catatan hasil (`pdf-nonlatin`), ganti tanda kutip/tanda
  pisah tipografis ke ASCII saat masuk PDF.
- **B (nanti)**: sematkan satu TTF Unicode (mis. Noto Sans, OFL) dan daftarkan di
  inventaris lisensi FIX-24. Baru dikerjakan bila ada permintaan nyata berbahasa
  non-Latin.

### 4.2 Template (maksimum tiga, sebagai data)

Template = fungsi kecil yang **menghasilkan `DocSchemaV2`**, bukan mesin template.

| Template | Isi | Dipakai untuk |
|---|---|---|
| `laporan` | subtitle + heading per bab + paragraf + bullets + tabel + caption | laporan kerja, hasil riset |
| `surat` | kop (paragraph tebal), nomor, tujuan, isi, penutup, tanda tangan | surat resmi sederhana |
| `rekap` | hanya tabel (judul + header + baris + caption) + paragraf pembuka | data tabular → XLSX/PDF |

Yang **tidak** dibuat sekarang: cover berhalaman sendiri, daftar isi otomatis,
nomor halaman, header/footer berjalan, kop berlogo. Semuanya butuh mesin tata letak
dan tema yang sudah teruji dulu.

---

## 5. Standar dokumentasi tool

### 5.1 Masalah yang harus dijawab

Model hari ini hanya tahu **nama** tool. Akibatnya ia memilih tool secara buta dan
tidak tahu apa yang harus dilakukan saat tool gagal. Pengguna tidak punya daftar
tool sama sekali. Dokumentasi untuk developer (SDD `04-execution-tools.md`) ada,
tetapi ia menjelaskan kontrak registry yang **belum diimplementasi**, bukan tool
yang benar-benar terpasang.

### 5.2 Satu sumber, tiga pembaca

```
src/lib/tools/catalog.ts   (data: ToolDoc[])
   ├─ buildCapabilityBlock()  → ringkasan untuk model (nama + kapan dipakai + batas)
   ├─ panel UI read-only      → daftar tool untuk pengguna
   └─ docs/tools/<id>.md      → halaman lengkap (diperiksa oleh satu tes)
```

Alasan: tiga salinan manual akan berbeda dalam sebulan. Satu array + satu tes
kesesuaian jauh lebih murah daripada sinkronisasi manual.

### 5.3 Bentuk `ToolDoc` (field wajib, tidak boleh kosong)

```ts
type ToolDoc = {
  id: string;                 // "generate_document"
  version: number;            // naik saat argumen/batas berubah
  ringkas: string;            // 1 kalimat, <= 120 char
  kapanDipakai: string[];     // 2..5 butir
  kapanJangan: string[];      // minimal 2 butir — ini yang mencegah salah pilih
  argumen: {
    nama: string; tipe: string; wajib: boolean; batas?: string; keterangan: string;
  }[];
  contoh: { valid: string; tidakValid: string };   // JSON siap tempel
  efek: "read" | "local" | "write";                // selaras SDD ToolEffect
  approval: boolean;
  batas: { bytes?: string; jumlah?: string; waktu?: string };
  kegagalan: { kode: string; arti: string; tindakanModel: string }[];
  hasil: string;              // part apa yang muncul ("kartu artefak")
};
```

Aturan isi yang dipegang:

1. **`kapanJangan` wajib ada.** Dokumentasi yang hanya mengatakan "gunakan tool ini
   untuk X" menghasilkan pemakaian berlebihan. Contoh nyata:
   `generate_document` **jangan** dipakai untuk satu paragraf pendek — jawab di chat.
2. **Setiap kode kegagalan harus punya `tindakanModel`.** "Gagal" tanpa tindakan
   membuat model mengulang argumen yang sama. Hari ini kode yang benar-benar
   dikembalikan: `INVALID_TOOL_ARGS`, `INVALID_DOC_SCHEMA`, `TOO_LARGE`,
   `QUOTA_EXCEEDED`, `FORMAT_NOT_READY`, `CONVERSION_UNSUPPORTED`, `ZIP_*`,
   `SEARCH_*` (via `SearchError`).
3. **Batas ditulis sebagai angka**, bukan "ukuran wajar": "maksimum 25 MiB",
   "maksimum 500 blok", "12 kolom".
4. **`approval` diisi dari capability, bukan dikarang.** `tools` sudah
   `requiresApproval: true` di route capabilities; dokumentasi harus menyebut itu.
5. **Tidak menjanjikan yang tidak ada.** `generate_file` hari ini **tidak** menerima
   `zip`, `html`, atau `png`; dokumentasi tidak boleh menyebutnya sebagai tersedia.

### 5.4 Isi minimum `docs/tools/<id>.md`

```markdown
# <id> (v<n>)

<ringkas>

## Kapan dipakai
## Kapan JANGAN dipakai
## Argumen
| nama | tipe | wajib | batas | keterangan |
## Contoh
### Valid
### Tidak valid (dan mengapa)
## Efek & persetujuan
## Batas
## Kegagalan
| kode | arti | yang harus dilakukan model |
## Hasil
```

### 5.5 Lima dokumentasi yang dibutuhkan sekarang

| Tool | Efek | Status hari ini |
|---|---|---|
| `generate_file` | local | ada, terpasang |
| `generate_document` | local | ada, terpasang |
| `compute` | read (deterministik) | modul + HTTP ada, **belum** tool model |
| `web.search` | read | dipakai internal (bukan tool) |
| `web.read` | read | modul ada, **belum** diekspos sebagai tool |

Untuk dua yang belum terpasang, dokumentasinya ditulis sebagai **rencana** dengan
penanda jelas "belum tersedia", atau tidak ditulis sama sekali. Menulis dokumentasi
untuk tool yang tidak ada adalah bentuk kebohongan yang paling mudah terdeteksi.

### 5.6 Yang harus diperbaiki pada `buildCapabilityBlock`

Sekarang: satu baris berisi nama tool. Usul (tetap ≤ ~600 char agar tidak memakan
konteks; `PROMPT_BUDGET_CHARS = 12_000` dan blok kemampuan tidak pernah dipotong):

```
## Fakta kemampuan
Tool tersedia:
- generate_file — berkas teks (md/txt/json/csv). Maks 25 MiB. Bukan untuk dokumen rapi.
- generate_document — PDF/DOCX/XLSX berstruktur (judul, bab, daftar, tabel).
  Maks 500 blok, 12 kolom tabel. Bukan untuk balasan pendek.
Tool lain tidak ada. Bila tool gagal, sebutkan kodenya kepada pengguna; jangan
mengulang argumen yang sama.
```

Alasan bentuk ini: nama + batas + larangan, tiga hal yang mengubah perilaku. Daftar
argumen lengkap sudah ada di JSON schema tool yang dikirim ke gateway; mengulanginya
di prompt hanya membakar token.

---

## 6. Batas yang diusulkan (ringkas, satu tempat)

| Area | Batas | Sumber hari ini |
|---|---|---|
| Artefak | 25 MiB/berkas, 100/hari, retensi 7 hari | `format.ts`, `create.ts` (ada) |
| Artefak per run | 10 | `MAX_ARTIFACTS_PER_RUN` (dideklarasikan, **tidak dipakai**) |
| Tool call per giliran | 3 | `generate.ts` `slice(0,3)` (ada) |
| DocSchema | 500 blok, 20k char/teks, **200k char total** | sebagian ada |
| Tabel | 12 kolom, 2.000 baris, 500 char/sel | **belum ada** |
| Bullets | 100 butir, 500 char/butir | **belum ada** |
| Gambar dalam dokumen | 20 blok, PNG/JPEG/WebP, 4 MiB/gambar | **belum ada** |
| PDF | A4 595×842 pt, Latin-1 (font inti) | **belum ada** (dua ukuran halaman sekarang) |
| PPTX | 16:9, 8 blok/slide, 8 kolom/tabel | **belum ada** |
| Pencarian web | 5 hasil, 2 halaman dibaca, snippet 300 char, teks 2.000 char/sumber | `web.ts`, `read.ts` (ada) |
| Baca halaman | 2 MiB, 200k char, 10 dtk | `READ_LIMITS` (ada) |

---

## 7. Urutan kerja yang diusulkan

Setiap langkah = satu perubahan yang bisa diuji sendiri. Tidak ada dependensi baru.

| # | Langkah | Berkas | Kenapa di urutan ini |
|---|---|---|---|
| D0a | `readZip`: lewati entri direktori (tetap tolak traversal) | `artifacts/zip.ts` | Membuka T2; tanpa ini seluruh uji round-trip Office mustahil |
| D0b | Sanitasi nama sheet XLSX + fallback `Sheet1` | `render-binary.ts` | Menutup T1 (satu fungsi, satu tes) |
| D0c | Tolak sumber konversi non-teks | `artifacts/convert.ts` | Menutup T3 |
| D1 | Batas kanonik §3.1 di `parseDocSchema` + `truncated` + `unknownBlocks` | `document.ts` | Semua langkah berikut mengasumsikan input berbatas |
| D2 | `theme.ts` + pakai di 4 renderer + satu ukuran halaman PDF | `artifacts/theme.ts`, `render-binary.ts` | Konsistensi antar-format; prasyarat template |
| D3 | Blok `pageBreak` → `divider` → `ordered` → `image` (satu per PR) | `document.ts` + renderer | Tiap blok = 1 tipe + 1 renderer + 1 tes pembaca independen |
| D4 | Tiga template §4.2 | `artifacts/templates.ts` | Butuh D2; menghasilkan DocSchema, bukan mesin baru |
| D5 | `tools/catalog.ts` + `docs/tools/*.md` + tes kesesuaian + `buildCapabilityBlock` | `tools/catalog.ts`, `prompt-builder.ts` | Bisa jalan paralel dengan D1–D4 |
| D6 | Perbaiki tata letak PPTX (hitung tinggi, tabel per slide) | `render-binary.ts` | Butuh D1 (batas kolom) supaya tata letak punya asumsi tetap |

Dependensi luar tim ini: `FIX-20` (approval) wajib sebelum tool berefek tulis;
`FIX-24` (inventaris lisensi/font) wajib sebelum opsi font B; `FIX-17` tidak
relevan untuk dokumen (tidak ada eksekusi kode).

---

## 8. Bukti penerimaan yang harus ada nanti

| Uji | Bukti |
|---|---|
| Round-trip | `renderDocxBytes` → `detectFormat` = `docx`; `extractText` mengembalikan teks yang sama (idem xlsx, pptx) |
| Judul jahat | `title: "Laporan/2026: Q1"` → XLSX tetap ter-render, nama sheet tersanitasi |
| Konversi | `convertFrom` artefak pdf + `format: md` → 400 `CONVERSION_UNSUPPORTED`, bukan file .md berisi byte PDF |
| Batas | 13 kolom → `TABLE_TOO_WIDE`; 2.001 baris → terpotong + `truncated: true`; 500 blok × 20k char → `DOC_TOO_LARGE` |
| Tata letak PPTX | 12 blok → semua kotak teks berada di dalam 0 ≤ y ≤ 5,625 inci (assert pada XML `ppt/slides`) |
| Tema | PDF/DOCX/XLSX dari dokumen yang sama memakai ukuran font & margin dari satu objek tema |
| Dokumentasi tool | setiap tool di `CHAT_TOOLS` punya `ToolDoc` lengkap; `docs/tools/<id>.md` cocok dengan data; setiap kode galat punya `tindakanModel` |
| PDF non-Latin | dokumen berisi emoji/CJK → catatan `pdf-nonlatin` muncul, tidak ada `?` tanpa penjelasan |

---

## 9. Yang tidak boleh dijanjikan

1. **Bukan "dokumen seperti Claude" secara piksel.** Yang bisa dijamin: struktur
   (judul, bab, daftar, tabel, code, gambar) tervalidasi dan konsisten antar-format.
   Fidelity layout (CJK, emoji, tabel lebar, font hilang) adalah risiko sisa.
2. **Bukan konversi dua arah.** PDF/DOCX/XLSX tidak dikonversi balik ke teks;
   rekonstruksi butuh LibreOffice headless dan berada di luar lingkup.
3. **Bukan XLSX penuh.** Satu sheet, tanpa formula yang dieksekusi, tanpa macro,
   tanpa pivot. Tipe sel kaya (angka/tanggal) belum dijamin sampai renderer diuji.
4. **Bukan template tanpa batas.** Tiga template, bukan sistem template pengguna.
5. **Bukan dokumentasi tool yang lengkap.** Hanya tool yang benar-benar terpasang.
   `compute`, `web.search`, `web.read` didokumentasikan sebagai rencana, bukan fitur.
6. **Bukan jaminan tool selalu berhasil.** Kegagalan tool tidak menggagalkan jawaban
   (desain yang sudah ada), tetapi harus **terlihat** — kode galat wajib sampai ke
   pengguna, bukan ditelan `catch {}`.

---

## 10. Sumber

Kode yang dibaca (semua di checkout ini):

- `src/lib/artifacts/document.ts`, `render.ts`, `render-binary.ts`, `format.ts`,
  `convert.ts`, `zip.ts`, `create.ts`, `document.test.ts`
- `src/lib/chat/file-tool.ts`, `generate.ts`, `prompt-builder.ts`, `content.ts`,
  `document-export.ts`
- `src/lib/search/web.ts`, `prompt.ts`; `src/lib/sources/record.ts`, `read.ts`, `crossref.ts`
- `src/lib/documents/extract.ts`, `office.ts`, `magic.ts`, `upload.ts`, `context.ts`, `citations.ts`
- `src/lib/tools/compute.ts`, `chart.ts`, `qr.ts`; `src/lib/net/policy.ts`
- `src/app/api/kawan/v1/artifacts/route.ts`, `artifacts/[artifactId]/route.ts`,
  `tools/compute/route.ts`, `capabilities/route.ts`

Dokumen: `docs/perbaikan-menyeluruh/02-rencana-implementasi.md`, `STATUS.md`,
`reports/FIX-10.md`, `reports/FIX-12.md`, `reports/riset-kebutuhan-lanjutan.md`,
`reports/riset-katalog-agent.md`, `docs/feature-request-file-generation.md`,
`tasks/agent-v1/04-execution-tools.md`.

Probe eksekusi (dijalankan di checkout ini, hasil dikutip apa adanya di §1.1 dan §2):
`parseDocSchema` batas tabel/bullets/header; `renderXlsxBytes` dengan judul
`Laporan/2026: Q1`; `readZip`/`detectFormat`/`extractText` atas hasil
`renderDocxBytes`/`renderXlsxBytes`/`renderPptxBytes`; `convertArtifact` dengan
sumber `pdf`; `/MediaBox` dari kedua jalur PDF; aritmetika `y` PPTX terhadap
`LAYOUT_16x9` (5,625 inci).
