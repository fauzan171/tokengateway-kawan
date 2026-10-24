# Gelombang 3 — D3 + D4 + D6

Tanggal: 2026-10-24. Cakupan: D3 (rencana §3 baris D3): `pageBreak` → `divider`
→ `bullets.ordered` → `image` (via `artifactId`); D4 (baris D4): tiga template
sebagai data; D6 (baris D6): tata letak PPTX berbasis tinggi terhitung.

## Perubahan

### Skema (`src/lib/artifacts/document.ts`)
- `DocBlock` bertambah: `pageBreak`, `divider`, `bullets.ordered`,
  `image { artifactId, alt, caption?, widthPct? }`.
- `DOC_LIMITS` baru: `images: 20` (kelebihan dibuang + `truncated`),
  `shortText: 200` (alt/caption dipotong).
- Parse: image tanpa `artifactId`/`alt` sah → `unknownBlocks`; `widthPct`
  diklem 10–100; `ordered` hanya emit saat `true`.

### Renderer (`src/lib/artifacts/render-binary.ts`)
- PDF: `pageBreak` → `addPage` (tes baca `/Count ≥ 2`); `divider` → garis
  `moveTo/lineTo/stroke`; `ordered` → prefiks "1. "; `image` → `pdf.image`
  dengan tinggi dari rasio byte (PNG/JPEG sniff; pdfkit tidak memajukan
  `pdf.y` — dimajukan manual).
- DOCX: `PageBreak` anak Paragraph; `divider` → `thematicBreak`;
  `ordered` → nomor literal di teks (ponytail: numbering config Word dengan
  restart per blok bila butuh semantik daftar); `image` → `ImageRun` + alt
  text + caption paragraf.
- XLSX: `pageBreak`/`divider` tidak punya makna grid → baris catatan
  `[pemisah halaman]`/`[garis pemisah]` (diam = potong tersembunyi);
  `ordered` → "1. "; `image` → `workbook.addImage` + anchor sel + catatan
  baris `[alt]`.
- PPTX: `pageBreak` → slide baru; `divider` → shape `line`; `ordered` →
  "1. "; `image` → `addImage` data URL, tinggi dari rasio byte.
- Gambar tak ter-resolve (bukan milik user / bukan `ready` / mime di luar
  PNG/JPEG/WebP / >4 MiB) → pengganti teks `[alt]`, bukan galat: satu gambar
  hilang tidak boleh membuang seluruh dokumen (filosofi `readArtifactForModel`).

### Resolver + wiring
- `render-binary.ts`: tipe `ImageResolver`; keempat renderer menerima
  parameter kedua opsional.
- `render.ts`: `renderArtifactBytesAsync(input, resolveImage)`.
- `create.ts`: `docImageResolver(db, userId)` — owner + `ready` +
  belum kedaluwarsa via `readArtifactForModel`, whitelist mime
  PNG/JPEG/WebP, batas 4 MiB/gambar; dibangun otomatis saat input membawa
  `doc`, jadi jalur chat DAN jalur API sama-sama dapat resolusi gambar tanpa
  perubahan pemanggil.

### Tool model (`src/lib/chat/file-tool.ts`)
- `DOC_BLOCK_FORMS` bertambah 4 bentuk (pageBreak, divider, ordered pada
  bullets, image dengan `artifactId`/`alt`/`caption`/`widthPct`) — model
  kini bisa memilihnya di `generate_document`.

### Tipe (`src/types/pdfkit.d.ts`)
- Ditambah deklarasi minimum: `moveTo`, `lineTo`, `lineWidth`, `stroke`,
  `image`, `y` — pdfkit 0.20 tidak membundel tipe.

## Batas yang dipegang
- Byte gambar TIDAK PERNAH masuk skema: hanya `artifactId` (riset §3 — base64
  menggandakan ukuran dan melewati validasi).
- 20 gambar/dokumen, 4 MiB/gambar, PNG/JPEG/WebP, owner+ready — sesuai tabel
  mitigasi risiko D3 di `rencana-masa-depan.md`.
- Aksesibilitas: alt diperlukan di DOCX (`altText`) dan menjadi teks
  pengganti saat gambar tak tersedia di semua format.

## Yang sengaja TIDAK dikerjakan (D3)
- `caption` pada table/code dan `align` table (bagian DocBlockV2 riset,
  belum ada tiket gelombang yang memintanya).
- `theme` per dokumen (field tingkat dokumen di riset; menunggu kebutuhan).
- Embed font TTF untuk glif non-Latin di PDF (opsi B, DITUNDA — catatan sudah
  ada di render-binary).
- WebP byte di PDF: whitelist mime mengizinkan webp sebagai input resolver,
  tapi pdfkit hanya menggambar PNG/JPEG — byte webp akan jatuh ke pengganti
  teks `[alt]`. Belum ada artefak webp di sistem (media provider
  blocked_external), jadi jalur ini belum bisa diuji nyata.

## Gate

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | 0 error |
| `npm run lint` | 0 error, 0 warning |
| `node scripts/check-migrations.mjs` | OK (skema tidak berubah, tidak dijalankan ulang penuh) |
| `npm test` | **1254 lulus / 112 file** (baseline 1229/109 + 9 D3 + 12 D4 + 4 D6) |
| `npm run build` | exit 0 |

