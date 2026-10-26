# GATE — WO-F1 (OnboardingFocusCard + i18n)

Worktree: `worktrees/wo-f1` · Branch: `wo/f1` · Base: `da7247c8` (feat/kawan-workspace)

File: `src/components/onboarding-focus-card.tsx` (baru), `.test.tsx` (baru),
`src/lib/i18n/messages.ts` (13 kunci id+en).

## Iterasi 1 — `0dd9a8f1` (gagal QA)

QA (`kawan-reviewer`, read-only) menemukan **S2** (blocking): state internal
`choice`/`text` di-init sekali via `useState` dan mengabaikan perubahan prop
`value` — melanggar kontrak SDD-FRONTEND §D4 ("state internal tidak ada, kontrol
penuh lewat props"). Kartu salah tampil bila `value` datang setelah mount.

Gate iterasi 1 (untuk rekam jejak):

```
$ npm run db:generate                                  EXIT=0
$ npx tsc --noEmit -p tsconfig.json                    EXIT=0
$ npx eslint <3 file berubah>                           EXIT=0
$ npx vitest run src/components/onboarding-focus-card.test.tsx   4 passed
$ npm test            123 file / 1329 test lulus       TEST=0
$ npm run build       ✓ Compiled successfully in 108s  BUILD=0
```

## Iterasi 2 — perbaikan S2 (+S3/S4 kecil), gate final

Perbaikan (worker `kawan-frontend`, diff +32/-2 di komponen, +32/-2 di tes):
- **S2**: `useEffect(..., [value])` resync `choice`/`text` saat prop berubah;
  `dismissed` (Lewati dulu) tetap state lokal.
- **S3**: tes `compact` meng-assert `data-compact` (atribut stabil), bukan
  substring `className`.
- **S4a**: `aria-label` input custom tanpa elipsis.
- **S4b** (`aria-controls`/`aria-expanded`): dilewati — tidak diwajibkan spec.

Tes baru membuktikan S2: mount `value="riset"` → radio ter-centang; mount
`value="custom:x"` → input berisi `x`; prop berubah pasca-mount (`""`→`custom:x`→`riset`)
→ tampilan ikut berubah. Semua assert perilaku/DOM, bukan string class.

```
$ npx vitest run src/components/onboarding-focus-card.test.tsx   7 passed (7)
$ npx tsc --noEmit -p tsconfig.json                    EXIT=0

$ npm test
 Test Files  123 passed (123)
      Tests  1332 passed (1332)
TEST=0
(basis 122/1325 → 123/1332: +1 file uji, +7 test; nol regresi)

$ npm run build
 ✓ Compiled successfully in 34.0s
BUILD=0
```

QA final: tidak ada S1/S2 tersisa (S2 ditutup bukti tes rerender; S3/S4 diperbaiki
atau dinyatakan sengaja dilewati).