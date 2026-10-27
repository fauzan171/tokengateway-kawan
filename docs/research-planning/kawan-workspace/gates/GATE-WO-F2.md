# GATE — WO-F2 (integrasi onboarding di task-view)

Worktree `worktrees/wo-f2` (`wo/f2`), basis `feat/kawan-workspace` `b9f9d931`.
Commit worktree `e953ca1e`; squash-merge ke `feat/kawan-workspace`: `0a2bdef1`.
AUTO_PUSH=0 (lokal saja).

## Gate (verbatim, dijalankan koordinator di worktree wo-f2)

### `npx tsc --noEmit -p tsconfig.json`
```
(exit 0, tanpa output)
```

### `npx eslint src/components/task-view.tsx src/components/task-view.test.tsx src/components/settings-form.tsx`
```
(exit 0, tanpa output)
```

### `npm test`
```
 Test Files  128 passed (128)
      Tests  1387 passed (1387)
```
(basis 127 file / 1371 lulus; +1 file / +16 tes = tes F2, nol regresi)

### `npm run build`
```
(exit 0)
```

## QA (agent `kawan-reviewer`, read-only)
Verdict: **APPROVED — tidak ada S1/S2**.

Diverifikasi QA:
- Tes baru diskriminatif (`task-view.test.tsx:114-188`): kartu hilang bila
  `onboarding` terisi; PATCH method/body `{onboarding:"riset"}` ditegaskan;
  PATCH 400 → `role="alert"` berisi pesan galat + kartu tetap tampil. Gagal bila
  jalur sukses dipakai saat galat.
- `task-view` hanya `setOnboarding` setelah `response.ok` (`task-view.tsx:363-379`).
- i18n lengkap di `id` dan `en`; `Record<MessageKey, string>` menjaga kelengkapan (tsc 0).
- Radio native + `<label>` pembungkus implisit; `name` unik dari `useId()`.
- Tak ada string keras/Inggris; tak ada rahasia/PII ke UI/log.

## S3/S4 diterima (non-blocking, diputuskan koordinator)

- **S3-1 optimistis tanpa rollback di `settings-form.tsx:88-96`:** `change()` menulis
  state sebelum `save()`; jalur galat hanya `setError`, tak mengembalikan nilai →
  radio onboarding tampak tersimpan padahal PATCH 400. **Diterima:** pola ini sudah ada
  untuk `theme`/`locale`/`fontScale` (bukan regresi baru yang diperkenalkan WO-F2),
  galat tetap ditampilkan, dan inti WO (`task-view`) sudah benar. Perbaikan menyeluruh
  (semua kontrol settings) = WP terpisah.
- **S3-2 galat settings `role="status"` bukan `role="alert"`** (`settings-form.tsx:181`):
  baris lama; WO-F2 hanya menaruh kontrol baru di bawahnya. `task-view.tsx:494` sudah
  `role="alert"`. Diterima sebagai utang a11y lama.
- **S3-3 judul field onboarding bukan `label`/`fieldset`** (`settings-form.tsx:172`):
  grup radio tetap punya `legend` internal kartu (`onboarding-focus-card.tsx:72`);
  heading field + `aria-describedby` ditunda ke WP a11y.
- **S3-4 tak ada `settings-form.test.tsx`:** SDD §D4(5) hanya mewajibkan tes kartu +
  task-view; bukan pelanggaran kontrak.
- **S4 fokus jatuh ke body setelah kartu hilang** (`task-view.tsx:490-499`); **S4 nilai
  lokal abaikan normalisasi server** (`task-view.tsx:372-375`). Dampak rendah.

## Catatan

QA tidak menjalankan gate (read-only) — klaim 4 gate di atas dijalankan koordinator
di worktree, verbatim.