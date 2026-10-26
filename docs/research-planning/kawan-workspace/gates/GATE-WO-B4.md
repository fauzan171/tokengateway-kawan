# GATE — WO-B4 (generate_file xlsx/docx + propagasi truncation)

Worktree `worktrees/wo-b4` (`wo/b4`), basis `feat/kawan-workspace` `90ec7d71`.
Squash-merge ke `feat/kawan-workspace`: `5ab5e3c6`. AUTO_PUSH=0 (lokal saja).

## Gate (verbatim)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/lib/artifacts/render-binary.ts src/lib/artifacts/render.ts src/lib/chat/file-tool.test.ts src/lib/chat/file-tool.ts src/lib/chat/generate.ts src/lib/tools/registry.ts src/lib/tools/file-gen.test.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  124 passed (124)
      Tests  1342 passed (1342)
TEST=0
```

### `npm run build`
```
B4BUILD=0
```

## QA (kawan-reviewer, read-only)
Verdict: **[x] APPROVED (tidak ada S1/S2)**. S3 diperbaiki iterasi 2 (lihat bawah).

## Iterasi 2 — S3 docx truncation senyap (data loss)
Jalur `generate_file` format `docx` memanggil `parseDocSchema` lalu **membuang** `parsed.truncated`/`parsed.unknownBlocks`, sehingga `generate.ts` (cabang `generate_file`) tidak pernah menyetel `docTruncated`/`docUnknownBlocks` → catatan `doc-truncated`/`doc-blocks-skipped` tidak terbit. Melanggar invariant yang sudah dikodifikasi di `generate.ts:1291` (FIX-19/R5: "pemotongan dokumen harus TERLIHAT... 490 dari 500 blok bisa hilang tanpa satu pun tanda di UI"); jalur `generate_document` mematuhinya (`generate.ts:1311-1312`).

Perbaikan (diff minimal, cermin `generate_document`):
- `file-tool.ts`: varian docx `GenerateFileArgs` + `truncated`/`unknownBlocks`; `parseGenerateFileArgs` meneruskannya.
- `generate.ts`: cabang `generate_file` + narrowing `if (args.format === "docx")` → set flag.
- Tes baru `file-gen.test.ts` `describe("generate_file docx")`: 600 blok → `truncated===true`, `blocks.length===500`; blok tak dikenal → `unknownBlocks>0`.

## Flake FIX-05 (resolusi)
Run penuh pertama gagal 1 tes (`generate.test.ts:645` `TypeError: Cannot read properties of undefined (reading 'data')`, tes `catatan history-trimmed membawa model, sumber budget dan jumlah pesan dibuang`). Investigasi:
- FIX-05 lulus 6/6 di isolasi pada `wo-b4` dan `wo-b2b`.
- Suite penuh `wo-b2b` (tanpa kode B4 sama sekali): 125 file/1351 lulus, TEST=0.
- Suite penuh `wo-b4` setelah fix: 124 file/1342 lulus, TEST=0.
- Perubahan `generate.ts` B4 pada jalur ini (`input: toArtifactInput(args)`) inert terhadap pemangkasan history/budget.
Kesimpulan: **flake load-dependent** (histori 40 pesan kadang tetap masuk budget saat mesin sibuk), bukan regresi B4. Tidak ada perubahan kode untuk flake ini.

## Catatan kejujuran cakupan
- **S4 (tidak diperbaiki):** kunci asing di dalam objek sheet diterima. Bukan blocking.
- `errorCode` TOO_LARGE/QUOTA_EXCEEDED tidak reachable lewat handler registry — **by design**: handler hanya memvalidasi (`registry.ts:505-512`); penulisan artefak (yang dapat melempar QUOTA_EXCEEDED/TOO_LARGE) ada di loop chat (`generate.ts`). Bukan bug.
- QA tidak menjalankan e2e lewat `generate.ts` (butuh DB+stream mock); gate koordinator di atas yang mengikat.