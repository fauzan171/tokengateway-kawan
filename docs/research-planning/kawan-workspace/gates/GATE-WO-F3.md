# GATE — WO-F3 (aktivitas per langkah di task-view)

Worktree `worktrees/wo-f3` (`wo/f3`), basis `feat/kawan-workspace` `80ac9889`.
Squash-merge ke `feat/kawan-workspace`: `eb4e9ac4`. AUTO_PUSH=0 (lokal saja).

## Gate (verbatim, dijalankan koordinator di worktree wo-f3)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```
Catatan: `src/generated/prisma` gitignored — sudah di-generate di worktree ini (`npm run db:generate`).

### `npx eslint src/components/task-view.tsx src/components/task-view.test.tsx src/lib/i18n/messages.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  128 passed (128)
      Tests  1383 passed (1383)
TEST=0
```
(basis 127/1371 di `80ac9889`; +1 file/ +12 tes = tes F3, nol regresi)

### `npm run build`
```
F3BUILD=0
```

## QA (agent `review`, read-only — kawan-reviewer tak terdaftar di harness)
Verdict: **APPROVED (tidak ada S1/S2)**.

Diverifikasi:
- Kontrak D5 (post-koreksi S1-1) dipatuhi: status `succeeded|failed|cancelled|indeterminate`,
  kind `model|tool|phase`, tanpa `preview`.
- `appendActivity` murni (`task-view.tsx:57-89`): hanya baca `prev`, `slice()`/spread,
  `findIndex`; kind tak dikenal → `prev` identik (diuji `toBe(out)`); `stepId` kosong → `prev`.
- Dedup `(runId, seq)` benar (`:239-243`); cek `seq > snapshotSeq` didahulukan; cursor `seqRef`
  maju untuk semua frame ber-`id` termasuk kind tak dikenal — tak ada event dobel/hilang.
- i18n 7 kunci ada di `id` DAN `en`; `Record<MessageKey, string>` menegakkan kelengkapan (tsc 0).
- Label server diutamakan; fallback i18n hanya bila `label` kosong.
- Tes = perilaku (render + DOM), bukan change-detector/source-reading.
- Keamanan: tak ada `dangerouslySetInnerHTML`; label dirender sebagai teks React; tak ada
  PII/kredensial ke UI/log.

## S3/S4 diterima (non-blocking, diputuskan koordinator)

- **S3 double-announce a11y:** `ThinkingDots` (`role="status"`) dirender di dalam subtree
  `aria-live="polite"` `task-view.tsx:380`, berpotensi mengumumkan label yang sama dua kali.
  **Diterima sebagai pola rumah:** `chat-view.tsx:931` (`role="log"` + `aria-live="polite"`)
  sudah membungkus `ThinkingDots` `role="status"` (`chat-view.tsx:1120`) dengan cara yang sama.
  WP ini konsisten dengan pola existing; bukan regresi. Jika pemilik ingin, perbaikan menyeluruh
  (semua pemakaian) = WP a11y terpisah.
- **S4 deviasi `prevRunIdRef`:** spec literal `setActivity([])` tanpa syarat di `loadSnapshot`;
  worker memakai `payload.run?.id !== prevRunIdRef.current`. **Diterima:** run id unik per run,
  jadi kasus tes 5 (snapshot run BEDA) tetap mengosongkan timeline; satu-satunya jalur yang tidak
  dikosongkan = snapshot berturut run id identik = run yang sama (mis. sambung ulang), yang sejalan
  dengan §(2) "timeline terakhir dibiarkan tampil". Tidak ada skenario timeline bocor antar-run.
- **S3 item phantom:** `step.completed` tanpa `step.started` yang lolos (`seq > snapshotSeq`) →
  push item settled. Artefak tampilan, sesuai §(7) risiko; bukan kehilangan data/security.
- **S4 cabang status tak teruji:** `cancelled`/`indeterminate`/`succeeded` tak diuji langsung
  meski masuk kontrak (logika `failed` mencakup ketiganya; `succeeded` = jalur else `failed`).
  Celah cakupan, bukan celah perilaku.

## Catatan kejujuran cakupan
- Integrasi live ke backend (`step.started`/`step.completed` sungguhan dari WO-B3) diuji di WO-9
  (e2e Playwright). Gate ini menguji komponen + `appendActivity` murni dengan fixture event.
- QA tidak menjalankan e2e browser; gate koordinator di atas yang mengikat.