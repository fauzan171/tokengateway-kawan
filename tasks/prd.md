# PRD Kawan — full-feature Open WebUI parity

> Referensi historis. Untuk pekerjaan baru baca [scope aktif](ACTIVE-SCOPE.md). Instruksi full-parity di bawah bukan scope default.

Baseline: `f8ae8a6c328946dc62cd0712961a0632574581bf`. Semua requirement di dokumen ini mandatory; status planned, belum implemented/verified.

Technical design dan developer handoff: [SDD](sdd/README.md), [contract registry](sdd/contract-registry.json) dan [work orders](sdd/work-orders/README.md). SDD mendetailkan implementasi requirement ini, bukan mengubah scope/claim verification.

## Product outcome

User/admin dapat menjalankan seluruh alur pada baseline Open WebUI dengan UI Kawan dan stack yang diminta, plus BYOK encrypted/user-owned active gateway dan monitoring connection. Feature flags, admin settings, role restrictions, transports, integrations dan offline/slim profiles merupakan bagian requirement, bukan alasan membuang fitur.

## Actor dan permission model

Anonymous/public reader, pending account, user, admin/operator, group member/resource owner, external API client, SCIM identity provider, worker/scheduler, plugin author dan remote integration client. Setiap aksi diuji allow/deny/cross-user/group/public/revoked sebagaimana baseline. First admin/setup/signup policy dan role defaults tidak disederhanakan menjadi semua account aktif.

## User journeys mandatory

Onboarding/auth/provider/model/chat; workspaces model/prompt/skill/tool/knowledge; chat documents/search/voice/images; sharing/import/export/data controls; collaboration channels/notes; calendar/automation/terminal; admin users/groups/providers/config/model/evaluation/analytics; self-host upgrade/offline/restore. Semua journey mencakup state empty/loading/error/success/permission denied dan restart/reload.

## Kontrak Kawan yang tetap wajib

BYOK onboarding "Hubungkan Gateway", placeholder `https://api.tokengateway.ai.id/v1`, Test koneksi/model count, multiple user-owned connections dan active connection model picker tetap mandatory pada P04. Mode default menerima key dari input user lalu menyimpan AES-256-GCM encrypted key menggunakan `ENCRYPTION_SECRET`; saved key tidak dikirim balik ke browser, hanya mask `sk-...abc1`. LLM requests berjalan melalui server Kawan. Mode Direct wajib tersedia, memakai browser-local key dan request gateway langsung tanpa key sync atau server fallback tersembunyi. Jadi pernyataan “tidak menyimpan key/tidak menjadi perantara” hanya cocok untuk jalur Direct, bukan mode default.

Branding Kawan/by tokengateway.ai.id, login/sidebar/onboarding attribution, URL signup helper, Connections empty/test-failed CTA, About version/repo dan metadata "Kawan — Chat AI by tokengateway.ai.id" mengikuti detail [plan](plan.md). Usage merupakan monitoring pribadi per model/connection, bukan billing token; missing usage tidak dibuat-buat. Semua core baseline features tetap mandatory di samping overlay ini.

## Feature requirements per domain

## P00 — Baseline, PRD dan fondasi

Root layout, initial setup, home, watch, error, workspace shell, offline/PWA behavior, feature flags dan fixture infrastructure.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P00-01 — Lock baseline dan source coverage | Validasi commit bersih, source fingerprints, inventory completeness serta dynamic paths yang perlu trace; hasilnya menjadi acuan differential test. | P00-01 |
| REQ-P00-02 — Golden behavior fixtures | Jalankan referensi terisolasi dengan synthetic data; rekam kontrak HTTP/WS, enabled/disabled controls, screenshot states tanpa menyalin kode/aset. | P00-02 |
| REQ-P00-03 — Scaffold stack Kawan | Siapkan Next 15, TypeScript strict, Tailwind 4, shadcn, AI SDK v5, Auth.js dan toolchain versi terkunci. | P00-03 |
| REQ-P00-04 — Shell dan navigasi full app | Bangun sidebar/home/chat/workspace/admin/playground serta routes, error/loading, mobile drawer dan keyboard sesuai baseline. | P00-04 |
| REQ-P00-05 — Test profiles dan service fixtures | Sediakan SQLite/Postgres test DB, provider/MCP/OAuth/Ollama/socket fixtures, fake clock, record/replay contracts tanpa real keys. | P00-05 |
| REQ-P00-06 — Feature registry dan change ledger | Petakan setiap inventory ID ke requirement/task/profile/test; catat seluruh deltas Kawan sebagai exception yang terukur. | P00-06 |

**Acceptance domain:** semua inventory rows milik P00 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P01 — Schema dan data compatibility

