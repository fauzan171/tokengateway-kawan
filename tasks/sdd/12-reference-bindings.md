# SDD-12 — Reference bindings dan semantic closure

Baseline `f8ae8a6c328946dc62cd0712961a0632574581bf`. Metadata ini melengkapi existing inventories; tidak menyalin source bodies/aset atau membuktikan runtime parity.

[Registry](contract-registry.json) · [Adapter operation metadata](adapter-contracts.json) · [Engine dispatch review](runtime-branch-review.json)

## Baseline browser routes → Next ownership

57 source surfaces terdiri pages/layout/error/initialization hooks. Route groups `(app)` tidak menjadi path browser. Mapping handler/component final ditetapkan P00; initialization/error surface tetap obligations walaupun tidak menambah public URL.

| Source ID | Public route or layout scope | Surface | Suggested owner |
|---|---|---|---|
| PAGE-001 | `/` | +layout.svelte | P00 |
| PAGE-002 | `/` | +page.svelte | P00 |
| PAGE-003 | `/admin` | +layout.svelte | P23 |
| PAGE-004 | `/admin` | +page.svelte | P23 |
| PAGE-005 | `/admin/analytics` | +page.svelte | P22 |
| PAGE-006 | `/admin/analytics/[tab]` | +page.svelte | P22 |
| PAGE-007 | `/admin/evaluations` | +page.svelte | P22 |
| PAGE-008 | `/admin/evaluations/[tab]` | +page.svelte | P22 |
| PAGE-009 | `/admin/functions` | +page.svelte | P12 |
| PAGE-010 | `/admin/functions/create` | +page.svelte | P12 |
| PAGE-011 | `/admin/functions/edit` | +page.svelte | P12 |
| PAGE-012 | `/admin/settings` | +page.svelte | P23 |
| PAGE-013 | `/admin/settings/[tab]` | +page.svelte | P23 |
| PAGE-014 | `/admin/users` | +page.svelte | P03/P23 |
| PAGE-015 | `/admin/users/[tab]` | +page.svelte | P03/P23 |
| PAGE-016 | `/automations` | +layout.svelte | P20 |
| PAGE-017 | `/automations` | +page.svelte | P20 |
| PAGE-018 | `/automations/[id]` | +page.svelte | P20 |
| PAGE-019 | `/c/[id]` | +page.svelte | P05/P06 |
| PAGE-020 | `/calendar` | +page.svelte | P19 |
| PAGE-021 | `/channels/[id]` | +page.svelte | P17 |
| PAGE-022 | `/folders/[folderId]` | +page.svelte | P06 |
| PAGE-023 | `/home` | +layout.svelte | P00 |
| PAGE-024 | `/home` | +page.svelte | P00 |
| PAGE-025 | `/notes` | +layout.svelte | P18 |
| PAGE-026 | `/notes` | +page.svelte | P18 |
| PAGE-027 | `/notes/[id]` | +page.svelte | P18 |
| PAGE-028 | `/notes/new` | +page.svelte | P18 |
| PAGE-029 | `/playground` | +layout.svelte | P10 |
| PAGE-030 | `/playground` | +page.svelte | P10 |
| PAGE-031 | `/playground/completions` | +page.svelte | P10 |
| PAGE-032 | `/playground/images` | +page.svelte | P16 |
| PAGE-033 | `/workspace` | +layout.svelte | P00 |
| PAGE-034 | `/workspace` | +page.svelte | P00 |
| PAGE-035 | `/workspace/functions/create` | +page.svelte | P12 |
| PAGE-036 | `/workspace/knowledge` | +page.svelte | P13 |
| PAGE-037 | `/workspace/knowledge/[id]` | +page.svelte | P13 |
| PAGE-038 | `/workspace/knowledge/create` | +page.svelte | P13 |
| PAGE-039 | `/workspace/models` | +page.svelte | P10 |
| PAGE-040 | `/workspace/models/create` | +page.svelte | P10 |
| PAGE-041 | `/workspace/models/edit` | +page.svelte | P10 |
| PAGE-042 | `/workspace/prompts` | +page.svelte | P11 |
| PAGE-043 | `/workspace/prompts/[id]` | +page.svelte | P11 |
| PAGE-044 | `/workspace/prompts/create` | +page.svelte | P11 |
| PAGE-045 | `/workspace/skills` | +page.svelte | P11 |
| PAGE-046 | `/workspace/skills/create` | +page.svelte | P11 |
| PAGE-047 | `/workspace/skills/edit` | +page.svelte | P11 |
| PAGE-048 | `/workspace/tools` | +page.svelte | P12 |
| PAGE-049 | `/workspace/tools/create` | +page.svelte | P12 |
| PAGE-050 | `/workspace/tools/edit` | +page.svelte | P12 |
| PAGE-051 | `/` | +error.svelte | P00 |
| PAGE-052 | `/` | +layout.js | P00 |
| PAGE-053 | `/` | +layout.svelte | P00 |
| PAGE-054 | `/auth` | +page.svelte | P02 |
| PAGE-055 | `/error` | +page.svelte | P00 |
| PAGE-056 | `/s/[id]` | +page.svelte | P06 |
| PAGE-057 | `/watch` | +page.svelte | P00 |

