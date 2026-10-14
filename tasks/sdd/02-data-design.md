# SDD-02 — Data design, invariants dan transactions

Owner P01; semua mutating domains menggunakan kontrak ini. [43 core tables/396 fields](../reference/schema.md) dan [schema contract](../schema-contract.md) normatif. Dokumen ini menambah desain extension dan transaction detail; bukan schema Prisma executable.

## Core persistence contract

Core physical names/types/nullability/defaults/constraints diambil dari baseline migrated live SQLite/Postgres. Semua 43 core tables tetap ada. Prisma `@map/@@map`, native type atau raw SQL dipakai bila diperlukan; API/resource ownership bukan alasan menambah destructive cascades pada core tables. Auth.js tidak mengganti User/Auth dengan starter template database.

Core `chat.chat` memuat lossless history JSON dan metadata; `chat_message` adalah materialized projection. `message` merupakan channel message yang berbeda. Semua mutations/imports melalui ChatService, menulis tree/projection/current-message/file links satu transaction. Native JSON dan JSONField text codec diperlakukan berbeda; baseline constraints lebih kuat daripada TypeScript type hints.

64-bit timestamps/identifiers/numeric values tidak melewati `Number()` tanpa range validation. Kawan extension epoch menggunakan milliseconds dalam signed BigInt. Compatibility timestamps mengikuti unit field baseline yang telah direview; jangan memakai satu unit global untuk core. JSON serializers: internal BigInt → decimal string; baseline boundary lossless integer-number codec bila kontrak baseline memakai JSON integer. Stringifying BigInt secara global akan mengubah API reference contract dan perlu codec khusus.

## Entity families dan ownership

| Core family | Authoritative state | Invariants |
|---|---|---|
| user/auth/api_key/oauth_session | User identity + Auth credentials/session stamp | Linked IDs, status/active/method rules; provider key berbeda dari application API key |
| group/group_member/access_grant | Effective ACL input | No group cycle; null/public/private/read/write semantics preserved |
| chat/chat_message/chat_file/shared_chat/folder/tag | Tree+projection+resource organization | Acyclic chat/folder structure; same chat ancestry; tag composite key |
| file/knowledge/directory/file links | Private blob/index/reference lifecycle | File authorization tidak hanya prefix object path; no cross-owner index lookup |
| model/prompt/skill/tool/function + histories | Current version and immutable snapshots | Version owner/type consistency, rollback does not delete history |
| channel/member/file/webhook/message/reaction | Collaboration state | Member/read/reply/pin identity and timestamps preserved |
| note/pinned_note | Content and per-user pins | CRDT checkpoint + serialized content reconciliation |
| calendar/event/attendee | Time/recurrence/participation | Range/timezone/end/start/cancel semantics field-specific |
| automation/run | User schedule + execution history | Scheduled occurrence identity, authorized target, no orphan run |
| memory/feedback/config | User retrieval/evaluation/operator settings | Owner/grant/config provenance and secret policy enforced |

## Extension conventions

All extension IDs opaque UUID; `user_id` references core user logically/physically according to baseline-compatible FK policy. IDs not authorization. Timestamps `_at_ms` BigInt. JSON blobs mempunyai schema_version dan typed parser. Immutable request fingerprints memakai canonical validated payload excluding transient credentials, kemudian SHA-256; raw secret tidak masuk fingerprint/log.

Text state fields memakai validated enum/check constraints SQL sendiri bila portable; tidak mengubah core SQL enum types. Nullable berarti genuinely absent/unknown, bukan default empty string. Extension foreign-key deletion memakai explicit domain cleanup; accounting/history tidak cascade hilang bila connection dihapus.

### kw_connection

