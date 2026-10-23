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

## Belum dikerjakan

- `toolsEnabled = true` masih hardcode di `generate.ts` (butuh gating capability; P3 lanjutan).
- UI pemilih agent (K7), kuota (K6), audit admin (K8).
- D3 (blok baru), D4 (template), D6 (PPTX), P2 (manifest plugin), P8 (dokumentasi tool).
