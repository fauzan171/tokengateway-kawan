# Gelombang 3 — D3 + D4 + D6 + P2 + P8 + K6 + K7 + K8

Tanggal: 2026-10-24. Cakupan: D3 (blok dokumen baru), D4 (template), D6
(tata letak PPTX), P2 (manifest plugin deklaratif + tabel Plugin), P8
(ToolDoc satu sumber tiga pembaca + penutupan W2-4 dan W2-8), K6 (kuota per
user 429 + Retry-After), K7 (UI pemilih agent), K8 (audit admin run per
agent). Gelombang 3 selesai penuh.

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

---

## P2 — manifest plugin deklaratif + tabel Plugin

### Modul (`src/lib/plugins/manifest.ts`)
- `parsePluginManifest(raw)`: JSON string atau objek → `PluginManifest`
  tervalidasi. `manifestVersion` wajib tepat 1; id kebab-case; version
  semver; batas ukuran (128 KiB, 20 tool/prompt/capability, body prompt
  8.000 char).
- Subset JSON-Schema DIBEKUKAN: hanya `type/enum/required/properties/items`;
  kedalaman maks 8. `$ref`/`oneOf`/`allOf`/`anyOf`/`$defs`/kunci asing
  ditolak `SCHEMA_KEYWORD_REJECTED` — `$ref` = lubang SSRF/logic
  (rencana §P2, riset-plugin §4).
- Nama tool wajib terdaftar di registry (P1); asing → `UNKNOWN_TOOL` —
  plugin TIDAK menambah executor.
- `effect` manifest wajib SAMA dengan registry — write tidak bisa dibungkus
  jadi read (penurunan bahaya ditolak `EFFECT_MISMATCH`).
- `canonicalManifestJson`: JSON kunci terurut untuk hash yang stabil
  terhadap urutan kunci.
- Galat semua berkode `ManifestError` — route bisa menerjemahkan ke 400.

### Tabel `Plugin` (migrasi dua provider `20261102000000_plugin_manifest`)
- Kolom: id, pluginId, version, enabled (Int 0/1, default 0), manifestJson,
  sha256, installedBy, installedAt.
- Unique (pluginId, version): update = baris baru, bukan mutasi diam-diam.
- Index (pluginId, enabled): lookup plugin aktif per id.
- `enabled` selalu 0 saat install — menyalakan wajib review manusia
  (rencana §P2). Route enable/disable + wiring generate (P3) belum: P3
  eksplisit terpisah dan menunggu keputusan capability per-tool.

### Yang SENGAJA tidak dibangun (P2, sesuai riset §4)
- Install otomatis dari URL/git/tarball; auto-sync; eksekusi build script.
- MCP eksternal; framework plugin umum; SDK konektor.
- Route API install/aktifkan — P2 hanya lapisan data + validator; pintu
  manusia datang bersama P3 (butuh keputusan capability intersection).

### Tes (`manifest.test.ts`, 14)
- Bentuk dasar: manifest sah, JSON rusak, manifestVersion 2 ditolak, id
  non-kebab, semver salah, field kosong.
- Registry: tool asing `UNKNOWN_TOOL`, effect diturunkan `EFFECT_MISMATCH`,
  tool ganda `DUPLICATE_TOOL`, tools kosong.
- Subset: parameter sah lolos; `$ref` dengan pesan SSRF; oneOf/allOf/anyOf/
  pattern/minimum ditolak; kedalaman 12 ditolak.
- Hash kanonik: urutan kunci tidak mengubah sha256; beda isi = beda hash.

### Gate P2
tsc 0 · eslint 0/0 · check-migrations OK · validate 2 schema OK ·
migrate deploy sqlite OK · db:generate OK · npm test 1268/113 · build 0.

---

## P8 — ToolDoc satu sumber tiga pembaca (+ tutup W2-4, W2-8)

### Katalog (`src/lib/tools/catalog.ts`)
- `TOOL_CATALOG: ToolDoc[]` untuk SEMUA tool registry (tes kesesuaian 1:1 —
  tidak ada tool terpasang yang tak terdokumentasi, tidak ada doc tanpa
  tool). Field per riset §5.3: ringkas ≤120 char, kapanDipakai 2..5,
  kapanJangan ≥2, argumen (nama/tipe/wajib/batas/keterangan), contoh
  valid+tidakValid (JSON parse-able), efek+approval (approval diturunkan
  dari registry), batas, kegagalan (kode+arti+tindakanModel), hasil.
