# GATE — WO-9 (e2e: riset end-to-end + onboarding + file + reconnect SSE)

Basis `feat/kawan-workspace` `044eb055` (WO-F5). Dikerjakan langsung di branch
integrasi (tanpa worktree terpisah), AUTO_PUSH=0 — seluruh commit lokal saja.

## Scope

WO ini menguji jalur produksi dari UI, bukan menambah fitur. Empat spec baru:

| Spec | Acceptance WO-10 | Yang dibuktikan |
|---|---|---|
| `e2e/research-loop.spec.ts` | poin 1, 3 | submit agent riset → siklus ≤3 → jawaban + sumber + metering; aktivitas per langkah berisi fase selesai, bukan gagal |
| `e2e/file-gen.spec.ts` | poin 2 | `generate_file` → entri artefak XLSX → unduhan 200, byte diawali `PK` (ZIP/OOXML), panjang > 200 |
| `e2e/flow-onboarding.spec.ts` | poin 6 | jawaban tersimpan ke `/settings`, bertahan setelah reload, bisa diubah |
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
      Tests  1419 passed (1419)
```
(basis 130 file / 1414 lulus di `044eb055`; +5 tes: 3 fokus D4 + 1 regresi titik
+ 1 regresi prototype chain)

### `npm run build`
```
(exit 0; route list normal)
```

### `npx playwright test e2e/{research-loop,flow-onboarding,research-reconnect,file-gen}.spec.ts --project=desktop`
```
E2E_PORT=3177 ...
 ✓ 1 [desktop] e2e/file-gen.spec.ts:28   generate_file membuat artefak yang benar-benar dapat diunduh (5.1s)
 ✓ 2 [desktop] e2e/flow-onboarding.spec.ts:27 onboarding tersimpan, bertahan setelah reload, dan bisa diubah (1.8s)
 ✓ 3 [desktop] e2e/research-loop.spec.ts:39 agent riset menyelesaikan run, menampilkan sumber dan metering (3.2s)
 ✓ 4 [desktop] e2e/research-loop.spec.ts:59 aktivitas per langkah memuat fase selesai, bukan gagal (2.5s)
 ✓ 5 [desktop] e2e/research-reconnect.spec.ts:34 putus SSE di tengah run tidak menggandakan teks atau aktivitas (2.3s)
