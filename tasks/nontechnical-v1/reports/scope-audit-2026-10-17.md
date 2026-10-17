# Audit arah produk dan fondasi Kawan

Tanggal: 17 Oktober 2026. Verdict: **FIX**. Dokumen baseline chat belum memenuhi
arah agen Manus. Scope telah direvisi pada [kontrak aktif](../../ACTIVE-SCOPE.md).
Ini audit dokumentasi dan alur fondasi, bukan sertifikasi keamanan produksi.

## Cakupan dan alur yang diperiksa

Inventaris dokumentasi mencakup README/PROMPT, `docs/`, paket `tasks/nontechnical-v1/`,
PRD/plan/coverage/acceptance lama, SDD/work orders, referensi dan arsip BYOK.
Dokumen historis dipertahankan dengan entrypoint yang menunjuk scope aktif.

Alur implementasi yang ditelusuri: halaman/composer → API auth/koneksi/chat →
service domain → Prisma; worker → lease antrean → chat generation → gateway;
SSE dari event database kembali ke klien. Schema, konfigurasi, enkripsi, kebijakan
jaringan, fixture, pipeline CI dan skrip migrasi turut diperiksa. Belum merupakan
review baris-per-baris seluruh source/generated/dependencies atau pentest.

## Temuan dan tindakan

| Prioritas | Bukti | Temuan / tindakan |
|---|---|---|
| Tinggi | PRD §4.2.6; SDD-1.1/10; coverage COV otomasi/kode | Scope lama melarang agen yang diminta pemilik. Kontrak aktif kini memasukkan task, tool, browser, sandbox dan artefak, dengan gate bertahap. |
| Tinggi | `handoff-prompts.md` §2/4; `prompt-full.md` urutan fase | Semua fitur chat/media/admin diposisikan sebelum agen. Prioritas diganti AG-P0..AG-P5; fitur enterprise dan multi-agent wajib dikeluarkan dari jalur awal. |
| Tinggi | `src/lib/jobs/kinds.ts`; `queue.ts` fail/releaseExpired | Chat/embedding dianggap idempoten sehingga bisa terulang setelah kegagalan ambigu/lease habis. Diubah menjadi indeterminate, dengan regresi kegagalan dan lease untuk kedua kind. |
| Tinggi | `src/lib/api/http.ts`; `src/lib/chat/generate.ts` fetch | Redirect otomatis melewati pemeriksaan awal egress. Kedua jalur kini menolak seluruh redirect; test HTTP fixture membuktikan target redirect tidak dipanggil. |
| Tinggi | `.github/workflows/ci.yml`; `src/lib/db.ts` | CI hanya generate SQLite sementara typecheck/build mengimpor kedua klien. CI kini memakai `npm run db:generate`, juga menjalankan checker dokumen. |
| Tinggi | `src/worker.ts`; `tests/worker-lifecycle.test.ts` | Timer force-exit berjalan sejak startup sehingga worker mati setelah 30 detik. Dipindahkan ke SIGINT/SIGTERM; proses nyata diuji hidup 31 detik setelah siap lalu shutdown normal. |
| Tinggi | `src/lib/chat/recovery.ts`; `src/lib/jobs/worker.ts` | Job terminal sebelumnya meninggalkan generasi aktif. Rekonsiliasi sebelum claim dan saat shutdown kini menyimpan partial, menutup generasi dan event secara transaksional; tidak menambah event setelah done/error yang sudah tersimpan. |
| Sedang | `src/lib/chat/generate.ts`; `src/lib/chat/usage.ts` | Dua pencatat usage berbeda. Generasi kini memakai satu implementasi usage yang menormalisasi nilai provider dan membedakan laporan tidak lengkap. |
| Sedang | README; SDD/execution/coverage header; `docs/CATATAN-ORCHESTRASI.md` | Ada klaim NT-P3 selesai dan klaim aplikasi belum ada bersamaan. Header diperbaiki: backend tersedia, UI dan gate end-to-end masih parsial. Mode Direct juga belum tersedia. |
| Sedang | `plan.md` catatan P1-06; `handoff-prompts.md` migrasi | Instruksi squash/reset data tidak aman sebagai upgrade. Diganti aturan additive; checker migrasi masih perlu diperbaiki sebelum schema tugas ditambah. |
| Rendah | `prompt-full.md` rujukan handoff/checker; PRD §8.4 | Bagian handoff tidak ada, path checker salah, repo publik masih dipertanyakan. Rujukan dan status diperbaiki. |
| Sedang | `tools/check_docs.py` DOCS | Checker awal hanya memeriksa enam dokumen. Kini mencakup seluruh Markdown paket termasuk prompt, laporan dan scope aktif; link relatif diselesaikan terhadap direktori masing-masing. |

