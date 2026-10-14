# SDD-08 — Integration protocols dan execution workers

Owner P04/P09/P12–P16/P21. Seluruh adapters/configured branches mandatory. [Reference bindings](12-reference-bindings.md) memberi katalog per source ID; 63 adapter-catalogue files mencakup dispatcher/helpers, **bukan klaim 63 provider independen**. Storage/audio/image branches di satu file memerlukan dispatch review tersendiri.

## ProviderAdapter contract

```typescript
type ModelCapability = 'text' | 'vision' | 'tools' | 'reasoning' | 'audio' | 'images';
type ProviderEvent =
  | { type: 'part'; kind: string; partId: string; value: unknown }
  | { type: 'usage'; raw: unknown; model: string | null }
  | { type: 'finish'; reason: string | null }
  | { type: 'error'; category: string; retryableBeforeSent: boolean };
interface ProviderAdapter {
  discover(binding: unknown, signal: AbortSignal): Promise<unknown>;
  capabilities(model: unknown): Record<ModelCapability, 'yes' | 'no' | 'unknown'>;
  execute(request: unknown, signal: AbortSignal): AsyncIterable<ProviderEvent>;
}
```

`unknown` di illustrative port wajib diganti validated domain/wire schemas oleh adapter owner sebelum implementasi; bukan alasan bypass input validation. Request mencakup connection binding, effective params, authorized message parts/files/system/tools, desired stream/native mode and scoped credential handle. Credential tidak muncul di emitted events. Unknown provider fields disimpan passthrough bag jika kontrak mendukung, tidak hilang karena generic formatter.

AI SDK v5 core dipakai pada supported OpenAI-compatible tool/stream path; native adapters mempertahankan Ollama management/generate/chat/embedding progress, custom OpenAI/Azure prefixes/config, task capabilities dan payloads yang tidak terwakili SDK. Browser Direct uses client adapter with local credential; server adapter has same protocol normalization where possible but different trust/secret boundary.

Per adapter: discovery/test/config/auth/params/request codec/response codec/stream parser/usage mapping/cancel/limits/errors/retry-safe-before-sent native methods. No shared fallback that silently sends all adapters to OpenAI endpoint. Version compatibility recorded package/API spec baseline plus official SDK pin; provider “current docs” may differ pinned reference and harus diberi profile adapter version.

## Common worker lifecycle

1. Dispatcher receives durable job ID; validates signed internal caller and reloads SQL job/actor/resource.
2. Capacity gate chooses resource class (generation/CPU/GPU/document/plugin/network/terminal).
3. Claim lease token atomically; publish safe state; load protected refs/typed payload schema.
4. Validate resource revision/grants/config/credential readiness; stale/deleted owner/resource fails safely.
5. Execute operation with abort propagation/resource budget/checkpoints; renew lease from independent heartbeat.
6. Commit result + run/domain state/usage/events/outbox fenced by lease; delivery happens after commit.
7. Cleanup temporary handles/process/kernel/container; ensure cancel/retry cleanup idempotent.

Job kind catalogue initial: generation.start/continue, chat.title/tags/followups/summary, file.extract/ocr/media, knowledge.index/reindex/delete, memory.review, search.query/load, audio.transcribe/tts, image.generate/edit, tool.execute, automation.occurrence, subagent.run, evaluation.run, events.deliver, storage.cleanup, document.compact. Enabled baseline extra jobs added during semantic audit; none silently dropped.

Retry taxonomy: no side effect yet/recoverable idempotent → bounded exponential retry; definite invalid config/auth/schema → failed and visible remediation; external outcome uncertain → indeterminate; cancel → partial settled result. Operator defaults proposal attempts 3/backoff 1s→5s→30s with jitter for retry-safe network/delivery work only; not unconditional LLM/tool retries. Queue waiting age separately from execution timeout.

## MCP/OpenAPI/MCPO

Connection descriptor: server ID/name/URL/transport/auth mode/secret reference/OAuth config/capabilities/protocol version/config revision/grants. Initialization negotiates supported version/capabilities and retains advertised tools/resources/prompts with schemas. Namespaced tool identity `(serverId,toolName)`; exact baseline display/collision resolution preserved.