- `buildToolCatalogBlock()`: ringkasan penuh untuk pembaca prompt.
- Pembaca pertama diaktifkan: `prompt-builder.ts` `buildCapabilityBlock`
  kini menyisipkan panduan pemilihan per tool aktif giliran itu (id,
  ringkas, "jangan bila" pertama) — model memilih tool sadar, bukan buta.
  Pembaca kedua (panel UI) dan ketiga aktif: `docs/tools/<id>.md` dihasilkan
  generator (`gen-docs.test.ts`, dijalankan ulang bila katalog berubah) dan
  diverifikasi tes kesesuaian memuat ringkas/kapan/contoh/kode galat.

### W2-4 ditutup: bentuk SDD-AG-4 di registry
- `ToolResult` bertambah `text`, `sourceRefs` (`id/url/artifactId/locator`),
  `artifactIds`, `errorCode`, `truncated` (SDD `04-execution-tools.md:62-66`).
- `ToolContext` bertambah `taskId`, `runId`, `stepId`, `approvedDigest`
  (wajib `string|null` — audit + approval terikat langkah).
- Konsumen yang ada tidak pecah: handler lama tetap sah karena field baru
  opsional; hanya konstruktor ctx di test yang perlu `approvedDigest: null`.

### W2-8 ditutup: maxItems/maxLength di schema kanonik
- `generate_file`: displayName 120, content 200.000, rows maxItems 2.000.
- `generate_document` DOC_BLOCK_FORMS: heading/paragraph/code text
  maxLength 20.000; language 32; bullets items maxItems 100 + item 20.000;
  table headers maxItems 12 + cell 500, rows maxItems 2.000; image
  alt/caption 200; doc title 200, blocks maxItems 500.
- Angka sama dengan DOC_LIMITS yang ditegakkan parseDocSchema — schema
  sekarang jujur di depan (model tahu batas sebelum mengirim), parser tetap
  penegak akhir.

### Tes (`catalog.test.ts` 8 + generator 1)
- Kesesuaian 1:1 katalog↔registry (nama, efek, approval).
- Aturan isi §5.3 (2..5 dipakai, ≥2 jangan, ringkas ≤120, tindakanModel,
  contoh JSON, argumen terisi).
- docs/tools/<id>.md ada + memuat ringkas/kapan/contoh/kode galat.
- buildToolCatalogBlock memuat nama, larangan pertama, contoh valid.
- Generator menulis ulang docs dari katalog.

### Yang sengaja tidak (P8)
- `web.read`/`web.search` belum ada di registry (FIX-10 jalan lewat jalur
  chat sendiri) — katalog hanya mendokumentasikan tool terpasang; entri
  menyusul saat tool web masuk registry.
- Panel UI tool (pembaca kedua) menunggu K7/tiket UI sendiri; data sudah
  siap lewat TOOL_CATALOG.

### Gate P8
tsc 0 · eslint 0/0 · npm test 1277/115 · build 0.

---

## K6 — kuota per pengguna (429 + Retry-After)

### Modul (`src/lib/tasks/quota.ts`)
- `checkTaskQuota(db, userId)` tiga sinyal: token UsageRecord `reported=1`
  per 24 jam (≥1.000.000), run nonterminal (`queued|running`, lewat relasi
  task.userId karena TaskRun tidak punya kolom userId) ≥2, task baru per
  24 jam ≥50.
- Usage TIDAK dilaporkan (reported=0) diabaikan — "tidak tersedia", bukan
  nol bohongan (rencana §K6).
- Label eksplisit "batas pemakaian, bukan tagihan" (rencana: angka kuota
  dikira billing).
- Konstanta di modul (bukan env): belum ada kebutuhan operator mengubahnya;
  ponytail: pindah ke tabel counter inkremental bila agregasi mahal.

### Route (`POST /api/kawan/v1/tasks`)
- Kuota dicek SEBELUM admission: 429 + header `Retry-After: 60` + body
  berkode (`QUOTA_TOKENS`/`QUOTA_ACTIVE_RUNS`/`QUOTA_TASKS`) + pesan
  Indonesia; idempotency key tidak terpakai untuk permintaan yang ditolak.