## Pekerjaan fondasi yang masih terbuka

- `src/components/chat-view.tsx`: ID placeholder diganti pada delta pertama tetapi
  delta berikutnya mencari ID lama, sehingga teks berikutnya tidak masuk. Error SSE
  ditutup tanpa pesan, state hanya di memori, pemilih model dan kontrol backend belum
  tersambung. Selesaikan AG-P0 dengan E2E UI, bukan hanya test service.
- `src/app/page.tsx`: tombol chat baru hanya memilih section dan tidak mereset chat
  yang sudah terbuka. Belum ada daftar riwayat yang dapat dibuka kembali.
- `src/lib/net/policy.ts`: validasi DNS terpisah dari DNS saat koneksi; risiko rebinding
  belum ditutup. Pin hasil resolusi pada koneksi dan uji; redirect fix tidak menutup ini.
- Penulisan delta chat belum memeriksa token lease pada setiap mutasi; worker lama
  yang belum menerima abort masih perlu dicegah menulis setelah kehilangan lease.
- Batas body/stream dan waktu chat perlu dibedakan dari discovery 15 detik; jangan
  memakai batas discovery sebagai batas tugas agen panjang.
- Reset password masih memakai pengiriman tautan melalui log operator; email belum
  diimplementasikan. Origin dari forwarded header memerlukan konfigurasi proxy tepercaya.
- `scripts/check-migrations.mjs` membandingkan setiap migrasi dengan snapshot init;
  belum mendukung migrasi incremental atau membuktikan upgrade database berisi data.
- Sandbox, browser agent, task/run/step, approval dan artefak belum ada. Tidak ada
  dasar untuk menyatakan keamanan atau kesetaraan Manus 100%.

## Batas verifikasi

Checker ID/link hanya membuktikan konsistensi mekanis, bukan kesesuaian produk,
keamanan atau seluruh fitur sudah berjalan. Test integrasi memakai gateway fixture;
model gateway produksi, SMTP, PostgreSQL live, browser sandbox, mobile dan seluruh
alur UI belum diverifikasi dalam audit ini. Hasil perintah aktual dicatat di bawah
setelah gate perubahan selesai.

## Bukti gate perubahan

Semua perintah dijalankan dari akar repo pada 17 Oktober 2026:

| Perintah | Hasil aktual |
|---|---|
| `npm run db:generate` | Exit 0; klien SQLite dan PostgreSQL berhasil dihasilkan |
| `npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0 |
| `npm test -- --maxWorkers=2` | Exit 0; 38 file, 475 test lulus |
| `npm run build` | Exit 0; build produksi dan generasi halaman selesai |
| `python3 tasks/nontechnical-v1/tools/check_docs.py` | Exit 0; 13 dokumen, 79 requirement, 94 WP, 64 coverage; 0 peringatan/pelanggaran |
| `node scripts/check-migrations.mjs` | Exit 0; snapshot dua provider identik; bukan uji upgrade atau DB PostgreSQL live |
| `git diff --check` | Exit 0 |

Regresi yang terlebih dahulu terbukti gagal: gateway mengikuti redirect, job chat/
embedding diulang setelah hasil ambigu, worker mati 30 detik setelah siap, dan
shutdown handler kooperatif meninggalkan lease aktif. Setelah perbaikan semuanya
lulus. Regresi rekonsiliasi juga membuktikan partial tersimpan, satu event error,
dan tidak ada event baru setelah done. Checker diuji pada salinan sementara dengan
link rusak di handoff; keluar 1 dan menyebut link yang disuntikkan.

Test server fixture memerlukan izin membuka localhost: percobaan dalam sandbox
menghasilkan EPERM, kemudian dijalankan ulang dengan izin yang diberikan. Tidak
ada request ke gateway produksi. Pipeline GitHub CI telah diperbaiki tetapi belum
dieksekusi di GitHub dalam pekerjaan ini. Tidak ada perubahan UI visual atau E2E
browser baru; kekurangan UI yang terdaftar di atas tetap pekerjaan AG-P0.