Seluruh 43 ORM models, 396 columns, constraints, JSON codecs, timestamp units, migration histories, legacy config dan import/export data.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P01-01 — Physical schema contract | Bandingkan deklarasi ORM dengan migrated live SQLite/Postgres; rekam types/defaults/nullability/indexes/FKs/partial predicates, tanpa menyalin migration source. | P01-01 |
| REQ-P01-02 — Identity dan config model mappings | Implementasikan User/Auth/ApiKey/OAuthSession/Config menggunakan Prisma map sesuai physical baseline; bukan reduced User schema. | P01-02 |
| REQ-P01-03 — Chat dan content model mappings | Petakan Chat/ChatMessage/ChatFile/SharedChat/Folder/Tag/File/Feedback dan JSONField/native JSON secara konsisten. | P01-03 |
| REQ-P01-04 — Workspace dan ACL model mappings | Petakan Model/Prompt/Skill/Tool/Function beserta history, Knowledge/directory/file, Group/GroupMember/AccessGrant. | P01-04 |
| REQ-P01-05 — Collaboration dan scheduling mappings | Petakan Channel/member/file/webhook, Message/reaction, Note/pinned, Calendar/events/attendees, Automation/run, Memory. | P01-05 |
| REQ-P01-06 — Migration and round-trip fixtures | Tulis SQL migrasi sendiri; clean install/legacy upgrades/introspection/JSON round-trip serta backup restore diuji dua provider. | P01-06 |
| REQ-P01-07 — Kawan extension tables | Tambahkan kw_connection/kw_secret/kw_generation/kw_usage/kw_mcp/kw_job/kw_rate_limit terpisah; core tables tidak diganti namanya. | P01-07 |

**Acceptance domain:** semua inventory rows milik P01 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P02 — Auth, account dan identity

Email/password, signup policy, first admin, pending accounts, session, account profile/password, MFA/recovery, API keys dan identity integrations.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P02-01 — Credentials dan onboarding roles | Register/login/logout, first admin/pending/active checks, password policy dan bcrypt/argon2 compatibility; Auth.js terikat User/Auth. | P02-01 |
| REQ-P02-02 — Session stamp dan API keys | Session revocation/expiry, bearer application keys, endpoint restrictions, user session metadata, cookies/CSRF dan durable auth rate limits. | P02-02 |
| REQ-P02-03 — Account profile dan password | Name/avatar/banner/bio/timezone serta password change/session revoke sesuai permissions dan field constraints. | P02-03 |
| REQ-P02-04 — MFA lifecycle | Enroll/verify/recovery/replacement/reset required, expiry/replay/attempt limits dan auth-method bypass policy sesuai baseline. | P02-04 |
| REQ-P02-05 — OAuth/OIDC providers | Provider registration/callback/refresh/merge/signup policies untuk seluruh provider config baseline; test identity linking dan failures. | P02-05 |
| REQ-P02-06 — LDAP dan trusted-header auth | Authentication/mapping/auto-provisioning serta trusted proxy boundaries dan disabled-auth/offline operator mode sesuai baseline. | P02-06 |
| REQ-P02-07 — Auth UI dan negative profiles | Semua login/account states dan authorization shapes dites lewat browser dan differential API fixtures. | P02-07 |

**Acceptance domain:** semua inventory rows milik P02 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P03 — RBAC, groups, access grants, SCIM

Admin/user/pending roles, resource read/write sharing, group hierarchy/inheritance, user management dan SCIM provisioning.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P03-01 — Resource ACL evaluator | Owner/admin/group/public grants dan per-feature permissions, termasuk perbedaan null/empty sharing policies baseline. | P03-01 |
| REQ-P03-02 — User administration | List/search/create/update/disable/delete users, activity/pagination/bulk actions dan admin access rules. | P03-02 |
| REQ-P03-03 — Group hierarchy | Create/edit/delete groups, parent inheritance/membership and cycle safety, effective permissions. | P03-03 |
| REQ-P03-04 — Sharing controls lintas resource | User/group/public read/write picker pada model/prompt/tool/knowledge/note/channel/file sesuai baseline. | P03-04 |
| REQ-P03-05 — SCIM provisioning | Bearer protected Users/Groups CRUD/PATCH/list/filter schema, identity sync/disable/deprovision behavior. | P03-05 |
| REQ-P03-06 — Authorization conformance | Role/resource/action matrix negative-positive lintas seluruh API dan UI; unauthorized controls tidak sekadar disembunyikan. | P03-06 |

**Acceptance domain:** semua inventory rows milik P03 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P04 — Providers, Connections dan BYOK

Global/admin providers, personal Direct, gateway BYOK, model aggregation, provider configs/header/auth, Ollama lifecycle, provider-native proxies.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P04-01 — Secret vault dan BYOK row | AES-GCM/AAD/rotation/mask, onboarding Test models, multiple owned connections, active selection and safe endpoint changes. | P04-01 |
| REQ-P04-02 — Admin OpenAI-compatible connections | Multiple URL/key/config, enable/order/provider options/model IDs/prefixes/custom params/headers/Azure/native provider behavior sesuai catalogue. | P04-02 |
| REQ-P04-03 — Model discovery aggregation | Base/effective model list, cache/invalidation/tag/order/filter collision semantics serta capability detection. | P04-03 |
| REQ-P04-04 — Ollama native connections | Models/tags/show/pull/create/delete/copy/version/chat/generate/embeddings/load-unload progress dan cancellation sesuai endpoints. | P04-04 |
| REQ-P04-05 — Direct provider mode | Browser-local keys, direct models/chat/integrations/CORS/device loss/logout; tanpa raw key sync ke Kawan. | P04-05 |
| REQ-P04-06 — Outbound policy dan native proxy | HTTP methods/path/header/stream/image/provider payload compatibility dengan redirect/DNS/SSRF controls dan operator private allowlist. | P04-06 |
| REQ-P04-07 — Connection UI parity | User/Admin modals, test states, editable config/passthrough, connection status dan branding gateway CTA. | P04-07 |

