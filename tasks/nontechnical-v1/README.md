# Paket dokumen Kawan — scope nontechnical-v1

Status: dokumen perencanaan aktif untuk brief terbaru. Aplikasi belum ada; tidak ada satu baris kode implementasi di paket ini.

Paket ini menjawab permintaan terbaru pemilik produk: PRD lengkap dan SDD detail yang siap dibagikan ke implementer, dengan target pengguna **nonteknis**, pengalaman chat selengkap ChatGPT untuk pemakaian pribadi, dan **BYOK gateway sebagai jalur default**. Fitur yang dianggap overkill untuk target ini dikecualikan secara eksplisit, bukan dihapus diam-diam.

## Baseline

- Repository referensi: `https://github.com/open-webui/open-webui`
- Commit lokal yang dipin: `f8ae8a6c328946dc62cd0712961a0632574581bf`
- Lokasi read-only: `/Users/mekari/tokengateway/open-webui`
- Versi paket referensi: `open-webui` 0.12.0 (dibaca dari `package.json` baseline)
- Working tree baseline bersih saat verifikasi (`git status --short` kosong), branch `main`.

Paket ini **tidak** mengikuti branch `main` referensi secara otomatis. Semua angka dan nama file di paket ini berasal dari sumber lokal di atas, bukan dari ingatan atau asumsi.

## Klaim cakupan — baca ini dulu

Paket ini **bukan** klaim 100% Open WebUI. Angka cakupan di sini berarti:

- 100% untuk **scope terpilih** yang didefinisikan di `prd.md` dan dipetakan di `coverage.md`.
- Fitur di luar scope terdaftar sebagai `defer` atau `exclude` dengan alasan, sehingga tidak ada klaim tersembunyi.
- Kawan **bukan** klon identik ChatGPT dan **tidak** menjanjikan perilaku yang identik dengan ChatGPT.

Paket full-parity lama di `tasks/prd.md`, `tasks/plan.md`, `tasks/sdd/`, `tasks/todo.md`, `tasks/coverage.*`, dan seterusnya tetap ada apa adanya sebagai referensi alternatif. Paket lama itu bukan requirement default untuk brief terbaru.

## Urutan baca dan precedence

1. `prd.md` — dokumen produk: masalah, pengguna, tujuan, metrik, requirement per domain, alur, acceptance, rencana rilis.
2. `sdd.md` — dokumen desain teknis: arsitektur, kepemilikan schema, kontrak API, lifecycle SSE, auth/secret, upload/RAG/security, UI/aksesibilitas/mobile, testing/deploy/backup.
3. `plan.md` — milestone, dependency, work package paralel dengan ID yang dipetakan ke requirement dan bagian SDD, plus handoff/DoR/DoD.
4. `coverage.md` — matriks fitur sumber Open WebUI dengan keputusan `include`/`defer`/`exclude`, alasan, requirement, dan test.
5. `execution-prompt.md` — instruksi worker: penugasan terbatas, quality gate, format bukti.

Bila ada konflik antar dokumen: requirement produk di `prd.md` menang atas detail teknis; `sdd.md` menang atas `plan.md`; `plan.md` menang atas `execution-prompt.md`. Perbedaan yang disengaja dicatat di bagian "Keputusan default" pada `prd.md` dan di "Exception ledger" pada `coverage.md`, bukan diselesaikan diam-diam.

## Isi paket

| File | Isi |
|---|---|
| `README.md` | Indeks, precedence, baseline, aturan klaim. |
| `prd.md` | 8 bagian: ringkasan, kontak, latar belakang, tujuan & metrik, pasar/pengguna, nilai, detail solusi (requirement + alur + acceptance), rilis. |
| `sdd.md` | Desain teknis: arsitektur modular monolith Next.js, kepemilikan schema, kontrak API, lifecycle SSE, auth/secret, upload/RAG/security, UI, testing/deploy/backup. |
| `plan.md` | Milestone, dependency, work package paralel, DoR/DoD, handoff. |
| `coverage.md` | Matriks feature sumber dengan keputusan include/defer/exclude. |
| `execution-prompt.md` | Instruksi worker dan quality gate. |
| `tools/check_docs.py` | Pemeriksa konsistensi dokumen berbasis Python stdlib (tanpa framework). |
| `verification.md` | Hasil jalannya pemeriksa konsistensi (output nyata). |

## Cara menjalankan pemeriksa konsistensi

```bash
python3 tasks/nontechnical-v1/tools/check_docs.py
```

Script memeriksa: keunikan ID requirement, ID work package, rujukan silang requirement ↔ work package ↔ SDD, rujukan silang matriks coverage ↔ requirement, keberadaan file lokal yang dirujuk, dan bahwa semua link markdown relatif menunjuk file yang ada. Exit code non-nol bila ada pelanggaran. Ini pemeriksaan konsistensi dokumen, bukan bukti aplikasi berjalan.

## Aturan penulisan dan lisensi

- Dokumen ini ditulis orisinal. Tidak ada aset, kode, terjemahan, atau skema dari repository referensi yang disalin atau di-rename lalu diklaim milik sendiri.
- Sebelum menyalin aset atau kode apa pun dari Open WebUI, wajib ada tinjauan lisensi dan merek (Open WebUI License, `LICENSE_NOTICE`, `LICENSE_HISTORY` di baseline). Sampai tinjauan itu selesai, semua aset Kawan dibuat sendiri.
- Angka pasar/pengguna/metrik yang bersifat eksternal tidak diarang. Nilai yang tidak diketahui ditandai `current: unknown` dan target sebagai usulan, bukan fakta.