## Core entities → data/service ownership

| DB ID | Physical table | Columns | Owner service |
|---|---|---:|---|
| DB-001 | `access_grant` | 7 | AccessService.authorize, GroupService, SCIM facade |
| DB-002 | `auth` | 6 | IdentityService, Auth.js JWT session, MFA/identity linking |
| DB-003 | `automation` | 11 | ScheduleService, AutomationOccurrence, GenerationService, SubagentCoordinator |
| DB-004 | `automation_run` | 6 | ScheduleService, AutomationOccurrence, GenerationService, SubagentCoordinator |
| DB-005 | `calendar` | 9 | CalendarService, RecurrenceCodec, AttendeePolicy |
| DB-006 | `calendar_event` | 16 | CalendarService, RecurrenceCodec, AttendeePolicy |
| DB-007 | `calendar_event_attendee` | 7 | CalendarService, RecurrenceCodec, AttendeePolicy |
| DB-008 | `channel` | 15 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-009 | `channel_member` | 17 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-010 | `channel_file` | 7 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-011 | `channel_webhook` | 9 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-012 | `chat_message` | 19 | GenerationService, ProviderAdapter, JobLease, EventDispatcher |
| DB-013 | `chat` | 17 | ChatService.mutate, TreeTransform, HistorySearch, ShareSnapshot |
| DB-014 | `chat_file` | 7 | ChatService.mutate, TreeTransform, HistorySearch, ShareSnapshot |
| DB-015 | `config` | 3 | ConfigRegistry, AdminFacade, EventRegistry, DeliveryTargets |
| DB-016 | `feedback` | 9 | FeedbackService, EvaluationJob, ArenaPolicy, UsageAggregator |
| DB-017 | `file` | 9 | FileService, StorageAdapter, ParserAdapter, ExtractionJob |
| DB-018 | `folder` | 10 | ChatService.mutate, TreeTransform, HistorySearch, ShareSnapshot |
| DB-019 | `function_history` | 7 | ToolRegistry, ToolExecutor, MCP/OpenAPI adapters, PluginExecutor |
| DB-020 | `function` | 12 | ToolRegistry, ToolExecutor, MCP/OpenAPI adapters, PluginExecutor |
| DB-021 | `group` | 10 | AccessService.authorize, GroupService, SCIM facade |
| DB-022 | `group_member` | 5 | AccessService.authorize, GroupService, SCIM facade |
| DB-023 | `knowledge` | 7 | KnowledgeService, IndexJob, Embedding/Vector/RerankAdapter |
| DB-024 | `knowledge_directory` | 7 | KnowledgeService, IndexJob, Embedding/Vector/RerankAdapter |
| DB-025 | `knowledge_file` | 7 | KnowledgeService, IndexJob, Embedding/Vector/RerankAdapter |
| DB-026 | `memory` | 8 | SearchAdapter, Crawler, MemoryService, ExternalKnowledgeAdapter |
| DB-027 | `message_reaction` | 5 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-028 | `message` | 13 | ChannelService, SocketRoom, MessageEvents, WebhookDelivery |
| DB-029 | `model_history` | 7 | ModelService, ProviderBinding, WorkspaceHistory, PlaygroundAdapter |
| DB-030 | `model` | 10 | ModelService, ProviderBinding, WorkspaceHistory, PlaygroundAdapter |
| DB-031 | `note` | 7 | NoteService, DocumentSync, CRDTCodec, FileService |
| DB-032 | `pinned_note` | 4 | NoteService, DocumentSync, CRDTCodec, FileService |
| DB-033 | `oauth_session` | 7 | IdentityService, Auth.js JWT session, MFA/identity linking |
| DB-034 | `prompt_history` | 7 | PromptService, SkillService, TemplateVariables, WorkspaceHistory |
| DB-035 | `prompt` | 12 | PromptService, SkillService, TemplateVariables, WorkspaceHistory |
| DB-036 | `shared_chat` | 7 | ChatService.mutate, TreeTransform, HistorySearch, ShareSnapshot |
| DB-037 | `skill_history` | 7 | PromptService, SkillService, TemplateVariables, WorkspaceHistory |
| DB-038 | `skill` | 11 | PromptService, SkillService, TemplateVariables, WorkspaceHistory |
| DB-039 | `tag` | 4 | ChatService.mutate, TreeTransform, HistorySearch, ShareSnapshot |
| DB-040 | `tool_history` | 7 | ToolRegistry, ToolExecutor, MCP/OpenAPI adapters, PluginExecutor |
| DB-041 | `tool` | 10 | ToolRegistry, ToolExecutor, MCP/OpenAPI adapters, PluginExecutor |
| DB-042 | `user` | 23 | IdentityService, Auth.js JWT session, MFA/identity linking |
| DB-043 | `api_key` | 8 | IdentityService, Auth.js JWT session, MFA/identity linking |

