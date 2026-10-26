# Riset engine: DeepSeek Harness dan ZCode

Tanggal observasi: **2026-10-24 UTC**. Cakupan: inspeksi statis sumber publik; tanpa instalasi, build, eksekusi upstream, perubahan runtime, atau deployment. Rekomendasi ini masukan SDD, bukan persetujuan implementasi.

## 1. Kesimpulan

**Adaptasi pola, bukan transplantasi runtime.** DSH unggul sebagai referensi pemisahan tool, event durable, proyeksi konteks dan lifecycle. ZCode memberi referensi transaksi input/command, cold recovery, metadata artefak dan journal workflow. Kawan tetap membutuhkan worker server-side, otorisasi tenant, penyimpanan milik aplikasi dan sandbox eksekusi independen.

Temuan pembatas utama:

- DSH berstatus developer preview, belum audit keamanan; sandbox bukan satu-satunya kontrol keamanan [D1, D2].
- **Durable session DSH tidak berarti durable workflow**: dokumentasi workflow eksplisit menyatakan tidak ada journaling/resume, nested/saved workflows, atau anggaran token lintas anak [D7].
- ZCode menyatakan shared execution adapter **tidak menyediakan sandbox OS secara default**; direktori kerja/worktree/VM JavaScript bukan jaminan isolasi seluruh tool [Z2].
- Deklarasi artefak DSH menunjuk berkas saat ini, bukan immutable snapshot. Untuk SaaS, adaptasi ke object ID/version/hash dan otorisasi unduh [D6].
- Tidak ada bukti riset ini bahwa salah satu engine siap menjadi runtime multi-tenant Kawan tanpa pekerjaan keamanan dan integrasi.

## 2. Akses, snapshot dan lisensi

API metadata, commit, raw file kedua repositori dapat diakses HTTP 200 tanpa autentikasi. Recursive tree kedua snapshot melaporkan `truncated: false`; tree dipakai menemukan berkas, bukan bukti implementasi. Branch dapat berubah: URL kode di daftar sumber dipatok SHA.

| Repo | Branch / commit teramati | Waktu commit UTC | Lisensi terverifikasi |
|---|---|---|---|
| DeepSeek Harness | `master`, `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` | 2026-10-23 11:48:59 | MIT, copyright 2026 DeepSeek [D0, D3] |
| ZCode | `main`, `3c5b227649371507ddc4eb46ac5133afe6db1cab` | 2026-10-20 06:23:05 | Apache-2.0, copyright 2026 Z.AI Co., Ltd [Z0, Z3] |

ZCode commit berupa source-sync; pesan mencantumkan `Source-Commit: 5a082039a1a3b1edfe8364a33c8978689c0d68bf`. SHA publik di atas adalah dasar riset; source-commit internal tidak diverifikasi. Kedua API commit menandai `verification.verified=false`, alasan `unsigned`; akses publik bukan attestation supply chain. README ZCode menyebut v3.16.2 diperbarui 2026-10-19; tanggal README bukan tanggal commit [Z1].

**Batas pemakaian:** MIT mewajibkan copyright/permission notice dalam salinan atau bagian substansial. Apache-2.0 mewajibkan salinan lisensi, penanda perubahan, mempertahankan notice relevan dan atribusi NOTICE bila berlaku; memuat grant paten beserta terminasi terkait litigasi, bukan izin merek. Kedua lisensi tanpa warranty. Lisensi first-party tidak otomatis mencakup dependency, font, ikon, binary atau materi situs. Sebelum menyalin kode: inventaris asal/SHA/berkas, tinjau header dan third-party notices, simpan atribusi dan perubahan. Riset ini **tidak** mengaudit semua lisensi transitif; utamakan implementasi pola mandiri, jangan menyalin aset/merek atau mengasumsikan akses layanan resmi ikut terlisensi [D3, Z2, Z3].

## 3. Tingkat bukti

- **K**: body kode implementasi dibaca; membuktikan cabang/logika ada, bukan bahwa runtime lulus pengujian.
- **T**: kode test/patch test dibaca; bukti cakupan yang dimaksud, **bukan hasil test dijalankan**.
- **D**: README, desain, safety/notice upstream; klaim maintainer, bukan verifikasi runtime.
- **I**: inferensi/rekomendasi Kawan; harus diuji di implementasi Kawan.

