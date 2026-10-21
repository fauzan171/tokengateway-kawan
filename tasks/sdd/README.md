# SDD Kawan — Software Design Description

> Referensi historis. Untuk pekerjaan baru baca [scope aktif](../ACTIVE-SCOPE.md). Instruksi full-parity di bawah bukan scope default.

Status: design specification untuk implementasi, bukan laporan aplikasi yang sudah bekerja. Baseline Open WebUI `f8ae8a6c328946dc62cd0712961a0632574581bf`. SDD ini melengkapi [PRD](../prd.md), [plan](../plan.md), [schema contract](../schema-contract.md) dan [backlog](../todo.md); scope penuh tetap berlaku.

SDD di sini adalah Software Design Description sekaligus dasar kerja **spec-driven development**: kontrak diselesaikan sebelum coding, setiap perubahan traced ke requirement/task/test, dan spec diperbarui saat keputusan berubah.

Keputusan ini memerlukan SDD karena menyangkut persisted schema, public API, execution lifecycle dan batas layanan yang mahal diubah serta harus dipahami beberapa developer. Gunakan satu istilah dan ID phase yang sudah ada, bukan membuat roadmap pengganti.

## Cara membaca dan precedence

| Dokumen | Pertanyaan engineering yang dijawab |
|---|---|
| [01 Architecture](01-architecture.md) | Process boundaries, load assumptions, module ownership, internal interfaces, dependency direction |
| [02 Data design](02-data-design.md) | Core schema, extension fields, constraints, codecs, transactions, retention |
| [03 HTTP contracts](03-http-contracts.md) | Route namespaces, payloads, validation, errors, auth, idempotency, pagination |
| [04 Chat execution](04-chat-execution.md) | Tree mutation, durable run states, streaming, cancellation, reconnect, Direct/MCP bridge |
| [05 Security and identity](05-security-and-identity.md) | Auth.js credentials/MFA/OAuth, ACL, encryption, SSRF, sandbox, trust boundaries |
| [06 Frontend and UX](06-frontend-and-ux.md) | Routes, component responsibilities, screen states, settings, responsive/accessibility |
| [07 Domain services](07-domain-services.md) | Files/RAG/workspaces/search/audio/images/collaboration/calendar/automation/evaluations |
| [08 Integrations and workers](08-integrations-and-workers.md) | Provider/adapters/plugin contracts, tools, worker execution and external transports |
| [09 Operations and quality](09-operations-and-quality.md) | Deploy profiles, environment, observability, backups, rollback, test/CI/release gates |
| [10 Delivery work orders](10-delivery-work-orders.md) | Developer work-unit format, first implementation slices, dependency handover and evidence |
| [11 ADRs](11-architecture-decisions.md) | Decisions, credible alternatives, consequences and conditions for revisiting |
| [12 Reference bindings](12-reference-bindings.md) | Normative binding of baseline routes/tables/settings/adapters to engineering contracts |
| [Contract registry](contract-registry.json) | Machine-readable task/requirement/SDD/reference/acceptance traceability |
| [Kawan API JSON Schema](kawan-api-contracts.json) · [synthetic examples](api-examples.json) | 59 typed request/response/event definitions untuk extension Kawan; baseline wire contract terpisah |
| [Engineering readiness](engineering-readiness.md) | Concrete design checks, unresolved baseline facts, stage gates and ownership |

Latest owner instructions → PRD scope/product exceptions → baseline behavior evidence → schema/API contracts → SDD implementation decisions → work orders. Jika terdapat konflik, tulis conflict record dan perbaiki kontrak sebelum coding. Jangan diam-diam memilih dokumen yang lebih mudah.

Istilah **wajib** berarti release obligation. **Default usulan** berarti pilihan engineering Kawan yang boleh diganti dengan evidence/ADR tanpa menghapus fitur. **Reference-bound** berarti nilai exact harus didapat dari baseline runtime/source semantic review; static descriptors tidak dianggap hasil pengujian. Semua tiga kategori terlihat dalam registry.

## Problem dan requirements

Bangun ulang full-feature interface AI dengan 43 core ORM entities/396 declared fields, 581 API declarations, 421 config keys, 67 Settings surfaces, 64 locales dan seluruh domain P00–P24. Kawan menambah personal BYOK encrypted/direct connection dan usage monitoring, memakai Next 15/TypeScript/Tailwind 4/shadcn/AI SDK v5/Prisma/Auth.js. Kode/aset/translation/migrations dibuat sendiri.

- R-CORE: seluruh domain, native provider behaviors, admin/role/feature flags tetap bisa digunakan; enabled profile wajib diuji.
- R-DATA: core names/types/JSON/timestamp/relations dan data round-trip kompatibel; extension berbeda ditandai.
- R-RUN: generation/indexing/scheduler/realtime tahan reconnect/restart dan punya cancel/ownership/idempotency semantics yang jelas.
- R-SECRET: saved provider credentials encrypted/masked; Direct key tetap browser-local; no secret in shares/logs/queues/export.
- R-UX: baseline navigation/actions/states termasuk mobile/dark/RTL/shortcuts dipertahankan dengan branding Kawan.
- R-HOST: operator dapat clean install, upgrade, backup/restore, menjalankan engines dan workers yang dikonfigurasi.
- R-PROOF: setiap reference obligation mempunyai owner, resolved contract, test dan evidence. Build hijau saja tidak membuktikan parity.

