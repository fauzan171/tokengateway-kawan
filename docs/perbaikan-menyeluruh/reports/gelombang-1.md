# Gelombang 1 — D1, P1, K1/K2

Status: **verified** (QA + reviewer lulus, temuan medium ditutup)

## Isi

| Tahap | Hasil |
|---|---|
| D1 | DOC_LIMITS kanonik (500 blok, 20k teks, 200k total, 12 kolom, 2.000 baris, 100 bullets, 500 sel); parseDocSchema mengembalikan {schemaVersion, title, blocks, truncated, unknownBlocks} |
| P1 | src/lib/tools/registry.ts — registry tertutup, 5 tool yang benar-benar ada (compute x3, chart, qr), tiap entri dibekukan |
| K1 | src/lib/agents/registry.ts — AgentDefinition + agent default; prompt diturunkan dari composeSystemPrompt() |
| K2 | TaskRun.agentId/agentVersion + migrasi identik dua provider |

## Keputusan penting

- **Lewat batas = dipotong + dilaporkan**, bukan dilempar. Kode galat
  TABLE_TOO_WIDE/DOC_TOO_LARGE yang disebut rencana **tidak pernah ada** di
  repo; rencana diamandemen. INVALID_DOC_SCHEMA tetap untuk bentuk salah:
  bukan objek, judul kosong, blocks bukan array, >500 blok.
- **Pemotongan tidak boleh tak terlihat.** parseGenerateDocumentArgs
  meneruskan truncated/unknownBlocks; generate.ts menulis note doc-truncated /
  doc-blocks-skipped; UI menampilkannya. Tanpa rantai ini 490 dari 500 blok
  bisa hilang tanpa satu pun tanda.
- **Entri registry dibekukan satu per satu.** Object.freeze(array) saja tidak
  mencegah tool.handler = ... menimpa perilaku saat runtime.

## Temuan QA (6 LOW) — tindakan

| # | Temuan | Tindakan |
|---|---|---|
| 1 | freeze hanya array, entri tidak beku | **diperbaiki**: map(Object.freeze) + tes yang mencoba menimpa effect |
| 2 | klaim 26 tes tidak akurat (16) | dicatat; angka sebenarnya 17 setelah tes freeze |
| 3 | rencana menyebut galat yang tidak ada | **diperbaiki**: rencana diberi catatan koreksi |
| 4 | 501 blok-tak-dikenal tetap dilempar | diterima: kontrak menyebut >500 blok = bentuk salah |
| 5 | prisma/dev.db 8 KB sisa lama | tidak berbahaya (DB aktif ./dev.db); dicatat |
| 6 | maxItems tidak ditegakkan validator | dicatat untuk P8 |

## Temuan reviewer (8 MEDIUM) — tindakan

| # | Temuan | Tindakan |
|---|---|---|
| R1-R4 | batas title/bullets/kolom/total tidak persis seperti rencana | rencana diamandemen; kode konsisten dengan kontrak yang dipilih |
| **R5** | pemotongan sampai ke pengguna tanpa catatan | **diperbaiki**: note doc-truncated/doc-blocks-skipped + i18n + UI |
| R6 | P1 belum punya konsumen produksi | diterima: P1 memang fondasi; P2/P3 tidak boleh mengasumsikan nama tool ada |
| R7 | klaim tipe SDD-AG-4 berlebih | dicatat: ToolResult/ToolContext belum selengkap SDD |
| R8 | K1 setara perilaku sekarang tidak akurat (run.ts punya prompt sendiri) | dicatat: K4 harus memutuskan prompt mana yang menang |

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json      → 0 error
npx eslint <berkas berubah>            → 0 error, 0 warning
node scripts/check-migrations.mjs      → OK (2 provider)
npx prisma migrate status              → 13/13 up to date
npx vitest run src/lib/{chat,artifacts,tools,agents} → 425 passed (32 file)
npm test (QA, sebelum perubahan R5)    → 1196 passed (107 file)
```

## Yang belum dikerjakan (jujur)

- **P1 belum tersambung**: generate.ts masih memakai CHAT_TOOLS hardcode;
  generate_file/generate_document belum terdaftar di registry; web.read
  tidak ada di registry. Itu P3.
- **K1 belum dipakai admission**: createTask belum memvalidasi agentId dan
  belum menulis snapshot. Itu K3.
- **maxSteps belum ditegakkan** — butuh loop tool FIX-09.
