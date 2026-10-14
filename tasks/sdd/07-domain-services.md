# SDD-07 — Detailed domain services

Scope semua phases selain foundation/auth/chat yang sudah memiliki dedicated SDD. Semua CRUD/API/UI contracts tetap terikat [inventory](../reference/README.md); desain di sini menjelaskan service boundaries, state, jobs dan failure behavior untuk implementasi.

## ConfigRegistry — sejak foundation, closure P23

Registry dibuat pada P00/P01 dan dipakai sejak auth/connections pertama, bukan baru setelah seluruh produk selesai. P23 menyelesaikan semua operator panels/control coverage. Specification entry memuat key/type/default expression/evaluated profile defaults/env name/persist scope/secret policy/user permission/dependent flags/validator/effect handler/reset/import-export/UI label/provenance/revision.

Resolution priority per key mengikuti baseline semantic audit; tidak menyamaratakan semua keys menjadi env > DB > personal. Generation/user/group/model/provider overrides mempunyai resolver khusus yang menghasilkan effective snapshot. Changes persist + revision/outbox atomically; effect handler invalidates affected model cache/engine/session/job policy. Restart/reload restores same value. Invalid engine/config rejected or saved as visibly disabled draft sesuai contract; no fallback ke engine lain tanpa explicit policy.

Typed secret keys return reference/mask, not raw configuration export. Baseline config import accepts authorized plaintext credentials only transiently and routes vault. All 421 config keys/938 env occurrences reviewed; env duplicate occurrences not independent user controls.

## P09 Files, storage and extraction

Flow: authorize upload → stream bounded bytes to private staged object → compute hash/MIME → create file metadata → attach extraction job → process → publish extracted result/version → expose ready file. States staged/uploading/uploaded/processing/ready/failed/deleting/deleted represented through baseline-compatible File data/meta + extension job, not new incompatible core columns.

Attachment file IDs validate actor/grants/model capability at chat start and execution. Text/PDF/OCR outputs include source page/section/table metadata; image/audio/video transformations record original vs derived refs/MIME. Binary inputs kept private, large text not stuffed into model automatically without configured context budget. Media/Office/archive handling isolated worker; quotas and decompression bounded.

StorageAdapter supports put/open/range/stat/delete/sign where engine supports; auth/lifecycle/file identity outside adapter. Content-addressed duplicate objects only reused when authorization/refcounts safe; hash match does not grant read access. Cleanup tombstoned file only when no active authorized links/jobs/snapshots; failed staged upload orphan TTL default 24h proposal. Signed URL revocation behavior tested for each storage engine.

Google Drive/OneDrive pickers receive least-privilege OAuth session, selection metadata and scoped import job; external token encrypted, not copied into attachment DTO. Parser selection uses actual registered adapter, recorded in file extraction metadata; configuration-effect tests assert selected engine received request.

## P10 Models and Playground

ModelService resolves base provider model + wrapper version/system params/capabilities/tools/knowledge/skills/variables + actor grants into immutable inference binding. Effective parameters follow baseline precedence; provider-native custom params preserved where supported. Same model ID from two providers resolved with prefix/config identity as reference, not naive global Map overwrite.

Create/update/version/rollback/clone/import/export writes current model and history snapshot together. Active/inactive/base model disappears/connection unavailable states explicit. Generated model avatars/imported assets processed independently; no borrowed Open WebUI logo/asset copy. Community import parses resource schema/permissions/source, never executes plugin code merely to display metadata.

Playground chat/completions/images share provider/orchestrator ports but preserve mode-specific request/response controls and export/history behavior. Completion APIs not automatically transformed into chat endpoints if provider-native contract differs. Ollama management progress from native adapter shown with model ownership/operator permission checks.

## P11 Prompts and skills

Prompt templates keyed command/resource version; variables parsed/validated/form-rendered, reserved/context variables come from authorized snapshot. Command collision/scope precedence captured reference. Slash selection expands prompt predictably, does not execute arbitrary template expression on server.

SkillService preserves instruction/content/data/files/metadata/version/active/localized fields and user/group/public grants. Invocation bundles selected skill version+file references, not all user's skills. Skill filenames/path normalization and attachment authorization independent of package metadata. Histories immutable; rollback creates new current version and retained ancestry, according baseline history contract.

## P12 Tool ecosystem and plugins

ToolRegistry produces stable server+tool IDs, schemas/capability/auth provenance, display descriptions and grants. Selected model wrapper/personal tools/OpenAPI/MCP/Python function sources merge with explicit conflict behavior. ToolExecutor validates complete model arguments, selection grant, resource action permissions, auth revision and invocation limits.

States discovered → selected → validated → waiting approval/elicitation → executing → succeeded/failed/cancelled/indeterminate. Input/output refs private; completion continuation receives normalized result/error/attachment semantics. Plugin filters/actions/pipes/functions hooks use isolated executor callbacks and compatible valves/history lifecycle [SDD-08](08-integrations-and-workers.md). Pipeline remote configuration separate adapter; cannot label it unsupported under full parity.

