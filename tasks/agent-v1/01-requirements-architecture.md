# SDD-AG-1: Requirement, arsitektur dan keputusan

Status: kontrak target. Keputusan ini membutuhkan SDD karena mengubah data persisten,
kontrak lintas web/worker/runtime, dan batas kepercayaan yang mahal dibalik.

## Masalah dan requirement

Fondasi saat ini merelay satu generasi teks. Produk yang diminta harus menyelesaikan
pekerjaan beberapa langkah, tahan putus koneksi, memperlihatkan aksi yang nyata,
dan menghasilkan file. Rujukan kemampuan publik terdapat pada scope aktif;
arsitektur di bawah adalah desain Kawan sendiri.

| ID | Requirement wajib | Kriteria hasil |
|---|---|---|
| R-AG-01 | Chat menjadi fondasi yang utuh sebelum agen | Model berasal gateway aktif; semua delta, error, stop, cabang dan reload berfungsi |
| R-AG-02 | Tugas/run persisten dan kepemilikan pribadi | Daftar/detail, follow-up, status dan replay tersedia; data pengguna lain 404 |
| R-AG-03 | Orchestrator memakai tools tervalidasi dalam loop terbatas | Alat nyata dipanggil; hasil masuk konteks model; batas menghentikan loop |
| R-AG-04 | Riset web dengan atribusi | Dokumen sumber dapat diperiksa; kegagalan sumber terlihat; sitasi tidak dibuat-buat |
| R-AG-05 | Lampiran dan artefak aman | Input dimiliki pengguna; output diunduh/preview; path dan MIME divalidasi |
| R-AG-06 | Browser terisolasi, pause dan handover | Pengguna dapat mengambil alih login; agen tidak melihat password/session secret |
| R-AG-07 | Kode berjalan di sandbox terisolasi | File analisis dapat dihasilkan; CPU/memori/waktu/jaringan dibatasi |
| R-AG-08 | Izin efek eksternal diperiksa server | Persetujuan terikat aksi, argumen, target dan masa berlaku; stale/replay ditolak |
| R-AG-09 | Stop, crash dan retry menjaga hasil parsial | Tidak ada replay otomatis efek ambigu atau penulisan worker dengan lease lama |
| R-AG-10 | UI nonteknis, responsif dan aksesibel | Alur inti keyboard/360 px berjalan; input/hasil/status/error jelas |
| R-AG-11 | Identitas, privasi dan rahasia terlindungi | Cookie/auth, BYOK terenkripsi, reset aman, ekspor/hapus data dan admin minimal |
| R-AG-12 | Upgrade dan operasi dapat diulang | Migrasi additive dua DB, health, backup/restore dan deployment diuji |
| R-AG-13 | Status, usage dan klaim sesuai bukti | Usage tidak dilaporkan tampil unavailable; tanpa kontrol palsu/persentase rekaan |

AG-01..07 pada scope produk dipenuhi oleh R-AG-01..13 secara bersama, bukan cukup
menambahkan tujuh tombol. Single-user ownership tidak berarti single account:
instance tetap multi-user dengan isolasi setiap resource.

## Batas dan asumsi kapasitas

Asumsi perencanaan, belum pengukuran: 200 pengguna harian × 3 tugas = 600 run/hari.
Jika rata-rata 10 langkah model/tool, ada 6.000 langkah/hari (0,07/detik rata-rata).
Puncak 20 kali rata-rata ≈1,4 langkah/detik; mulai 4 run aktif global, 1 per pengguna.
Jika event delta digabung 5 kali/detik, 4 run menghasilkan ≈20 event/detik.
Jika 10% run menghasilkan artefak 5 MiB, pertumbuhan ≈300 MiB/hari (107 GiB/tahun).
Operator harus mengukur storage dan retensi; angka ini bukan jaminan kapasitas.

Target uji internal: API lokal p95 ≤400 ms selain upload/provider; replay 100 event
p95 ≤1 detik pada dataset 100.000 event dan mesin yang dicatat; stop diakui API
≤1 detik dan penghentian tool dikonfirmasi ≤5 detik pada fixture. Catat latency
provider terpisah. Target diperiksa sebelum rilis; kegagalan tidak disembunyikan
sebagai sukses atau diselesaikan dengan mengurangi ketahanan/keamanan.

## Arsitektur dan batas modul

```text
UI React → API Next.js → auth + service chat/task → Prisma DB
                                    |               ↑
                                    ├→ file store   |
                                    └→ Job → worker/orchestrator
                                                  ├→ model gateway
                                                  ├→ tools read-only + egress policy
                                                  └→ sandbox provider → browser/kode
SSE ← event DB; unduhan ← storage melalui API berotorisasi
```

Web dan worker terpercaya memakai satu basis kode/image; entry point berbeda.
Runtime sandbox merupakan lingkungan terpisah. Satu DB relasional cukup untuk
job, run, steps dan event; tidak ada Redis, vector DB atau microservice per fitur.

Batas logis (lokasi implementasi mengikuti tree aktual): API memegang HTTP/validasi
bentuk, service memegang ownership/transaksi dan invariants, orchestrator memegang
loop, registry memegang schema tool, adapter memegang provider model/runtime/storage.
Modul generik jobs tidak mengimpor domain task/chat; callback rekonsiliasi domain
menghubungkannya. Lib tidak mengimpor app. UI menerima DTO aman, bukan row Prisma.

