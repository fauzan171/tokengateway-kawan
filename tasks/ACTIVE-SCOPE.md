# Arah aktif Kawan: pengalaman agen seperti Manus

Tanggal keputusan: 17 Oktober 2026. Status: arah produk aktif berdasarkan permintaan
pemilik produk untuk menyamakan pengalaman dengan Manus dan menghapus fitur overkill.
Dokumen ini mengganti keputusan scope yang bertentangan pada paket lama. Ini kontrak
produk dan urutan pengembangan, bukan bukti bahwa kemampuan agen sudah tersedia.

## Otoritas dan cara membaca

Instruksi terbaru pemilik produk → dokumen ini → `nontechnical-v1/prd.md` →
[SDD agen lengkap](agent-v1/README.md) → baseline `nontechnical-v1/sdd.md` yang tidak
diganti → work order agen → instruksi eksekusi Hermes/Claude.
Baca [laporan audit](nontechnical-v1/reports/scope-audit-2026-10-17.md) untuk bukti
kesenjangan implementasi. Requirement lama tetap berlaku hanya bila tidak diganti
secara eksplisit di sini. ID REQ-NT dan WP lama dipertahankan untuk penelusuran.

`tasks/prd.md`, `tasks/sdd/`, `tasks/reference/`, `tasks/archive/`, dan `PROMPT.md`
adalah referensi historis Open WebUI/BYOK. Jangan menjalankan prompt full-parity
sebagai instruksi aktif. Prompt bantu di `nontechnical-v1/` tunduk pada dokumen ini;
perintah menyelesaikan seluruh NT-P4..NT-P10 sebelum mulai agen tidak lagi berlaku.

## Tujuan dan batas klaim

Kawan tetap aplikasi web untuk pengguna nonteknis, memakai gateway BYOK milik
pengguna dan branding `by tokengateway.ai.id`. Arah baru: pengguna memberi tujuan,
agen mengerjakan beberapa langkah, memperlihatkan progres, meminta input bila perlu,
dan menyerahkan hasil yang dapat dibuka atau diunduh. Chat menjadi fondasinya.

Target "100% seperti Manus" dicatat sebagai aspirasi kesetaraan pengalaman, belum
sebagai klaim produk. Kemampuan yang belum tersedia tetap tercatat di matriks,
bukan dihitung selesai. Gateway chat saja tidak menyediakan browser, sandbox,
penyimpanan file, atau konektor; masing-masing membutuhkan implementasi dan gate.
Kesamaan piksel, aset, merek, dan perilaku internal Manus tidak dapat dibuktikan
dari dokumentasi publik. UI Kawan menggunakan identitasnya sendiri.

Sumber pembanding resmi, diperiksa 17 Oktober 2026:

