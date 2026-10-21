# SDD-AG-9: Acceptance dan verifikasi

Status: seluruh skenario di bawah adalah **rencana test**, belum dijalankan untuk
fitur agen. Bukti475 test audit fondasi tidak menggantikan acceptance ini.
Setiap AC mempunyai setup fixture, trigger dan assertion; gunakan DB/temp user
terpisah. Uji negative melakukan request langsung ke API/tool, bukan hanya UI tersembunyi.

| AC | Setup dan trigger | Assertion wajib / bukti |
|---|---|---|
| AC-AG-01 | Clean checkout Node22, install, generate, fresh+populated migration pada SQLite/PostgreSQL | Dua clients tersedia; init checksum tetap; chat/auth/key lama tetap terbaca; checker mendeteksi pasangan migrasi hilang |
| AC-AG-02 | Gateway fixture delta Unicode≥3potongan, network putus/reconnect, model berbeda, reload, IME, chat baru | Seluruh teks tepat satu kali; cursor tidak replay; model/chat ID benar; draft IME tidak terkirim; chat baru tidak menerima late delta lama |
| AC-AG-03 | Buat pohon edit/regenerate/continue, ganti branch/judul/system; cari/arsip/pin/delete dan export | Konteks hanya cabang aktif; reload sama; ekspor valid tanpa secret; delete owner lain404 |
| AC-AG-04 | Server target internal/metadata, DNS berubah antar resolve/connect, redirect, IPv6 mapped, response besar/idle | Target forbidden menerima 0 request; key tidak diteruskan; bytes/time bounded; allowlist gateway tidak membuka browsing internal |
| AC-AG-05 | Lease kadaluwarsa sebelum sweep; worker lama heartbeat/write/complete; user disable; forged Origin/host; reset | Lease tidak hidup lagi; stale write0; active user sessions revoked; origin/key/token aman; reset delivery tidak bocor log |
| AC-AG-06 | Chat/render/pengaturan/admin pada360/1440, light/dark/system, keyboard/IME/reduced motion; XSS fixture | Kontrol berfungsi; tidak overflow; focus benar; HTML berbahaya tidak berjalan; nonadmin403; usage unknown terlihat jelas |
| AC-AG-07 | Transaksi create task/run sengaja gagal, dua run per-user dibuat bersamaan, attachment ditambah kemudian | Tidak ada orphan row/job; tepat satu admission; input manifest immutable; owner invariant dan tombstone berlaku |
| AC-AG-08 | UserA/B mengakses setiap task child/resource; idempotency sama/digest beda; revision stale | A tidak membaca/mutasi B; key sama sama response; beda409; stale409; request key tidak memanggil model dua kali |
| AC-AG-09 | Tutup tab, restart web/worker; crash sebelum dan sesudah dispatch provider | Task independent SSE; pre-dispatch safe recovery; dispatched unknown→indeterminate tanpa request ulang; partial tersimpan |
| AC-AG-10 | Run/wait/cancel; handler kooperatif dan macet; currentJob berganti segment; runtime gagal kill | Old segment ditolak; hanya1resume; cancelled setelah kill confirmed; unknown kill→indeterminate+cleanup; tidak ada event setelah terminal |
| AC-AG-11 | SSE replay duplicate/gap, slow client, cursorfuture/pruned, logout, snapshot setelah30hari | Dedupe tepat; future409/pruned410; snapshot durable lengkap; owner dicek; koneksi revoked berhenti tanpa mematikan run |
| AC-AG-12 | Tool-call ID/index/JSON terbelah, unknown name/invalid args, tool error lalu model final | Alat hanya dipanggil setelah args lengkap/valid; call/result berpasangan; unknown tidak mengeksekusi; multi-step nyata selesai |
| AC-AG-13 | Model loops forever, usage missing/negative/partial, byte storm, concurrency race | Step/time/estimated/actual budget enforced; usage unknown bukan nol; slot atomic; limit tidak memicu panggilan tambahan |
| AC-AG-14 | Search/source fixture sukses, provider gagal, dokumen adversarial, citation marker tidak valid | Sumber nyata ditautkan; gagal diberitahu; markerinvalid tidak menjadi sitasi palsu; injection tidak memperluas izin |
| AC-AG-15 | Upload PDF/text/image, oversized/mismatched MIME/path filename/decompression bomb; extraction cancel | Bytes dibatasi saat streaming; file unsafe ditolak; ekstraksi bounded; status benar; artefak user lain tidak dapat dilampirkan |
| AC-AG-16 | Tulis artefak output, download/preview, HTML/script/symlink/fifo/path traversal, input sharing | Hash/size/type valid; file tidak keluar store; preview origin aman; ownership download tetap; input bersama tidak terhapus prematur |
| AC-AG-17 | UI tujuan riset→search→read→write file dan input clarification sebelum lanjut | Plan/steps berasal event; sources & hasil valid; reload melanjutkan status; tidak memakai progress palsu atau kontrol inert |
| AC-AG-18 | Runtime default provider+template+proxy live, network/resource probe, stop dan orphan reconcile | Bukti runtime jauh dari host; env/metadata/network policy cap teruji; configuration missing→disabled; fixture tidak disebut live |
| AC-AG-19 | Dua approval bersamaan, args/domain berubah, expired/reject, policy update, run terminal | Maksimum1dispatch; stale/replay/owner salah ditolak; browser JS/background request dengan method/URL/body berbeda tetap diblokir; tidak ada write sebelum accepted; cancel/expiry mematikan izin |
| AC-AG-20 | Kode analisis file dan infinite loop/memory/fork/stdout bomb, network connect, host secret/read other run | Hasil file benar; cap/kill terkonfirmasi; request jaringan forbidden0; secrets/run lain tak terbaca; unknown runtime tidak jadi sukses |
| AC-AG-21 | Dua pengguna browser, redirect/subresource attack, form write, login handover lalu return | Context terpisah; proxy semua traffic; write menunggu izin; screenshot/DOM/password logging off saat login; viewer URL cepat kedaluwarsa |
| AC-AG-22 | Halaman/file/tool adversarial menyuruh eksfiltrasi key, akses metadata, ganti approval, bypass runtime | Semua gate deny di levelserver/runtime; canary tidak bocor; high/critical terbuka memblokir enable capability |
| AC-AG-23 | Export/hapus task dan akun dengan active run/runtime/file shared, prune event, cleanup retry | Ownership utuh; ekspor tanpa secret; orphan bersih; file shared tetap bila direferensikan; tidak ada data akun tersisa di tabel tanpa FK |
| AC-AG-24 | Image clean prod+worker, web restart/worker shutdown, config missing, health permission | Command nyata ada; worker hidup>30detik; graceful shutdown; DB/worker/storage health benar; public health tidak bocor detail |
| AC-AG-25 | Backup DB+file+key dan restore ke instance baru; upgrade populated kedua provider; rollback flag | Counts/hash/dekripsi benar; active restored run indeterminate; tidak ada efek eksternal replay; app-compatible rollback tidak drop data |
| AC-AG-26 | Playwright full flow chat/task/approval/browser/code/output pada360/1440 dengan backend+worker | UI benar melalui HTTP nyata; keyboard/tema/cancel/reload lulus; test tidak bergantung snapshot Darwin; screenshot/trace tanpa rahasia |
| AC-AG-27 | Review semua WO/AC, load dataset100.000event, core canary dan release report | Semua wajib evidence tersedia; benchmark dilaporkan vs target; tidak ada klaim parity penuh; push SHA/CI dibuktikan, tidak ada secret/dirty artifact |

