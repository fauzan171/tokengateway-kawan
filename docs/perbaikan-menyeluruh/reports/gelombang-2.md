# Gelombang 2 — D2, P3, K3/K4/K5

Status: **verified** (QA lulus; review diselesaikan kapten karena reviewer gagal 2x oleh gateway 409)

## Isi

| Tahap | Hasil |
|---|---|
| D2 | `src/lib/artifacts/theme.ts` beku (A4 595x842, margin, font per level, warna). `renderPdfBytes` dan `exportChatPdfBytes` memakai TEMA yang sama |
| P3 | `generate.ts` tidak lagi memakai `CHAT_TOOLS` hardcode; payload gateway dibangun dari `chatTools()`; `generate_file`/`generate_document` terdaftar di registry |
| K3 | `resolveAgent()` di DALAM transaksi admission; 422 `AGENT_UNKNOWN`, 403 `AGENT_FORBIDDEN`; `TaskRun.agentId/agentVersion` ditulis; `deadlineAt` dari `limits.deadlineMs`; PATCH menolak `agentId` (422 `AGENT_IMMUTABLE`) |
| K4 | `run.ts` memakai `systemPrompt`+`defaultModelId` agent; event `run.queued`/`run.started` membawa `agentId`/`agentVersion`; agent hilang -> `AGENT_UNKNOWN` tanpa panggilan gateway |
| K5 | `GET /api/kawan/v1/agents` — hanya id/version/label/description/defaultModelId/limits/audience; `systemPrompt` dan `tools` tidak pernah dikirim |

## Bukti temuan lama ditutup