**Acceptance domain:** semua inventory rows milik P04 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P05 — Chat execution, task lifecycle dan realtime

Streaming/non-streaming, stop/retry, task IDs, sockets, temporary chat, background completion, queue, multi-model replies, context variables/tasks.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P05-01 — Generation claim dan persistence | Durable job/run/idempotency/lease, placeholders/status/checkpoints, owner/revision guards dan endpoint compatibility. | P05-01 |
| REQ-P05-02 — Completion provider execution | AI SDK plus native protocol adapters; message mapping, params, attachments, system context, request/response shapes and safe errors. | P05-02 |
| REQ-P05-03 — Stream/SSE/socket events | Reference event/payload/task IDs and browser bridge; chunk/Unicode/tool/reasoning/usage states, reconnect and ordering. | P05-03 |
| REQ-P05-04 — Stop, queue dan background completion | Cancel durable jobs, partial output, multi-instance completion/disconnect, queue semantics, task cleanup and resumable UI. | P05-04 |
| REQ-P05-05 — Multi-model response fan-out | Model selections produce parallel responses and per-model statuses/stop/usage; tabs/comparison modes sesuai baseline. | P05-05 |
| REQ-P05-06 — Temporary chat dan context compaction | Non-persistent mode rules, recoverable tasks/usage policy, context summary/checkpoints, variables/default user data interpolation. | P05-06 |
| REQ-P05-07 — Generated title/tags/follow-ups/autocomplete | Background task model selection, params/prompts, enable flags and no accidental duplicate requests. | P05-07 |
| REQ-P05-08 — Chat execution regression | Happy/error/timeout/offline/race/abort/reload suites; every token/state event mapped to baseline or declared exception. | P05-08 |

**Acceptance domain:** semua inventory rows milik P05 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P06 — History, tree, folders, tags, share dan data controls

Edit/regenerate/branch, clone/fork, nested folders/sharing, archive/unread/search, export/import/shared snapshots and bulk actions.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P06-01 — Message tree editing | User in-place edit vs submit-as-sibling, assistant in-place vs copy, regenerate/continue/model-slot and sibling navigation; baseline delete-message removes immediate children and reparents grandchildren, distinct from explicit subtree deletion. | P06-01 |
| REQ-P06-02 — History search and ordering | Title/content/search filter tags/folders/pinned/archived/shared, unread/read timestamps, cursor pagination/date groups. | P06-02 |
| REQ-P06-03 — Folder hierarchy and sharing | Recursive folders/reparent/move/cycle prevention, knowledge attachments/folder context and shared folder grants. | P06-03 |
| REQ-P06-04 — Tags, pin dan archive | Tags CRUD/auto tags, pin/unpin, archive/unarchive, rename/delete/unread and bulk actions. | P06-04 |
| REQ-P06-05 — Clone/fork/share snapshots | Clone whole or selected subtree, public share modes, snapshot updates/revoke/clone/read-only permissions sesuai baseline. | P06-05 |
| REQ-P06-06 — Import/export formats | Open WebUI-compatible JSON versioned payload/tree; text/Markdown/PDF exports, ChatGPT import where present, bulk backup/data controls. | P06-06 |
| REQ-P06-07 — History cleanup and integrity | Delete semantics preserve authorized references/usage; import malicious/cyclic/cross-owner payloads rejected; branch round-trip tests. | P06-07 |

**Acceptance domain:** semua inventory rows milik P06 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P07 — Message rendering, composer dan artifacts

Full Markdown/extensions, rich text composer/mentions, reasoning/structured outputs, citations, math/diagrams/code blocks/artifacts previews.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P07-01 — Markdown extension rendering | GFM, code/highlight, KaTeX/math, Mermaid, citations/footnotes/details/alerts/colon fences/mentions sesuai source surfaces. | P07-01 |
| REQ-P07-02 — Rich text composer and mentions | Editor formatting/commands/prompt suggestions, @model/#knowledge/notes references, queued drafts/paste/image actions. | P07-02 |
| REQ-P07-03 — Structured outputs and reasoning | Response parts, streaming reasoning/details, code execution/subagent results, error/status metadata without fabricated reasoning. | P07-03 |
| REQ-P07-04 — Message actions and feedback UI | Copy/edit/continue/regenerate/rate/comment/delete/TTS actions and availability sesuai role/feature/temporary flags. | P07-04 |
| REQ-P07-05 — Artifacts preview and editing | Code/HTML/iframe/SVG/interactive previews, artifact edits/downloads with sandbox isolation and configured behavior. | P07-05 |
| REQ-P07-06 — Overview and comparison views | Message-tree flow overview, multi-response modes, embeds and message virtualisation/scroll preferences. | P07-06 |
| REQ-P07-07 — Rendering/accessibility goldens | Every message/composer surface state at desktop/mobile, keyboard/IME/copy, incomplete streaming Markdown and unsafe content controls. | P07-07 |

