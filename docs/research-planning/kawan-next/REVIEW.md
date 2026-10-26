# Review konsistensi dan kesiapan coding

24 Oktober 2026 UTC. Ordinary document review; bukan quality gate kode, bukan izin implementasi/deploy. Enam dokumen sintesis dan empat laporan dibaca penuh. Source tambahan diperiksa untuk upload dan konfigurasi tes. Baseline HEAD `027e17d4ba9c8faaa75d749e0e30166f651a17f5`; tracked diff kosong. Hanya dokumen review ini ditulis.

## Status terkini — delta review t9

**PASS untuk penutupan temuan dokumen REV-01–07**, 24 Oktober 2026 UTC. Revisi t8 diverifikasi dari isi kontrak/WP/acceptance, bukan menerima self-check penulis. Rincian penutupan di bagian akhir. Kesimpulan dan temuan awal di bawah dipertahankan sebagai riwayat; locator awal dapat bergeser setelah revisi. Pass ini bukan acceptance implementasi, bukan izin coding/deploy, bukan audit runtime.

## Kesimpulan awal t6

**Needs revision sebelum membekukan kontrak implementasi.** Arah reuse existing, read-only dahulu, tiga siklus, provenance, budget, tenant isolation dan sandbox fail-closed konsisten. Namun jalur upload file, klarifikasi read-only dan consent egress belum menjadi kontrak end-to-end. WP belum aman dijalankan sebagai paket lengkap tanpa menutup temuan high berikut. WP baseline/lifecycle independen tetap dapat dipilih setelah izin coding terpisah; review ini tidak memberikan izin tersebut.

## Temuan

### REV-01 — high — Jalur upload input tidak tersambung ke artifactIds

