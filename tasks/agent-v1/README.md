# SDD agen Kawan v1

Revisi: 17 Oktober 2026. Status: spesifikasi target untuk implementasi; bukan laporan fitur selesai.
Repo: https://github.com/fauzan171/tokengateway-kawan, branch dokumen `main`.

Paket ini melengkapi [scope aktif](../ACTIVE-SCOPE.md). Tujuan rilis inti adalah
AG-01 sampai AG-07: pengguna memberi tujuan, agen melakukan pekerjaan bertahap dengan
alat, lalu menyerahkan hasil yang dapat diperiksa. Implementasi saat ini tetap fondasi
chat; task agent, browser, sandbox dan artefak belum tersedia.

## Otoritas dan urutan baca

Instruksi pemilik produk → scope aktif → requirement dan keputusan paket ini →
kontrak teknis paket ini → work order → prompt Hermes. Baseline chat
[nontechnical-v1](../nontechnical-v1/README.md) berlaku untuk bagian yang tidak diganti.
Arsip full-parity Open WebUI bukan daftar fitur yang harus diimplementasikan.

| Urutan | Dokumen | Dipakai ketika |
|---|---|---|
| 1 | [Requirement dan arsitektur](01-requirements-architecture.md) | Menentukan scope, batas modul, alternatif dan keputusan |
| 2 | [Data dan migrasi](02-data-migrations.md) | Mengubah schema, relasi, transaksi, penghapusan atau format persisten |
| 3 | [API dan event](03-api-events.md) | Menulis route, klien HTTP, SSE, upload atau unduhan |
| 4 | [Eksekusi dan tools](04-execution-tools.md) | Menulis orchestrator, retry, lease, stop dan tool calling |
| 5 | [Sandbox, browser dan keamanan](05-sandbox-security.md) | Menambah eksekusi kode, browser, approval, jaringan atau secret |
| 6 | [Frontend dan pengalaman pengguna](06-frontend-ux.md) | Mengerjakan chat, daftar tugas, progres, input, hasil dan aksesibilitas |
| 7 | [Operasi dan kualitas](07-operations-quality.md) | Menambah konfigurasi, CI, deployment, backup atau gate rilis |
| 8 | [Work orders](08-work-orders.md) | Memilih pekerjaan ready dan dependency implementasi |
| 9 | [Acceptance dan verifikasi](09-acceptance-verification.md) | Mengukur selesai dengan skenario yang dapat dijalankan |
| 10 | [Prompt Hermes](HERMES-PROMPT.md), [brief Claude](CLAUDE-PROMPT.md), [perintah goal](CLAUDE-GOAL.txt) | Hermes mengambil repo; Claude memakai goal dan sub-agent untuk seluruh scope inti |

## Arti lengkap dan selesai

SDD memuat keputusan dan kontrak yang harus diimplementasikan; implementer tetap
mengecek API/library resmi versi yang dipasang. Nilai default di sini adalah desain
Kawan, bukan batas vendor atau hasil benchmark. Perubahan kontrak persisten dicatat
pada bagian keputusan, diperbarui lintas bab dan dites, bukan diubah diam-diam.

Semua work order AG-P0..AG-P4 adalah scope eksekusi penuh yang diminta. AG-P5+
adalah backlog AG-08..12 yang eksplisit ditunda: proyek bersama, konektor/scheduler,
media lanjutan, multi-agent dan komputer lokal. Menyelesaikan inti tidak berarti
parity seluruh Manus. Fitur nonteknis dasar yang mendukung inti (riwayat, rendering,
file, ekspor/hapus data, akun dan admin minimal) tetap masuk work order.

Bukti implementasi awal dan 475 test fondasi ada di
[audit fondasi](../nontechnical-v1/reports/scope-audit-2026-10-17.md).
Tidak memindahkan angka itu menjadi bukti bahwa skenario agen sudah berjalan.

## Pemeriksaan paket

```bash
python3 tasks/agent-v1/check_docs.py
python3 tasks/nontechnical-v1/tools/check_docs.py
```

Checker agen memeriksa link, ID, dependency, hubungan requirement/WO/skenario dan
struktur minimum. Ia tidak membuktikan keamanan, UI atau kecocokan runtime.
Bukti pemeriksaan paket ada di [verifikasi SDD](VERIFICATION.md).
Status aktual per work order dicatat di [status implementasi](STATUS.md); laporan
fase ditulis ke `reports/`. Mulai dengan work order pertama yang belum selesai,
bukan mengulang bootstrap atau menjalankan prompt historis.
