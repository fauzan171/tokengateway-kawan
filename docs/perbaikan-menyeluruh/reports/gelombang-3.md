# Gelombang 3 — D3: blok dokumen baru

Tanggal: 2026-10-24. Cakupan: D3 saja (rencana `rencana-masa-depan.md` §3,
baris D3): `pageBreak` → `divider` → `bullets.ordered` → `image` (via
`artifactId`), satu tahap, urutan blok dikerjakan berurutan dalam satu commit
karena keempatnya menyentuh file yang sama (`document.ts` + 4 renderer).

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
| `npm test` | 1238 lulus / 110 file (baseline 1229/109 + 9 baru D3) |
| `npm run build` | exit 0 |

Tes baru: `src/lib/artifacts/document-d3.test.ts` (9 tes: parse batas 20
gambar + klem widthPct + potong alt/caption; pembaca independen per format —
`/Count` PDF, entri `word/media` + `<w:br w:type="page"/>` + `thematicBreak`
DOCX, sharedStrings XLSX, slide kedua + `prst="line"` + `ppt/media` PPTX).