## P13 Knowledge, indexing and retrieval

KnowledgeService manages collections/directories/files, grants/order/bulk actions and active index revision. Index job snapshot includes file content hash/parser version/chunk params/embedding model/vector adapter/config revision. States queued/extracting/chunking/embedding/staging/publishing/ready/failed/cancelled; old active index remains usable while new revision builds if baseline profile permits.

Chunk identity deterministic within `(file,index revision,chunk ordinal/content hash)`; embedding dimension validated before store. Stage writes to adapter-supported versioned namespace/metadata strategy; publish active revision only after complete counts/manifest. Partial job does not appear as ready; retry deduplicates chunk/embedding work where possible. Vector deletion/relational state coordinated by durable outbox + reconciler, never assumed single distributed transaction.

Retrieval applies effective grants and index version filters before returning content. Query embeddings/semantic/hybrid/BM25/full-context/threshold/top-k/reranker pipeline follows config/model settings. Candidate filtering after retrieval must not leak denied document metadata/citations or silently starve allowed results; adapter filter behavior benchmarked per engine. Cross-user shared knowledge allowed only through effective grants, not hard user-ID namespace restriction.

Citations tie response to source/file/page/chunk/version and authorized file handle. File updates/reindex/embedding dimension change/access revocation invalidate relevant caches; stale worker cannot publish over later resource revision. No fake RAG answer when index unavailable; typed status/error and retry visible.

## P14 Search, crawling, memories and external knowledge

SearchAdapter normalizes result URL/title/snippet/source/image/score/provider metadata while preserving supported baseline fields. Query generation uses configured task model/params, invoked once per required task. Manual/always/selected provider choices reflected in execution binding; rate-limit/timeout fallback only explicit configured policy.

Crawler parses authorized safe outbound URL under SSRF/size/redirect/time policy, records fetched timestamp/MIME/source, deduplicates and extracts context with citation provenance. Robots/provider policies captured supported baseline behavior; no unbounded crawl. Source content is data, cannot grant tool permissions through prompt text.

MemoryService stores user/type/path/content/meta and retrieval index references; create/edit/delete/query/background review flow respects actor/settings/character limits/cadence. Review jobs snapshot ownership/settings, revalidate on execute and cannot write B's memory from A's conversation. Derived review provenance recorded; user manual edit revision beats stale review. External knowledge loader/retrieval APIs have their own typed/auth/error contract, not conflated with built-in vector store.

## P15 Audio/STT/TTS/realtime

Device capture stays browser; permission/device/record/upload lifecycle explicit. STT worker accepts validated private file handle and engine/model/options; streaming/chunked transcription text/time segments preserved where baseline supports. Local Whisper plus all configured provider branches and slim/offline readiness covered, not just generic OpenAI upload.

TTS supports configured local/provider engine, model/voice list/options/output format/cache/stream. Cache key binds actor authorization/input hash/engine model voice/version/settings; cached speech cannot expose private text through public URL. Browser handles interrupt/stop/device routing/playback errors. Engine source branches observed include OpenAI/realtime, ElevenLabs, Azure, Mistral and transformers paths; full dispatch inventory resolved P00/P15.

Realtime voice uses authorized session bridge/provider ephemeral token or protected server transport according protocol; raw saved provider key never returned. Turn detection/VAD/transcript/audio/model tool calls and reconnect/cancel behavior preserved. Large realtime streams not ordinary one-shot generation jobs; session coordinator persists metadata/results and bounded state, realtime process owns transport.

## P16 Images, editing and workflows

ImageAdapter capability distinguishes generate/edit/mask/variations where baseline supports. Observed generation branches OpenAI/Gemini/ComfyUI/Automatic1111; edit branches have separate inventory, not assumed all generation engines support all edits. Each engine has discovery/test/params/auth/output/error/cancel contracts.

ComfyUI workflow node mapping and upload/poll/events treated actual workflow graph with validated declared nodes/inputs; Automatic1111 native payload/sampler/model settings retained. Generated assets stored through FileService with generation/model/options provenance. Prompt-generation task uses selected task model once, no hidden new billing system. Chat/Playground shows real job progress and provider unsupported failure truthfully.

## P17 Channels/realtime messaging

ChannelService membership/ACL/read/unread/archive/delete lifecycle separate from chat model history. Message IDs reply/parent/pin/edit/reactions/files/user data preserve reference shapes/time units. Message mutation + outbox one transaction; SocketRoom service reauthorizes joins and revoked memberships across instances.

Persisted events carry resource sequence/dedup identity; clients reconnect from cursor/canonical history, presence ephemeral with heartbeat TTL. Webhooks store vault credential refs, inbound/outbound payload schemas/grants/rate limits; retry delivery idempotency recorded. Model mention/channel automation calls use GenerationService with channel-scoped context/action grants, not invisible admin credentials.

## P18 Notes and collaborative documents

NoteService core note data/meta/title/pins/grants and serialized editor content mapped losslessly. CRDT service persists updates/state vector/checkpoints, serializes core note representation via versioned codec, and publishes document-room events. Awareness presence ephemeral; update bytes, document identity and owner/grant checked before apply.