**Acceptance domain:** semua inventory rows milik P07 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P08 — Seluruh personal Settings dan localization

General, Interface, Notifications, Shortcuts, Connections, Tools, Personalization, Audio, Data Controls, Usage, Archived Chats, Account, About; all locale coverage.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P08-01 — Settings navigation and search | Tab/search/deep link/save/reset behavior, state ownership and available controls berdasarkan permissions. | P08-01 |
| REQ-P08-02 — General/model parameters | Theme/language/system defaults plus every generation parameter/custom param, profiles and persistence precedence. | P08-02 |
| REQ-P08-03 — Interface preferences | Density/type scale/font/layout/bubbles/widescreen/background/markdown/scroll/collapse/floating controls/haptics sesuai settings catalogue. | P08-03 |
| REQ-P08-04 — Shortcuts and notification controls | Shortcut discovery/remapping/supported hotkeys, browser/sound notification states and disabled permissions. | P08-04 |
| REQ-P08-05 — Personalization/memory/audio/data panels | Controls all connected to real feature services; Account/Usage/Archive/About not placeholder panels. | P08-05 |
| REQ-P08-06 — All baseline locales | 64 locale surfaces, interpolation/plurals/date/RTL/fallback and glossary; translations written independently. | P08-06 |
| REQ-P08-07 — Settings value conformance | Every SET/CFG/Pydantic UI field gets default/change/persist/reset/disabled-state test; no unimplemented toggles. | P08-07 |

**Acceptance domain:** semua inventory rows milik P08 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P09 — Files, storage dan document processing

Upload/preview/extract/delete/search/access, folders/cloud file pickers, image/video/audio/docs/spreadsheets/PDF/OCR where supported; async extraction and lifecycle.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P09-01 — Storage backends and private access | Local/S3/GCS/Azure-style configured storage adapters present in baseline, signed access/ownership/range/cleanup semantics. | P09-01 |
| REQ-P09-02 — Upload/file records and formats | Mime/size/quota/hash metadata, direct upload and file states; all baseline supported document/media inputs catalogued. | P09-02 |
| REQ-P09-03 — Document parsing and OCR pipelines | PDF/Office/text/HTML/table/media extraction plus local/external parser engines; job progress and retry semantics. | P09-03 |
| REQ-P09-04 — Image/media preprocessing | Resize/compression/HEIC and image payloads, audio/video preprocessing, model file capabilities. | P09-04 |
| REQ-P09-05 — Cloud drive pickers | Google Drive/OneDrive auth/config pickers, file selection/import/progress/error/security ownership. | P09-05 |
| REQ-P09-06 — Files UI and lifecycle | Files modal/FileNav previews/search/download/delete/bulk actions, shared references and expired orphan cleanup. | P09-06 |

**Acceptance domain:** semua inventory rows milik P09 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P10 — Workspace models dan Playground

Custom model wrappers/presets/agents, capabilities/params/tools/knowledge/avatar/tags/sharing/versioning, base model management and playground chat/completions/images.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P10-01 — Model CRUD and metadata | Custom wrappers with base model, name/avatar/tags/capabilities/system/default params and resource grants. | P10-01 |
| REQ-P10-02 — Model revisions and history | Version create/select/rollback/clone/import/export and history consistency with model_id resolution. | P10-02 |
| REQ-P10-03 — Model capabilities and binding | Tools/knowledge/skills/functions/variables availability and per-user/group constraints enforced at inference. | P10-03 |
| REQ-P10-04 — Admin model management | Multiple provider models/Ollama management, order/default/visibility/load/unload/cache operations and progress states. | P10-04 |
| REQ-P10-05 — Playground surfaces | Chat/completions/images mode params/request/response/streaming/export behavior aligned with available providers. | P10-05 |
| REQ-P10-06 — Community model import/export | Validated preset/community/external origin interactions, metadata/version handling, no automatic untrusted execution. | P10-06 |

**Acceptance domain:** semua inventory rows milik P10 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P11 — Prompts, skills dan version histories

Workspace prompt templates/slash commands/variables/localized metadata and reusable skills/files/versions/sharing/import/export.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P11-01 — Prompt CRUD and commands | Create/edit/delete/search templates, slash command uniqueness, variables/forms, activation and access. | P11-01 |
| REQ-P11-02 — Prompt versions and import/export | Version IDs/history/diff/rollback/public references and compatible JSON payloads. | P11-02 |
| REQ-P11-03 — Skill CRUD and files | Instructions plus skill file operation validation, names/tags/description/localized metadata and activation. | P11-03 |
| REQ-P11-04 — Skill history and sharing | Version snapshots/diff/restore, resource grants, import/export and owner consistency. | P11-04 |
| REQ-P11-05 — Composer/model integration | Select prompts/skills, render variables and combine instructions at documented precedence without leaking private resources. | P11-05 |
| REQ-P11-06 — Community workspace flows | External import prompts, origin validation, preview/confirm and round-trip compatibility. | P11-06 |