Support required HTTP/SSE/Streamable HTTP/server protocols captured baseline. Operator-local stdio only when baseline supports and operator policy permits process command; hosted user URL form does not become arbitrary server command execution. MCP transport/auth session handling is separate from OpenAPI spec fetch and MCPO tool conversion. [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

OpenAPI discovery validates bounded document, server URLs, referenced schemas/cycles, allowed operations/security/parameters; auth inheritance scoped to configured origin, not malicious `$ref` server. Convert typed arguments to path/query/body/multipart carefully; escaping/missing-null values captured. Tool result references/files/content/error normalized without losing engine semantics.

MCP user elicitation creates bounded pending request with schema/owner/run/nonce/expiry, UI form + accept/decline/cancel, and reply to exact protocol request. Disconnect/expiry/cancel finalizes appropriately; not every elicitation needs an existing browser if baseline automation policy declines unsupported interaction. OAuth state/PKCE/refresh binding isolated from provider model key. [MCP elicitation specification](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)

Tool discovery can be cached revision/owner/auth scope; list changed/version auth invalidation follows protocol. Schemas rendered in tools composer; selected tool capability snapshot included in run. Model can call only selected/allowed tools; server validates output schema/size and resource actions. Parallel calls bounded and unique execution records avoid same-call duplicate side effects.

## Python-compatible plugin contract

Full parity includes Tool/Function/filter/pipe/action/pipeline code, histories/import/export, global/model/user enable flags, valves/UserValves/default/UI options. Kawan original plugin loader recognizes required baseline metadata/frontmatter/classes/signatures, validates load/error behavior and dependency installation in isolated environment.

Observed reserved hook inputs include `__user__`, `__event_emitter__`, `__event_call__`, `__metadata__`, `__files__`; additional reserved inputs and function signatures enumerated from source on P12. User projection only permitted safe fields/settings/valves; event callbacks route through signed authenticated RPC handles. Do not serialize Python function callbacks into JSON or provide raw unrestricted DB/request objects as shortcut.

Executor protocol request: execution ID, plugin ID/version/content reference/hash, actor safe projection, input body/args refs, valve snapshots, allowed capability handles, time/resource/egress/FS budgets, schema version. Response: status/typed output or stream parts/events, artifact refs, usage facts when emitted, safe exception, dependency info. Callback RPC binds execution/capability/session nonce; server authorizes resource actions at callback time.

Lifecycle load → validate contracts/dependencies → warm ready → invoke hook → bounded output/checkpoint → cleanup. Dependency cache keyed content/dependency/runtime hash; user plugins cannot mutate global runtime for other users. Operator-approved packages installed from official distribution with locked provenance, not copied repository source/bundle. Functions requiring unsupported native dependency fail readiness with exact reason; still open parity obligation until compatible environment tested.

Filters input/output/order/error semantics, pipes streaming/native async behavior, actions with browser event callback, tool argument-schema generation/docstring metadata and dynamic valve options each have independent fixtures. Sandbox policy can differ from insecure host access, with explicit exception; preserve legitimate plugin behavior inside configured capabilities instead of deleting plugin feature.

## Parser/storage/vector/search contracts

| Family | Mandatory operations | Edge cases |
|---|---|---|
| Storage | put/open/range/stat/delete/sign where supported | Abort/partial object/expired URL/missing credentials/ownership cleanup |
| Parser/OCR | extract typed document + source metadata | MIME/decompression/page/tables/empty/corrupt/auth/async polling |
| Embeddings | batches/model/dimensions/normalize/rate/cancel | Dimension mismatch, partial batch, retry-safe checkpoint, usage missing |
| Vector | upsert/query/filter/delete/collection/index lifecycle | Score direction, distance/type, tenant/grant filters, stale revision |
| Search | query/results/source/image/provider metadata | Pagination/rate/empty/malformed/auth/timeout, external engine configs |
| Reranker | input pairs/top-k/score/limits | Score semantics/missing model/external service/partial results |

One family protocol port is shared, adapters retain capability-specific operations/limits. A helper/dispatcher task owns routing/config mapping and tests engine-selection effect, not an invented external service. Distinguish e.g. Qdrant multitenancy variant from standard configuration in fixtures, even if sharing implementation pieces.

## Audio/images/terminal transport detail

Audio adapter typed inputs file/audio stream/model/voice/format/language/options, outputs transcript/segments/audio chunk/session data; distinct discover/voices/ready/token bridge operations. Image adapter workflows/generate/edit/masks progress/files payloads preserved per engine. Terminal adapter sessions/files/ports/HTTP/WS auth/cleanup, execution engine Jupyter/Pyodide packages/kernel output require protocol-specific codecs.

Protocol binary/stream objects not carried as raw giant job JSON; use file refs/stream channels with size/TTL/ownership. Generated file refs resolved by FileService before display/model continuation; workers cannot attach arbitrary local host paths. Egress/provider secrets scoped to adapter and purpose.

## Adapter evidence matrix

For every INT ID and dynamic engine branch: source contract review, configured profile (enabled + disabled), request/auth/config/default schema, success/empty/error/timeout/cancel/stream fixtures, serialization/time/model/usage mapping, effect assertion proving selected engine was called, real configured smoke with external test credentials/service, UI status evidence and secret canary scan.

Fixtures verify protocol deterministically; real smoke verifies interoperability. Missing remote credentials can allow developer fixture progress but does not make adapter fully verified for full-parity release. No testing user production gateway/key without explicit assignment. Operator-local engines get reproducible container/runtime profiles.

## Open contracts

Static AST dispatch review cannot enumerate arbitrary dynamically registered integrations; P00/P12/P23 semantic audit expands catalogue. Exact transports/auth flows/hook reserved parameters/provider request options are reference-bound and owned by respective adapter work package. API SDK/package versions pinned after compatibility check. Public outbound/host plugin capabilities and final operational quotas configured per self-host profile, with explicit tested defaults.