5 passed
```

### `npx playwright test ... --project=mobile --project=tablet`
```
E2E_PORT=3179 ...
8 passed
```
`flow-onboarding.spec.ts` dikecualikan di mobile/tablet oleh `testIgnore: /flow-.*\.spec\.ts/` —
spec itu mengubah state global pengguna E2E_B di satu DB bersama, jadi menjalankannya
paralel lintas project membuat project berikutnya tidak lagi melihat "belum dijawab".
Konvensi ini sudah ada di config (dipakai spec `flow-*` lain), bukan pengecualian baru.
Tiga spec lain (riset, file, reconnect) berjalan di ketiga viewport: 5 desktop + 4 mobile
+ 4 tablet = 13 lulus.

Catatan: port 3100 sedang dipakai proses lain saat gate dijalankan, sehingga
`E2E_PORT` ditimpa. Konfigurasi default tetap 3100.

## D4 — kalimat fokus onboarding di prompt riset

`research.ts`: `FOCUS_PRESETS` (riset/data/tulis/campur) + `focusLine(configJson)`
membaca `configJson.focus`, `custom:` dipotong 200 char, JSON rusak/nilai tak
dikenal → `null` (run lama tetap jalan tanpa kalimat fokus). `modelTurn`
menyisipkan satu pesan `system` bila tidak null. 3 tes di `research.test.ts`
(preset, `custom:` terpotong, JSON rusak → null).

## QA (agent `kawan-reviewer`, read-only) — putaran 1: CHANGES-REQUESTED

3 temuan S3, 5 S4. Tidak ada S1/S2.

### S3-1 (diperbaiki) — `FOCUS_PRESETS[focus]` lewat prototype chain
`research.ts:98`: `FOCUS_PRESETS["constructor"]` mengembalikan `Object` dari
prototype, lolos `if (!label)`, dan teks `function Object() { [native code] }`
masuk ke pesan `system`. Bukan jalur serang hidup (`normalizeOnboarding` di
`settings.ts:70-91` menolak nilai itu), tapi defense-in-depth murah.
**Perbaikan:** `Object.hasOwn(FOCUS_PRESETS, focus)`. Tes regresi
`research.test.ts` "preset bernama properti prototype tidak menyisipkan teks
sampah" — memastikan body tidak memuat `native code` / `[object Object]`.

### S3-2 (tidak terkonfirmasi, ditolak dengan bukti) — `tsconfig` exclude
Reviewer menduga `.claude/worktrees/` dan `.agents/worktrees/` tetap ikut
`include: ["**/*.ts"]` sehingga gate `tsc` bisa meledak. Diukur:
`npx tsc -p tsconfig.json --showConfig` → **567 berkas**, nol dari kedua
direktori itu (461 `src/`, 77 `.next/`, 19 `e2e/`, 5 `tests/`, 4 config).
TypeScript melewati direktori berawalan titik saat memperluas glob. Gate tsc
exit 0 pada checkout dengan kedua direktori masih ada. Tidak ada perubahan.

### S3-3 (diperbaiki) — `flow-onboarding` berebut pengguna dengan `flow-e`
`fullyParallel: true` + satu DB bersama: `flow-e` menghapus `E2E_B`, sedangkan
`flow-onboarding` login sebagai `E2E_B` dan menuntut kartu onboarding tampil.
Urutan mana pun yang menang, yang lain gagal. `testIgnore: /flow-.*/` hanya
memisahkan project, bukan spec di dalam project yang sama.
**Perbaikan:** pengguna khusus `ONBOARDING_EMAIL` / `ONBOARDING_USER_ID` di
`seed.ts` (tanpa baris `UserSetting`, tanpa `Connection`, tidak pernah dihapus
spec lain). Verifikasi: `flow-e` + `flow-onboarding` berdampingan `--workers=2`
→ **2 lulus**.

### S4-1 (diperbaiki) — assertion `steps <= 3` tautologis
`PhaseTimeline` merender `phases.slice(-3)` (`thinking-indicator.tsx`), jadi
jumlah `listitem` tidak pernah melebihi 3. Assertion itu tidak bisa gagal.
**Perbaikan:** dibuang; diganti dua hitungan teks yang benar-benar bisa
berganda (`"Balasan palsu"` = 1, `"Menyusun jawaban akhir"` = 1). Klaim header
soal "replay `afterSeq`" juga diperbaiki: tombol sambung ulang memuat ulang
snapshot lalu menyambung dengan cursor, jadi yang diuji adalah dedup
`(runId, seq)` sisi klien — bukan replay delta.

### S4-2 (diperbaiki) — komentar `file-gen.spec.ts` mengklaim hash
Komentar menyebut `sha256` byte diunduh dibandingkan dengan `Artifact.sha256`;
spec tidak menyentuh DB sama sekali. **Perbaikan:** komentar dibetulkan dan
menunjuk ke `file-gen.test.ts:102` yang memang membandingkan hash.

### S4-3 (diperbaiki) — judul tes menyesatkan
"custom dipotong 200 karakter **dan karakter kontrol hilang**" — `focusLine`
hanya `trim()` + `slice(0,200)`; `\n` tetap ada. Tes lulus karena pemotongan,
bukan karena pembuangan kontrol. Produksi tetap aman: `normalizeOnboarding`
membuang `[\u0000-\u001f\u007f]` di trust boundary. **Perbaikan:** judul
dikoreksi jadi "custom dipotong 200 karakter". Lapis kedua di `focusLine`
sengaja tidak ditambah — satu titik validasi sudah cukup.

### S4-4 (diperbaiki) — filter migrasi seed berbeda dari checker
Seed memakai `/^\d{14}_/`, `scripts/check-migrations.mjs` menerima direktori
apa pun. Migrasi baru dengan nama tak cocok akan lolos checker + `prisma
migrate` tetapi **dilewati diam-diam** di DB e2e — persis pola insiden yang
ingin dihapus. **Perbaikan:** filter disamakan (`isDirectory()` saja).

### S4-5 (diterima, tidak diperbaiki) — `sanitizeDisplayName("." + ".")`
Menghasilkan `"..pdf"`. Hanya nama tampilan; `storageKey` = `randomUUID()` dan
route unduh menyaring ulang. Tidak ada traversal. Dibiarkan.

### Diperiksa reviewer, bersih
Determinisme dan urutan `applyMigrations` (15 direktori, semuanya additive
`ALTER/CREATE`, FK dibuat lebih awal); himpunan nama migrasi sqlite = postgres
15/15; `sanitizeDisplayName` bukan tautologis (`[..]+` lama memang gagal pada
`rekap.xlsx`); tidak ada kredensial/path mesin di berkas yang di-commit;
`focusLine` disisipkan setelah `system` agent sehingga tidak bisa menimpa
instruksi fase.

## Sisa (dicatat, tidak memblokir)

- **`flow-onboarding` hanya desktop.** Spec itu mengubah state pengguna E2E_B
  global; tiga spec lain berjalan di ketiga viewport (13 lulus total).
- **`research-reconnect` bergantung pada abort tiruan** (`route.abort`), bukan
  putus jaringan sungguhan — dedup `afterSeq` diuji, kondisi jaringan asli tidak.
- **Bukti WO-10 poin 3 (SEARCH_UNAVAILABLE)** tidak punya spec e2e; ditutup di
  unit test chain pencarian (`WO-B2`), bukan di sini.
- Berkas lepas yang tidak di-commit: `Memulai Obrolan Santai.md` (materi pengguna,
  bukan sumber repo); `.agent-teams/`, `.playwright-cli/`, `snap*.yml` kini
  masuk `.gitignore`.