**Acceptance domain:** semua inventory rows milik P11 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P12 — Tools, MCP, functions, pipelines dan integrations

MCP/MCPO/OpenAPI remote tool servers, OAuth/auth/elicitation, local tool definitions, Python functions/filters/pipes/actions, valves, marketplace/versioning.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P12-01 — Tool server CRUD/discovery/auth | Remote endpoint profiles, Bearer/custom/OAuth credentials, OpenAPI/MCPO/MCP schemas, connection lifecycle and resource grants. | P12-01 |
| REQ-P12-02 — MCP transports and elicitation | HTTP/SSE and operator-local transport where baseline supports it, OAuth redirects, tool/resource/prompt discovery and ask-user lifecycle. | P12-02 |
| REQ-P12-03 — Tools composer and execution | Selected/deferred tools, allowlist/search, namespacing, validated inputs/results, multi-step model use, abort and history replay. | P12-03 |
| REQ-P12-04 — Python tool/function runtime | Own isolated executor for baseline Python plugin interface; packages/source reviewed, per-user valves/event hooks, no web-process arbitrary execution. | P12-04 |
| REQ-P12-05 — Filters, pipes and actions | Inlet/outlet/stream hooks, model pipe selection/actions/buttons and priority/order semantics with error isolation. | P12-05 |
| REQ-P12-06 — Pipelines admin and versions | Upload/install/config/delete pipelines, history for Tool/Function, rollback/import/export/community interfaces. | P12-06 |
| REQ-P12-07 — Integration conformance | Actual tool calls/results/model continuation, auth expiry/timeout/collision/side-effects, permission and resource cleanup tests. | P12-07 |

**Acceptance domain:** semua inventory rows milik P12 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P13 — Knowledge, RAG, embeddings dan vector stores

Knowledge hierarchy/files/grants, all document/index/query/RAG config, embedding/rerank/hybrid modes, citations and supported vector backends.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P13-01 — Knowledge CRUD and hierarchy | Collections/directories/files/metadata/access grants, bulk operations/search/sort/shared contexts. | P13-01 |
| REQ-P13-02 — Indexing pipeline | Load/chunk/embed/upsert jobs with collection permissions/idempotency/progress/reindex/cancel/delete propagation. | P13-02 |
| REQ-P13-03 — Embedding engines and models | Local/remote provider/model/config/update/download operations, batch/token/timeout handling. | P13-03 |
| REQ-P13-04 — Retrieval and reranking | Semantic/hybrid/BM25/full-context/focused query, top-k/threshold/reranker/merge and metadata filters. | P13-04 |
| REQ-P13-05 — Citation/source integration | Grounded context assembled only from authorized docs; source retrieval, quotes, citations and file preview in chat. | P13-05 |
| REQ-P13-06 — Vector store engine contracts | All engine options in baseline remain required; profile-specific adapters tested for indexes/filters/tenant scope/delete. | P13-06 |
| REQ-P13-07 — RAG config and admin document panels | All catalogue keys/control defaults/persist/reset/config endpoints, external knowledge/loaders and upgrade behavior. | P13-07 |

**Acceptance domain:** semua inventory rows milik P13 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P14 — Web search, memories dan context integrations

Web engines/crawl/loaders/search/query generation, consent/context, memory CRUD/user context/background review and external document knowledge.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P14-01 — Search provider catalogue | All supported web engines credentials/params/results/rate limits mapped to external search adapters. | P14-01 |
| REQ-P14-02 — Web loading/crawling and citations | Safe URL fetch/parse/multilanguage/context extraction, image/source search and citation metadata. | P14-02 |
| REQ-P14-03 — Search composer and task integration | Enable/always/manual selection, query generation/model tasks/provider consent and answer grounding. | P14-03 |
| REQ-P14-04 — Memory CRUD and retrieval | User memories/types/path/metadata, create/edit/delete/search/extract/query and context owner scoping. | P14-04 |
| REQ-P14-05 — Background memory review | Review cadence/char limits/user controls, model-assisted updates and prevention of cross-user pollution. | P14-05 |
| REQ-P14-06 — External knowledge APIs | Configured external loaders/retrieval integrations and file/content access/auth/error profiles. | P14-06 |

**Acceptance domain:** semua inventory rows milik P14 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P15 — Audio, STT/TTS dan realtime voice

