# Keputusan, konflik dan blocker

24 Oktober 2026 UTC. **Rekomendasi belum persetujuan implementasi.** Sumber empat laporan pada [README](<README.md>). Kontrak hasil integrasi [SDD](<SDD.md>).

## Rekonsiliasi terhadap kode

| ID | Konflik / bukti aktual | Keputusan integrasi |
|---|---|---|
| C01 | [STATUS lama](<../../../tasks/agent-v1/STATUS.md#L3-L13>) mengatakan task belum ada; [schema](<../../../prisma/schema.prisma#L600-L685>) dan [route](<../../../src/app/api/kawan/v1/tasks/route.ts#L44-L79>) sudah ada | Source menjadi baseline current; dokumen lama tetap acuan target historis, tidak mengulang bootstrap. Instruksi push lama tidak mengalahkan larangan tugas ini |
| C02 | Riset engine mengusulkan interrupted/cancel_requested; [RUN_STATUSES](<../../../src/lib/tasks/tasks.ts#L26-L38>) memakai indeterminate, schema mempunyai cancelRequestedAt | Pertahankan status existing; cancel intent field, indeterminate terminal untuk hasil ambigu. Tidak menambah enum tanpa kebutuhan |
| C03 | DSH delta process-local; [SSE Kawan](<../../../src/lib/tasks/events.ts#L95-L127>) membaca event durable, [run](<../../../src/lib/tasks/run.ts#L334-L351>) append delta lalu update text terpisah | Jangan downgrade durability; atomic delta+projection dan consistent snapshot cursor. Durability event saat ini tidak otomatis berarti UI replay benar |
| C04 | [task UI](<../../../src/components/task-view.tsx#L74-L82>) reset cursor0 dan [send](<../../../src/components/task-view.tsx#L147-L154>) menolak active kosong | P0 task pertama/replay sebelum loop; reproduksi browser tetap acceptance, bukan sudah dibuktikan visual |
| C05 | Lima lapisan prompt [existing](<../../../src/lib/chat/prompt-builder.ts>) adalah trust hierarchy; bukan metode riset | Usulkan framing/discovery/extraction/validation/synthesis; pemilik perlu konfirmasi. Tidak mengganti policy hierarchy |
| C06 | Angka3 pada chat tool calls bukan siklus; [task run](<../../../src/lib/tasks/run.ts#L294-L314>) satu model call tanpa tools | Maks3 siklus durable termasuk awal, terpisah model turn/call/retry. Hasil tool harus kembali ke model |
| C07 | Inspect preview20×20 vs output UI50×12; dataset contoh10k rows melebihi batas ingestion20k cells | Cap berbeda boundary. Preview inspect untuk konteks; UI preview untuk DOM. Fixture UI10k×20 generated canonical dataset, bukan klaim file ingestion sebesar itu supported. Ingestion oversize ditolak sampai profil diperluas dengan bukti |
| C08 | Renderer [menerima PPTX](<../../../src/lib/artifacts/render.ts#L19-L26>); [format registry](<../../../src/lib/artifacts/format.ts#L3-L26>) tidak | PPTX parsial; jangan promosi end-to-end. MD/CSV/JSON/XLSX prioritas; PDF/Office fidelity gate per format |
| C09 | Tool registry/helpers sudah ada tetapi task belum terhubung; parent/depth/plugin existing tersedia | Reuse, tidak membangun framework/engine baru. Defer ekspansi multi-agent/plugin, bukan menghapus existing code |
| C10 | Limit file/read pasca allocation bukan memory protection; JSON.parse kehilangan duplicate keys | Parser isolation spike gate sebelum expose file inspect. Pilih stdlib/dependency terpasang bila memenuhi acceptance; dependency baru hanya kebutuhan terbukti + persetujuan. Tidak menyebut parser bounded sebelum buktinya |
| C11 | E2B adapter existing belum membuktikan cap/network; Node `-c` bukan execution | Perbaiki contract/invocation lalu live canary; code off hingga seluruh isolation gate. VM/worktree/CLI bukan sandbox |
| C12 | DSH workflow tidak durable; ZCode executor tidak OS sandbox default | Adapt pola event/registry/provenance/approval; reject klaim transplant siap multi-tenant. Tidak menjalankan/install upstream |

## Pilihan arsitektur dan tradeoff

| ID | Pilihan direkomendasikan | Alternatif dan alasan tidak dipilih |
|---|---|---|
| ADR01 | Worker/task Kawan + satu loop read-only | Embed DSH/ZCode runtime: biaya integrasi tenancy/credentials/storage/lease/approval, lisensi/dependency lebih besar; belum ada nilai yang membenarkan |
| ADR02 | Additive step/source/attachment, String JSON validated, config snapshot | Journal workflow generic atau semua tabel backlog: terlalu dini. JSON-only tanpa indexed step/attachment: lebih kecil tetapi recovery/idempotency/ownership query lemah |
| ADR03 | Registry tertutup existing, direct handlers | Plugin framework/MCP arbitrary install: attack surface dan supply-chain tanpa kebutuhan MVP |
| ADR04 | Compute closed+aggregate source-bound sebelum kode | Model menghitung angka: tak dapat diandalkan; pandas/SymPy/Sandbox untuk semua: biaya/isolasi besar. Sandbox hanya kebutuhan di luar enum |
| ADR05 | Existing Markdown/Mermaid/native table/details | MDX/HTML/live JS/React Flow/AG Grid: tidak perlu, menambah security/accessibility/maintainability |
| ADR06 | Snapshot evidence privat berhash, retention awal7 hari | Pointer URL/path mutable saja: tidak reproducible; simpan semua selamanya: biaya/privasi/hak sumber. Ambil excerpt/snapshot hanya bila diizinkan; metadata saat snapshot tidak boleh disimpan |
| ADR07 | Budget konservatif reserve+settle, cap3, fixed small parallel reads | Infinite reflection/multi-agent/nested workflow: biaya dan stop/recovery lebih sulit; tidak dibutuhkan untuk dataset awal |
| ADR08 | Read-only release terpisah code/format fidelity | Menahan semua sampai sandbox/Office sempurna: memperlambat manfaat dasar; membuka semua dari mock: tidak aman |
| ADR09 | Pertahankan artifact immutability/hash/auth dan source refs | DSH present path menunjuk file berubah: tidak cocok sebagai public SaaS artifact contract |
| ADR10 | Code capability fail-closed, approval effects-only | Approval setiap read mengganggu UX; approval sebagai pengganti sandbox salah; default yolo/unrestricted shell ditolak |

## Pemilik perlu memutuskan

| ID | Pertanyaan | Rekomendasi / dampak bila belum disetujui |
|---|---|---|
| O01 | Apakah lima lapisan metode sesuai maksud awal? | Setujui framing/discovery/extraction/validation/synthesis; jika berbeda, revisi PRD D05 sebelum prompt/loop coding |
| O02 | Scope coding awal? | WP00–WP11/14 read-only, satu WP/sesi; sandbox terpisah. Tanpa jawaban, tetap planning |
| O03 | Budget dan model/provider untuk pilot? | Cap awal SDD; BYOK tool-call compatibility wajib, consent biaya live eksplisit. Tidak memilih/menagih model diam-diam |
| O04 | Retensi source snapshots/file privat dan consent eksternal? | Ikuti7 hari existing artifacts; no search raw private/third-party viewer. Perubahan retention/transfer perlu keputusan privasi |
| O05 | Format prioritas dan arah visual? | MD/CSV/JSON/XLSX dahulu, PDF/DOCX fidelity bertahap, PPTX off. Reuse UI; redesign tunggu DESIGN.md/brief pemilik, tanpa asset baru |
| O06 | Sandbox template/provider dan gate operator? | Default E2B existing hanya setelah attestation+live isolation; tidak ada fallback host. Biaya/test account disediakan terpisah |
| O07 | Siapa mengotorisasi deployment/rollback? | Operator dengan jendela/target/runbook eksplisit setelah QA. Dokumen/izin coding tidak mengotorisasi deploy/push |

## Blocker eksternal dan nonblocker

- **blocked_external live:** provider BYOK/search credentials, kompatibilitas tools, kuota/consent biaya, model/version eval; jangan mengubah secret atau memakai akun berbayar tanpa izin.
- **blocked_external sandbox:** template/network/cgroup evidence, operator endpoint/test account, kill-descendant proof dan isolation canary. Code tetap off; read-only independent dapat lanjut setelah izin coding.
- **blocked_external migration/release:** PostgreSQL test terisolasi, backup/restore environment, browser test server, izin deploy. Checker SQL bukan substitute live migration.
- **Keputusan teknis belum selesai:** parser resource isolation/duplicate JSON key; pilihan font Unicode berlisensi bila PDF fidelity memerlukannya; ini spike WP, bukan menambah dependency otomatis.
- **Kualitas sumber:** paywall/scan/404/time-sensitive conflict bukan alasan mengarang; partial/abstention adalah hasil sah.
- **Keterbatasan alat riset:** search harness404, direct URL fallback; kuli_work tidak tersedia. Tidak mengklaim search comprehensive/Kuli work order/live suite dijalankan.

## Lisensi dan sumber

[Riset engine §10](<riset-engine.md#L112-L139>) menyimpan SHA dan URL primer: DSH `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` MIT, ZCode `3c5b227649371507ddc4eb46ac5133afe6db1cab` Apache-2.0. Adaptasi pola mandiri tidak berarti salin kode. Jika salin substansial kelak: file asal/SHA/header, copyright/license/NOTICE, perubahan, third-party notices dan lisensi transitif diperiksa. Merek/aset/akses layanan tidak ikut terlisensi otomatis. Tidak ada audit upstream/runtime/benchmark dilakukan dalam riset.

Rujukan keamanan/parsing/UX primer tersimpan pada [data](<riset-data-evaluasi.md#L34-L45>) dan [output](<riset-output-ux.md#L113-L121>): OWASP SSRF/CSV, Decimal API, ExcelJS README, E2B network, react-markdown, Mermaid, W3C WAI. Versi docs live/branch bisa berbeda dari dependency lokal; implementer harus cocokkan versi, tidak menganggap docs bukti Kawan berjalan.

## Batas keputusan

Prioritas boleh berubah karena hasil fixture/model/live dan pemilik; hard safety/ownership/data preservation tidak dilonggarkan. Tidak mengklaim zero hallucination, exactly-once eksternal, full PDF fidelity, atau sandbox aman dari mock. Completion paket berarti rencana dapat ditinjau; completion produk memerlukan seluruh gate scope terpilih dengan bukti baru.

## Respons revisi REV-01–07

Respons desain berikut telah direview ulang oleh t9: **REV-01–07 Closed pada dokumen**, sebagaimana [penutupan delta](<REVIEW.md#L95-L118>). Verdict needs_revision t6 tetap riwayat; t9 menambahkan penutupan baru, bukan mengganti verdict lama. Finalisasi t7 hanya menyelaraskan status penyerahan; bukan bukti acceptance runtime lulus.

| Finding | Keputusan dan alternatif | Pemetaan perubahan / bukti target |
|---|---|---|
| REV-01 | Pilih endpoint raw-byte Artifact upload, storage existing, hash original tanpa re-render. Alternatif Document original resolver lebih reuse jalur chat tetapi membutuhkan union Document/Artifact pada tools/binding dan perbaikan multipart buffering; tidak dipilih untuk menjaga satu artifactId contract. Endpoint baru tetap harus streaming, bukan memindahkan bug allocation | SDD D02/D04/D07; WP03 metadata, WP06B upload/picker/ownership, WP07 aggregate; T03-upload end-to-end original hash dan oversize |
| REV-02 | Read-only terminal partial clarification_required; follow-up endpoint existing dengan replyToRunId/revision, run/config/budget baru hanya atas tindakan pengguna. Alternatif pause/input endpoint sebelum loop lebih kompleks dan tidak diperlukan MVP; waiting_input enum existing tetap tetapi tidak dipakai rilis ini | SDD D03/D04; WP08 dan task UI; T08-clarify valid/stale/foreign/expired/restart. Tidak bergantung WP13 |
| REV-03 | Sticky private taint, default deny model-authored outbound, exact per-run recipient/payload grant user single-use+expiry+revoke. Consent read-only endpoint/UI WP05, terpisah approval efek eksternal WP13. Alternatif classifier PII/prompt saja ditolak; web phase tanpa private context boleh sebelum taint | SDD D02/D04/D06/D09; WP03/05/08; T09-egress canary termasuk callback publik, query/body/log; tidak ada general allow-all grant |
| REV-04 | WP06B mendahului WP06C sebagai pemilik inspect contract yang diperluas | Edge Mermaid W06B→W06C dan dependency tabel WP06A,WP06B; shared file tidak dikerjakan paralel |
| REV-05 | Reserve final input4.000+output1.000 dalam cap existing; terminal template tanpa model jika paket tidak muat/deadline/provider gagal. Alternatif reserve output saja ditolak | SDD D05; WP04/08; T04-final scenarios dalam T04, status synthesisStatus:not_generated, nol overspend/cycle4 |
| REV-06 | Laporan peneliti tidak diedit; indeks README memetakan semua23 tautan lokal ke path benar beserta locator original | Resolver local links dan hitungan23 entries; target dan line ranges diverifikasi, bukan HTTP/runtime gate |
| REV-07 | 60 total,40 development+20 held-out total, stratified per keluarga tanpa template leakage | ACCEPTANCE dataset; WP00 wajib membekukan per-family split di manifest dan validasi sum40/20 |

Batas revisi: enam dokumen sintesis saja; tidak source edit/build/migrasi/deploy. Pilihan kontrak ini bukan izin coding dan tidak mengaktifkan capability.
