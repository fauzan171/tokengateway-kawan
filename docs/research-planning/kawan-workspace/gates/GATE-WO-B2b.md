# GATE — WO-B2b (onboarding fokus → configJson.focus)

Worktree `worktrees/wo-b2b` (`wo/b2b`), basis `feat/kawan-workspace` `8b161bbd`.
Squash-merge ke `feat/kawan-workspace`: `ea5b2d78`. AUTO_PUSH=0 (lokal saja).

## Gate (verbatim)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/lib/settings/settings.ts src/lib/settings/settings.test.ts src/lib/tasks/tasks.ts src/lib/tasks/admission-onboarding.test.ts`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  125 passed (125)
      Tests  1351 passed (1351)
TEST=0
```

### `npm run build`
```
B2BBUILD=0
```

## QA (kawan-reviewer, read-only)
Verdict: **[x] APPROVED (tidak ada S1/S2)**.

Bukti kunci:
- Migrasi additive B1: `ALTER TABLE "UserSetting" ADD COLUMN "onboarding" TEXT NOT NULL DEFAULT '';` (sqlite+postgresql), `schema.prisma:565` sinkron. **Tidak ada migrasi baru — benar** (tidak ada kolom baru).
- Transaksi: `tasks.ts:443` (dalam `$transaction` @384) dan `:748` (@683), keduanya di dalam tx yang sama dengan `tx.taskRun.create` (@479 / @771).
- Anti-bocor DTO: `RUN_FIELDS` (`tasks.ts:144-160`) + `toRunDto` (`:115-132`) tidak memuat `configJson`/`focus`; satu-satunya pembaca `configJson` = tasks.ts + tes. Titik kebocoran terbukti tidak ada.
- Sanitasi server (`settings.ts:75-84`): `replace(/[\u0000-\u001f\u007f]/g,"")`, cap `>200` → throw, `custom:` kosong → throw; di `writeSettings`, bukan UI.

## Catatan kejujuran cakupan
- **S3 (bukan blocking, dipindah ke WO-B3):** klausa tes D4 "run lama (focus null) tetap valid; prompt tanpa kalimat fokus". Tes B2b membuktikan `focus:null` di configJson, tapi bagian injeksi prompt hidup di `research.ts` — belum ada di worktree mana pun, dan per SDD-BACKEND §D4/§Urutan WO itu milik **WO-B3** (loop riset). Bukan celah B2b.
- **S4:** `focusConfigJson` passthrough mentah (tanpa re-normalisasi) — risiko rendah (semua jalur tulis lewat `writeSettings`); `custom:` case-sensitive — SDD tidak mensyaratkan case-insensitive. Tidak diperbaiki.
- QA tidak menjalankan `scripts/check`; gate koordinator di atas yang mengikat.