Voice recording/input/transcription/TTS playback/voices/local engines/realtime calls and all audio config/provider profiles.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P15-01 — Recording and transcription UI | Mic permissions/devices/record-upload/progress/error, transcription insertion and mobile lifecycle. | P15-01 |
| REQ-P15-02 — STT engines | Local Whisper plus configured OpenAI/Deepgram/Azure and engine branches inventory; preprocessing/chunks/limits/model updates. | P15-02 |
| REQ-P15-03 — TTS engines and voices | Generate/cache/stream speech, voice list/model/options/defaults/provider adapters and interruption controls. | P15-03 |
| REQ-P15-04 — Realtime voice session | Realtime provider token/server bridge/WebSocket, turn-taking/VAD/transcript/model tools and call disconnect. | P15-04 |
| REQ-P15-05 — Audio settings and local inference worker | Admin/personal controls, engine readiness/GPU/offline profile and resource lifecycle. | P15-05 |
| REQ-P15-06 — Audio conformance profiles | Fake audio/provider tests plus capability device smoke; no fake transcription or success without external engine. | P15-06 |

**Acceptance domain:** semua inventory rows milik P15 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P16 — Image generation/editing dan media playground

Image generate/edit settings and provider engines, ComfyUI workflows, AUTOMATIC1111, OpenAI/Gemini branches, uploads and generated output history.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P16-01 — Generation provider engines | Config/test/model discovery and actual generate requests across all baseline branches. | P16-01 |
| REQ-P16-02 — ComfyUI/Automatic1111 workflows | Workflow node mapping/params/sampler/model controls, polling/stream progress/upload and cancellation. | P16-02 |
| REQ-P16-03 — Image edit and masks | Reference image/mask upload, edit provider options, generated output/metadata and safe storage. | P16-03 |
| REQ-P16-04 — Chat and playground integration | Composer generation/edit action, image prompt task, progress/error/history/gallery/download behavior. | P16-04 |
| REQ-P16-05 — Media permissions and quota | Image feature/model/user permission gates, secret protection/private file access and content limits. | P16-05 |
| REQ-P16-06 — Engine conformance matrix | Fixtures each backend success/failure/unsupported feature; real configured engine smoke before parity claim. | P16-06 |

**Acceptance domain:** semua inventory rows milik P16 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P17 — Channels, messaging dan realtime collaboration

Channel CRUD/share/members/messages/replies/reactions/pins/files/webhooks/model interactions/notifications/presence/socket rooms.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P17-01 — Channel/member management | Create/edit/archive/delete/search channel and participant membership/access controls. | P17-01 |
| REQ-P17-02 — Channel message threads | Messages/replies/edit/delete/reactions/pins, cursor/history/read status and attachment metadata. | P17-02 |
| REQ-P17-03 — Realtime rooms and presence | Socket room join/leave/heartbeat/events/order/reconnect, online status and cross-instance relay. | P17-03 |
| REQ-P17-04 — Files/webhooks and external events | ChannelFile/webhook CRUD/auth/payload limits, inbound/outbound event policies. | P17-04 |
| REQ-P17-05 — Model and automation channel integration | Mention model/selected chat/task action and scheduled targets use correct channel ACL/context. | P17-05 |
| REQ-P17-06 — Collaboration race tests | Simultaneous edits/join/revoke/delete, private room isolation and seconds/ns timestamp precision. | P17-06 |

**Acceptance domain:** semua inventory rows milik P17 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P18 — Notes, rich editor dan collaborative documents

Personal/shared notes, pinned notes, search/folders/model assistance, rich content/export/import and Yjs collaboration.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P18-01 — Notes CRUD and organization | Create/edit/delete/pin/search/share/grants/tags/folder linkage and note content metadata. | P18-01 |
| REQ-P18-02 — Rich editor and content transforms | Baseline rich text/Markdown/editor commands/media/table/code/export interfaces without content loss. | P18-02 |
| REQ-P18-03 — Collaborative document sync | Yjs update/state/awareness room protocol, reconnect/conflict/persistence and ACL checks. | P18-03 |
| REQ-P18-04 — Note/chat integrations | Mentions/context references/model assisted actions/citations and selected note permissions. | P18-04 |
| REQ-P18-05 — Pinned and shared note navigation | Home/sidebar/pinned list/shared detail, access-loss/delete and owner lifecycle. | P18-05 |
| REQ-P18-06 — Note round-trip and race conformance | Concurrent documents, file attachments, serialize/import/export and read-only role tests. | P18-06 |

**Acceptance domain:** semua inventory rows milik P18 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P19 — Calendars, events dan attendees

Calendars/default/color/sharing, event CRUD/ranges/recurrence/attendee responses/agent integrations and timezone.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P19-01 — Calendar management | Create/edit/delete/default calendars, grants/color/meta and calendar navigation. | P19-01 |
| REQ-P19-02 — Event editor and range queries | Timed/all-day/location/description events, create/edit/cancel/delete and date ranges. | P19-02 |
| REQ-P19-03 — Recurrence and timezone | RRULE expansion/minimum intervals/exceptions/series modification, DST and bounded evaluation. | P19-03 |
| REQ-P19-04 — Attendees and permissions | Invite/status/pending/response/lifecycle, resource grants, private event fields and access loss. | P19-04 |
| REQ-P19-05 — Calendar model/tool integration | Chat tools/event suggestions and authorized calendar actions match baseline supported flows. | P19-05 |
| REQ-P19-06 — Calendar UI and boundary fixtures | Month/week/list/editor states from source; DST/recurrence overlaps/attendee race E2E. | P19-06 |

