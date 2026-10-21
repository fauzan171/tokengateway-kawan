# SDD-AG-8: Work order implementasi seluruh scope inti

Status awal semua WO: not_started. Perbaikan fondasi audit sebelumnya tidak berarti
seluruh gate fase lulus. Verifikasi keadaan repo sebelum menetapkan status.

## Cara mengeksekusi

Setiap baris adalah brief: current state di audit/STATUS, desired behavior di kolom
hasil, interfaces pada bab SDD, acceptance pada skenario AC. Implementer menelusuri
file/simbol aktual, bukan menganggap path target sudah ada. Tidak memulai WO sebelum
dependency dan gate fase sebelumnya lulus; pekerjaan read-only/perencanaan boleh
paralel. Kontrak shared schema/API dibekukan oleh coordinator sebelum worker menulis.

| WO | Hasil dan batas pekerjaan | Requirement | Kontrak | Dependency WO | Acceptance |
|---|---|---|---|---|---|
| WO-AG-P0-01 | Reproduksi clean checkout, dua generated clients, CI dan migrasi additive; helper test menjalankan seluruh urutan migrasi; init tidak diubah | R-AG-12 | SDD-AG-2, SDD-AG-7 | — | AC-AG-01 |
| WO-AG-P0-02 | Perbaiki identitas delta chat, reconnect/dedupe/error, IME, model per chat, reload dan Chat baru; pakai API existing | R-AG-01, R-AG-09, R-AG-13 | SDD-AG-6 | WO-AG-P0-01 | AC-AG-02 |
| WO-AG-P0-03 | Hubungkan edit/regenerate/continue/cabang/system/judul; riwayat/search/archive/pin/delete dan ekspor JSON/Markdown aman; tidak menambah folder wajib | R-AG-01, R-AG-11 | SDD-AG-6 | WO-AG-P0-02 | AC-AG-03 |
| WO-AG-P0-04 | Tutup DNS rebinding pada koneksi nyata, body/time limits, Origin/proxy/reset/log secret; perbaiki shared Job heartbeat/start/complete/fail expiry agar lease mati tidak hidup kembali | R-AG-09, R-AG-11 | SDD-AG-4, SDD-AG-5 | WO-AG-P0-01 | AC-AG-04, AC-AG-05 |
| WO-AG-P0-05 | Render Markdown aman/copy code/KaTeX, tema/preferensi/akun/admin dasar, E2E smoke aktual dan aksesibilitas; media/Mermaid advanced tetap defer | R-AG-10, R-AG-11, R-AG-13 | SDD-AG-6, SDD-AG-7 | WO-AG-P0-02, WO-AG-P0-04 | AC-AG-06 |
| WO-AG-P1-01 | Tambah schema task/run/message/step/event/interaction/file/runtime secara additive beserta invariants, tombstone dan manifest input | R-AG-02, R-AG-05, R-AG-09, R-AG-12 | SDD-AG-2 | WO-AG-P0-01, WO-AG-P0-03, WO-AG-P0-05 | AC-AG-07 |
| WO-AG-P1-02 | API task CRUD/list/follow-up/cancel, owner checks, revision, rate limit, idempotency envelope; belum tool executor | R-AG-02, R-AG-11 | SDD-AG-2, SDD-AG-3 | WO-AG-P1-01 | AC-AG-08 |
| WO-AG-P1-03 | Job agent segment, concurrency slots, deadline, fencing setiap mutasi, stop/recovery/wait/resume; tanpa replay efek ambigu | R-AG-02, R-AG-09, R-AG-13 | SDD-AG-2, SDD-AG-4 | WO-AG-P1-02, WO-AG-P0-04 | AC-AG-09, AC-AG-10 |
| WO-AG-P1-04 | SSE durable, snapshot/messages, task list/detail dan status; close tab bukan cancel | R-AG-02, R-AG-10, R-AG-13 | SDD-AG-3, SDD-AG-6 | WO-AG-P1-03 | AC-AG-11 |
| WO-AG-P2-01 | Tool-call parser Unicode/arg fragments, registry/schema, capability probe, model loop, budget accounting dan safe results; single orchestrator | R-AG-03, R-AG-09, R-AG-13 | SDD-AG-4 | WO-AG-P1-04 | AC-AG-12, AC-AG-13 |
| WO-AG-P2-02 | Web search/read via egress, source tracking, keyword retrieval dan citation mapping; tidak ada sumber palsu/embedding wajib | R-AG-04, R-AG-11 | SDD-AG-4, SDD-AG-5 | WO-AG-P2-01, WO-AG-P0-04 | AC-AG-14 |
| WO-AG-P2-03 | Upload PDF/text/image yang didukung, extraction worker bounded, artifact write/download/preview, MIME/path validation; file data tidak di-inline tanpa batas | R-AG-05, R-AG-11 | SDD-AG-2, SDD-AG-3, SDD-AG-5 | WO-AG-P2-01 | AC-AG-15, AC-AG-16 |
| WO-AG-P2-04 | Hubungkan tujuan→plan/step nyata→sources/hasil unduh, input interaction dan capability UI; jangan menggambar progres simulasi | R-AG-03, R-AG-04, R-AG-05, R-AG-10, R-AG-13 | SDD-AG-3, SDD-AG-6 | WO-AG-P2-02, WO-AG-P2-03 | AC-AG-17 |
| WO-AG-P3-01 | Implementasi adapter E2B/template/proxy/control-plane terpisah, resource cap, probe/cleanup; bukti spike live diperlukan sebelum enable | R-AG-06, R-AG-07, R-AG-12 | SDD-AG-5, SDD-AG-7 | WO-AG-P2-04 | AC-AG-18 |
| WO-AG-P3-02 | Approval bound digest/policy/revision/expiry, atomic consume/resume, server enforcement dan UI review | R-AG-08, R-AG-09, R-AG-10 | SDD-AG-2, SDD-AG-3, SDD-AG-5 | WO-AG-P2-04 | AC-AG-19 |
| WO-AG-P3-03 | Code tool network-off, input allowlist, validated output ingestion, kill/ambiguity; tidak mengeksekusi kode model di host | R-AG-05, R-AG-07, R-AG-09 | SDD-AG-4, SDD-AG-5 | WO-AG-P3-01 | AC-AG-20 |
| WO-AG-P3-04 | Browser executor/context per run, read/write classification, viewer/pause/handover tanpa password capture, resume lewat interaction | R-AG-06, R-AG-08, R-AG-09, R-AG-10 | SDD-AG-3, SDD-AG-5, SDD-AG-6 | WO-AG-P3-01, WO-AG-P3-02 | AC-AG-21 |
| WO-AG-P3-05 | Adversarial suite runtime/egress/approval/injection dan live smoke; capability tetap disabled pada gate gagal | R-AG-06, R-AG-07, R-AG-08, R-AG-11 | SDD-AG-5 | WO-AG-P3-03, WO-AG-P3-04 | AC-AG-22 |
| WO-AG-P4-01 | Export/delete account/task/file lengkap, referensi shared input, retention/pruning/cursor410 dan orphan cleanup | R-AG-05, R-AG-11, R-AG-13 | SDD-AG-2, SDD-AG-3, SDD-AG-7 | WO-AG-P3-05 | AC-AG-23 |
| WO-AG-P4-02 | Packaging web/worker, production commands nyata, readiness/heartbeat/metrics, config docs dan CI Linux | R-AG-12, R-AG-13 | SDD-AG-7 | WO-AG-P3-05 | AC-AG-24 |
| WO-AG-P4-03 | Upgrade populated SQLite/PostgreSQL, backup/restore file+key, rollback schema-compatible dan reconciliation restored run | R-AG-09, R-AG-11, R-AG-12 | SDD-AG-2, SDD-AG-7 | WO-AG-P4-01, WO-AG-P4-02 | AC-AG-25 |
| WO-AG-P4-04 | Seluruh skenario E2E user-facing di360/1440, keyboard/tema, fixture dan provider live terpisah; regresi chat tetap lulus | R-AG-01, R-AG-02, R-AG-03, R-AG-04, R-AG-05, R-AG-06, R-AG-07, R-AG-08, R-AG-10 | SDD-AG-6, SDD-AG-7 | WO-AG-P4-01, WO-AG-P4-02 | AC-AG-26 |
| WO-AG-P4-05 | Audit akhir, benchmark angka asumsi, bukti tiap requirement, release notes/core readiness, commit/push integrasi | R-AG-01, R-AG-02, R-AG-03, R-AG-04, R-AG-05, R-AG-06, R-AG-07, R-AG-08, R-AG-09, R-AG-10, R-AG-11, R-AG-12, R-AG-13 | SDD-AG-1, SDD-AG-7 | WO-AG-P4-03, WO-AG-P4-04 | AC-AG-27 |

