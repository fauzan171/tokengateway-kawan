# GATE — WO-F4 (RunMeteringSummary + i18n metering)

Worktree `worktrees/wo-f4` (`wo/f4`), basis `feat/kawan-workspace` `2ab72317`.
Squash-merge ke `feat/kawan-workspace`: `11a464cf`. AUTO_PUSH=0 (lokal saja).

## Gate (verbatim)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```
Catatan: perlu `npm run db:generate` di worktree (`src/generated/prisma` gitignored). Worker melaporkan "error pra-ada" — itu artifact client basi; setelah generate: exit 0.

### `npx eslint src/components/run-metering-summary.tsx src/components/run-metering-summary.test.tsx src/lib/i18n/messages.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  127 passed (127)
      Tests  1365 passed (1365)
TEST=0
```

### `npm run build`
```
F4BUILD=0
```

## QA (review koordinator — komponen kecil murni)
Verdict: **APPROVED** (tidak ada S1/S2/S3).

- Kontrak SDD-FRONTEND §D6 (pasca-koreksi S2-2) dipenuhi: props `{ metering?: RunMetering }` dengan `usage`/`consumed`/`sourcesRead`.
- `metering === undefined` → `return null`.
- **Tanpa baris biaya** — `estimatedCostUsd` tidak diproduksi backend (non-goal billing); tes `tidak pernah menampilkan klaim biaya` menegakkan ini.
- Catatan kejujuran `tasks.metering.estimateNote` tampil HANYA saat `usage.reported === false`.
- Format `Intl.NumberFormat("id-ID")` (1200 → "1.200"); tes menolak "1,200".
- i18n 4 kunci di `id` + `en` (kunci `cost` sengaja tidak ditambah).

## Catatan kejujuran cakupan
- Komponen belum dirender dari `TaskView` — integrasi itu WO-F5 (butuh B5 backend mengirim `metering` di snapshot). Diverifikasi lewat fixture (sesuai rencana SDD "independent dari backend untuk shape (dimock)").
- QA tidak menjalankan e2e browser; gate koordinator di atas yang mengikat.