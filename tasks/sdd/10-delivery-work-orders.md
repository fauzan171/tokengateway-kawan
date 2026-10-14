# SDD-10 — Developer execution, work orders dan Definition of Ready

Owner mandor/integrator dan setiap task owner. Active [224 work packages](../todo.md) tetap source backlog; SDD memberi engineering contract dan child breakdown tanpa mencentang implementasi.

## Readiness levels

| Level | Meaning | Boleh melakukan |
|---|---|---|
| Design specified | PRD/SDD interfaces/state/risks/acceptance tersedia | Baseline semantic audit, fixture/toolchain preparation |
| Contract resolved | Per-task runtime/default/schema/profile facts mempunyai evidence | Child implementation design final, scoped coding assignment |
| Implementation ready | Dependency interfaces pass; child ≤5 core files/focused session; exact tests/fixture/assertions defined | Implement assigned child and verify |
| Implemented | Production behavior exists, no inert/mock path | Gate tests/review/evidence |
| Verified | Baseline/profile conformance + own tests/build/evidence pass | Mark owned obligation done; parent only when all children verified |

SDD selesai sebagai desain tidak membuat semua external contracts otomatis resolved. Pada repository sekarang tidak ada app/packages/runner; `npm run build` belum bisa dijalankan. First assignment P00 seperti [prompt](../execution-prompt.md), bukan seluruh 224 packages sekaligus.

## Work order wajib

Setiap parent mempunyai [task brief](work-orders/README.md) per phase dan machine mapping [registry](contract-registry.json). Saat menugaskan coding, kirim child yang terfokus; source reference IDs tetap diwariskan dari parent. Developer mencari file tree terkini melalui module/contracts, tidak mengikuti line number lama sebagai kebenaran.

```text
Child ID / parent task / module:
Category: feature | contract-review | migration | integration | verification
Current behavior: status nyata branch sekarang, bukan status yang diharapkan.
Desired behavior: satu alur konkret + failure behavior.
Key interfaces: typed DTO/port/event/schema/config yang berubah.
Inputs / expected outputs / side effects / rollback:
Blocking task/contracts:
Acceptance: 2–4 independently verifiable assertions dengan fixtures.
Verification: exact focused command/filter + build checkpoint.
Scope: ≤5 core files; migrations/shared registry changes dikoordinasikan integrator.
Out of scope for child: adjacent operations tetap mandatory pada parent lain.
Evidence: source IDs, baseline/profile, sanitized test output/diff/screenshots.
```

Jika package mencakup multiple engines/CRUD flows/MFA methods/admin controls, pecah per engine/operation/state edge; jangan menyebutnya “medium” hanya karena satu bullet. Penambahan child ke registry mempertahankan parent obligation dan scope; tidak menghapus unsupported integration supaya done.

## First implementation slices — concrete breakdown

Semua rows belum dikerjakan. Dependency parent adalah constraint minimum; listed child dependencies tambahan. Per domain default test filters adalah target scaffold command, belum installed tests.