Registry tools berisi definisi tervalidasi dan executor; jangan membuat plugin loader
arbitrer. Model tidak mendapat kredensial, konfigurasi operator, token lease, atau
instruksi internal untuk membuka scope. Progress berasal dari event langkah,
bukan chain-of-thought privat atau animasi simulasi.

## Konfigurasi dasar dan konsistensi

Snapshot per run menyimpan connectionId, model ID, capability yang telah diuji,
limit efektif, tools yang diizinkan dan revision policy. Mengganti koneksi aktif
di tab lain tidak mengalihkan run berjalan. Menghapus/menonaktifkan koneksi
membatalkan run terkait; tidak menghapus riwayat. Key tetap di vault/envelope;
run tidak menyimpan ciphertext salinan. Pergantian key membutuhkan resolusi ulang
pada panggilan berikut dengan pengecekan koneksi yang sama.

Create task/run, claim segment, append event + state, consume approval, dan
terminalization harus read-your-write dalam transaksi. SSE adalah proyeksi yang
boleh tertinggal polling singkat; ia tidak berwenang memulai ulang eksekusi.

## Keputusan dan alternatif

Status keputusan: accepted sebagai default implementasi SDD, belum deployed.

| Keputusan | Alternatif nyata dan best case | Pilihan / kapan ditinjau |
|---|---|---|
| Next.js + worker + DB job | Semua inline HTTP sederhana untuk chat singkat; queue eksternal memberi operasi/concurrency lebih matang | Worker/DB karena R-AG-02/09; tinjau queue eksternal bila latency claim melewati target pada benchmark |
| Satu orchestrator | Multi-agent cocok riset paralel besar; agent API pihak ketiga mempercepat delivery dengan perilaku terkelola | Satu orchestrator BYOK untuk R-AG-03; tambah multi-agent setelah bottleneck dan evaluasi terbukti |
| PostgreSQL prod, SQLite dev | Postgres saja mengurangi perbedaan migrasi; SQLite saja memudahkan self-host pribadi | Pertahankan dual provider existing dengan uji upgrade keduanya; tinjau jika maintenance terbukti dominan |
| Provider sandbox terkelola E2B sebagai adapter awal | gVisor/runsc pada host khusus memberi kontrol/data locality; microVM mandiri memberi isolasi dengan operasi yang lebih berat | E2B untuk menekan beban operasi R-AG-07; tidak mengirim data atau membeli layanan dalam pekerjaan dokumentasi; gate live tetap wajib |
| Keyword retrieval dahulu | Embedding berguna saat makna berbeda dari kata pertanyaan; full vector service cocok koleksi besar | R-AG-04/05 cukup mulai keyword + kutipan terbatas; embedding setelah evaluasi fixture tidak memadai |
| Storage lokal dahulu | S3-compatible cocok multi-instance/durability terkelola | Satu host + volume untuk inti; adapter objek ditambah hanya saat deployment memerlukan |

Detail runtime dan batas provider pada [SDD-AG-5](05-sandbox-security.md).
Default E2B adalah pilihan implementasi; operator harus memberi kredensial, persetujuan
penggunaan provider dan lingkungan uji sebelum gate browser/kode live. Tanpa itu
implementer menyelesaikan kode/fixture, menandai gate live tertahan, dan melanjutkan
pekerjaan independen. Tidak mengganti sandbox dengan subprocess host.

## Non-goals dan risiko keputusan

Tidak ada billing Kawan, enterprise SCIM/LDAP/RBAC organisasi, parity Open WebUI,
plugin Python di server, Kubernetes wajib, atau multi-agent wajib. AG-P5+ tetap
backlog, bukan acceptance inti. Identitas visual tetap Kawan.

Pre-mortem: (1) provider dipanggil dua kali setelah crash, terlihat dari dua invocation
untuk step yang sama: intent persisten + hasil ambigu indeterminate; (2) file/kode
menembus sandbox, terlihat dari canary/akses metadata: blok rilis AG-P3 dan perbaiki
isolasi; (3) tugas sering habis anggaran, terlihat dari metrik limitReached: evaluasi
prompt/tool dan benchmark sebelum menaikkan default.

Rollout menutup fondasi → migrasi additive → tasks read-only → tools terbatas → sandbox
terkonfigurasi → canary pengguna operator → rilis inti. Rollback menonaktifkan pembuatan
run baru, menguras/membatalkan job, mempertahankan riwayat dan schema additive; downgrade
hanya ke versi yang schema-compatible. Restore ke salinan database jika schema tidak kompatibel.

## Pertanyaan eksternal yang tetap eksplisit

Kredensial/provider sandbox dan mesin Linux/browser uji adalah kebutuhan operator,
bukan izin untuk membuat kredensial fiktif. Model gateway acuan harus diuji tool calling;
jika tidak ada, test fixture berjalan tetapi acceptance provider live tetap belum lulus.
Tidak ada pertanyaan produk yang menghalangi AG-P0..AG-P2 dimulai.