- **T6 riset (MediaBox beda)**: kedua jalur PDF kini `MediaBox [0 0 595 842]` — dibuktikan dengan mem-parse byte PDF, bukan klaim.
- **R8 reviewer (prompt mana yang menang)**: diputuskan eksplisit. `LEGACY_SYSTEM_PROMPT` di-rename dengan komentar alasan dan dikirim sebagai blok **kedua** setelah prompt agent; kebijakan tetap di atas identitas, dan perilaku agent `default` setara.
- **QA #1 (byteCap tidak konsisten)**: `artifactByteCap` 65.536 -> `25 * 1024 * 1024` (= `MAX_ARTIFACT_BYTES`). Angka lama lebih kecil dari PDF sah (103.174 byte) sehingga akan menolak dokumen yang boleh. Ada tes yang menyamakan keduanya.
- **QA #6 (schema chatTools tidak beku)**: `chatTools()` mengembalikan `deepFreeze(structuredClone(parameters))`; ada tes yang mencoba memutasi schema dan memastikan registry tidak berubah.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npx eslint <berkas berubah>         → 0 error, 0 warning
node scripts/check-migrations.mjs   → OK (2 provider)
npm test                            → 1224 passed (109 file)
```

## Temuan yang diterima apa adanya

| # | Temuan | Keputusan |
|---|---|---|
| QA #3 | agent default kini mengirim 2 blok system (bukan 1) | diterima: identitas lama dipertahankan, bukan dihapus diam-diam; perilaku setara |
| QA #4 | `tools`/`maxSteps`/`maxTokensPerRun` agent belum ditegakkan | diterima: `maxSteps` butuh loop tool FIX-09; angka disimpan, tidak diklaim ditegakkan |
| QA #5 | handler `generate_*` di registry belum dipanggil produksi | diterima: jalur eksekusi masih lewat loop lama; disatukan saat P8 |
| QA #2 | `TEMA.color` belum dipakai renderer | diterima: disiapkan untuk D3/D6 |

## Review gelombang 2 (reviewer, attempt ke-3)

Verdict **pass**. 0 high/blocker, 6 medium, 6 low. Dua attempt pertama reviewer mati
oleh gateway (`409 conflict_error request_in_progress`) — bukan temuan kode.

### Medium

| # | Temuan | Status | Tindakan |
|---|---|---|---|
| W2-1 | `TEMA` hanya dipakai jalur PDF; DOCX masih `"Courier New"`, XLSX default ExcelJS, PPTX `fontSize` 24/12 literal; `TEMA.color` tak terpakai | **DITUTUP** | `TEMA.font.mono` + `TEMA.ptx.{title,body}` ditambahkan; DOCX/XLSX/PPTX sekarang membaca TEMA (`header.font.color`, `slide.addText({color,fontSize})`, `addTable({fill})`) |
| W2-2 | Mitigasi D2 mewajibkan catatan `pdf-nonlatin`; grep nol hasil | **DITUTUP** | Komentar eksplisit di `render-binary.ts` `latin1` menjelaskan penggantian `?` dan menunjuk opsi B (TTF Unicode, DITUNDA). Catatan runtime (note part) belum ada — lihat D3 |
| W2-3 | Klaim "tata letak tidak digeser" tidak benar untuk jalur dokumen: lebar 612→595 berarti kolom teks 468→451 pt | **DITUTUP** | Komentar `theme.ts` dan `rencana-masa-depan.md` dikoreksi: yang dijaga hanya margin 72 dan geometri transkrip 50/780 |
| W2-4 | `ToolResult` tidak memuat `text/sourceRefs/artifactIds/errorCode/truncated`; `ToolContext` tidak memuat `taskId/runId/stepId/approvedDigest` (SDD `04-execution-tools.md:62-66`) | **TERBUKA — milik P8** | Registry sekarang dipakai produksi hanya untuk schema; penyatuan bentuk hasil ke SDD-AG-4 terjadi saat P8 agar tidak ada dua kali refactor. Dicatat sebagai syarat masuk P8 |
| W2-5 | `document.ts:33` dan rencana baris 112 masih menulis ">500 blok dilempar" | **DITUTUP** | Docstring `parseDocSchema` dan teks penerimaan di rencana dikoreksi: kelebihan jumlah/panjang DIPOTONG + `truncated` |
| W2-6 | Riset §3.1 masih menyebut `DOC_TOO_LARGE`/`TABLE_TOO_WIDE` | **DITUTUP** | Tabel batas §3.1 dan tabel bukti §8 dikoreksi ke perilaku nyata (potong, bukan tolak) |

### Low

| # | Temuan | Status |
|---|---|---|
| W2-7 | Route API `artifacts` membuang flag `truncated` (asimetris dengan jalur chat) | **DITUTUP**: respons 201 cabang dokumen terstruktur kini membawa `{docTruncated, docUnknownBlocks}` bila ada potongan; `tsc` 0, eslint 0, vitest artifacts 60/60 |
| W2-8 | Schema chat belum punya `maxItems`/`maxLength` | **TERBUKA** — milik P8 (schema kanonik satu sumber) |
| W2-9 | `listAgents` masih mengembalikan `systemPrompt` di objek internal | diterima sebagai desain: pemfilteran ada di `toAgentEntry`; tes memastikan route tidak membocorkan |
| W2-10 | Tes `run.test.ts:275` hanya mencocokkan substring "Kebijakan" | diterima: diperkuat saat P8 |
| W2-11 | Bukti gate "1224 passed" tidak menyebut flake `worker.test.ts` | dicatat: 1224 lulus / 2 gagal saat beban paralel, lulus saat terisolasi |
| W2-12 | Scope worktree kabur: perubahan belum-commit di berkas yang sama | ditutup: perubahan phase/rag-degraded sudah commit `c18ed34` |

## Belum dikerjakan

- `toolsEnabled = true` masih hardcode di `generate.ts` (butuh gating capability; P3 lanjutan).
- UI pemilih agent (K7), kuota (K6), audit admin (K8).
- D3 (blok baru), D4 (template), D6 (PPTX), P2 (manifest plugin), P8 (dokumentasi tool).
- W2-4 (bentuk hasil SDD-AG-4) dan W2-8 (schema kanonik) sengaja menunggu P8.
