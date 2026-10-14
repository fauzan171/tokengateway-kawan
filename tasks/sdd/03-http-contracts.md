# SDD-03 — HTTP, DTO dan compatibility contracts

Owner P00/P04/P05/P24. Semua 581 baseline declarations di [API inventory](../reference/api.md) mandatory. Endpoint Kawan di bawah adalah extension untuk BYOK/durable orchestration/monitoring, bukan pengganti atau pengurangan baseline API.

Formal typed definitions: [kawan-api-contracts.json](kawan-api-contracts.json), JSON Schema 2020-12 dengan named `$defs`; [api-examples.json](api-examples.json) berisi delapan synthetic examples. Domain checks/grants/revisions/discovered tool schemas tetap tambahan wajib di runtime; shape validation saja tidak mengizinkan execution.

## Namespaces dan routing

| Namespace | Handler ownership | Contract |
|---|---|---|
| `/api/auth/*` | Auth.js | Framework session/callback/signin/signout; signed cookie/CSRF handling |
| `/api/kawan/v1/*` | Kawan controllers | Extension DTO/error/ETag/idempotency contracts di sini |
| `/api/v1/*`, `/api/models`, root API endpoints | Compatibility controllers | Path/method/schema/status/header/auth baseline; typed facade ke domain service yang sama |
| `/openai/*`, `/ollama/*` | Provider compatibility edge | Registered native paths only; no arbitrary user-configured proxy routes |
| `/ws/*` dan realtime audio mounts | Realtime/transport edge | Baseline mount/protocol/profile exact setelah P00 capture |
| `/c/*`, `/s/*`, `/workspace/*`, `/admin/*` etc. | Next pages | Browser URL/navigation compatibility; session/role/resource checks |
| Static/Pyodide/avatar/artifact mounts | Authorized assets/runtime service | Only registered runtime/static resources, no raw storage root mount |