All individual columns/types/options/constraint descriptors tetap normatif di [schema inventory](../reference/schema.md). SDD-02 extension names tidak mengganti atau menyederhanakan entitas ini.

## Adapter catalogue → operation-specific work

| ID | Catalogue module | Phase | Operation signatures |
|---|---|---|---:|
| INT-001 | `datalab_marker` | P09 | 3 |
| INT-002 | `external_document` | P09 | 2 |
| INT-003 | `external_web` | P09 | 2 |
| INT-004 | `local` | P09 | 8 |
| INT-005 | `main` | P09 | 18 |
| INT-006 | `microsoft_web_iq` | P09 | 3 |
| INT-007 | `mineru` | P09 | 8 |
| INT-008 | `mistral` | P09 | 15 |
| INT-009 | `paddleocr_vl` | P09 | 2 |
| INT-010 | `pdf` | P09 | 4 |
| INT-011 | `tavily` | P09 | 2 |
| INT-012 | `youtube` | P09 | 5 |
| INT-013 | `chroma` | P13 | 10 |
| INT-014 | `elasticsearch` | P13 | 19 |
| INT-015 | `mariadb_vector` | P13 | 20 |
| INT-016 | `milvus` | P13 | 29 |
| INT-017 | `milvus_multitenancy` | P13 | 18 |
| INT-018 | `opengauss` | P13 | 16 |
| INT-019 | `opensearch` | P13 | 17 |
| INT-020 | `oracle23ai` | P13 | 27 |
| INT-021 | `pgvector` | P13 | 23 |
| INT-022 | `pinecone` | P13 | 22 |
| INT-023 | `qdrant` | P13 | 16 |
| INT-024 | `qdrant_multitenancy` | P13 | 18 |
| INT-025 | `s3vector` | P13 | 13 |
| INT-026 | `valkey` | P13 | 30 |
| INT-027 | `weaviate` | P13 | 14 |
| INT-028 | `azure` | P14 | 1 |
| INT-029 | `bing` | P14 | 2 |
| INT-030 | `bocha` | P14 | 2 |
| INT-031 | `brave` | P14 | 1 |
| INT-032 | `brave_llm_context` | P14 | 1 |
| INT-033 | `duckduckgo` | P14 | 1 |
| INT-034 | `exa` | P14 | 1 |
| INT-035 | `external` | P14 | 1 |
| INT-036 | `firecrawl` | P14 | 10 |
| INT-037 | `google_pse` | P14 | 1 |
| INT-038 | `jina_search` | P14 | 1 |
| INT-039 | `kagi` | P14 | 1 |
| INT-040 | `linkup` | P14 | 1 |
| INT-041 | `main` | P14 | 1 |
| INT-042 | `microsoft_web_iq` | P14 | 1 |
| INT-043 | `mojeek` | P14 | 1 |
| INT-044 | `ollama` | P14 | 1 |
| INT-045 | `openserp` | P14 | 1 |
| INT-046 | `perplexity` | P14 | 1 |
| INT-047 | `perplexity_search` | P14 | 1 |
| INT-048 | `searchapi` | P14 | 1 |
| INT-049 | `searxng` | P14 | 2 |
| INT-050 | `serpapi` | P14 | 1 |
| INT-051 | `serper` | P14 | 1 |
| INT-052 | `serphouse` | P14 | 1 |
| INT-053 | `serply` | P14 | 1 |
| INT-054 | `serpstack` | P14 | 1 |
| INT-055 | `sougou` | P14 | 1 |
| INT-056 | `staan` | P14 | 2 |
| INT-057 | `tavily` | P14 | 1 |
| INT-058 | `utils` | P14 | 54 |
| INT-059 | `yacy` | P14 | 1 |
| INT-060 | `yandex` | P14 | 2 |
| INT-061 | `ydc` | P14 | 2 |
| INT-062 | `provider` | P09 | 27 |
| INT-063 | `client` | P12 | 15 |