| Child | Parent | Hasil dan precise acceptance | Depends on | Evidence / focused verification |
|---|---|---|---|---|
| P00-01.a | P00-01 | Baseline pin/clean-tree/source hashes; drift report ditulis tanpa mengubah reference | — | Inventory IDs/count/hash validation |
| P00-01.b | P00-01 | Register root packaging/scripts/static runtime metadata yang belum tercakup; source bodies/assets tidak disalin | a | Manifest diff + owned review rows |
| P00-01.c | P00-01 | Expand methods/mounts/schema inheritance untuk auth/models/chat/file starter contracts; dynamic branches owned | a | Contract fields/status/validators evidence |
| P00-02.a | P00-02 | Synthetic A/B/admin/pending/groups/provider dataset reset reproducible; no real keys/data | P00-01 | Fixture seed/reset counts |
| P00-02.b | P00-02 | Capture first auth/BYOK/models/chat/tree HTTP/WS goldens and role failures on isolated baseline | P00-02.a | Sanitized wire snapshots + oracle config |
| P00-03.a | P00-03 | Official dependency compatibility/security matrix and exact lockfile; stack majors respected | P00-01 | Runtime/version/lockfile manifest |
| P00-03.b | P00-03 | Minimal Next shell compiles with TS/Tailwind/shadcn and command scripts; no fake production inference | P00-03.a | typecheck/lint/build exit 0 |
| P00-05.a | P00-05 | Fixture gateway models + Unicode/SSE/401/429/disconnect profiles; deterministic abort/call counters | P00-03 | Protocol fixture tests |
| P00-05.b | P00-05 | SQLite/Postgres integration test profiles and isolated migration reset | P00-03 | Both-provider bootstrap smoke |
| P00-06.a | P00-06 | Registry ID→requirement→parent/child→fixture/evidence links; no dangling owner/cycle | P00-01 | verify:contracts report |
| P01-01.a | P01-01 | Fresh baseline SQLite introspection exports tables/columns/keys/indexes/defaults without copying migration code | P00 | Physical schema evidence |
| P01-01.b | P01-01 | Same Postgres contract and ORM-vs-live differences classified | P01-01.a | Postgres schema diff |
| P01-01.c | P01-01 | Lossless BigInt/ns/JSONField/native JSON codecs fixture; no Number rounding | P01-01.b | Codec/property round trips |
| P01-02.a | P01-02 | User/Auth mapped independently; same linked ID/status/stamp fields; first identity fixtures round-trip | P01-01 | Schema + repository integration |
| P01-03.a | P01-03 | Chat JSON/ChatMessage/File link fields map all source columns; active leaf projection transaction rollback | P01-02 | Both-provider atomicity fixture |
| P01-07.a | P01-07 | Connection/vault/revision core extensions and active-selection constraint; no credentials returned | P01-06 | DDL/race/secret canary tests |
| P01-07.b | P01-07 | Group/run/job/attempt/event/usage/outbox extension keys/indexes; pending execution state durable | P01-07.a | Constraint/CAS/recovery fixture |
| P02-01.a | P02-01 | Register validates/hash User/Auth and atomic first-admin; concurrent signup cannot create duplicate bootstrap authority | P01 | Positive/negative/race auth fixture |
| P02-01.b | P02-01 | Credential login checks active/pending/password, issues JWT cookie only on allowed complete auth | P02-01.a | Browser/API login states |
| P02-02.a | P02-02 | Session stamp revoke invalidates request/socket/job actor; JWT role not permanent authority | P02-01 | Stale-session permission suite |
| P03-01.a | P03-01 | ACL read/write owner/admin/group/public evaluator + null/empty semantics resolved | P02 | Role/resource matrix |
| P03-01.b | P03-01 | Same ACL decisions apply model/chat/file/tool route entries; no foreign ID authority from body | P03-01.a | Cross-user API negative suite |
| P04-01.a | P04-01 | AES-GCM 32-byte key/nonce/tag/AAD/envelope/mask/rotation helper; wrong owner/ciphertext fails | P03 | Crypto known-roundtrip/context misuse tests |
| P04-01.b | P04-01 | Server connection create/read/replace/remove + Direct metadata reject raw key; mode transition lossless/revisioned | P04-01.a | HTTP/DB/log canary |
| P04-01.c | P04-01 | Atomic activate/delete selection; A/B isolated; concurrent activate leaves one active | P04-01.b | SQLite/Postgres race tests |
| P04-01.d | P04-01 | Model Test normalized URL reaches `/models` once; safe 401/empty/timeout/CORS modes; no saved key response | P04-01.b | Gateway fixture call URL/result counts |
| P04-07.a | P04-07 | Onboarding form/branding/CTA/server-Direct explanation/test/save/error states with real services | P04-01.d/P04-05 | E2E connections + screenshots |
| P05-01.a | P05-01 | Start group same-key replay/digest 409/chat revision/placeholder/job write atomic | P04 | HTTP+SQL start race suite |
| P05-01.b | P05-01 | Worker job claim lease heartbeat/fencing; stale worker cannot checkpoint/finalize | P05-01.a | Kill/reclaim/fencing fixture |
| P05-02.a | P05-02 | Provider attempt sent checkpoint/native normalization and typed parts/usage; unknown outcome not auto-retried | P05-01.b | Wire/request count + failure injection |
| P05-03.a | P05-03 | UTF-8/SSE batched durable events; replay+live high-watermark overlap dedup; client reducer correct | P05-02.a | Cursor/Unicode/disconnect suite |
| P05-04.a | P05-04 | Stop queued/streaming/approval states; terminal race and partial output settled truthfully | P05-03.a | Cancel/finalize/worker restart suite |
| P06-01.a | P06-01 | Canonical tree invariants/ancestry import validation; cycles/dangling/foreign chat rejected | P05 | Property/integration tree fixtures |
| P06-01.b | P06-01 | User edit submit creates sibling; in-place save retains ID; both preserve correct fields/files/leaf | P06-01.a | Golden transform+E2E branch tests |
| P06-01.c | P06-01 | Assistant copy/in-place regenerate/continue each use correct node/model slot/feedback/output rules | P06-01.b | Golden per-action expected tree |
| P06-01.d | P06-01 | Delete-message removes node+immediate children, reparents grandchildren; root/current-leaf rules explicit | P06-01.a | Baseline differential deletion cases |

These are 36 starting child slices. They are a detailed starting work breakdown, not claim all 224 packages have already been decomposed into session-sized coding tasks. Each remaining package carries a module-specific brief; semantic audit creates operation/engine/control children through the same contract. Public release still requires all parent obligations, not merely these starter slices.

## Development workflow dan code style

TypeScript strict, runtime input validation, discriminated errors, no `any`/casts for sensitive identity/provider data, no secret in client props. Controller small; domain service owns transitions/ACL/transactions; adapter owns wire mapping; components own presentation. Named helpers when shared contract is real, avoid wrapper abstraction for single call. Migrations serialized by integrator; tests fixtures meaningful, no implementation-mirroring smoke-only tests.

Illustrative **original** service behavior, not implementation code to paste:

```typescript
type ActivateResult =
  | { ok: true; connectionId: string; revision: string }
  | { ok: false; code: 'NOT_FOUND' | 'STALE_REVISION' | 'UNAVAILABLE' };
// Handler validates request and Actor; service checks authorized row/revision.
// Repository transaction changes active selection and enqueues invalidation event.
// DTO mapper returns only masked ConnectionView, never credential-bearing row.
```

Every change follows resolve contract → focused fixture assertion → implement vertical slice → targeted checks/build → evidence and brief rewritten to actual final behavior. Routine reversible design choices proceed inside assignment. Ask owner only for genuinely changed scope/public contract or concrete publish/destructive operation outside assignment, after reviewable result ready.

## Mandor handover and review

Submission includes task/child IDs, reference IDs, module/SDD/ADR affected, before-after behavior, exact baseline/profile, file highlights, commands/exit/results, sanitized DB/network/event/UI evidence, declared deltas, open failures and next ready child. Code review checks invariant boundaries and real error/recovery states, not only screenshot beauty.

Update parent checkbox/registry only after all children+adapter/profile evidence done. Review conflicts known from scope/SDD before merge; no test deletion/fixture normalization to hide deviations. Keep abandoned approach history only when explaining an accepted trade-off; final brief/PR description describes final implementation clearly.
