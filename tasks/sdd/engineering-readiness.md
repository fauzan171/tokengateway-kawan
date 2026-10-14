# Engineering readiness — design, contracts dan implementation gates

Status: SDD specification lengkap per domain untuk handoff, seluruh implementation statuses belum dimulai. Completeness desain tidak sama dengan runtime parity yang sudah dibuktikan. [Registry](contract-registry.json) memetakan 224 work packages ke SDD/requirements/reference IDs/minimum cases.

Registry membedakan owned verification IDs dan related candidate source/context IDs. Mapping awal coverage sering menaruh verification ownership pada phase closure task; implementer tetap mendapat phase/source context untuk membaca kontrak. Child semantic audit mempersempit exact operation-to-source links dengan evidence; seluruh daftar context tidak dianggap satu task kecil atau completed review.

## Paket engineering tersedia

Architecture/load assumptions/module ports; core/extension data fields/invariants/transactions/codecs; Kawan HTTP DTO/errors/revision/idempotency; tree transforms/durable run states/stream replay/Direct tool bridge; Auth.js JWT/MFA/OAuth/ACL/vault/SSRF/sandbox; frontend routes/state/components/screens/Settings/locale/accessibility; seluruh domain execution; worker/adapters/plugin protocol; deployment/config/backup/rollback/CI/tests; ADR alternatives; work-order briefs dan concrete starting child slices.

12 numbered SDD chapters + master index/readiness, 10 ADRs, 25 phase brief files untuk 224 tasks, 36 starter child slices, 508 adapter signature seeds dan 135 selected engine/provider dispatch review rows. Metadata review seeds tidak dianggap 508 endpoints/135 fitur user; masing-masing menjelaskan tempat kontrak perlu diselesaikan.

Formal [JSON Schema](kawan-api-contracts.json) memuat 59 typed definitions, termasuk type-specific payloads seluruh 22 Kawan event types, dan [8 synthetic examples](api-examples.json). Schema tool/provider dynamic values dipotong oleh discovery/config schemas dan domain authorization; tidak menganggap generic object sebagai izin execute.

## Design decisions yang sudah konkret

| Contract | Design decision | Owner |
|---|---|---|
| Source baseline | Commit `f8ae8a6c328946dc62cd0712961a0632574581bf`; drift requires ledger/inventory diff | P00 |
| Framework boundaries | Next Node web/API; long-lived generation/realtime/isolated workers; SQL source of truth | P00/P05/P24 |
| Credential sessions | Auth.js JWT; User/Auth managed domain persistence; stamp/status/grants revalidation | P02 |
| Core schema | All 43 entities/396 fields + migrated-only objects; dual provider mappings/own migrations | P01 |
| Extension state | Explicit credential/revision/run/attempt/usage/job/event/outbox/approval/CRDT/schedule schemas | P01 |
| Public namespaces | Auth.js, baseline facade and `/api/kawan/v1` separated; shared domain services | P00/P24 |
| Concurrency | Resource CAS, unique request digest, fenced job leases, persisted event sequence | P04/P05 |
| External outcome | Known recoverable failures vs indeterminate; no unconditional inference side-effect retry | P05/P12/P20 |
| Tree behavior | In-place/branch/copy/continue/delete-reparent distinct; JSON/projection transaction | P06 |
| Credentials | AES-GCM/AAD/versioned rotation; Direct localStorage key never server-synced | P04 |
| SDK role | v5 execution/UI adapter; canonical domain events/tree independent; native codecs when required | P04/P05 |
| Execution trust | Python-compatible plugins isolated; scoped callback/file/secret capability contracts | P12/P21 |
| Realtime notes | Compatible CRDT protocol + persisted updates/checkpoints and note projection | P18 |
| Adapter completion | Fixture + real configured smoke; selected-engine effect; unavailable credential not verified | All integration phases |
| Release claim | All-category proof and visible exceptions; no app/100% parity claim from planning checks | P24 |

## Reference-bound facts — explicit closure ownership

These are implementation intake tasks, not empty design placeholders. Owner must capture named evidence before relevant slice coding/acceptance; registry status remains `review_required` meanwhile.