**Acceptance domain:** semua inventory rows milik P19 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P20 — Automations, schedules, subagents dan background work

Scheduled prompts/models/RRULE folders/targets/terminal, run history, timers/internal chats/subagents/review and task ownership.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P20-01 — Automation CRUD and schedules | Name/prompt/model/rrule/folder/target/terminal config, active state, next-runs UI. | P20-01 |
| REQ-P20-02 — Durable scheduler and execution | Exactly-once claim/idempotency/leases, next/last run, retries, offline/catch-up/timezones and limits. | P20-02 |
| REQ-P20-03 — Runs/targets/notifications | History success/error links, chat/channel targets, stop/delete/access revoked/provider key changes. | P20-03 |
| REQ-P20-04 — Subagent model orchestration | Configured subagent models/limits/prompts/internal chats, selected tools/delegation/result/event UI sesuai baseline. | P20-04 |
| REQ-P20-05 — Timers and compaction hooks | Chat timer/internal task paths, status/unread/summary and background context/memory work integration. | P20-05 |
| REQ-P20-06 — Restart and multi-instance tests | Scheduler restart/race/revocation/no duplicate inferensi, job retention and failure recovery. | P20-06 |

**Acceptance domain:** semua inventory rows milik P20 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P21 — Terminal, code execution, file workspace dan browser bridge

Remote terminal servers, HTTP/WS sessions, code interpreter Jupyter/Pyodide, file tree/edit/preview/diff/ports/notebooks/SQLite and execution tools.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P21-01 — Terminal server connections | Admin/personal configuration/auth/access/test, remote HTTP/WS routing and session ownership. | P21-01 |
| REQ-P21-02 — Terminal sessions and dock | Create/attach/resize/input/output/close terminal, reconnect/cwd/chat linkage and real xterm UI behavior. | P21-02 |
| REQ-P21-03 — File workspace browser/editor | List/tree/upload/download/rename/delete/bulk/edit/diff/search/JSON/notebook/SQLite preview and path safety. | P21-03 |
| REQ-P21-04 — Jupyter/Pyodide execution | Code execution engine settings/auth/timeouts, packages/artifacts/output/files and kernel/session cleanup. | P21-04 |
| REQ-P21-05 — Port/browser previews and interactions | Remote port preview, sandbox/iframe bridge/browser-related tool actions supported by baseline, explicit session permissions. | P21-05 |
| REQ-P21-06 — Execution containment conformance | Isolated worker/egress/fs/process/resource policies, user separation/cancel/disconnect and generated file privacy. | P21-06 |

**Acceptance domain:** semua inventory rows milik P21 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P22 — Feedback, evaluations, arena, analytics dan usage

Ratings/comments/annotations/datasets/model evaluations/arena, user/admin analytics/heatmaps/token timing/connection monitoring.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P22-01 — Feedback persistence | Message rating/comment/tags/details/snapshot/update/delete/export and available permissions. | P22-01 |
| REQ-P22-02 — Evaluation datasets and jobs | Create/configure/evaluate model runs, progress/results/dataset management and statistical display. | P22-02 |
| REQ-P22-03 — Arena/blind comparison | Model selection/blind votes/scoring/leaderboards/history/control flags sesuai enabled baseline. | P22-03 |
| REQ-P22-04 — Usage aggregation and heatmaps | Original personal totals/daily/weekly/cumulative plus kw usage connection filter, reported/missing/browser sources and token/timing models. | P22-04 |
| REQ-P22-05 — Admin analytics dashboards | User/model/chat/activity/usage filter/export drill-down, admin data access and bounded queries. | P22-05 |
| REQ-P22-06 — Analytics numerical conformance | Usage every model/tool/subagent step once, timezone buckets/dedup/absent usage/privacy and comparison dataset tests. | P22-06 |

**Acceptance domain:** semua inventory rows milik P22 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P23 — Seluruh Admin Settings, events dan operations

General/auth/interface/connections/models/audio/images/documents/web search/code/tools/subagents/evaluations/pipelines/external knowledge/database/events/I18n.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P23-01 — Config registry and precedence | All 421 persistent keys plus env occurrences; defaults/env/persist overrides/reset/import/export and secret references. | P23-01 |
| REQ-P23-02 — All admin panels and search | Every Settings source surface mapped to working control, visibility permissions and pending/error/success states. | P23-02 |
| REQ-P23-03 — Notification targets and event webhooks | 191 event definitions, target CRUD/default/test, routing/payload templates/auth and safe delivery lifecycle. | P23-03 |
| REQ-P23-04 — Database and system operations | Health/version/update/import/export/maintenance/access defaults/slim-offline options and admin destructive operations with clear review. | P23-04 |
| REQ-P23-05 — Interface/brand/localization administration | Banners/notices/model order/defaults/I18n and display settings preserve Kawan required attribution. | P23-05 |
| REQ-P23-06 — Admin config change conformance | Every key/type/default/control is tested with enabled/disabled profiles; secrets never returned raw or traced. | P23-06 |

