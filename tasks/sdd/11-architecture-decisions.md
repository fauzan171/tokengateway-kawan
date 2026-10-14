# SDD-11 — Architecture Decision Records

Date: 2026-10-13. Semua ADR **proposed** sebagai recommendation planning; status bukan approval deployment atau hasil runtime. Scope/stack/branding berasal instruksi owner; design choices dapat diratifikasi saat P00 contract review. Setiap ADR memenuhi expensive-to-reverse + cross-boundary + rationale perlu dipertahankan.

## ADR-001 — Gunakan modular monolith dengan isolated execution services

Status: proposed. Context: full P00–P24 membutuhkan relational transactions, long-running generation/WS/CRDT dan Python/GPU/untrusted plugins. Traffic belum terkonfirmasi; sizing assumption 200 active runs ada di SDD-01.

Decision: domain CRUD/access/config tetap Next modular monolith; SQL shared authority; generation/realtime/processing/plugin services dipisah berdasarkan trust/execution/resource needs. Tidak membuat service setiap core table.

**Alternatives considered:**

- Single process sangat sederhana untuk personal preview tetapi tidak mempertahankan durable jobs setelah terminate dan tidak mengisolasi plugins
- Domain microservices cocok independent deploy tim besar tetapi menambah distributed transaction/ACL coordination pada rewrite awal.

Consequences: shared contracts/transactions sederhana, service ops lebih kompleks dari MVP. Early warning boundary salah: domain menyimpan salinan auth/grants sendiri atau memanggil cycle antar services. Mitigasi domain ports/shared typed contract, one authority. Revisit bila measured workload/deployment restrictions memerlukan managed execution yang proven conformance.

Non-goals: multi-region active-active dan microservices sebagai default.

## ADR-002 — Preserve core physical schema, pisahkan Kawan extensions

Status: proposed. Context: 43 entities/396 fields + migration-only objects/API payloads/history/identity perlu kompatibel; stack Prisma dua provider.

Decision: use mapped core tables with lossless codecs and independently written SQL migrations; `kw_*` extensions for credentials/runs/revisions/usage/jobs/CRDT, no reduced 13-entity redesign.

**Alternatives considered:**

- Normalized Kawan-only schema memberi greenfield ergonomics tetapi data/drop-in contracts perlu importer besar dan kehilangan exact core target
- JSON universal storage cepat prototype tetapi constraints/query/history/control effects sulit dibuktikan.

Consequences: raw SQL/unsupported mapping mungkin diperlukan, duplicate tree projection maintained transactionally. Early warning: ORM schema same names tetapi live DB constraints/types differ. Mitigation migrated DB introspection + both-provider round trip. Revisit hanya bila owner sengaja mengubah physical compatibility scope, bukan karena ORM inconvenient.

Non-goals: mengklaim binary-identical DB atau menyalin reference migration source.

## ADR-003 — Auth.js JWT session dengan domain-managed identity persistence

Status: proposed. Context: credentials login + core User/Auth + MFA/OAuth/session stamp; provider credentials bukan application credentials.

Decision: JWT cookie session strategy, Kawan IdentityService manages User/Auth/password/MFA; server guards reload active/stamp/role. OAuth identity links stored mapped core-safe projection + protected extension.

**Alternatives considered:**

- Auth.js standard DB-session adapter ergonomic OAuth/session revocation tetapi tidak langsung memenuhi Credentials JWT requirement/core mapping
- Entirely custom auth maximum token wire control tetapi menambah security implementation tanpa kebutuhan mengganti Auth.js.

Consequences: domain registration/session stamp checks must actually implemented; adapter cannot auto-supply password lifecycle. Early warning stale JWT role masih memberi akses setelah revoke. Mitigation server/access/socket/job revalidation and negative fixtures. Revisit bila pinned Auth.js provider requirements berubah dengan verified supported strategy.

Non-goals: Auth.js cookies dianggap identik native Open WebUI bearer token tanpa dedicated compatibility fixtures.

## ADR-004 — Durable SQL jobs, transactional outbox dan replayable events

Status: proposed. Context: request-bound jobs hilang saat shutdown; API/worker/frontend harus melihat consistent run/tree/usage state.

Decision: SQL authoritative job/state/event/outbox; fenced leases/CAS, Redis fan-out/cache, replay cursors and terminal content persisted before delivery.

**Alternatives considered:**

- In-memory tasks ideal single-user demo tetapi tidak tahan restart
- Redis queue as authority memiliki mature throughput tetapi atomic core mutation/queue publish memerlukan outbox dan recovery reconciliation tetap. Managed durable workflow alternatif baik jika namespace/schema/cancel/idempotency interoperable.

Consequences: DB writes/retention/checkpoint load bertambah; batching dan replay budgets diukur. Early warning checkpoint/outbox lag atau duplicate execution spans meningkat. Mitigation batching, leases, outbox dispatcher, attempt-aware recovery; indeterminate third-party outcome explicit. Revisit bila SQL sustained workload proven bottleneck dan managed replacement pass same contract.

Non-goals: unconditional exactly-once external LLM/tool/network side effects.

## ADR-005 — Tree JSON authoritative bersama transactional projection

Status: proposed. Context: baseline tree supports inplace/branch/copy/regenerate/continue and specific delete-reparent transform; core ChatMessage projection/search/timing also present.

Decision: one ChatService mutation transformer updates preserved Chat.chat JSON/current leaf, materialized messages/file links/revision atomically; active UI list derived ancestry only.