Katalog mempunyai 63 files, 508 function/method signature seeds; dispatcher/helper bukan provider independen. Operation signatures termasuk internal helpers; baseline semantic review mengidentifikasi protocol-facing operations dan error/default behavior.

## Runtime engine/provider branch seed

Selected AST conditions menghasilkan 135 dispatch review rows di runtime-branch-review.json. Ini mengangkat image/audio/embedding/provider choices yang berada dalam satu file dan belum tercakup sebagai adapter file terpisah. Setiap row punya source reference ID/line/selector/literal metadata tanpa body code. Tidak exhaustive untuk dynamic registry/match/indirect dispatch.

Review owner menetapkan selected engine → operation/config/auth/request/response/state/error/cancel fixtures. Add discovered protocols/branches sebagai coverage obligations dengan IDs baru, preserve counts/history, lalu lock expanded denominator pada P00. Jangan mengubah unknown branch menjadi N/A.

## 581 HTTP and realtime declarations

Source ID→mount/method/path/handler/param shape ada di [API inventory](../reference/api.md) dan descriptors [inventory.json](../reference/inventory.json). Kawan controller binds melalui SDD-03; canonical facade menggunakan service yang sama. Exact request/response/status/headers/auth flag/pagination/schema inheritance belum runtime-resolved. Semua declarations mempunyai owned coverage task; source classification awal boleh corrected ownership dengan ledger.

## 421 config keys / 67 Settings surfaces / 64 locales

Config/SET/LOC IDs tetap [settings inventory](../reference/settings.md). Each key mendapat spec type/evaluated default/env-persist precedence/secret/scope/permission/dependency/control/effect/reset; setiap UI field linked key/profile or local preference. Personal control registry dibangun sejak domain feature, full admin closure P23. Locale paths/signature keys bukan izin copy translations.

## Contract resolution record shape

Required fields: reference ID, source fingerprint, owner task/child, exact baseline profile, methods/inputs/defaults/validator/inherited fields, states/outputs/status/header/events, permissions/side-effects/units, golden fixture IDs, declared delta ID, test/assertion evidence, reviewer and review state. Unresolved row blocks implementation acceptance; design document tidak menyamarkan seed metadata sebagai final behavioral contract.