Tidak ada benchmark, penetration test, real-provider run, chaos test atau pengukuran performa dilakukan.

## 4. Arsitektur

**DSH — D/K.** Arsitektur Cordis everything-is-a-plugin; profile menyusun bundles untuk web/headless/SDK/ACP. Agent loop, model adapter, tool registry, persistence semuanya capability yang dapat diganti. Pemisahan event: fakta sesi durable, event agent live, hook capability. Urutan turn/step membentuk request, stream, tool call/result, settlement [D1]. Implementasi `ToolsService` menunjukkan scoped registry, schema projection, activation per-step, executor terpisah, guard inherited dan disposer. Ini pola bagus; menyalin plugin framework penuh belum dibenarkan untuk sedikit tool Kawan [D4].

**ZCode — D/K.** Monorepo desktop Electron, web, HTTP/WebSocket server, shared React UI/services/protocol; agent CLI/core/contracts/adapters/bootstrap terpisah [Z1]. Port session mendefinisikan input, message parts, provenance, usage dan fork transaction [Z4]. Adapter SQLite menggunakan `node:sqlite`, migrasi, repository dan transaksi `begin immediate/commit/rollback` untuk fork/import [Z5]. Ini bukan Prisma/PostgreSQL drop-in; kebutuhan Kawan memakai transaksi dan model datanya sendiri.

## 5. Perbandingan sepuluh kemampuan

| Kemampuan | DeepSeek Harness | ZCode | Implikasi Kawan |
|---|---|---|---|
| Tools | **K:** output schema/render wajib; timeout positif; scoped restriction; aktivasi snapshot per-step memeriksa abort; guard sesudah policy [D4] | **K:** approval gate terpisah; kontrak tool state pending/running/completed/error, call ID dan usage [Z4, Z6] | Registry kecil dengan schema input/output; server menentukan capability, bukan browser/model. Unknown tool ditolak. |
| Durable runs | **K:** JSONL generation, single-writer claim/lease, validasi identitas, flush, fsync dan rollback append [D5]. Sesi baru lazy sampai append/flush | **K:** input ledger; transaksi fork + command fact; journal store workflow [Z4, Z5]. **T:** cold-resume test membedakan jenis anak dan menolak input ulang [Z8] | DB durable run/step/attempt/event; ACK setelah commit; lease/fencing dan idempotency. Resume bukan rerun efek samping. |
| Streaming | **D:** chunk live process-local; message/attempt stream disimpan saat settlement. Hard crash sebelum settlement dapat kehilangan stream [D1] | **T:** cold-resume test memakai `ModelStreaming`, snapshot/revision/logEpoch dan web replayable [Z8]; README menyebut HTTP/WS [Z1] | Pisahkan delta sementara dari event committed; cursor monotonik, reconnect replay dan snapshot. Jangan janjikan setiap token crash-durable. |
| Cancellation | **K:** tool activation abort tidak menerbitkan partial selection [D4]. **D:** workflow caller-owned cancel/dispose menunggu cleanup [D7] | **K/T:** patch adapter menunjukkan AbortController, stop sebelum spawn dan output cleanup; cold-resume test tersedia [Z8]. **D:** abort berbeda dari timeout failure [Z7] | `cancel_requested` lalu terminal setelah worker acknowledge; abort fetch/model/child; tidak mengklaim rollback side effect. |
| Approval | **K:** DSH guard dapat menolak sesudah extensible policy/approval [D4] | **K:** preview failure tetap `ask`, bukan fail-open; tetapi trusted `prepareApproval` dapat menghasilkan `proceed` [Z6] | Approval terikat actor/run/tool/arg hash/version/expiry; deny policy tidak bisa dibatalkan tool/model. Jangan adopsi bypass hook tanpa batas. |
| Sandbox | **D:** safety menyatakan eksperimental, bukan security boundary tunggal [D2] | **D:** shared execution tidak sandbox OS default; workflow subprocess/`vm.createContext` bukan isolasi seluruh tool [Z2, Z7] | Code analysis hanya pada sandbox OS terpisah, quota CPU/RAM/disk/time, egress terbatas, tanpa host secrets. Web fetch pun wajib SSRF guard. |
| Context management | **K:** tool-result pruner menyimpan source event, replacement dan event pricing; Unicode code points; original tidak dihapus [D8] | **K-kontrak:** compaction boundary/summary IDs, provenance, visibility provider/UI/transcript; metadata attachment recoverability [Z4] | Full evidence disimpan di luar prompt; preview bertanda truncated; summary terhubung sumber. Pin pertanyaan, batas, sitasi dan schema. |
| Orchestration | **D:** agent/parallel/pipeline; child failure bisa `null`, misuse fatal; workflow tidak checkpoint/resume [D7] | **K:** adapter mengekspos journal, run, activity, cache inputHash/callPath [Z5]. **D:** engine menguasai terminal status; harness membersihkan child [Z7] | Mulai single-agent iterative loop; parallel fetch bounded. Defer generated workflow scripting dan nested agents sampai metrik membenarkan. |
| Artifacts | **K:** `present` validasi regular file, resolve/stat, append `deliverables/presented` hanya setelah hasil sukses; isi tidak disalin [D6] | **K-kontrak:** MIME/name, size/hash, artifact URI, storage kind dan recoverability; adapter memiliki workflow journal artifacts lewat port [Z4, Z5] | Artefak immutable berversi: owner, run, MIME, hash, size, provenance. Preview terisolasi; unduh server-authorized. |
| Evaluasi | **T:** commit berisi deterministic fixture dan restore assertions, bukan bukti kualitas jawaban [D0]. Tidak ditemukan benchmark kualitas riset dalam sampel | **D:** automation guide mewajibkan independent scoring; mengakui model-io converter dan recorder gagal pada verifikasi upstream [Z9] | Evals khusus groundedness, sitasi, akurasi numerik, recovery, keamanan; jangan memakai selesai/exit 0 sebagai skor kualitas. |