**Alternatives considered:**

- Simple message array easiest UI but cannot preserve branches
- Adjacency-only normalized rows good relational querying but requires reconstructing full baseline lossless JSON/metadata and may lose import/export semantics.

Consequences: more write coordination/reconciliation and explicit transform tests. Early warning canonical JSON/projection/current leaf differ. Mitigation transactional writes + property/golden fixture checks. Revisit only if baseline core contract changes or complete tested lossless codec allows representation switch while preserving required persisted shape.

Non-goals: delete all descendants as shortcut for baseline delete-message behavior.

## ADR-006 — AI SDK v5 is execution/UI adapter, bukan canonical storage protocol

Status: proposed. Context: v5 UIMessage/transport and core SDK support chat; native Ollama/OpenAI/provider/plugins require fields/protocol not always generic SDK.

Decision: canonical domain tree/events independent; use v5 core when lossless supported, explicit native adapters otherwise; custom client transport maps typed durable events to active-branch UI parts.

**Alternatives considered:**

- Store UIMessage[] directly simplest SDK demo but loses tree/native payload contracts
- Full custom inference/UI code offers total control but discards supported stack SDK capabilities and duplicates common parsing unnecessarily.

Consequences: codecs/protocol conformance maintained; API/SDK updates do not silently migrate DB format. Early warning unknown provider fields discarded or wrong UI stream header. Mitigation native golden fixtures + negotiated transport headers. Revisit if SDK covers all required native protocols demonstrably.

Non-goals: generic OpenAI payload replacing all native endpoints.

## ADR-007 — Server credentials encrypted; Direct credentials device-local

Status: proposed. Context: original detailed BYOK requirement explicitly encrypted server persistence and optional Direct, now Direct mandatory full parity.

Decision: server default AES-256-GCM/AAD/keyring/masked responses; Direct key localStorage client namespace with no server sync/fallback. Server tool bridge takes only bounded authorized tool calls/results.

**Alternatives considered:**

- All-browser-only strongest server key locality/simple transport but cannot server background native jobs on that key and CORS may fail
- Server plaintext easier integration/debug but conflicts explicit encrypted/masked security.

Consequences: key rotation/import/export/mode switches and device re-entry need UX; Direct cannot background-resume after browser exits. Early warning raw key in synced settings/log/queue or Direct request hitting Kawan proxy. Mitigation scoped vault/client module separation/canary network tests. Revisit storage mechanism only with owner-approved privacy requirement and migration design.

Non-goals: claiming default server mode never stores/receives/transports key.

## ADR-008 — Execute Python-compatible plugins in isolated worker

Status: proposed. Context: full function/pipe/filter/action/tool/valves contract spans Python runtime and callback hooks; web stack remains Next/TS.

Decision: independently written loader/executor supports baseline plugin signatures, dependency/runtime isolation and typed callback RPC; web domain services enforce grants/secret/file access.

**Alternatives considered:**

- Rewrite all plugins to JavaScript simplifies Node operations but breaks Python ecosystem/user plugin compatibility
- Run Python in web host process easiest prototype but broad untrusted trust/resource boundary unsuitable multi-user target.

Consequences: runtime/dependency build/sandbox operations required, unknown outcome and callbacks must be durable/scoped. Early warning plugin can read unrelated secret/path or mutate shared dependencies. Mitigation container/OS scopes/content-hash env/capability handles and probe fixtures. Revisit isolation backend with demonstrated equivalent contract, not by deleting plugin feature.

Non-goals: arbitrary user command becoming privileged host execution.

## ADR-009 — Compatibility facade and Kawan routes share domain services

Status: proposed. Context: 581 declarations/native mounts differ typical REST cleanup; product overlay/auth framework add routes.

Decision: preserve baseline path/method/payload/status/native stream contracts at registered facade; Kawan extension `/api/kawan/v1`, Auth.js `/api/auth`; all route controllers use canonical services/ACL/data.

**Alternatives considered:**

- Redesign all routes RESTful yields cleaner fresh API but breaks full compatibility/deep-links
- Run original backend behind Next fastest migration but violates write-from-zero constraint and retains separate authority.

Consequences: route registry/DTO codecs/differential tests substantial; business logic not duplicated. Early warning one endpoint bypasses canonical auth/tree/config policy. Mitigation conformance route binding and cross-entrypoint service tests. Revisit API shape only explicit versioned scope change.

Non-goals: arbitrary catch-all external proxy or source-code cloning.

## ADR-010 — Persist CRDT document updates with authorized server projection

Status: proposed. Context: shared notes/editor/realtime reference capability; users can edit concurrently and offline/reconnect.

Decision: compatible Yjs update/state-vector flow, protected durable checkpoint/update storage, serialized core note projection, ephemeral awareness. Every room/update rechecks grants.

**Alternatives considered:**

- Last-write-wins rich document simpler persistence but loses concurrent edits
- Custom OT can meet collaboration but introduces independent protocol/transform compatibility implementation without benefit for reference Yjs target.

Consequences: binary codecs/compaction/checkpoint reconciliation and access-loss behavior required. Early warning remote editor overwrites new content or read-only socket applies update. Mitigation state-vector/race/ACL tests and compaction barrier. Revisit collaboration engine only if captured baseline transport/data semantics still preserved.

Non-goals: assuming CRDT library itself provides authorization/persistence.