| Item | Resolver/method | Gate and required artifact |
|---|---|---|
| Baseline mounted methods, wildcard routes, inherited forms/validators/status/cookies/headers | P00-01/P00-02 + endpoint owner; isolated OpenAPI/runtime/wire fixtures | Exact per-ID contract record before compatible handler accepted |
| Live SQLite/Postgres DDL, migration-only indexes/actions/defaults | P01-01; independent fresh migrated DB introspection | Physical schema report/fixtures before own migration accepted |
| Field timestamp units/large integer serialization | P01-01/P01-06 + entity owner; producer/consumer/import trace | Codec registry + lossless fixtures; no numeric guesses |
| Root packaging/container/scripts/static runtime and dependency metadata not initial fingerprints | P00-01.b; full tracked-file classification/runtime dependency audit | Expanded manifest/coverage ledger before denominator lock |
| Configuration type/evaluated defaults/env-persist precedence/effects | ConfigRegistry foundation + each domain + P23 closure | Every key/control typed spec/change/restart/effect fixture |
| Dynamic provider/engine/auth/function dispatch beyond static seeds | Adapter/source owner uses runtime branch catalogue and source/runtime audit | Complete operation/protocol/profile inventory before adapter verified |
| Tree root deletion/current-leaf/copied metadata/continue edge behavior | P00/P06-01 children; source-reviewed transforms + differential goldens | Expected trees/events for each action including negative/race case |
| Plugin signatures/reserved hook params/callbacks/dependency capabilities | P12; own fixture plugins + baseline isolated invocation | Compatible executor protocol and sandbox callback matrix |
| OAuth/LDAP/SCIM/MFA/session/bearer exact profile contracts | P02/P03; identity fixtures/security profile review | Session/link/revoke/MFA/API token interoperability evidence |
| Note binary CRDT/state serialization/audio WS/terminal native transport details | P15/P18/P21 protocol owner; wire/byte-state captures | Codec/version/reconnect/error/grant contract fixtures |
| UI tokens/density/control visibility/keyboard/date/RTL/profile states | P00/P07/P08 per screen; synthetic screenshots/interactions | Geometry/theme/action-state goldens with brand exclusions |
| Arena formulas/evaluation metric display/provider usage details | P22; source formulas + deterministic datasets | Numeric expected results/provenance and privacy fixtures |

## Owner release configuration — does not block writing SDD

| Decision | Current recommendation | Resolution before release |
|---|---|---|
| Repository/license | Original Kawan repository and explicit license; source/assets independent | Owner supplies real public repo/license; metadata no fabricated link |
| Hosting/domain | Container production-full/Postgres profile default | Owner chooses vendor/secret distribution/domain; release review concrete |
| Traffic/SLO/retention budgets | Sizing/default proposals in SDD-01/09 | Operator validates benchmark/restore/cost and records approved profile |
| External test services/credentials | Synthetic fixtures first; dedicated sandbox engines/accounts smoke | Operator supplies configured tests; never user production key by assumption |
| Dependency exact patches | Preserve requested majors, choose official compatible/security-patched releases in P00 | Lockfile/SBOM/runtime matrix before scaffold acceptance |

No repeated permission requirement for routine reversible tasks already assigned. Decisions that change product scope/security/public persisted contract need spec change + owner review; deployment/publish outside planning remains separate instruction.

## Definition of Ready for a child

- Parent/requirement/reference/module/SDD links known; same baseline/profile.
- Input/output/errors/state transitions/auth/side effects/recovery/config defaults resolved for this child.
- Blocking schema/ports/DTOs available; developer does not guess a missing framework/provider behavior.
- Child focuses one operation/engine/UI path and can fit a focused session, ≤5 core files as sizing guide.
- Acceptance has concrete fixture input/expected/assertion; exact test filter and build/worker gates available.
- Intended Kawan difference has ledger entry; no silent simplified semantics.

## Definition of Done and mandor acceptance

Real production slice works end-to-end, positive/negative/revoke/error/cancel/recovery paths relevant to operation proved, profile/schema/secret provenance correct, focused tests/build pass, sanitized evidence linked, no mock/inert control. Child done does not mark parent done until all children/reference/adapter obligations completed. All phase gates and P24 final closure remain mandatory.

## Review status of this SDD

Static design consistency checks are written to [SDD verification](sdd-verification.md). No application build/runtime/DB/provider tests run during planning. Baseline semantic unknowns explicit above; first engineer assignment P00 resolves intake contracts and prepares tooling before implementing assigned slices. Full parity claim stays conditional on real evidence.