Checkpoint race resolved via document revision/update-sequence barrier; compactor never deletes updates newer than captured vector. Reconnect merges acknowledged updates without overwriting peer content with stale HTML/Markdown. Read-only/revoked clients cannot submit updates even if editor remains mounted. Files/mentions/context/export/import use authorized NoteService transformations. Yjs solves shared state merge, not authorization/durable server persistence by itself. [Yjs collaborative editor guide](https://docs.yjs.dev/getting-started/a-collaborative-editor)

## P19 Calendar, recurrence and attendees

CalendarService manages default/color/grants/events/ranges/attendees/cancelled state. Store core timestamps in baseline field-specific units; source review confirms calendar created/updated nanoseconds, event start/end units require field codec evidence rather than assumption. Timed UTC instants vs all-day/local date semantics kept distinct; user IANA timezone used for display/query expansion.

RRULE parsing/expansion bounded to request range/count/operator policy; DTSTART/TZID/DST/series exception/edit behaviors captured baseline. Attendee identity/status/private details and per-event/calendar grants checked for list/read/write/tool actions. User event suggestions/model tool calls pass same service validation, not separate less-restricted calendar API.

## P20 Automations, scheduler, subagents and timers

ScheduleService computes next occurrence from baseline RRULE/cadence/timezone, inserts unique occurrence and durable job atomically. Worker claim revalidates owner status/model/connection/target/grants. Baseline core automation last/next created/updated fields retain their own units; extension occurrence ms codec maps explicitly.

Execution uses GenerationService/tool/subagent ports; prompts/target chat/channel/folder/terminal snapshots versioned. Job retries apply operation-specific rules; no automatic repeated inference after unknown external outcome. Run history links success/error/chat output; schedule edits/deactivate/delete cancel unstarted future occurrences, not historical results. Catch-up/missed occurrence policy must match baseline profiles, not assumed “run every missed event”.

Subagent sessions have model/tools/budget/parent/cancel relationship; nested delegation recursion/output/context limits enforced with per-step usage and event metadata. Internal chats/timers/memory/compaction tasks have actual lifecycle/source behavior, not just hidden placeholder calls. Parent stop cascades pending jobs while recording independent side-effect outcomes.

## P21 Terminal, file workspace, Jupyter and Pyodide

ExecutionService registers authorized remote servers/auth/config; HTTP/WS terminal sessions use scoped actor/session/cwd/permissions, not arbitrary unauthenticated socket proxy. Resize/input/output/attach/reconnect/close events follow protocol; bounded output/backpressure and idle cleanup.

Workspace file operations normalize paths against session root, reject traversal/symlink escapes per server capability, validate edit revision, preview/download safely. File tree/search/diff/notebooks/JSON/SQLite/ports/browser previews captured baseline; temporary port URLs auth-bound and sandboxed.

Jupyter kernel/execution/session/artifact/package contracts preserved; Pyodide browser runtime loaded from official package distribution, not copied reference bundle. Browser code execution cannot access parent provider keys by artifact bridge. Runtime packages/outputs/files preserved according engine capability; worker/image resources scoped per session and user.

## P22 Feedback/evaluation/arena/usage

FeedbackService stores version/type/rating/comment/tags/meta/snapshot with grants/history/import-export contracts. Evaluation jobs have dataset/model/config revision/progress/results/error/cancel state; deterministic fixture comparison and model timing displayed with provenance. Arena/blind selection/votes/scoring/leaderboards follow baseline config/formulas; formulas captured reference instead of invented Elo implementation.

UsageAggregator reads immutable per-attempt facts with gateway-reported/missing/estimated/browser labels, daily/model/connection/timezone aggregation and personal/admin scope. End-to-end model/tool/subagent steps counted once; retries/cancel/partial usage follow gateway available facts. Unknown usage count not turned into zero. Date buckets DST-tested; model/connection deletion retains configured historical attribution without exposing secrets.

## P23 Admin operations and events

Admin panels bind ConfigRegistry/UserService/AccessService/ProviderService/ModelService/Analytics, not direct unchecked SQL. Health/version/setup/maintenance/import/export/cleanup profiles enforce role/status and safe credential masking. Custom brand/theme controls keep mandatory Kawan attribution.

EventRegistry covers all 191 observed event definitions; publish typed domain event + outbox, route configured targets/defaults/payload templates/auth/delivery policies. Webhook retries bounded/idempotency metadata, secrets encrypted and rate/egress restrictions apply. Test-delivery actually calls configured fixture/target and reports response; no success merely because target URL saved.

## Domain gate

Every domain: typed public contract, state machine, permissions, transaction/job boundary, config effects, failure/recovery, UI states, adapter selection, codecs and positive/negative fixtures. Provider/engine lacking test credentials remains unverified, not out of scope. Domains cannot report completed while tabs/controls or integration paths are inert. [Acceptance cases](../acceptance-scenarios.md) are minimum, all reference IDs need detailed fixtures.