## 6. Keputusan adopsi dan prioritas

| Keputusan | Prioritas | Pola / alasan | Batas |
|---|---|---|---|
| **Adopt** prinsip | P0 | Event committed terpisah dari UI delta; status machine eksplisit; ID korelasi run/step/tool/attempt | Implementasi sendiri pada storage Kawan; tidak impor JSONL runtime |
| **Adapt** | P0 | Registry tool dan schema output DSH; tool result terstruktur ZCode | Allowlist server; validation sebelum dispatch dan setelah return; capability per tenant |
| **Adapt** | P0 | Input ledger/command receipt dan atomic promotion ZCode | ACK setelah transaksi; duplicate request tidak membuat run kedua; jangan copy SQLite-specific transaction API |
| **Adapt** | P0 | Cancel + cleanup ownership | Timeout, cancel pengguna, error provider berbeda; stop seluruh resource milik run, tidak process global |
| **Adapt** | P0 | Preview approval fail-closed | Approval tidak mengganti sandbox; mutasi/publication baru sesudah otorisasi eksplisit |
| **Adapt** | P1 | Pruning replay-safe dan source provenance DSH | Tidak membuang evidence asli; jangan mengandalkan head/tail untuk menghitung dataset |
| **Adapt** | P1 | Delivery declaration + attachment metadata | Immutable object store; bukan path host mentah atau pointer mutable |
| **Adopt** praktik | P1 | Manifest eval reproducible dan independent scorer [Z9] | Rujukan praktik, bukan menjalankan tooling upstream yang diketahui gagal |
| **Defer** | P2 | Plugin ecosystem, MCP arbitrary install, script workflow, recursive delegation | Beban supply-chain, approval, budget, isolasi; riset single-agent sudah mencakup kebutuhan awal |
| **Defer** | P2 | Full workflow journal/replay ala ZCode | Baru saat proses multi-stage perlu resume lintas restart; lebih dulu step checkpoint sederhana |
| **Reject** untuk Kawan | Semua | Runtime CLI di request handler, unrestricted shell, default yolo, token dalam URL, plaintext path artefak | Tidak sesuai SaaS multi-tenant/BYOK |
| **Reject** klaim | Semua | “Persisted session = exactly-once workflow”; “VM/context/worktree = sandbox”; “model selesai = acceptance lulus” | Bukti upstream sendiri menunjukkan batasnya |

Adopt berarti mengambil prinsip; adapt berarti merancang ulang untuk batas web Kawan. Tidak berarti menambahkan dependency atau menyalin kode sekarang.

## 7. Kontrak minimum untuk SDD Kawan (I)