## Gate fase

AG-P0: chat E2E lengkap, fondasi security/fencing/migrasi aman dan baseline suite
lulus. AG-P1: task tetap dapat dibuka setelah reload, restart dan waiting, tanpa
leak/replay. AG-P2: tujuan riset/file selesai lewat beberapa alat nyata dan hasil
bisa diunduh. AG-P3: code/browser/approval lulus fixture **dan** live isolation gate.
AG-P4: acceptance inti, upgrade/restore, UI dan operasi lulus; tidak ada blocker
keamanan kemampuan aktif. Gate gagal tidak membuka dependent work; pekerjaan
independen boleh dilanjutkan dan status blocker dicatat.

## Sub-agent dan integrasi

Claude Code coordinator mengerjakan pembagian, kontrak shared, integrasi dan gate.
Default maksimum3 sub-agent aktif; kurangi bila memory/CPU/test contention tinggi.
Gunakan sub-agent backend, frontend dan verifier/security pada dependency yang ready.
Schema/migrasi/package lock/config CI/shared types mempunyai satu pemilik pada satu waktu.

Setiap assignment wajib berisi WO, desired behavior, dependency commit, interfaces,
file/module ownership, larangan scope tambahan, acceptance, perintah test dan bentuk
laporan. Worker yang menulis memakai worktree/branch terisolasi berdasarkan **commit
integrasi terbaru yang ditentukan coordinator**, bukan mengasumsikan worktree otomatis
berasal dari HEAD parent. Worker mengembalikan commit SHA dan bukti; hanya coordinator
mengintegrasikan. Review read-only bisa melihat checkout integrasi tanpa mengedit.

Worker tidak push/merge main atau menjalankan seluruh suite berbarengan. Coordinator
menggabungkan perubahan sesuai dependency, memeriksa diff, menjalankan gates terpusat,
commit path eksplisit dan push normal setelah fase lulus. Konflik diselesaikan dengan
mempertahankan kontrak terbaru, bukan memilih ours/theirs seluruh file.

## DoR, DoD dan laporan

DoR: input/hasil terdefinisi, dependency selesai, schema/API tersinkron, owner file
jelas, fixture tersedia, credential live jika WO memerlukannya. DoD: implementasi
jalur hidup, meaningful test, acceptance dijalankan, typecheck/lint/build lulus,
security checks terkait lulus, laporan status dan commit tersedia. Stub/mock hanya
untuk test, bukan tombol produk yang mengaku berhasil.

Laporan `reports/AG-Pn.md`: base/head SHA, WO dan requirement, file berubah, perintah
+ exit code, jumlah test, langkah/bukti perilaku, temuan yang ditutup, blocker external,
dan backlog tersisa. Status enum: not_started, in_progress, blocked_external, done.
Done hanya jika semua gate WO lulus; acceptance live yang blocked tidak disamakan done.