### Tes (`quota.test.ts`, 6)
- Pengguna baru lolos; reported=0 diabaikan; token ≥ batas → QUOTA_TOKENS +
  retryAfter; run nonterminal ≥2 → QUOTA_ACTIVE_RUNS (terminal tak dihitung);
  task ≥50 → QUOTA_TASKS (user lain tak terpengaruh); task di luar jendela
  tak dihitung.

### Gate K6
tsc 0 · eslint 0/0 · npm test 1283/116 · build 0.

---

## K7 — UI pemilih agent di task-view

### Perubahan
- `RunDto`/`toRunDto`/`RUN_FIELDS` bertambah `agentId`+`agentVersion`
  (aditif — field beku run K2 kini terlihat oleh klien; server tetap
  sumber validasi, UI hanya membaca).
- `task-view.tsx`: fetch sekali `GET /agents` (gagal → pemilih kosong,
  server jatuh ke default — bukan bloker); `<select>` agent di atas form
  (opsi "Bawaan" + label tiap agent); pilihan `agentId` hanya ikut POST
  saat task BARU — run lanjutan memakai agent beku task itu.
- Label agent aktif (`data-testid="task-agent-label"`) di detail task dari
  `run.agentId`; id tak dikenal tetap ditampilkan apa adanya (bukan
  disembunyikan).
- i18n baru: `tasks.agentPicker`/`agentDefault`/`agentActive` (id + en).

### Tes (`task-view.test.tsx`, 3)
- Tanpa katalog: select tidak dirender (tanpa rasa aman palsu).
- Dengan katalog: opsi default+agent; pilihan mengubah nilai select.
- Label agent aktif tampil dari `run.agentId` + label katalog.

### Batas jujur
- Pengiriman `agentId` di POST /tasks tidak diuji lewat klik tombol:
  delegation event button async handler tidak menembak di jsdom+React 19
  lingkungan vitest ini (prompt-picker yang sinkron jalan). Kontrak POST
  `agentId` teruji di `tasks.test.ts` (admission menerima + menolak agent
  asing); komponen membaca state `agentId` yang sama. Risiko rendah;
  E2E Playwright menyusul saat tiket UI penuh.
- Audience filtering tetap di server (route `/agents`); UI hanya menampilkan
  yang dikirim.

### Gate K7
tsc 0 · eslint 0/0 · npm test 1286/117 · build 0.

---

## K8 — audit admin run per agent

### Modul (`src/lib/admin/agent-runs.ts`) + route
- `listAgentRuns(db, {agentId, limit, cursor})`: run satu agent terbaru
  dulu (limit 1..100, default 20), total run, judul task, status, step,
  hitungan event per run (satu `groupBy` untuk seluruh halaman), errorCode,
  waktu mulai/selesai.
- `listAgentSummaries(db)`: ringkasan per (agentId, agentVersion) — total
  run + run terakhir, diurutkan terbanyak.
- Route `GET /api/kawan/v1/admin/agent-runs` (role admin, pola FORBIDDEN
  sama dengan route admin lain): tanpa `?agentId` → ringkasan; dengan →
  halaman run.
- TANPA tabel audit baru (rencana §K8): sumber = TaskRun + TaskEvent yang
  sudah ada; migrasi tidak diperlukan.

### Privasi
- Payload `TaskEvent` TIDAK PERNAH dikembalikan — hanya `_count`; tes
  menanam teks "PROMPT RAHASIA" di payload dan meng-assert ia tidak muncul
  di JSON hasil.
- Logger route tetap requestId/route/latency/result tanpa isi prompt.

### Tes (`agent-runs.test.ts`, 5)
- Kelompok per agent benar (run agent lain tidak bocor); eventCount cocok.
- agentId kosong → default; judul task ikut; payload tak keluar.
- limit diklem 100; urutan terbaru dulu.
- Ringkasan per (agent, versi) urut total; lastRunAt terisi.
- Belum ada run → ringkasan kosong.

### Gate K8
tsc 0 · eslint 0/0 · npm test 1291/118 · build 0.