- [Manus API introduction](https://open.manus.im/docs/v2/introduction): tugas,
  pesan lanjutan, proyek, lampiran, webhook, skill, agen.
- [Manus features](https://manus.im/features): pembuatan aplikasi/media,
  riset, otomasi, dan konektor.
- [Browser Operator](https://manus.im/en/blog/manus-browser-operator):
  otomasi browser dengan kendali pengguna.

Sumber tersebut membuktikan area kemampuan publik, bukan arsitektur internal Manus.
Spesifikasi Kawan di bawah adalah keputusan desain lokal.

## Matriks pengalaman dan prioritas

Status `direncanakan` berarti belum tersedia di aplikasi. Tidak ada persentase
parity sampai setiap area memiliki skenario pembanding dan bukti yang dijalankan.

| ID | Kemampuan / hasil pengguna | Keputusan | Status / gate minimum |
|---|---|---|---|
| AG-01 | Mengirim tujuan, menerima rencana dan progres langkah nyata | Inti agen awal | Direncanakan; rencana berubah mengikuti hasil tool, tidak memakai progres palsu |
| AG-02 | Tugas berjalan setelah tab ditutup, dapat dihentikan dan dibuka kembali | Inti agen awal | Antrean chat ada; lifecycle tugas belum ada; reload/restart tanpa efek ganda wajib diuji |
| AG-03 | Agen memakai alat berulang sampai tujuan selesai atau batas tercapai | Inti agen awal | Direncanakan; fixture tool call valid/rusak dan batas iterasi wajib lulus |
| AG-04 | Riset web dengan sumber yang dapat diperiksa | Inti agen awal | Direncanakan; hasil bersumber, kegagalan alat terlihat, SSRF diuji |
| AG-05 | Membaca lampiran dan menghasilkan file yang dapat diunduh | Inti agen awal | Direncanakan; isolasi pemilik, validasi file, sitasi dan unduhan diuji |
| AG-06 | Browser terisolasi dengan progres dan pengambilalihan pengguna | Inti setelah runner aman | Direncanakan; sesi terpisah, pause/resume dan persetujuan tindakan diuji |
| AG-07 | Menjalankan kode untuk analisis/file di sandbox | Inti setelah runner aman | Direncanakan; tidak boleh berjalan di proses web/worker terpercaya |
| AG-08 | Proyek berisi tugas, file dan instruksi bersama | Tahap lanjutan | Direncanakan; mulai dari kepemilikan pribadi, tanpa organisasi enterprise |
| AG-09 | Konektor akun eksternal, skill dan otomasi terjadwal | Tahap lanjutan | Direncanakan; scope izin, pencabutan dan pembatasan tindakan wajib |
| AG-10 | Pembuatan situs, slide, gambar, video dan audio | Tahap lanjutan per hasil | Direncanakan; tiap format punya generator, preview, unduhan dan uji tersendiri |
| AG-11 | Riset paralel / beberapa agen | Ditunda sampai ada kebutuhan terukur | Satu orchestrator dahulu; bukan prasyarat AG-01..07 |
| AG-12 | Kendali komputer lokal/native/mobile | Ditunda | Butuh integrasi dan batas izin tersendiri; bukan kontrol UI kosong |

Setiap kemampuan inti agen adalah requirement wajib pada rilis agen pertama,
namun dikerjakan berurutan. AG-08..12 tetap backlog kesetaraan lebih luas dan
belum boleh disebut parity penuh. Tidak memakai Manus API sebagai backend default;
BYOK gateway tetap jalur model. Integrasi Manus API akan memerlukan keputusan terpisah.

## Pengurangan scope yang berlaku sekarang

| Area lama | Keputusan baru | Alasan / rujukan |
|---|---|---|
| Larangan worker otonom, tool execution dan sandbox | Diganti AG-01..07 | Menggantikan PRD §4.2.6, SDD-1.1 prinsip 5, SDD-10 baris terakhir, coverage otomasi/kode |
| Semua proses dari satu image | Berlaku hanya web + worker terpercaya | Sandbox adalah batas kepercayaan baru dengan runtime terpisah |
| SCIM, LDAP, grup/RBAC enterprise, multi-tenant organisasi | Tetap exclude | Tidak diperlukan pengguna pribadi; auth, otorisasi pemilik dan admin dasar tetap wajib |
| Seluruh endpoint/tabel Open WebUI, plugin Python di server, Ollama management | Exclude | Bukan kontrak produk Kawan; jangan menyalin keseluruhan backend referensi |
| Channel tim, kalender, collaborative notes/CRDT, arena evaluator | Exclude rilis awal | Tidak diperlukan untuk mengerjakan dan menyerahkan tugas pribadi |
| Multi-agent wajib, Redis, Kubernetes, vector DB terpisah | Defer | Mulai satu orchestrator + antrean DB; tambah layanan jika ada kebutuhan terukur |
| Folder chat, prompt template variabel, Mermaid, TTS, dashboard usage CSV | Defer dari jalur kritis | REQ-NT-35,45,62..64,68,73 tetap backlog, bukan gate agen awal |
| Pencarian/riwayat, rendering aman, lampiran, privasi, ekspor, hapus data | Pertahankan | Mendukung penggunaan agen dan kontrol data pengguna |
| Media dan embedding wajib sebelum agen | Defer | REQ-NT-56/61 mulai pencarian kata kunci; tambah embedding setelah evaluasi kualitas |
| Saldo/harga/billing Kawan | Tetap exclude | Batas token/langkah untuk tugas tidak berarti sistem penagihan baru |

Requirement lama yang ditunda tidak dihitung tercakup atau selesai. Tidak menghapus
kode auth, enkripsi, lease, SSE, atau database sebagai "overkill": itu fondasi yang dipakai.

## Desain tugas dan batas kepercayaan

Alur: browser → API berotorisasi → service tugas → DB/antrean → orchestrator worker
→ alat tervalidasi → sandbox/browser terisolasi → artefak → API unduhan berotorisasi.
Event progres berasal dari transisi persisten. Keluaran alat/web/dokumen adalah data
tidak tepercaya dan tidak dapat memberi izin baru, mengambil rahasia, atau memperluas scope.

Entitas target: `Task` (pemilik, tujuan, status, batas), `TaskRun` (satu percobaan,
model/koneksi yang dipin), `TaskStep` (jenis, status, input/output yang sudah direduksi),
`TaskEvent` (seq monoton), `Artifact` (pemilik, storage key acak, MIME, ukuran),
`Approval` (aksi spesifik, digest argumen, masa berlaku, sekali pakai). Nama ini
kontrak desain; tabel dan endpoint tersebut belum ada. Jangan membuat tabel kosong
untuk seluruh backlog sekaligus. Rinci schema dan JSON sebelum setiap irisan implementasi.

State run: `queued → running → completed | failed | cancelled | indeterminate`.
`running → waiting_input | waiting_approval → running`; terminal tidak dapat hidup
kembali. Follow-up setelah terminal membuat run baru. Restart tidak mengulang langkah
berefek eksternal yang hasilnya belum diketahui. Claim/lease mengatur satu penulis;
setiap event dan mutasi memeriksa pemilik serta token lease yang masih berlaku.

Resume stream memakai `afterSeq` dan dedup. Membuka ulang UI tidak berarti mengirim
ulang model atau tool. Stop membatalkan model, tool dan sandbox; output parsial tetap
tersedia. Hasil ambigu masuk `indeterminate`, tidak otomatis diulang. HTTP
Idempotency-Key hanya mencegah duplikasi request lokal, bukan bukti provider belum menagih.

Tool registry awal tertutup: pencarian/baca web, baca file milik tugas, tulis artefak,
lalu browser dan kode setelah gate sandbox. Validasi argumen terhadap schema; tolak
nama alat tak dikenal. Terapkan batas iterasi, token, waktu, ukuran hasil, dan
konkurensi di server. Jika gateway tidak mendukung tool calls yang dibutuhkan,
tawarkan mode chat atau model lain, jangan mengaku agen sedang menjalankan alat.

Web dan worker memegang kredensial; sandbox tidak menerima `ENCRYPTION_SECRET`,
`AUTH_SECRET`, URL database, socket Docker, mount host, atau API key gateway. Runtime
sandbox harus menyediakan filesystem sementara per run, user tanpa privilege,
batas CPU/memori/waktu, pembatasan jaringan/metadata dan penghentian seluruh proses.
Eksekusi kode di worker dengan `eval`, shell, atau subprocess tanpa isolasi dilarang.
SDD agen menetapkan adapter E2B sebagai default awal, dengan spike/live gate isolasi
sebelum mengaktifkan AG-06/07. Tidak ada klaim container biasa cukup sebagai sandbox aman.

Persetujuan hanya untuk efek yang memerlukannya: kirim/publish, pembelian, hapus,
atau perubahan akun eksternal. Review menampilkan aksi, tujuan, dan data yang akan
terkirim; perubahan argumen membatalkan izin lama. Read-only dalam scope dapat
berjalan langsung. Login browser diserahkan ke pengguna tanpa mencatat password/cookie.
Unduhan artefak dan preview selalu memeriksa pemilik; HTML hasil dibuka terisolasi,
bukan dirender sebagai HTML tepercaya di origin aplikasi.

## Urutan implementasi dan bukti selesai

| Fase | Pekerjaan | Dependency dan gate |
|---|---|---|
| AG-P0 | Tutup ketidakcocokan chat UI/API, model nyata, resume/error, worker dan CI | Fondasi existing; skenario chat melalui UI + HTTP, lint/typecheck/test/build |
| AG-P1 | Task/run persisten, daftar/detail, event replay, follow-up/stop, batas server | AG-P0; tutup tab, restart worker, isolasi pengguna, idempotensi dan hasil ambigu diuji |
| AG-P2 | Loop tool tervalidasi, riset read-only dan lampiran/artefak | AG-P1; tujuan → beberapa langkah nyata → hasil unduh bersumber; batas dan tool gagal diuji |
| AG-P3 | Spike sandbox, browser dan eksekusi kode, approval/pause | AG-P2; uji isolasi lintas tugas, metadata, rahasia, resource cap, kill, izin basi; baru aktifkan |
| AG-P4 | Evaluasi pengalaman inti dan pengerasan rilis | AG-01..07 lulus E2E di desktop/mobile; backup/restore dan migrasi upgrade diuji |
| AG-P5+ | AG-08..12 per kemampuan | Tiap kemampuan punya acceptance dan laporan; tidak menahan rilis inti |

NT-P4..NT-P10 dipilih per dependency yang mendukung fase di atas, bukan dikerjakan
seluruhnya sebelum agen. Jangan mengurangi keamanan, aksesibilitas, atau integritas
penyimpanan demi mengejar kesamaan tampilan. Setiap fase melaporkan apa yang benar-benar
jalan dan yang belum diuji. Metrik awal: keberhasilan tugas fixture end-to-end, hasil
unduhan valid, waktu selesai, berhenti saat batas tercapai, efek eksternal duplikat,
dan kebocoran lintas pengguna. Baseline belum diukur; target keamanan adalah nol
kebocoran/efek ganda pada suite, bukan janji keberhasilan 100% di dunia nyata.

Migrasi berikutnya wajib additive dan tidak mengubah init yang telah diterapkan.
Checker migrasi saat ini hanya mendukung snapshot init; perlu diperbaiki sebelum
menambah schema tugas. Backup/restore dan upgrade diuji pada salinan DB, tidak
menghapus `dev.db` atau data pengguna sebagai langkah standar upgrade.


## Paket implementasi dan handoff

[SDD agen v1](agent-v1/README.md) merinci13 requirement,23 work order core dan27
skenario acceptance. Seluruh AG-P0..AG-P4 adalah scope implementasi wajib;
AG-P5+ tetap backlog. [Prompt Hermes](agent-v1/HERMES-PROMPT.md) mengatur clone/fetch
GitHub → Claude Code dengan `/goal` native → sub-agent pengembangan → gate dan push.
Sub-agent pengembangan tidak berarti fitur multi-agent produk menjadi wajib.