| Column | Type/default | Contract |
|---|---|---|
| id/user_id/name | text required | Unique connection identity; nonblank name 1–100 chars |
| base_url | text required | Canonical http(s) URL tanpa userinfo/query/fragment; server mode approved egress policy |
| api_key_encrypted | text nullable | Versioned AES-GCM envelope; mandatory bila authenticated server connection; null pada Direct/no-key local adapter |
| key_mask | text nullable | Stored suffix mask; safe read API, not recomputed by decrypt during list |
| is_direct/is_active | boolean false | Exactly one active when any eligible owned connection exists; Direct stores metadata only |
| provider_kind | text `openai-compatible` | Registered adapter ID, native provider extensions preserved |
| config | JSON object | Header/parameter/model mapping; secret values only encrypted refs |
| revision | BigInt 1 | Increment on URL/mode/key/config mutation; model cache invalidation key |
| last_test_at_ms/last_test_status | nullable BigInt/text | server-verified vs browser-reported provenance |
| created_at_ms/updated_at_ms/deleted_at_ms | BigInt/BigInt/nullable | Tombstone preserves usage references; new requests reject deleted |

Original Prisma-facing `Connection { id,userId,name,baseUrl,apiKeyEncrypted,isDirect,isActive,createdAt }` remains via field maps; additional fields support full lifecycle. Server connection credential lives in this encrypted column, **not duplicated** in kw_secret. SecretService resolves logical handle `connection:{id}` to this vault row. Other integration credentials use kw_secret. Provider auth-none capability explicitly permits null; arbitrary missing key does not become auth-none automatically.

Unique active constraint `(user_id) WHERE is_active AND deleted_at_ms IS NULL` implemented independently for both providers; state change transaction locks/CASes user's connection selection. User deleting active connection selects another eligible connection deterministically by creation/id; no remaining connection routes onboarding. Direct active on a new device can need local-key re-entry while metadata stays selected.

### kw_secret

Columns: id, owner_id nullable for operator secrets, scope enum personal/operator/system, resource_kind, resource_id, purpose, encrypted_envelope, key_id, mask nullable, revision, created_at_ms, updated_at_ms, revoked_at_ms nullable. Unique `(scope,owner_id,resource_kind,resource_id,purpose)` with deliberate SQL null uniqueness handling. Encrypt AAD binds immutable row ID/owner/resource/purpose; moving ownership requires decrypt/re-encrypt, never ciphertext relabel.

Config/provider legacy plaintext imported into protected vault references; credential read API remains masked. Re-encryption atomically updates envelope/key ID/revision. Worker requests scoped secret use; it does not receive a general-purpose list-all vault capability.

### kw_resource_revision

Columns resource_kind/resource_id composite PK, revision BigInt default 1, updated_at_ms, deleted_at_ms nullable. Extension adds CAS without modifying core schema. Used for chat/group/knowledge/note/calendar/config resources whose baseline does not expose revision. Compare-and-swap and core mutation in same SQL transaction. Native compatibility request without revision serializes/merges according to baseline behavior; it must not become unconditional last-writer-wins by omission.

### kw_generation_group and kw_generation

`kw_generation_group`: id, user_id, chat_id nullable for temporary, parent_message_id nullable, idempotency_key, request_digest, chat_revision, connection_snapshot JSON, selected_models JSON, mode server/direct, state, created_at_ms, completed_at_ms nullable. Unique `(user_id,idempotency_key)`; same key+same digest returns same group; different digest returns 409. Connection snapshot stores identity/config revision/model mapping, no key or ciphertext.

`kw_generation`: id, group_id, user_id, chat_id nullable, message_id nullable, model_slot integer, requested_model, returned_model nullable, connection_id nullable, state, current_step integer default 0, last_event_seq BigInt 0, cancellation_requested_at_ms nullable, error_code nullable, finish_reason nullable, started_at_ms/completed_at_ms nullable, created_at_ms/updated_at_ms. Unique `(group_id,model_slot)`; per-model completion independent; parent group reaches terminal when all runs terminal. Core assistant placeholder ID is assigned before provider execution.

### kw_provider_attempt

Columns id, generation_id, step_index, attempt_index, provider_request_id nullable, request_digest, phase prepared/sent/response_started/finished/indeterminate, sent_at_ms nullable, last_checkpoint_at_ms nullable, response_ref nullable, finish_reason nullable, error_code nullable, created_at_ms. Unique `(generation_id,step_index,attempt_index)`; indexes generation/phase. Persist `sent` before outbound request, provider request ID when available. Do not retry attempt after uncertain external response without idempotency support/user decision. No DB design provides unconditional exactly-once third-party inference.

### kw_generation_event

