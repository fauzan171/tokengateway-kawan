# FIX-05 — konteks per model dan snapshot koneksi

Status: **selesai** (4 butir). Dokumen ini melanjutkan `reports/FIX-05.md` lama
yang mencatat butir snapshot koneksi + budget jujur.

## Perubahan pada putaran ini

| Berkas | Perubahan |
|---|---|
| `prisma/schema.prisma` | `Connection.revision Int @default(1)`, `Generation.connectionRevision Int?` |
| `prisma/migrations/{sqlite,postgresql}/20261026000000_generation_config_revision/` | `ALTER TABLE` ×2, additive + nullable |
| `src/lib/connections/connections.ts` | `revision` naik saat `baseUrl`/`apiKey` berubah |
| `src/lib/chat/start-generation.ts` | Pin `connectionRevision` di transaksi admission |
| `src/lib/chat/generate.ts` | Worker menolak jalan bila revisi bergeser → `CONNECTION_CHANGED` |
| `src/lib/chat/model-budget.ts` | **Baru** — budget per model: gateway → tabel keluarga → ceiling 8192 `assumed` |
| `src/lib/chat/generate.ts` | `CONTEXT_BUDGET_TOKENS`/`OUTPUT_RESERVE_TOKENS` dihapus, diganti `modelBudget()` |
| `src/lib/chat/generate.ts` | `trimHistory` mengembalikan `droppedMessages`; note `history-trimmed` membawa `data` provenance |
| `src/lib/chat/model-budget.test.ts` | **Baru** — 4 tes |
| `src/lib/chat/generate.test.ts` | +3 tes: pin mismatch, pin cocok, provenance pemangkasan |
| `eslint.config.mjs` | `.claude/**` di-ignore (worktree agen lain, bukan kode repo) |

## Empat butir

1. **Pin revisi config** — `Connection.revision` naik pada setiap perubahan
   kredensial/base URL. `Generation.connectionRevision` menyimpan revisi saat
   admission; worker membandingkan dan gagal `CONNECTION_CHANGED` bila bergeser.
   Tidak pernah beralih ke koneksi aktif lain, tidak memakai kredensial baru.
2. **Budget per model** — jendela konteks dibaca dari `context_length` gateway
   (`source: gateway`), lalu tabel keluarga (`known-family`), lalu ceiling
   konservatif 8192 (`assumed`). Reserve output 25% jendela, lantai 1024.
   Angka `assumed` tidak pernah diklaim sebagai token sebenarnya.
3. **Summary provenance** — **butir ini diubah cakupannya, alasannya di bawah.**
   Tidak ada fitur ringkasan (summary/compaction) di codebase ini: grep ketat
   `summar(y|ize|ise)` hanya menemukan `usage.ts`. Membangun pipeline ringkasan
   adalah fitur baru dan termasuk lingkup FIX-13 (memori + invalidasi summary),
   bukan FIX-05. Yang dikerjakan sebagai gantinya: provenance pada satu-satunya
   mekanisme yang benar-benar memotong konteks hari ini — `trimHistory`. Note
   `history-trimmed` sekarang membawa `{ droppedMessages, model, budgetSource,
   contextTokens, reserveTokens }` sehingga pengguna bisa melihat berapa pesan
   tidak terkirim dan dari mana angka budgetnya.
4. **Revocation** — sudah ada sebelum putaran ini: `revokeSession` di
   `session-store.ts`, pencabutan massal "semua kecuali satu" di
   `password-change.ts`. Tidak ada kode baru; dicatat sebagai audit.

## Hasil gate

```
npx tsc --noEmit -p tsconfig.json   → 0
npm run lint                        → 0 error, 0 warning
npx vitest run model-budget.test.ts → 4/4
npx vitest run generate.test.ts     → 27/27
npm test                            → lihat bagian berikut
```

## Yang belum

- **Tokenizer model-specific belum ada.** Rasio 4 char/token tetap fallback.
  Spec meminta tokenizer teruji bila tersedia lewat API; belum ada endpoint
  gateway yang mengumumkannya.
- **Reserve RAG/tool schema/gambar belum dihitung** — baru history + output.
- **Label estimasi di UI belum tampil sebagai badge**; `data` provenance sudah
  tersimpan di `contentJson` tetapi `chat-view.tsx` belum merendernya.