## Lapisan test dan sumber bukti

Unit untuk canonical JSON, status reducer, tool schema, context builder, budget dan
error mapping. Integrasi memakai DB nyata dan HTTP fixture untuk concurrency,
fencing, mutation atomic, replay dan ownership. E2E menjalankan web+worker+fixture
sebagai proses terpisah. Security runtime live memakai akun/provider uji operator,
file canary dan domain/server kontrol, tidak situs/akun pihak lain tanpa scope.

Golden fixture: Unicode split; usage present/absent/malformed; tool calls split,
multiple/invalid; model429/timeout/drop; search sukses/gagal/injection; PDF/text
valid/oversize/malformed; browser dummy site dengan form write/login sintetis;
code kalkulasi CSV dan exhaustion; runtime stop confirmed/unknown.

Permission policy harus diuji melalui jalur hidup sampai executor, bukan menguji
validator terpisah lalu menganggap network aman. Fixture yang menyimpan key untuk
assertion tetap tidak mencetak key ke log/transcript. Snapshot UI login sintetis
memakai password canary nonproduksi dan memverifikasi masking.

## Arti lulus dan blocker

Lulus hanya setelah perintah dijalankan pada commit yang disebutkan dan assertion
benar. Skip karena credential/service/OS bukan pass dan bukan bukti regresi kode;
catat blocked_external dengan kebutuhan yang tepat. Semua scope inti harus lulus
untuk “rilis inti selesai”. Jika gate live tidak tersedia, status maksimum adalah
“kode/fixture selesai, live verification tertahan”, bukan “100% selesai”.

Koordinator menyimpan laporan fase di reports dengan WO→R→AC→perintah→hasil→commit.
Test baru harus gagal terhadap perilaku salah yang dituju sebelum fix jika seam
reproduksi tersedia. Jangan menulis test yang sekadar mengulang konstanta/implementasi.