Columns generation_id/seq composite PK, event_id unique, type, schema_version, payload JSON, created_at_ms. Monotonic sequence per run allocated within fenced write transaction. Payload contains authorized display/status/tool metadata, never raw key/auth header or hidden private worker data. Event chunks coalesced before checkpoint; final state commits final durable content before emitting terminal event. Retention default usulan 7 days after terminal; run/core content retained under user data policy.

### kw_usage

Columns id, generation_id nullable, provider_attempt_id nullable, user_id, connection_id nullable, model_requested, model_returned nullable, step_index, source gateway/browser_reported/local_engine, prompt_tokens/completion_tokens/total_tokens nullable BigInt, cache_read/cache_write/reasoning_tokens nullable BigInt, raw_usage JSON nullable, measurement_status reported/missing/estimated, recorded_at_ms, finalized_at_ms nullable. Unique provider_attempt_id when present; Direct source unique `(generation_id,step_index,source)` with authenticated client reconciliation rules.

Usage append/upsert exactly once per provider step, never derived from display chunks. Sum known values; report unknown count separately. Preserve provider reported total even when it differs from prompt+completion; surface provenance. Estimates labeled separately and not summed into “reported” total. No billing/currency tables. Foreign model display names copied for historical attribution even if model/connection is deleted.

### kw_job and kw_outbox

`kw_job`: id, kind, schema_version, owner_id, resource_kind/resource_id, payload_ref, idempotency_key, state queued/leased/running/waiting/succeeded/failed/cancelled/indeterminate, priority integer 0, available_at_ms, attempt integer 0, max_attempts, lease_owner nullable, lease_token BigInt 0, lease_expires_at_ms nullable, heartbeat_at_ms nullable, cancel_at_ms nullable, result_ref/error_code nullable, created_at_ms/updated_at_ms. Unique `(kind,idempotency_key)`. Index `(state,available_at_ms,priority,id)` and `(state,lease_expires_at_ms)`.

`kw_outbox`: id, topic, aggregate_kind/id, event_ref nullable, payload JSON for non-generation events, state pending/published, attempts integer, available_at_ms, published_at_ms nullable, created_at_ms. Index pending/available. Domain write + outbox insert one transaction. Dispatcher publish then mark; duplicate delivery possible and consumers deduplicate event ID. Outbox does not claim exactly-once network delivery.

### kw_tool_execution and kw_tool_approval

`kw_tool_execution`: id, generation_id, step_index, provider_tool_call_id, server_ref, tool_name, args_digest, arguments_ref, state discovered/waiting_approval/executing/succeeded/failed/cancelled/indeterminate, result_ref/error_code nullable, job_id nullable, started_at_ms/finished_at_ms nullable. Unique `(generation_id,step_index,provider_tool_call_id)`. Arguments/results access-controlled; no secret-bearing refs in public shares.

`kw_tool_approval`: id, execution_id, user_id, nonce_hash, request_schema JSON, state pending/accepted/declined/expired/cancelled, response_ref nullable, expires_at_ms, resolved_at_ms nullable. A response uses owner/run/nonce/expiry/schema validation and single-use CAS. UI auth approval and MCP elicitation are separate protocol reasons; one record does not silently approve all later tool calls.

### kw_direct_session and kw_mcp

`kw_direct_session`: id, user_id, generation_group_id, browser_instance_hash, state active/completed/expired/cancelled, capability_digest, expires_at_ms, last_event_seq, created_at_ms. Browser instance ID is routing metadata, not auth. Session grants specific selected server-side tools/results to one Direct generation; model credential absent everywhere. Extension direct endpoint receives model metadata/client-reported usage only.

`kw_mcp`: id, user_id, name, base_url, transport, auth_mode, secret_ref nullable, config JSON, revision, last_test_status/at nullable, enabled boolean, created_at_ms/updated_at_ms/deleted_at_ms. Original server-connection config contracts also mapped; extension does not replace all baseline MCPO/OpenAPI/global tools. Unique connection-scoped tool identities include server ID + advertised tool name, preventing name collision.

### kw_document_state and kw_automation_occurrence