Tes baru: `src/lib/artifacts/document-d3.test.ts` (9 tes: parse batas 20
gambar + klem widthPct + potong alt/caption; pembaca independen per format —
`/Count` PDF, entri `word/media` + `<w:br w:type="page"/>` + `thematicBreak`
DOCX, sharedStrings XLSX, slide kedua + `prst="line"` + `ppt/media` PPTX).

---

## D4 — tiga template sebagai data

### Modul (`src/lib/artifacts/templates.ts`)
- `templateLaporan(data)`: judul + subtitle + ringkasan + bab (heading 1,
  paragraf, bullets opsional, tabel opsional + caption) + penutup.
- `templateSurat(data)`: kop (heading 1 + divider), nomor·tanggal, tujuan,
  isi, penutup, penandaTangan, jabatan opsional.
- `templateRekap(data)`: pembuka + satu tabel + caption — untuk data tabular
  yang biasanya dibuka sebagai XLSX.
- `buildDocFromTemplate(id, data)`: pintu tunggal; ID tak dikenal ditolak
  dengan pesan yang menyebut tiga pilihan sah.
- Output SELALU melewati `parseDocSchema` (`finalize`): batas kanonik
  (500 blok / 200.000 char / potongan caption 200 char) ditegakkan di titik
  yang sama dengan jalur doc mentah — template tidak punya jalur bypass.
- Semua field wajib divalidasi dengan galat `INVALID_TOOL_ARGS` yang
  menyebut field-nya (model bisa menyadarikan sendiri).

### Jalur tool (`src/lib/chat/file-tool.ts`)
- `generate_document` menerima `template` + `data` sebagai alternatif
  `doc` (anyOf). Bila keduanya dikirim, template MENANG — struktur dari
  template konsisten, doc mentah model tidak.
- `parseGenerateDocumentArgs` mengalihkan ke `buildDocFromTemplate`;
  flag `truncated`/`unknownBlocks` tetap mengalir ke note chat seperti
  jalur doc mentah.
- Template API juga tersedia tanpa chat: fungsi murni di lib, bisa dipakai
  endpoint lain nanti.

### Yang sengaja TIDAK dibangun (D4, sesuai riset §4.2)
- Cover berhalaman sendiri, daftar isi otomatis, nomor halaman, header/footer
  berjalan, kop berlogo — semua butuh mesin tata letak; belum ada kebutuhan.
- Caption tabel sebagai field `table.caption` — DocBlockV2 riset belum
  berstatus tiket; caption saat ini blok paragraph setelah tabel.

### Tes (`templates.test.ts` 10 + `file-tool.test.ts` +2)
- Struktur blok per template dalam urutan wajar; field wajib hilang → galat
  menyebut field; template tak dikenal menyebut pilihan sah; teks 30.000 char
  dipotong + truncated (bukti batas kanonik jalan); hasil template dirender
  docx + xlsx tanpa galat; jalur tool: template menang atas doc, galat
  template menyebut pilihan.

### Gate D4
tsc 0 · eslint 0/0 · npm test **1250 lulus / 111 file** (baseline 1238/110 + 12 baru D4) · build 0

---

## D6 — tata letak PPTX dihitung, bukan rumus tetap

### Masalah (riset T4/T5)
- Rumus lama `y = 1,3 + used*0,6` dengan 12 blok/slide menempatkan blok
  ke-12 di 7,9 inci — meluber dari slide 16:9 (tinggi 5,625 inci).
- Semua blok `table` diletakkan di `y: 1,3` yang sama: tabel kedua menimpa
  tabel pertama di slide yang sama.
- Tabel 12 kolom (batas kanonik) tetap lolos render di slide selebar 10 inci.

### Perubahan (`renderPptxBytes`)
- Kursor tinggi berjalan mulai 1,3 inci; tiap blok menghitung konsumsinya
  (teks 0,6; divider 0,6; image = rasio asli + caption 0,4; tabel = penuh).
- Slide baru otomatis saat kursor melewati 5,4 inci (buffer bawah 0,225).
- Tabel SELALU dapat slide sendiri (`newSlide` sebelum render) — tidak ada
  lagi tumpang-tindih dua tabel.
- Kolom tabel dipotong ke `PPTX_TABLE_MAX_COLS = 8` — lebih ketat dari
  batas kanonik 12, sesuai riset §3.1 "boleh lebih ketat, tidak boleh lebih
  longgar".
- `pageBreak` (D3) tetap slide baru tanpa konsumsi tinggi.

### Tes (`pptx-layout.test.ts`, 4)
- 12 blok teks: semua `a:off/a:ext` XML slide berada 0 ≤ y+h ≤ 5,625 inci
  (pembaca independen, EMU → inci).
- 200 paragraf: tidak ada elemen keluar slide.
- Dua tabel: slide terpisah (tabel kedua tidak menimpa).
- Tabel 12 kolom: `h9`/`H9` tidak ada di XML slide tabel (dipotong 8).

### Gate D6
tsc 0 · eslint 0/0 · npm test **1254 lulus / 112 file** · build 0
