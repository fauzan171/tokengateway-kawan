# Kawan Next — paket keputusan dan rencana

24 Oktober 2026 UTC · **Draft untuk persetujuan pemilik. Planning, bukan bukti fitur berjalan.** Tidak mengotorisasi coding, migrasi, commit, push, pembelian layanan atau deployment. Persetujuan implementasi dan deployment harus terpisah.

## Rekomendasi

Pertahankan aplikasi dan worker Kawan. Tutup lifecycle task, lalu sambungkan satu loop riset read-only maksimal tiga siklus dengan registry, parsing bounded, perhitungan deterministik, provenance dan renderer existing. Adaptasi prinsip DSH/ZCode; jangan mengganti runtime atau menambah framework/dependency sebelum kebutuhan terbukti. Code execution tetap off sampai gate isolasi live lulus.

## Urutan baca

| Dokumen | Isi |
|---|---|
| [PRD](<PRD.md>) | Persona, hasil pengguna, requirement, prioritas dan non-goals |
| [SDD](<SDD.md>) | Arsitektur, kontrak data/API/event/tool, keamanan dan UX |
| [Rencana implementasi](<IMPLEMENTATION-PLAN.md>) | DAG, scope file, owner-role, urutan gate, rollback |
| [Acceptance](<ACCEPTANCE.md>) | Traceability, skenario, perintah dan bukti yang belum tersedia |
| [Keputusan](<DECISIONS.md>) | Konflik, alternatif, blocker dan pilihan pemilik |

## Empat laporan sumber — tidak diubah

- [Audit Kawan](<audit-kawan.md>): bukti kode path/line, fondasi dan gap integrasi.
- [Riset engine](<riset-engine.md>): sepuluh kemampuan DSH/ZCode, SHA, lisensi dan sumber primer pinned.
- [Riset data/evaluasi](<riset-data-evaluasi.md>): tool schemas, parser limits, sandbox, dataset 60 kasus.
- [Riset output/UX](<riset-output-ux.md>): renderer/export, aksesibilitas, keamanan. Tautan source di laporan ini berakar repo; gunakan indeks lengkap di bawah untuk23 tautan source yang tidak dapat di-resolve langsung dari laporan immutable.

## Baseline dan otoritas

Branch `merge/main-into-feat-nt-p1`, HEAD `027e17d4ba9c8faaa75d749e0e30166f651a17f5`. Pada awal t5 hanya direktori state tim dan dokumen riset untracked; tracked diff kosong. Existing source/fitur/guard wajib dipertahankan. Saat coding kelak, ulangi pemeriksaan Git; jangan reset perubahan manusia atau menganggap baseline tetap.

[Scope aktif](<../../../tasks/ACTIVE-SCOPE.md>) tetap batas keamanan. [Paket agen lama](<../../../tasks/agent-v1/README.md>) menyediakan kontrak historis, bukan bukti status aktual. Pernyataan “task belum ada” dalam [STATUS lama](<../../../tasks/agent-v1/STATUS.md>) sudah bertentangan dengan schema/route aktual. Otorisasi push pada prompt historis tidak berlaku untuk tugas riset ini.

Kontrak integrasi pada paket ini menyelesaikan konflik laporan secara eksplisit di [DECISIONS](<DECISIONS.md>); belum mengganti scope pemilik tanpa persetujuan. Lima lapisan **metode riset** diusulkan, bukan disamakan dengan lima lapisan **otoritas prompt**.

## Kekuatan bukti

Inspeksi statis membuktikan kode ada; fixture membuktikan skenario fixture saja. Peneliti melaporkan 121 tes data/tools dan 7 tes renderer existing lulus; bukan tes fitur target, bukan browser/sandbox live. Tidak ada klaim full suite/build, model quality, produksi, migrasi dua provider atau audit keamanan independen lulus.

Search harness gagal HTTP 404; peneliti memakai direct fetch sumber resmi. Sumber engine dipatok SHA; sebagian dokumentasi vendor memakai branch/live page, sebagian bacaan panjang terpotong. Detail batas, lisensi MIT/Apache-2.0 dan URL primer berada di laporan sumber. Tidak menyalin kode upstream; reuse substansial kelak memerlukan notice dan review dependency transitif.

Tool `kuli_work` tidak tersedia; lifecycle pekerjaan dicatat AgentTeams t5, bukan work order Kuli fiktif. Antislop during sesuai pilihan pemilik via kapten; tidak ditemukan DESIGN.md. Tidak ada desain visual/asset baru; Delivery Gate visual belum dijalankan. Semua acceptance implementasi berstatus belum dijalankan atau blocked_external sampai bukti aktual dicatat.

## Keputusan berikutnya

Setujui atau revisi: irisan read-only dahulu; lima lapisan metode; budget awal; penyimpanan/retensi bukti privat; biaya canary BYOK; format ekspor prioritas. Setelah itu pilih satu WP, dengan otorisasi coding tersendiri. Tidak ada WP yang otomatis berjalan dari dokumen ini.