1. **Run**: tenant/user ownership; `queued/running/waiting_approval/cancel_requested/completed/failed/cancelled/interrupted`; terminal immutable. Attempt ID/fencing monotonik menolak hasil worker lama. Batas iterasi/token/biaya/durasi dan fetch count disimpan sebelum run.
2. **Tool invocation**: tool name/version, input tervalidasi, call ID, attempt ID, side-effect class, status, output/error typed, provenance, timing/usage. Retry otomatis hanya untuk read-only/idempotent action; hasil eksternal ambigu dicatat `unknown`, bukan dianggap belum pernah terjadi.
3. **Stream**: event ID monotonik per run, event type/version, timestamp, safe payload; reconnect menggunakan cursor dan tenant check. Delta provisional tidak boleh disamakan event committed. Buffer/backpressure terbatas; ringkasan status tersedia tanpa seluruh transcript.
4. **Approval**: keputusan user nyata, hash input kanonik, expiry, target, capability dan run revision; single-use; perubahan parameter wajib persetujuan ulang. External page/tool content tidak berwenang memberi approval.
5. **Evidence/context**: sumber dengan URL final, retrievedAt, snapshot/hash, lokasi kutipan, trust label, extract status. Konten eksternal dianggap data. Summary/pruning menyimpan relasi sumber, bukan menimpa original.
6. **Artifact**: ID opaque, version/hash, tenant, creator run, MIME terverifikasi, byte limit, retention dan provenance; sanitize Markdown/HTML/SVG/Mermaid, blok script/remote resource berbahaya. Tabel data tetap memiliki schema/typed cells, bukan hanya Markdown.
7. **Executor**: web fetch dan parsing terpisah dari untrusted code; SSRF/IP/redirect guard. Code/data execution memerlukan sandbox gate terbukti. Tidak meneruskan BYOK secret ke proses analisis; provider adapter server-only dengan redaksi log.
8. **Recovery**: browser disconnect bukan cancel otomatis; worker restart merekonsiliasi lease dan step receipt; pending approval dipulihkan atau expired, tidak auto-allow. Replay event tidak memicu ulang tool.

## 8. Acceptance yang disarankan (belum dijalankan)

| ID | Skenario | Bukti lulus yang dibutuhkan |
|---|---|---|
| ENG-01 | Double submit dan reconnect | Satu run; satu tool invocation per idempotency key; event tidak ganda di UI |
| ENG-02 | Worker crash sebelum/sesudah result commit | Status interrupted/recovered benar; tidak mengulang mutasi; stale attempt ditolak |
| ENG-03 | Cancel saat stream/fetch/approval/child aktif | Provider/resource dihentikan sesuai batas; satu terminal event; output parsial dilabeli; side effect yang selesai tetap tercatat |
| ENG-04 | Approval berubah argumen, expired, lintas tenant | Seluruh replay/parameter drift ditolak; preview error tidak auto-execute |
| ENG-05 | Prompt injection dari situs/CSV/tool result | Tidak bisa mengubah policy, membaca secret, meluncurkan tool terlarang atau publikasi |
| ENG-06 | SSRF, path traversal, symlink, malicious preview | Ditolak sebelum akses; artefak tenant lain tidak dapat dibaca; script tidak jalan |
| ENG-07 | Konteks besar + pruning + resume | Sitasi asli dapat dibuka; token budget terjaga; sumber tidak hilang; partial view ditandai |
| ENG-08 | Tabel/analisis numerik | Hasil cocok fixture deterministik, null/type/encoding ditangani; kalkulasi bukan hanya tebakan model |
| ENG-09 | Biaya, nested/parallel limit | Anggaran global run tidak dilampaui secara tak terbatas; penggunaan anak masuk total |
| ENG-10 | Artefak berubah/dihapus setelah publish | Version/hash stabil atau status unavailable eksplisit; unduh terotorisasi; tidak diam-diam memberi versi lain |
| ENG-11 | Evaluation manifest | Model/provider/config hash, dataset version, prompt version, scorer dan kegagalan dicatat tanpa secrets |

## 9. Keterbatasan dan tindak lanjut