**Acceptance domain:** semua inventory rows milik P23 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## P24 — Compatibility, full acceptance dan self-host release

Complete feature/schema/API/event/settings conformance, data migration, production multi-service deployment, backup/restore/offline and release handover.

| Requirement | Behavior yang wajib | Task |
|---|---|---|
| REQ-P24-01 — Endpoint and payload differential closure | 581 HTTP/WS declarations plus 446 shape descriptors compared status/body/headers/permissions/pagination/stream behavior. | P24-01 |
| REQ-P24-02 — Schema and import/export closure | 43 models/396 fields/64 migrations physical semantics, legacy JSON/timestamp/hashes and SQLite/Postgres round trips. | P24-02 |
| REQ-P24-03 — UI/settings/locale parity closure | 57 route surfaces/645 components/67 settings surfaces/64 locales with enabled/disabled/mobile/read-only/error screenshots. | P24-03 |
| REQ-P24-04 — All adapter/profile closure | Every integration catalogue/provider branch gets protocol fixture and configured environment smoke; missing external service is not a global pass. | P24-04 |
| REQ-P24-05 — Production deployment and CI | Node web + worker/socket/queue + Postgres/vector/private storage; containers/proxy/SSE/WS/migrations/rollback/backup/restore docs tested. | P24-05 |
| REQ-P24-06 — Performance/security/accessibility verification | Load/context/long histories/large docs/queues, SSRF/ACL/XSS/plugin sandbox, auth/rate limits/telemetry redaction and accessible UI. | P24-06 |
| REQ-P24-07 — Final owner handover and publish review | Report closed obligations/open failures/declared deltas, real test evidence and exact commit; deployment/publication separate explicit instruction. | P24-07 |

**Acceptance domain:** semua inventory rows milik P24 diterapkan dan dibandingkan terhadap synthetic reference profile; payload/permission/error/restart/UI states sesuai baseline. Semantics tidak boleh diganti dengan implementasi yang lebih sederhana tanpa exception tertulis.

## Detail requirement yang bersifat exhaustive

Requirement tables di atas adalah kelompok kerja. Detail enumerasi bukan berhenti pada ringkasan: seluruh row berikut termasuk mandatory scope dan harus ikut acceptance.

| Detail | Sumber normatif |
|---|---|
| Tabel/kolom/types/defaults/constraints | [schema inventory](reference/schema.md) + [schema contract](schema-contract.md) |
| Endpoint/payload schemas/events | [API inventory](reference/api.md) dan descriptors/validators di [inventory.json](reference/inventory.json) |
| Config/env/settings/locales/adapters | [Settings inventory](reference/settings.md) dan inventory JSON |
| Seluruh page/layout/component surface | [UI inventory](reference/ui.md) |
| Task dan status setiap obligation | [Coverage registry](coverage.json) |

Dynamic controls, provider branches, inherited payload fields dan effects yang tidak bisa diketahui hanya dari static scan tetap dianggap mandatory. P00 mengurai behavior; tidak mengubah source yang belum dipahami menjadi out of scope.

## UX equivalence contract

Recreate seluruh surface dan navigasi reference: hierarchy/density/menu/actions/shortcuts/modal/search/progress/states and desktop/mobile/RTL/theme behavior. Gunakan synthetic data yang sama untuk screenshot comparison. Perbedaan logo/wordmark/by attribution/assets adalah brand exception. Tidak menyalin assets/source/translations. Tidak mengganti workspace/admin screens dengan satu dashboard generik.

## Data/API equivalence contract

Core physical names/fields/JSON payloads/relationships/indexes dan timestamp units mengikuti pinned reference. API reference-compatible path/method/body/status/header/authorization/pagination/event behavior merupakan kontrak; extensions Kawan punya routes/tables sendiri. Schema compatibility, API compatibility dan token compatibility harus diuji terpisah; tidak ada klaim drop-in karena nama field sama.

## Non-functional acceptance

Role/ACL isolation, credential redaction/encryption, bounded resource usage, multi-instance durable jobs/socket propagation, private file/vector access, plugin sandbox, accessibility/keyboard/IME, mobile safe areas, context/long-history performance, clean self-host, backup/restore/rollback dan provider-disabled states wajib lulus. Performance thresholds ditetapkan dari baseline benchmark pada hardware/test dataset yang sama di P00, kemudian menjadi automated regression budgets.

## Declared product exceptions

Branding/assets Kawan; secret encrypted at rest dan masked response (tidak mengembalikan key referensi mentah); personal BYOK onboarding/active connection overlay; stack/runtime rewrite. Exceptions tidak menghapus fitur domain. Bila perubahan privacy/security mengubah API payload, compatibility mapping dan test harus menyatakannya secara terbuka, bukan diberi label exact.

## Product completion criteria

Seluruh requirement + registry obligation implemented/verified, setiap profile teruji, no open unexplained delta, schema/API/UI evidence lengkap. Sebelum itu status hanya planned/partial/preview; bukan 100% produk sama.