Next App Router handlers memakai Node runtime untuk DB/crypto. Explicit compatibility route dispatch sesuai inventory; wildcard expansion berasal allowlisted mounted contracts, bukan catch-all external URL proxy. `/api/auth` tidak bentrok `/api/v1/auths`. Ingress menentukan WS routes sebelum page routing. External gateway URLs tidak dipasang melalui runtime rewrites dari input user. [Next 15 rewrites](https://nextjs.org/docs/15/app/api-reference/config/next-config-js/rewrites) hanya routing deployment tetap; authorization tetap dalam handler/service.

## Common extension request/response rules

JSON `Content-Type: application/json`; multipart hanya upload. Mutations dari browser memerlukan authenticated session + same-origin/CSRF defenses. Server derives user ID; body `userId` tidak dipercaya. Credentials pada create/replace/test POST tidak pernah berada query/path; request body logging dimatikan. Auth errors tidak mengungkap apakah email/resource milik user lain ada.

Extension successful response JSON berbentuk resource atau `{data,nextCursor}`. Semua extension timestamps `_at` menggunakan ISO UTC untuk display atau `_at_ms` decimal string untuk precision, consistent per DTO; core compatibility payload unit/type tidak berubah. Resource DTO mempunyai `revision` decimal string. `ETag: "resource-kind:id:revision"`; mutating persisted resources memakai `If-Match` kecuali create/idempotent run start mempunyai revision dalam body.

Error extension:

```json
{"error":{"code":"STALE_REVISION","message":"Data berubah. Muat ulang untuk melanjutkan.","requestId":"req-opaque","retryable":false,"details":{"currentRevision":"8"}}}
```

`details` hanya fields safe untuk actor. 400 malformed; 401 auth; 403 permission bila existence memang boleh diketahui; 404 non-readable/missing resource; 409 revision/idempotency/capability conflict; 422 valid syntax tetapi field invalid; 429 rate/concurrency; 502 invalid provider upstream; 503 dependency unavailable; 504 test/handshake timeout. Provider 401 ditampilkan sebagai gateway credential failure, bukan logout akun Kawan. Baseline endpoints memakai golden baseline error shape/status, tidak dipaksa envelope extension.

`X-Request-Id` generated/validated opaque ID; `Cache-Control: private,no-store` pada credentials/chat/settings/usage. Public share cache hanya jika revocation invalidation dan sanitized snapshot semantics diuji. No `Access-Control-Allow-Origin:*` dengan credentials. Native provider response headers disaring; jangan meneruskan Set-Cookie atau auth challenge sembarangan.

## Connections contracts

| Method/path | Request | Response/status | Side effects |
|---|---|---|---|
| GET `/connections` | Session; optional cursor | 200 `{data:[ConnectionView],nextCursor}` | Owner-only rows; key mask only |
| POST `/connections` | CreateConnection | 201 ConnectionView + Location | Encrypt key if server; direct input rejects raw key; auto active if first eligible |
| PATCH `/connections/{id}` | If-Match + UpdateConnection | 200 new revision; 409 stale | Config/key mode migration + cache invalidation |
| POST `/connections/{id}/activate` | If-Match | 200 ConnectionView | Atomic single-active per user |
| DELETE `/connections/{id}` | If-Match | 204 | Tombstone/cancel not-started jobs/active replacement; old usage retained per policy |
| POST `/connections/test` | DraftServerTest | 200 TestResult or mapped 422/502/504 | No persistence; egress validation; transient key cleared |
| POST `/connections/{id}/test` | If-Match; no apiKey | 200 TestResult | Server key resolved; direct mode returns 409 LOCAL_TEST_REQUIRED |
| GET `/connections/{id}/models` | optional refresh | 200 `{data,provenance,revision}` | Server discovery cached by owner/config revision; direct mode local discovery |
| POST `/connections/{id}/direct-report` | revision/model IDs/status/count/client instance | 200 reported metadata | Authenticated but untrusted client status, no verification claim |

All paths relative `/api/kawan/v1`. Create server connection fields: name, baseUrl, providerKind, isDirect=false, apiKey, optional typed config. Explicit `authMode=none` tanpa key hanya untuk registered adapter yang memang mendukung auth-none dan policy mengizinkan; missing key tidak otomatis menjadi auth-none. Create Direct fields same metadata with isDirect=true and **without apiKey**. `apiKey` property on Direct server request rejected rather than silently persisted. Server test fields exclude userId/connectionId arbitrary secret reference; draft mode is server only. Browser Direct tests use local key via browser gateway request, then optional sanitized report.

```json
{"id":"conn-opaque","name":"Gateway pribadi","baseUrl":"https://api.tokengateway.ai.id/v1","providerKind":"openai-compatible","isDirect":false,"isActive":true,"keyMask":"sk-...abc1","hasKey":true,"revision":"1","lastTest":{"status":"success","provenance":"server","modelCount":2}}
```

Update key semantics explicit `keyAction: keep|replace|remove`. `replace` requires new key, `keep` forbids key property, `remove` allowed only auth-none adapter or switch to Direct. Mode switch server→Direct clears server credential only after mutation success and UI prompts local entry; Direct→server requires explicit new input, never uploads local key automatically. Changing base URL with existing key requires deliberate `keyAction` and UI acknowledgement of destination; no automatic request with old key to an unreviewed origin.

OpenAI-compatible normalization retains user path `/v1` or custom prefix; removes trailing slash; append `/models`, not append `/v1` blindly. URLs prohibit userinfo/query/fragment. GET models validates `data` IDs/duplicates/schema/limits; no fabricated model. Empty list distinguish reachable-no-models from valid chat-ready state. Test display status and gateway CTA include safe error category/count, no raw gateway body/key.

Server cache default usulan 60 s, invalidated revision/key/baseURL change. ETag/cache cannot mix owners. Direct models in client cache namespace user/connection/device/revision. Capability fields unknown are `unknown`, not presumed tool/vision support.

## Generation and tree contracts

| Method/path | Request | Response/status | Invariant |
|---|---|---|---|
| POST `/generation-groups` | Idempotency-Key + StartGeneration | 202 group/run descriptors + event URLs | Tree/user placeholder/job creation atomic; snapshot resolution |
| GET `/generation-groups/{id}` | owner read | 200 group/per-run state/revision | No provider key; final/indeterminate states truthful |
| POST `/generations/{id}/cancel` | optional reason safe enum | 202 current state; 200 already terminal | Durable cancel; no undo claim for external tools |
| GET `/generations/{id}/events` | Last-Event-ID or `after` cursor | 200 SSE; 409 replay expired | Ordered replay+live dedup; resource auth revalidated |
| POST `/chats/{id}/tree-mutations` | revision + typed mutation | 200 patch/revision/current leaf | Same-chat tree validation and transaction |
| POST `/direct-sessions` | owned group, local capability report | 201 bounded tool bridge grant | No model key or untrusted server execute spec |
| POST `/direct-sessions/{id}/events` | monotonic client sequence + allowed typed parts | 200 ack cursor | Client-reported provenance; canonical content validation |
| POST `/direct-sessions/{id}/tool-calls` | selected tool ID/call ID/validated args | 202 execution ID | Recheck grants; approval policy; server tools only |
| GET `/tool-executions/{id}` | owner read | 200 state/result/approval-safe data | No arbitrary server secret or foreign results |
| POST `/tool-approvals/{id}/response` | nonce + accepted/declined + typed response | 200 state; 409 replay; 410 expired | Single-use CAS, exact execution binding |

```json
{"chatId":"chat-opaque","expectedRevision":"5","mutation":{"kind":"append-user","parentId":"assistant-old","content":[{"type":"text","text":"Ringkas dokumen ini"}],"fileIds":["file-owned"]},"models":["gateway/model-a"],"connectionId":"conn-opaque","mode":"server","systemPrompt":"Jawab dalam bahasa Indonesia","generationParams":{"temperature":0.4},"selectedToolIds":[],"temporary":false}
```

Server validates entire mutation and ancestry from DB; it does not trust client `messages` array as complete history. Selected models/connection/system prompt/params are effective config snapshots for this group; profile permissions/binding precedence verified. Same Idempotency-Key/digest replays response even after client revision becomes stale; different digest returns 409 before changing history.

Typed mutation kinds: append-user, branch-user-edit, edit-assistant, regenerate, continue-assistant, select-branch, delete-subtree, insert-message, import-tree. Each kind has allowed fields and parent/message role constraint per [chat execution](04-chat-execution.md). Core compatibility chat update endpoints accept baseline payload and map to same validated domain mutation; unknown supported baseline metadata preserved, unsafe ownership/status fields cannot escalate execution.

SSE events and resume cursor specified SDD-04. SSE content negotiated explicitly; Kawan event envelope is not automatically AI SDK UIMessage stream. UI uses custom transport/reducer mapping; native compatibility endpoints preserve baseline stream protocol.

## Files, shares, usage and settings

Baseline CRUD remains primary where no Kawan-specific extension is needed: e.g. POST `/api/v1/files/`, POST `/api/v1/chats/new`, POST `/api/v1/chats/{id}/share`, workspace routes. Controllers use same auth/domain services; no duplicate upload/history database.

Kawan-specific GET `/usage?from=YYYY-MM-DD&to=YYYY-MM-DD&timezone=...&connectionId=...&model=...&groupBy=day|model` returns reported totals, unknown-step count, client-reported totals separately, bounded date range and authorized pagination/export. Dates interpreted in declared IANA timezone; start inclusive/end exclusive expressed clearly. Default usulan maximum range 366 days/request; operator configurable and export paginated.

Kawan public share overlay adds read-only anonymous snapshot mode requested in original PRD while baseline share modes remain supported. Snapshot IDs unguessable, no update/delete/tool/run endpoints for anonymous actor, sanitized system/secret/internal attachments policy. File downloads require share-scoped capability, not owner session forged by public reader. Revoke invalidates snapshot/file capabilities/cache.

Settings DTOs distinguish personal/admin/core config and Kawan-specific fields. GET never returns ciphertext/plaintext integration credentials. Save response includes effective value/provenance/revision; dependent controls observe changed registry revision. Mask string never submitted as replacement credential. About repo/version sourced build config; absent repo uses clear operator setup state, no fake GitHub URL.

## Pagination, concurrency and validation

Extension list defaults limit 30, max 100; cursor is opaque signed/validated tuple `(orderValue,id,filterDigest)` tied resource/query/auth scope, not arbitrary SQL. Stable ordering handles same timestamps. Baseline offset/page/cursor behavior retained separately. Search query bounded and parameterized; escaping `%/_` aligns literal/full-text contract captured baseline.

Validation default proposals: connection name 100 chars; URL 2.048 chars; transient key 8.192 chars; extension JSON body 1 MB except explicit import/upload limits. These guardrails configurable/profile-tested if baseline permits larger relevant inputs. No generic 1 MB cap on streaming files or exports. Generation context/token/message bounds follow model/operator configs, not silent truncation.

Runtime schemas reject dangerous fields/prototype pollution and parse typed values before DB/provider call. DTO error includes precise safe field path. Unsupported adapter capability produces visible typed failure; hidden switch to different adapter violates parity.

## Baseline contract resolution checklist

For each API ID record mount/method expansion, params path/query/body/form/files, inherited schemas, validators/defaults, auth/roles, response schema/status/error/header/cookies, side effects, pagination/order, flags, stream/event shapes and data/time units. Golden fixtures include malformed/auth/cross-user/enabled/disabled/timeout races. Static metadata only seeds the record; exact codes/names are captured, never invented from FastAPI conventions.

## Open contracts and gate

Baseline bearer/session token wire compatibility requires P02/P24 dedicated issuer/validation fixtures; Auth.js token is not native Open WebUI token. Socket/audio/static exact mount parameters and inherited response validation require P00 review. Core/public share default visibility requires source/runtime confirmation; Kawan public snapshot overlay is explicitly additive. Every unresolved contract has reference ID/task owner in registry and blocks its implementation acceptance.
