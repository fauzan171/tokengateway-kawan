# Hasil pemeriksaan konsistensi dokumen

Hasil 14 Oktober di bawah adalah historis. Pemeriksaan 17 Oktober mencakup 13 dokumen, 79 requirement, 94 work package, 64 baris coverage, 0 peringatan dan 0 pelanggaran. Ini tidak memverifikasi semantic parity atau implementasi agen. Lihat [scope aktif](../ACTIVE-SCOPE.md) dan [audit terbaru](reports/scope-audit-2026-10-17.md).

Perintah:

```bash
python3 tasks/nontechnical-v1/tools/check_docs.py
```

Hasil nyata (dijalankan pada 14 Oktober 2026, dari direktori paket):

```text
Dokumen diperiksa : 6
Requirement       : 79
Work package      : 94
Baris coverage    : 64
Peringatan        : 0
Pelanggaran       : 0

HASIL: LULUS
```

Exit code: `0`.

## Apa yang diperiksa

1. ID requirement `REQ-NT-*` unik pada baris definisi `prd.md`.
2. ID work package `WP-NT-Pn-mm` unik pada baris tabel `plan.md`.
3. Setiap work package merujuk requirement dan bagian SDD yang benar-benar ada.
4. Tidak ada requirement yatim (setiap `REQ-NT-*` dirujuk minimal satu work package).
5. Baris matriks `COV-*` unik; setiap baris `include` merujuk requirement yang ada.
6. Semua link markdown relatif pada enam dokumen menunjuk file yang benar-benar ada.

## Batas pemeriksaan ini

Ini **bukan** bukti aplikasi berjalan dan **bukan** bukti kesetaraan perilaku dengan baseline. Ini hanya membuktikan bahwa dokumen saling konsisten: tidak ada ID duplikat, tidak ada rujukan silang yang menggantung, dan tidak ada tautan rusak. Klaim parity tetap menunggu implementasi dan test.

## Catatan pengecualian

Paket infrastruktur dan audit (`WP-NT-P0-0x`, `WP-NT-P2-04`, `WP-NT-P5-09`, `WP-NT-P5-10`, `WP-NT-P10-0x`) boleh tidak merujuk requirement langsung karena ia mendukung banyak requirement sekaligus; pengecualian ini didaftarkan eksplisit di dalam script agar tidak menjadi celah yang menyembunyikan paket yang lupa dipetakan.

## Suite keamanan (SDD-9.3, WP-NT-P10-02)

Perintah yang bisa dijalankan ulang, semuanya harus exit `0`:

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint src/security/
npx vitest run src/security/
npm run check:docs
npm run check:licenses
```

Peta uji per butir SDD-9.3 ada di `src/security/README.md`. Suite ini memakai
SQLite sementara dari `tests/helpers/auth-db.ts` dan resolver DNS palsu, jadi
tidak menyentuh jaringan maupun database pengembang.

`npm run check:docs` dan `npm run check:licenses` juga dipasang di
`.github/workflows/ci.yml` (job `check`), sehingga konsistensi dokumen dan
lisensi diperiksa di CI, bukan hanya di laptop.