Inspeksi sampel, bukan audit keseluruhan. README root mula-mula dibaca melalui branch; sumber kode/desain/lisensi inti kemudian melalui SHA. Beberapa hasil API commit dan sumber persistence sangat panjang dan terpotong; kesimpulan hanya menggunakan bagian yang terlihat, tidak mengklaim membaca seluruh modul. Implementasi streaming end-to-end, sandbox backend, scheduler, seluruh evaluator dan dependency transitif belum diaudit. Test upstream tidak dijalankan. Tidak ada bukti latency, scale, cost, atau ketahanan terhadap serangan pada deployment nyata.

Sebelum coding: cocokkan kontrak ini dengan SDD/baseline Kawan; pilih delta terkecil; review lisensi hanya bila ada reuse kode; buat threat model dan eval fixtures. Sebelum production: sandbox isolation, tenant authorization, recovery fault injection dan external side-effect policy wajib lulus gate terpisah. Persistensi/journal tidak memberikan exactly-once terhadap layanan eksternal tanpa idempotency/reconciliation.

## 10. Sumber primer

Semua diakses 2026-10-24 UTC. Label sumber memungkinkan membedakan fakta kode dari dokumentasi. URL `blob` menunjuk teks yang dibaca lewat raw URL pada SHA sama.

### DeepSeek Harness

- **D0 — metadata/commit:** [API repo](https://api.github.com/repos/deepseek-ai/deepseek-harness), [commit](https://github.com/deepseek-ai/deepseek-harness/commit/22ddee3792402c3e70ec5f86a63c3e3e895a2f60).
- **D1 — D:** [arsitektur](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/docs/architecture.md), [README root](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/README.md).
- **D2 — D:** [Safety](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/SAFETY.md).
- **D3 — lisensi:** [MIT](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/LICENSE). [Third-party notices](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/THIRD_PARTY_NOTICES.md) ditunjuk README; belum diaudit.
- **D4 — K:** [ToolsService](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/core/tools/src/index.ts), khusus `register`, `resolve`, `checkGuards`, `selectExecutor`.
- **D5 — K:** [JSONL persistence](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/session/session-persistence-jsonl/src/index.ts), khusus `create`, `open`, `materializePosix`, `appendLines`.
- **D6 — K:** [present tool](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/deliverables/tool-present/src/index.ts).
- **D7 — D:** [workflow limits/lifecycle](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/workflow/workflow/README.md).
- **D8 — K:** [tool-result pruner](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/compaction/compaction-tool-result-pruner/src/index.ts).

### ZCode

- **Z0 — metadata/commit:** [API repo](https://api.github.com/repos/zai-org/ZCode), [commit/source-sync](https://github.com/zai-org/ZCode/commit/3c5b227649371507ddc4eb46ac5133afe6db1cab).
- **Z1 — D:** [README](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/README.md).
- **Z2 — D:** [risiko, data flows dan batas sandbox](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/NOTICE.md).
- **Z3 — lisensi:** [Apache-2.0](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/LICENSE). [Third-party notices](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/THIRD-PARTY-NOTICES.md) dirujuk NOTICE; belum diaudit.
- **Z4 — K-kontrak:** [session store port](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/contracts/src/interfaces/session-store.port.ts).
- **Z5 — K:** [SQLite store](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts), khusus `commitForkBundle`, `commitSharedContextImportBundle`, `workflowJournalStore`.
- **Z6 — K:** [approval gate](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/core/src/tool/executor/approval-gate.ts).
- **Z7 — D:** [dynamic workflow runtime](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/dynamic-workflow-runtime/README.md).
- **Z8 — K/T, patch pada commit Z0:** [execution lifecycle](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/adapters/src/exec/node-execution-adapter-lifecycle.ts), [execution run](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/adapters/src/exec/node-execution-adapter-run.ts), [cold-resume test](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/packages/bootstrap/tests/v4-cold-resume.test.ts). Yang dibaca ialah patch terpapar API commit, bukan keseluruhan berkas.
- **Z9 — D:** [automation/evaluation guide beserta kegagalan verifikasi upstream](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/docs/usage/13-automation.md), [guide index](https://github.com/zai-org/ZCode/blob/3c5b227649371507ddc4eb46ac5133afe6db1cab/apps/zcode-cli/docs/usage/README.md).

## 11. Verifikasi dokumen

Pemeriksaan lokal: keberadaan bagian sepuluh kemampuan, kedua SHA, empat kategori keputusan, sumber primer dan batas riset; `git diff --check`. Tidak ada acceptance runtime yang diklaim lulus. Perubahan tugas terbatas pada dokumen ini.
