# FIX-05 — konteks per model dan snapshot koneksi

Status: **selesai sebagian** (butir snapshot koneksi + budget jujur; sisanya dicatat di bawah).

## Perubahan

| Berkas | Perubahan |
|---|---|
| `prisma/schema.prisma` | `Generation.connectionId String?`, `Generation.modelId String?` |
| `prisma/migrations/{sqlite,postgresql}/20261022000000_pin_generation_admission/` | `ALTER TABLE "Generation" ADD COLUMN` ×2 (additive, nullable) |
| `src/lib/chat/start-generation.ts` | Pin `connectionId` (koneksi aktif saat admission) + `modelId` dalam transaksi yang sama |
| `src/lib/chat/generate.ts` | Worker memakai `generation.connectionId`; koneksi terhapus → galat jelas, **tidak** pindah ke koneksi aktif lain |
| `src/lib/chat/generate.ts` | `resolveModel` memakai `generation.modelId ?? chat.modelRef` |
| `src/lib/chat/context-budget.ts` | **Baru** — `estimateTokens` (4 char/token), `overBudget` |
| `src/lib/chat/context-budget.test.ts` | **Baru** — 4 tes |
| `src/lib/chat/generate.ts` | `CONTEXT_BUDGET_TOKENS=30_000`, `OUTPUT_RESERVE_TOKENS=4_000`; `trimHistory` mengembalikan `{messages, trimmed}` |
| `src/lib/chat/generate.ts` | Pesan terbaru melebihi budget → `GenerationError("INPUT_TOO_LARGE")`, bukan pemangkasan diam-diam |
| `src/lib/chat/generate.ts` | Note `history-trimmed` saat riwayat dipangkas |
| `src/components/chat-view.tsx` | `parseNote` → `parseNotes` — sebelumnya hanya note **pertama** yang bisa tampil |
| `src/lib/i18n/messages.ts` | `chat.historyTrimmed` (ID + EN) |

## Hasil gate

```
npx tsc --noEmit -p tsconfig.json          → 0
npx eslint (5 berkas)                      → 0
npx vitest run generate.test.ts            → 22/22
npm test                                   → 80 file, 796 lulus
rm -rf .next && npm run build              → 0
node scripts/check-migrations.mjs          → OK
```

## Yang belum (jujur)

- **Revisi konfigurasi koneksi tidak dipin.** Hanya `connectionId` + `modelId`. Bila `baseUrl`/key diedit setelah admission, generasi tetap memakai nilai baru. Diperlukan kolom revisi/snapshot.
- **Budget belum per model.** `CONTEXT_BUDGET_TOKENS` hardcoded 30k untuk semua model; metadata context window dari gateway belum dibaca.
- **Belum ada tokenizer model-specific.** Rasio 4 char/token adalah fallback; spec meminta tokenizer teruji bila tersedia lewat API.
- **Belum ada reserve untuk RAG/tool schema/gambar** — baru history + output.
- **Summary terikat branch/cutoff/provenance belum ada.**
- **Lifecycle revocation key belum ditentukan.**
- **Label estimasi di UI belum tampil sebagai badge** — note hanya muncul saat riwayat benar-benar dipangkas.

## Insiden terkait

Migrasi `20261022000000_pin_generation_admission` diterapkan ke `dev.db` **sebelum** `pm2 restart`. Aturan lama tetap berlaku: migrasi baru wajib `npx prisma migrate deploy --schema prisma/schema.sqlite.prisma` sebelum restart worker.