## Recommendation

Pakai **modular monolith Next.js + process pendukung terisolasi**, satu authoritative relational DB, durable DB jobs/outbox/event log, Redis untuk fan-out/cache, Node generation/processing coordinator, realtime gateway dan Python-compatible plugin worker. Service boundaries mengikuti execution/trust/resource differences; domain CRUD tetap di aplikasi, bukan microservice per fitur. [Architecture](01-architecture.md) dan [ADRs](11-architecture-decisions.md) menetapkan kontrak detail.

Pilihan ini memenuhi R-DATA/R-RUN/R-SECRET sambil mempertahankan stack utama. Revisit bila P00 membuktikan workload hanya single-process tanpa jobs/plugins/realtime, atau deployed service constraints menuntut managed replacement yang lolos kontrak sama. Full parity saat ini membutuhkan jalur execution tersebut.

## Alternatives dan trade-offs

| Alternatif | Best case | Dampak untuk target Kawan |
|---|---|---|
| Satu Next process, request-bound background tasks | Self-host personal sederhana, sedikit operasi | Bagus untuk preview kecil; process termination dan Python/WS workloads memerlukan boundary tambahan agar R-RUN/R-CORE terpenuhi |
| Modular monolith + durable workers/realtime | Shared transactions/contracts; heavy/untrusted workload dipisah | Pilihan utama; lebih banyak process dibanding MVP, tetapi lebih sedikit distributed ownership dibanding microservices |
| Microservice setiap domain + message bus | Independent scale/deploy untuk tim besar | Berguna setelah domain ownership stabil; saat rewrite awal meningkatkan data/ACL/event coordination tanpa requirement tim/scale yang terkonfirmasi |

## Non-goals desain ini

Dokumen ini tidak mengimplementasikan aplikasi, mengoperasikan gateway milik user, menambahkan token billing, mengikuti upstream `main` otomatis, atau menyalin aplikasi/aset referensi. Multi-region active-active tidak menjadi default deployment karena belum diminta. Ini tidak menghapus fitur baseline; semua engines tetap punya enabled test profiles.

## Assumptions, risks dan open decisions

Scale/budget numbers di architecture adalah asumsi sizing, bukan traffic bisnis terkonfirmasi. Repo public Kawan/license/deployment location dan external test credentials belum diberikan; operator mengisinya sebelum release, tanpa fabricated links/keys. Exact status/payload/default/legacy timestamp units masih reference-bound sampai semantic audit P00/P01 selesai. [Engineering readiness](engineering-readiness.md) menetapkan resolver dan gate untuk setiap jenis uncertainty.

Risiko yang dapat menggagalkan rewrite: chat JSON/projection diverge, worker recovery menggandakan inference, controls terlihat lengkap tetapi adapter sebenarnya tidak dipakai. Tanda awalnya masing-masing reconciliation mismatch, repeated run/provider request IDs, dan config-effect tests gagal. Mitigasi: transactional tree writes, fenced leases/indeterminate state, dan adapter-specific conformance gate. Seluruh risiko/early warnings dijabarkan pada architecture/operations.

## Rollout dan rollback

P00 mengunci evidence/contracts/toolchain; P01 mengunci physical data design; vertical slices auth/BYOK/chat menyusul. M1–M5 mengikuti [plan](../plan.md). Preview hanya mengiklankan fitur yang verified; registry full scope tetap open. Release full parity menunggu semua phase gates, dynamic unknown closure dan exception report.

Migrations dibuat expand → backfill → verify → switch readers/writers; destructive contract dilakukan setelah backup/retention dan review release konkret. Rollback app hanya ke version yang schema-compatible; restore DB/file/vector/encryption keys sebagai satu recovery set bila format incompatible. Deployment/publication tetap penugasan terpisah setelah review hasil.

## Workflow spec-driven development untuk tim

1. **Specify:** pilih stable module/phase, baca requirement dan source ID, resolve baseline input/output/state/permission/default/profile melalui evidence; tulis declared Kawan delta.
2. **Design:** tetapkan DTO/ports/data invariants/transaction/recovery dari SDD; expensive cross-boundary change memakai ADR, tanpa abstraction tambahan yang tidak diperlukan.
3. **Plan dan tasks:** ambil parent brief, pecah child operasi/engine/UI path, cek dependencies/Definition of Ready dan precise acceptance/fixture/test filter.
4. **Implement:** hanya assigned ready child, end-to-end behavior nyata; meaningful tests dan config-effect assertions, bukan UI-only mock.
5. **Verify dan review:** focused checks + build/worker checks, golden diff/profile/schema/security evidence; mandor mengulas hasil final dan deltas, baru update registry/parent gate.
6. **Maintain spec:** keputusan atau source drift memperbarui requirement/contract/ADR/fixtures sebelum merge; old evidence tidak otomatis berlaku untuk profile/commit baru.

Owner tetap meninjau concrete scope/design changes dan final publish yang terpisah. Ordinary reversible work dalam assignment berjalan terus tanpa meminta ulang izin. Semua artifact stages/status jelas: design specified ≠ runtime resolved ≠ implemented ≠ verified.
