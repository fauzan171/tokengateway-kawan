# GATE — WO-9 (e2e: riset end-to-end + onboarding + file + reconnect SSE)

Basis `feat/kawan-workspace` `044eb055` (WO-F5). Dikerjakan langsung di branch
integrasi (tanpa worktree terpisah), AUTO_PUSH=0 — seluruh commit lokal saja.

## Scope

WO ini menguji jalur produksi dari UI, bukan menambah fitur. Empat spec baru:

| Spec | Acceptance WO-10 | Yang dibuktikan |
|---|---|---|
| `e2e/research-loop.spec.ts` | poin 1, 3 | submit agent riset → siklus ≤3 → jawaban + sumber + metering; aktivitas per langkah berisi fase selesai, bukan gagal |
| `e2e/file-gen.spec.ts` | poin 2 | `generate_file` → entri artefak XLSX → unduhan 200, byte diawali `PK` (ZIP/OOXML), panjang > 200 |
| `e2e/onboarding.spec.ts` | poin 6 | jawaban tersimpan ke `/settings`, bertahan setelah reload, bisa diubah |
| `e2e/research-reconnect.spec.ts` | poin 5 | abort stream di tengah run → banner → sambung ulang → teks & aktivitas tidak berganda |

Plus D4 (kalimat fokus onboarding masuk prompt run riset) yang sebelumnya
tertinggal di worktree `wo-9` — di-apply dari patch ke branch integrasi.

## Tiga cacat infrastruktur yang ditemukan (bukan milik WO-9)

Ketiganya membuat **spec e2e apa pun** mustahil lulus, jadi diperbaiki di sini.

### 1. `e2e/seed.ts` hanya menerapkan migrasi `init`
DB e2e punya 22 tabel, **tanpa** `Task`, `TaskRun`, `TaskSource`, `TaskStep`,
`Artifact`, `WorkerHeartbeat`, `SearchUsageDaily`. Setiap spec fitur baru gagal
dengan "tabel tidak ada", bukan karena kode salah — pola insiden produksi
2026-10-21. **Perbaikan:** `applyMigrations()` menerapkan seluruh direktori
`prisma/migrations/sqlite/<14 digit>_*/migration.sql` urut nama. Migrasi repo
additive dan idempoten, jadi aman di DB kosong. Verifikasi: 40 tabel.

### 2. `tsconfig.json` ikut men-typecheck `worktrees/`
`include: ["**/*.ts"]` menyapu 486 berkas dari worktree WO-9 (salinan repo
lain), menghasilkan 87 galat palsu (TS2353 `onboarding` / `configJson` tidak
ada di tipe Prisma). **Perbaikan:** `exclude: ["node_modules", "worktrees"]`.

### 3. `sanitizeDisplayName` membuang setiap titik
`replace(/[..]+/g, " ")` adalah **character class** — mencocokkan tiap titik
tunggal, bukan `..`. Akibatnya `rekap-e2e.xlsx` → `rekap-e2e xlsx.xlsx` di
**produksi**, bukan hanya di uji. **Perbaikan:** `\.{2,}` + tes regresi
(`artifacts.test.ts`, 3 asersi).

Penyesuaian pendukung: `playwright.config.ts` — `timeout` webServer 180s → 420s
(build di 3 vCPU melewati 180s) dan `E2E_PORT` (port 3100 dipakai proses lain).

## Gate (verbatim, dijalankan di branch integrasi setelah D4 di-apply)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint <11 berkas berubah>`
```
(exit 0, tanpa output)
```
Berkas: `src/lib/tasks/research.ts`, `research.test.ts`, `src/lib/artifacts/format.ts`,
`artifacts.test.ts`, `e2e/{seed,fake-gateway,file-gen.spec,onboarding.spec,research-loop.spec,research-reconnect.spec}.ts`,
`playwright.config.ts`.

### `npm test`
```
 Test Files  130 passed (130)
      Tests  1418 passed (1418)
```
(basis 130 file / 1414 lulus di `044eb055`; +4 tes: 3 fokus D4 + 1 regresi titik)

### `npm run build`
```
(exit 0; route list normal)
```

### `npx playwright test e2e/{research-loop,onboarding,research-reconnect,file-gen}.spec.ts --project=desktop`
```
E2E_PORT=3177 ...
 ✓ 1 [desktop] e2e/file-gen.spec.ts:28   generate_file membuat artefak yang benar-benar dapat diunduh (5.1s)
 ✓ 2 [desktop] e2e/onboarding.spec.ts:27 onboarding tersimpan, bertahan setelah reload, dan bisa diubah (1.8s)
 ✓ 3 [desktop] e2e/research-loop.spec.ts:39 agent riset menyelesaikan run, menampilkan sumber dan metering (3.2s)
 ✓ 4 [desktop] e2e/research-loop.spec.ts:59 aktivitas per langkah memuat fase selesai, bukan gagal (2.5s)
 ✓ 5 [desktop] e2e/research-reconnect.spec.ts:34 putus SSE di tengah run tidak menggandakan teks atau aktivitas (2.3s)
5 passed
```

Catatan: port 3100 sedang dipakai proses lain saat gate dijalankan, sehingga
`E2E_PORT` ditimpa. Konfigurasi default tetap 3100.

## D4 — kalimat fokus onboarding di prompt riset

`research.ts`: `FOCUS_PRESETS` (riset/data/tulis/campur) + `focusLine(configJson)`
membaca `configJson.focus`, `custom:` dipotong 200 char, JSON rusak/nilai tak
dikenal → `null` (run lama tetap jalan tanpa kalimat fokus). `modelTurn`
menyisipkan satu pesan `system` bila tidak null. 3 tes di `research.test.ts`
(preset, `custom:` terpotong, JSON rusak → null).

## Sisa (dicatat, tidak memblokir)

- **E2E hanya project `desktop`.** Project `mobile`/`tablet` ada di config
  tetapi tidak dijalankan pada gate ini; tata letak mobile tetap diuji suite
  komponen. Bila acceptance menuntut tiga viewport, jalankan
  `npx playwright test --project=mobile --project=tablet`.
- **`research-reconnect` bergantung pada abort tiruan** (`route.abort`), bukan
  putus jaringan sungguhan — dedup `afterSeq` diuji, kondisi jaringan asli tidak.
- **Bukti WO-10 poin 3 (SEARCH_UNAVAILABLE)** tidak punya spec e2e; ditutup di
  unit test chain pencarian (`WO-B2`), bukan di sini.
- Berkas lepas yang tidak di-commit: `Memulai Obrolan Santai.md` (materi pengguna,
  bukan sumber repo); `.agent-teams/`, `.playwright-cli/`, `snap*.yml` kini
  masuk `.gitignore`.
