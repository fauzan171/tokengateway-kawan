# Hasil pemeriksaan konsistensi dokumen

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