`kw_document_state`: resource_kind/id composite PK, schema_version, snapshot_ref, state_vector binary or lossless encoding, revision, last_compacted_at_ms, updated_at_ms. CRDT update records stored as blobs or `kw_document_update` with doc ID/monotonic seq/update bytes/created_at_ms; exact protocol and encoding captured P18. Serialized core note content and checkpoint coordinated through document service.

`kw_automation_occurrence`: automation_id/scheduled_at_ms composite PK, id unique, job_id nullable, generation_group_id nullable, state scheduled/claimed/completed/failed/cancelled/indeterminate, config_revision, created_at_ms/updated_at_ms. Scheduler claim unique per occurrence; RRULE changes create new schedule revision and invalidate not-started prior occurrences, not completed history.

### kw_identity_link and kw_rate_limit

`kw_identity_link`: id, user_id, provider_id, provider_subject, issuer, secret_ref nullable for refresh tokens, created_at_ms/updated_at_ms/revoked_at_ms. Unique `(provider_id,issuer,provider_subject)`; email match alone never links a different issuer without explicit policy. Baseline user.oauth/oauth_session remains compatible projection, does not expose refresh secrets.

`kw_rate_limit`: scope/key_hash/window_start_ms composite PK, count BigInt, expires_at_ms. Atomic increments scoped user/IP hash/action; Redis may accelerate but fallback obeys durable auth limits. No raw password/key/IP in counter key. MFA challenges/reset tokens use single-purpose hashed token records with expiry; they are not regular logged-in sessions.

## Transaction boundaries and locking

| Operation | Atomic work | Lock/CAS and conflict |
|---|---|---|
| Register/first admin | Core User/Auth + identity init | Operator bootstrap claim prevents simultaneous first-admin races |
| Activate/update connection | Active flags/key revision/cache invalidation outbox | User selection serialization + connection revision; 409 stale mutation |
| Start generation | Idempotency group, user node/placeholders, projection/revision, jobs/outbox | Chat revision CAS; same-key replay independent of stale client revision |
| Chunk checkpoint/finalize | Event sequence, content/projection, run/job state, usage/outbox | Fenced lease token + monotonic sequence |
| Edit/delete/import tree | Tree validation, core JSON/message/file links/current leaf/revision | Same-chat transaction; running-node edit policy checked |
| Share snapshot | Sanitized immutable data + token/mapping/grants | Snapshot revision; no live private hydration |
| Index/reindex knowledge | Job revision and immutable staged index | Publish index version only after all chunks complete; stale job cannot overwrite |
| Calendar automation claim | Unique occurrence + job + run reference | DB uniqueness; leases renewed; external execution indeterminate tracked |
| Note sync/compact | Update append/state vector/serialized content/checkpoint | Per-document sequence + CAS; no concurrent compactor data loss |

Postgres uses row locks or atomic CAS where appropriate; SQLite uses short transactions/CAS plus bounded retry for busy/lock failure. Do not hold DB transaction across LLM/network/worker execution. Lock order: user selection → resource revision → generation group/run → event/job/outbox; prevent inverted nesting.

## Retention, deletion and recovery

Default proposals: outbox published records 7 days, terminal stream replay 7 days, job diagnostics 30 days, temporary chat content only lifespan authorized by baseline profile. User core history persists until delete policy; analytics follows deletion/privacy policy captured from baseline, not indefinite retention by assumption.

Delete access first, cancel affected future jobs, detach authorized references, schedule private blob/vector cleanup, then finalize tombstones after refcount/reconciliation. `usage` retains opaque historical attribution only under configured user data policy; account erasure handles it explicitly. Retry cleanup idempotently; tombstoned IDs never resurrect via stale job/event.

Migration lineage and round-trip tests cover all 64 baseline revisions with supported version fixtures; Kawan does not copy Alembic source or revision filenames as its migration implementation. Backup recovery includes SQL/blob/vector metadata/vault keyring; lost encryption master key cannot be recovered from database alone.

## Gate dan open contracts

Fields/extensions above are proposed Kawan schema contract, implemented independently for both providers. Exact physical FK/index/default objects and core timestamp units await P01 introspection evidence; owner P01-01, blockers before migrations accepted. All extension unique/check policies require actual SQLite/Postgres race tests, not just schema file comparison. Schema changes after implementation update ADR/contracts/fixtures first, then migration.