## Indeks navigasi bukti laporan output (REV-06)

Semua23 occurrence tautan lokal pada [laporan output/UX](<riset-output-ux.md>) dipetakan berikut; laporan tidak diubah. Nomor berurutan mengikuti occurrence asli, termasuk target berulang.

| No | Bukti / locator original |
|---|---|
| 1 | [renderer](<../../../src/components/markdown.tsx#L108-L150>) |
| 2 | [table/th/td](<../../../src/components/markdown.tsx#L132-L138>) |
| 3 | [MermaidDiagram](<../../../src/components/markdown.tsx#L26-L62>) |
| 4 | [CodeBlock/CopyButton](<../../../src/components/markdown.tsx#L64-L105>) |
| 5 | [exportChatMarkdown](<../../../src/lib/chat/transfer.ts#L79-L88>) |
| 6 | [menu ekspor](<../../../src/components/chat-sidebar.tsx#L357-L384>) |
| 7 | [kartu](<../../../src/components/chat-view.tsx#L937-L954>) |
| 8 | [lifecycle](<../../../src/lib/artifacts/create.ts#L86-L155>) |
| 9 | [route](<../../../src/app/api/kawan/v1/artifacts/[artifactId]/route.ts#L24-L43>) |
| 10 | [renderer biner](<../../../src/lib/artifacts/render-binary.ts#L1-L96>) |
| 11 | [dependencies](<../../../package.json#L20-L52>) |
| 12 | [exportChatPdfBytes](<../../../src/lib/chat/document-export.ts#L49-L113>) |
| 13 | [input/render](<../../../src/lib/artifacts/render.ts#L19-L58>) |
| 14 | [registry format/MIME](<../../../src/lib/artifacts/format.ts#L3-L26>) |
| 15 | [DocSchema](<../../../src/lib/artifacts/document.ts#L5-L39>) |
| 16 | [citation panel](<../../../src/components/chat-view.tsx#L1040-L1082>) |
| 17 | [SourceList](<../../../src/components/source-list.tsx#L8-L27>) |
| 18 | [fase terakhir](<../../../src/components/chat-view.tsx#L1018-L1035>) |
| 19 | [SSE](<../../../src/components/task-view.tsx#L92-L145>) |
| 20 | [Format](<../../../src/lib/artifacts/format.ts#L3-L6>) |
| 21 | [create](<../../../src/lib/artifacts/create.ts#L16-L18>) |
| 22 | [CSV→MD](<../../../src/lib/artifacts/convert.ts#L121-L124>) |
| 23 | [renderer](<../../../src/lib/artifacts/render.ts#L62-L92>) |

Respons tujuh finding serta tradeoff: [DECISIONS](<DECISIONS.md>). Acceptance runtime tetap not_run/blocked_external.

## Penyerahan final perencanaan

Review delta t9 **PASS dokumen**, REV-01–07 tertutup dalam [review](<REVIEW.md#L95-L118>). Finalisasi t7 tidak mengubah kontrak teknis yang direview. Enam deliverable final adalah README ini, [PRD](<PRD.md>), [SDD](<SDD.md>), [rencana implementasi](<IMPLEMENTATION-PLAN.md>), [acceptance](<ACCEPTANCE.md>) dan [keputusan](<DECISIONS.md>). “Final” berarti paket siap diputuskan pemilik, bukan scope coding disetujui atau produk selesai.

Urutan rekomendasi setelah izin coding: WP00 baseline/contract freeze; WP01–02 lifecycle/task pertama/replay; WP03–04 schema/ledger/budget; WP05 bounded web + consent egress dan WP06A–06B–06C parser/upload; WP07 numerik; WP08 loop; WP09–10 renderer/provenance/artefak; WP11 format terpilih; WP14 evaluasi read-only. Dependency DAG tetap otoritas; WP09 dapat dimulai sesudah WP03. WP12–13–15 sandbox/code merupakan jalur terpisah, tetap off sampai live gate. Upload end-to-end sampai aggregate diuji setelah WP07/08 tersedia, bukan diklaim selesai pada WP06B saja.

Keputusan tersisa O01–O07: metode lima lapisan, scope satu WP pertama, budget/model serta consent biaya, retensi/transfer privat, prioritas format/arah visual, template sandbox, otorisasi operator deployment. Detail wire validator dan jumlah split dataset per-family dibekukan WP00. Izin coding, paid live, push dan deployment tetap terpisah.

Batas bukti: inspeksi source dan fixture existing dari peneliti; review konsistensi dokumen, tautan, traceability dan DAG. Bukan tes target end-to-end, benchmark model, migrasi dua provider, browser/accessibility, isolation sandbox, backup/restore atau canary produksi. Laporan peneliti tidak diedit;23 tautan output menggunakan indeks di atas. Source/secret/migrasi/deploy tidak diubah.
