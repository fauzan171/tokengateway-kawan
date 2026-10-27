# GATE — WO-B2c (egress query gate — sanitasi PII sebelum keluar ke provider)

Worktree `worktrees/wo-b2c` (`wo/b2c`), basis `feat/kawan-workspace` `5ab5e3c6`.
Squash-merge ke `feat/kawan-workspace`: `80ac9889`. AUTO_PUSH=0 (lokal saja).

## Gate (verbatim)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```
Catatan: worktree ini perlu `npm run db:generate` dulu — `src/generated/prisma` gitignored. Sebelum generate, tsc melaporkan ~120 error palsu (`implicitly any` / `Cannot find module '.../generated/prisma'`) dari client basi. Setelah generate: exit 0.

### `npx eslint src/lib/search/egress.ts src/lib/search/egress.test.ts src/lib/search/chain.ts src/lib/search/chain.test.ts`
```
/path/src/lib/search/chain.test.ts
  8:43  warning  'describe' is defined but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (0 errors, 1 warning)
```
Warning **pre-existing** (baris import tak terpakai di base, bukan dari WP ini).

### `npm test`
```
 Test Files  127 passed (127)
      Tests  1371 passed (1371)
TEST=0
```

### `npm run build`
```
B2CBUILD=0
```

## QA (review keamanan diff oleh koordinator)
Verdict: **APPROVED** (S2 ditutup iterasi 2).

- **S2 (blocking, iterasi 2):** gate hanya di `chain.ts`, tapi `src/lib/chat/generate.ts:1000` memanggil `webSearch` (`web.ts`, SearXNG) **langsung** — jalur egress kedua yang bypass. Acceptance "query keluar ke provider SELALU lewat egress gate" dilanggar. Diperbaiki: `webSearch` kini `sanitizeSearchQuery(normalizeSearchQuery(query)).query`; PII murni → `[]` tanpa jaringan.
- Fail-closed terbukti: `chain.test.ts` — query murni-PII → `SearchError("SEARCH_UNAVAILABLE", false)`, `fetchMock`/`readSourceMock` tidak dipanggil. `web.test.ts` — PII murni → `[]`, `fetchMock` tidak dipanggil.
- Redaksi terbukti: `chain.test.ts` memeriksa **body POST** tavily (bukan URL) tak memuat email, kata lain tetap; `web.test.ts` memeriksa `searchParams.q`.
- `redacted` hanya angka; nilai asli tidak disimpan/di-log.

## Catatan scope (diputuskan koordinator, bukan dipotong diam-diam)
- Mesin taint/grant penuh REV-03 (sticky `privateContextSeen`, grant single-use + expiry + revoke, UI consent) **DITUNDA**: v1 belum punya jalur ingest berkas privat (tidak ada model `TaskAttachment` di schema, tidak ada upload privat aktif), jadi flag taint tanpa penulisnya = kode mati (dilarang aturan repo). Gate ini menutup jalur egress yang benar-benar ada: query prompt → provider pihak ketiga.
- Bukan bagian acceptance v1: "Task riset pertama dari UI kosong" (B3), "File XLSX/DOCX terbuka balik" (B4 — sudah), dsb. Acceptance B2c = "Query keluar ke provider selalu lewat egress gate; tanpa PII dari prompt".