**Lokasi:** [SDD:44](<SDD.md#L44>), [SDD:90–98](<SDD.md#L90-L98>), [SDD:148](<SDD.md#L148>), [rencana:51–56](<IMPLEMENTATION-PLAN.md#L51-L56>).

TaskAttachment dan file.inspect menerima artifactId, tetapi tidak ditetapkan bagaimana upload CSV/JSON/XLSX/PDF pengguna menghasilkan ID itu. Jalur upload aktual [documents route:25–51](<../../../src/app/api/kawan/v1/documents/route.ts#L25-L51>) menghasilkan Document, bukan Artifact. [Artifacts route:31–38](<../../../src/app/api/kawan/v1/artifacts/route.ts#L31-L38>) menerima JSON konten terstruktur, bukan upload byte original. Konversi ulang menjadi artefak generated dapat menghilangkan byte/hash/formula/cache original. Upload existing juga memakai formData+arrayBuffer sebelum limit; cap inspect tidak otomatis melindungi admission.

**Perbaikan wajib:** pilih satu kontrak: attachment Document original dengan resolver owner-scoped, atau endpoint upload Artifact input yang menyimpan byte immutable tanpa re-render. Tentukan MIME/stream cap sebelum alokasi, DTO status upload/extraction, expiry, hash, binding task/message, UI picker dan error. Tambahkan ownership path+WP serta acceptance browser upload sampai file.inspect dan aggregate atas hash original; oversize upload dihentikan sebelum buffer penuh. Tidak perlu tabel storage kedua.

### REV-02 — high — Klarifikasi read-only bergantung pada cabang sandbox yang ditunda

**Lokasi:** [SDD:63–72](<SDD.md#L63-L72>), [SDD:93–98](<SDD.md#L93-L98>), [SDD:163](<SDD.md#L163>), [rencana:40](<IMPLEMENTATION-PLAN.md#L40>), [rencana:63](<IMPLEMENTATION-PLAN.md#L63>).

Framing/locale ambigu wajib klarifikasi; state waiting_input dan resume segment baru didefinisikan. Namun interaction endpoint baru hanya di WP13 setelah sandbox WP12; rilis read-only berhenti WP14 tanpa WP13. Follow-up endpoint hanya menerima terminal run. Akibatnya user dapat terjebak waiting_input tanpa jalur jawaban pada rilis yang direkomendasikan. UI input interaction dan expiry acceptance juga belum ditugaskan.

**Perbaikan wajib:** pisahkan input clarification dari approval/code; implementasikan input endpoint/UI/state/expiry dalam cabang read-only sebelum WP08/14. Alternatif minimum: read-only tidak memakai waiting_input, mengakhiri run partial dengan pertanyaan dan follow-up eksplisit; dokumentasikan konsekuensi budget/config baru. Tambahkan T untuk ambiguous CSV/periode, jawaban valid, stale/foreign response, expiry/restart; pastikan endpoint dan DAG sesuai pilihan.

### REV-03 — high — Larangan egress file privat belum memiliki mekanisme dispatch

**Lokasi:** [PRD:61](<PRD.md#L61>), [SDD:128–153](<SDD.md#L128-L153>), [SDD:177–181](<SDD.md#L177-L181>), [acceptance:35](<ACCEPTANCE.md#L35>).

Kontrak melarang query berisi file privat/PII tanpa consent, tetapi model boleh melihat file lalu menyusun query web/search URL bebas. Tool context tidak membawa grant egress/taint state; daftar approval hanya efek write. Prompt saja tidak dapat membuktikan nol exfiltration lewat query atau URL path/query ke public host. SSRF guard tidak menyelesaikan kebocoran ke endpoint publik yang sah.

**Perbaikan wajib:** tetapkan enforcement sederhana server-side: misalnya mode private-file default menolak semua model-authored outbound setelah konteks privat masuk, kecuali grant user untuk tujuan/payload spesifik; atau pisahkan web phase tanpa private context. Consent harus menampilkan penerima/data, terikat owner/run/scope/digest/expiry dan dapat dicabut; jangan mengandalkan klasifikasi PII model sebagai guard tunggal. Petakan ke WP read-only dan uji canary file berisi token unik yang tidak boleh muncul di query/URL/body/log tanpa grant, termasuk callback URL dari dokumen.

### REV-04 — medium — DAG tidak mencerminkan dependency file parser

**Lokasi:** [rencana:21–25](<IMPLEMENTATION-PLAN.md#L21-L25>), [rencana:55–56](<IMPLEMENTATION-PLAN.md#L55-L56>).

WP06C hanya bergantung WP06A pada DAG/tabel, tetapi scope memerintahkan extend inspect/test yang dibuat WP06B secara berurutan. Scheduler/implementer dapat memilih WP06C lebih dahulu ketika file/kontrak belum lahir. DAG saat ini acyclic, tetapi edge penting hilang.

**Perbaikan wajib:** tambahkan WP06B sebagai dependency WP06C pada graph dan tabel, atau pindahkan shared inspect contract ke WP06A dan nyatakan ownership serta urutan merge eksplisit. Jangan hanya menyebut “berurutan” dalam prose.

### REV-05 — medium — Reserve final tidak mencakup input yang diperlukan untuk sintesis

**Lokasi:** [SDD:118–122](<SDD.md#L118-L122>), [acceptance:28](<ACCEPTANCE.md#L28>).

Final reserve 1.000 hanya output, sementara input kumulatif dapat habis sebelum final call. Counter token bisa benar tetapi tidak tersisa jatah untuk mengirim evidence+schema+history final; janji final parsial belum mempunyai jalur deterministik. Pada deadline/provider unavailable juga tidak didefinisikan bentuk final tanpa model secara operasional.

**Perbaikan wajib:** reserve input final bounded beserta output, atau definisikan fallback terminal tanpa model dari evidence durable dengan answerStatus dan stopReason, tanpa klaim sintesis. Gate: habiskan input tepat sebelum final, deadline saat gap review, provider down setelah tool; tidak overspend, tidak siklus keempat, partial result tetap terbuka.

### REV-06 — low — Tautan laporan output tidak dapat diklik relatif dokumen

**Lokasi:** [laporan output:15–28](<riset-output-ux.md#L15-L28>), [README:24](<README.md#L24>).

Pemeriksaan resolver Markdown menemukan 23/23 tautan lokal laporan output menuju `src/...` atau `package.json` relatif direktori dokumen, bukan root repo. README mengakui konvensi ini tetapi tidak memperbaiki navigasi bukti; enam dokumen sintesis memiliki nol target lokal hilang.

**Perbaikan wajib:** pemilik laporan memperbaiki prefix menjadi `../../../` atau menambahkan indeks navigasi bukti yang lengkap dan benar jika laporan harus tetap immutable. Tidak mengubah laporan peneliti dalam review ini.

### REV-07 — low — Definisi pembagian dataset ambigu

**Lokasi:** [acceptance:46](<ACCEPTANCE.md#L46>), [riset data:151](<riset-data-evaluasi.md#L151>).

Frasa “60 kasus, 40 development/20 held-out per keluarga” dapat dibaca sebagai 60 kasus untuk tiap keluarga, padahal jumlah keluarga tabel totalnya 60 dan laporan asal menyatakan split keseluruhan berdasarkan keluarga/domain/file.

**Perbaikan wajib:** tulis “60 total; 40 development + 20 held-out total, stratified per keluarga, tanpa template leakage”; bekukan jumlah per-family split di manifest WP00.

## Area yang konsisten

- Pemisahan current versus target jujur; [README:34–40](<README.md#L34-L40>) dan [acceptance:58–63](<ACCEPTANCE.md#L58-L63>) tidak mengklaim fixture sebagai bukti live.
- Temuan audit task pertama/cancel/replay/config snapshot diterjemahkan ke WP01–04; tidak mengulang bootstrap berdasarkan STATUS basi.
- Rekonsiliasi durable delta, enum existing dan batas UI-versus-ingestion eksplisit pada [DECISIONS:9–20](<DECISIONS.md#L9-L20>).
- R01–R11 mempunyai design/WP/test mapping. Tidak ada requirement ID hilang; kelengkapan tabel tidak menghapus gap kontrak pada REV-01–03.
- Reuse registry, Prisma, renderer, parser/library; tidak transplant runtime DSH/ZCode. Sandbox live dan arbitrary-code host dibatasi tegas. Approval bukan substitusi isolasi.
- Lisensi MIT/Apache-2.0 dan SHA konsisten dengan [riset engine:21–28](<riset-engine.md#L21-L28>); [DECISIONS:60](<DECISIONS.md#L60>) mewajibkan provenance/header/NOTICE/dependency review bila copying. Tidak ada kode upstream disalin. Review tidak mengulang audit lisensi transitif atau HTTP seluruh sumber eksternal; URL SHA dipatok, vendor live docs diberi batas versi.
- Perintah V0–V10 merujuk script/file existing; test baru diberi penanda belum ada, migration live command tidak dikarang. [Playwright:40–48](<../../../playwright.config.ts#L40-L48>) memang build/start server E2E sendiri, bukan deploy produksi; jalankan hanya setelah izin implementasi pada environment terisolasi. Review ini tidak menjalankannya.

## Verifikasi review

- Membaca enam dokumen sintesis, empat dependency, route upload/artifact dan konfigurasi Playwright; tidak membuka secret/state tim.
- Python read-only resolver tautan: sintesis 125 tautan lokal, nol target hilang; audit72/data19 nol hilang; output23 target relatif hilang. Tidak memverifikasi anchor HTML atau HTTP live dalam pemeriksaan ini.
- `git diff --check`: exit 0; hanya tracked diff sehingga bukan validasi otomatis semua dokumen untracked.
- `git status --short`: state tim dan direktori riset untracked; tracked source tidak berubah. File debug yang disebut t5 tidak muncul pada observasi ini; tidak dicari/dibuka/diubah.
- Tidak menjalankan build/test/migrasi/deploy atau mengubah paket sintesis. Kesiapan runtime tetap not_run/blocked_external sebagaimana paket.

## Urutan penutupan

1. Tutup REV-01–03 dahulu; pemilik menetapkan metode/scope/budget/privasi sebagaimana O01–O04.
2. Selaraskan DAG, reserve final, navigasi dan split dataset (REV-04–07).
3. Review delta dokumen dan rerun link/traceability checks; sesudah itu minta izin coding satu WP. Deployment/paid live tetap izin terpisah.

## Penutupan delta t9

| Finding | Status dokumen | Bukti verifikasi dan alasan |
|---|---|---|
| REV-01 high | Closed | [SDD:100–106](<SDD.md#L100-L106>) menetapkan endpoint raw-byte upload, stream cap, original hash, storage existing, DTO/extraction state, cleanup/expiry dan binding. [WP06B:55](<IMPLEMENTATION-PLAN.md#L55>) mengalokasikan route/picker/inspect; [T03-upload:30](<ACCEPTANCE.md#L30>) menuntut bytes original, oversize abort, ownership dan retry. Jalur Document lama tidak diklaim sebagai Artifact lagi. |
| REV-02 high | Closed | [SDD:84](<SDD.md#L84>) memilih alternatif minimal: terminal partial clarification_required, bukan waiting_input; follow-up eksplisit run/config/budget baru dengan replyToRunId/revision. [WP08:58](<IMPLEMENTATION-PLAN.md#L58>) dan [T08-clarify:36](<ACCEPTANCE.md#L36>) menguji valid/stale/foreign/expired/restart. Tidak menunggu sandbox WP13. |
| REV-03 high | Closed | [SDD:108–110](<SDD.md#L108-L110>) menetapkan proposal, exact single-use user grant, expiry/revoke/CAS/dispatch; [SDD:191](<SDD.md#L191>) sticky private taint, default deny public outbound, follow-up inheritance, kanal BYOK dipin dan log disanitasi. [WP05:53](<IMPLEMENTATION-PLAN.md#L53>) memiliki UI/route/server; [T09-egress:37](<ACCEPTANCE.md#L37>) menguji canary, callback publik, replay/drift/revoke. Bukan classifier PII/prompt sebagai guard. |
| REV-04 medium | Closed | [DAG:22–25](<IMPLEMENTATION-PLAN.md#L22-L25>) memiliki W06B→W06C; [WP06C:56](<IMPLEMENTATION-PLAN.md#L56>) juga mencantumkan WP06A,WP06B. Graph acyclic; extra direct dependency WP06A sudah dipenuhi transitif. |
| REV-05 medium | Closed | [SDD:130–136](<SDD.md#L130-L136>) reserve final input4.000/output1.000 dalam cap, paket bounded, fallback terminal deterministik tanpa model; [WP04:52](<IMPLEMENTATION-PLAN.md#L52>), [WP08:58](<IMPLEMENTATION-PLAN.md#L58>), [T04:28](<ACCEPTANCE.md#L28>) memuat exhausted/deadline/provider-down, synthesisStatus dan nol overspend/siklus4. |
| REV-06 low | Closed melalui indeks | [README:46–74](<README.md#L46-L74>) memetakan seluruh23 occurrence beserta locator yang sama ke target benar. Resolver memverifikasi kesetaraan target/path/range. Tautan dalam laporan sumber tetap relatif-root dan masih tidak navigable langsung; workaround indeks adalah alternatif yang dibolehkan review awal, bukan klaim laporan sumber sudah diedit. |
| REV-07 low | Closed | [ACCEPTANCE:49](<ACCEPTANCE.md#L49>) jelas60 total,40+20 total stratified; [WP00:48](<IMPLEMENTATION-PLAN.md#L48>) membekukan jumlah per-family dan manifest. Tidak lagi60 per keluarga. |

### Pemeriksaan baru

- Python resolver enam dokumen sintesis: **157 tautan lokal + seluruh line range valid**. Tidak mengecek HTTP live; tidak membaca state tim/secret.
- Indeks output: **23/23 occurrence dipetakan**, termasuk target berulang; laporan peneliti tidak diedit.
- Traceability: R01–R11 memiliki D/WP/T yang didefinisikan; subtest upload/clarify/egress ada. DAG **23 edge, acyclic**, dependency parser diperbaiki. Python command exit0.
- `git diff --check` exit0; tracked diff/stat kosong. Dokumen masih untracked sehingga pemeriksaan tautan eksplisit diperlukan. Source tidak diubah; hanya review ini diperbarui.
- Gate end-to-end upload/aggregate harus dijalankan setelah WP07/08 tersedia; acceptance yang dicantumkan pada WP06B bukan klaim loop/aggregate sudah hadir saat parser dibuat. Scope satu WP tetap berlaku: implementer boleh memecah WP besar menjadi sesi lebih kecil dengan kontrak/dependency sama.
- Detail wire naming/validator baru dibekukan pada WP00 sebelum coding; keamanan grant/stream caps tidak boleh diturunkan untuk menyesuaikan helper existing. Parser isolation tetap spike gate, bukan otomatis available.

### Batas verdict

REV-01–07 tertutup pada **rancangan**. Tidak ada tes aplikasi, browser, migrasi, sandbox/provider live, canary atau deployment dijalankan oleh t9. Kelayakan runtime tetap not_run/blocked_external sesuai paket. Pemilik tetap perlu menyetujui O01–O07 dan memilih satu WP dengan izin coding; tidak ada pengaktifan capability dari pass dokumen ini. Hasil t6 needs_revision tetap riwayat yang benar; penutupan baru dicatat oleh t9, bukan menulis ulang verdict lama.
