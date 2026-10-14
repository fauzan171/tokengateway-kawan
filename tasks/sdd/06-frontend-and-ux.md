# SDD-06 — Frontend architecture dan screen behavior

Owner P00/P04/P06/P07/P08/P23. All [57 route/layout surfaces](../reference/ui.md), 645 components and 67 Settings surfaces are baseline targets. Component count includes icons/helpers; recreate experience with original Kawan assets/source.

## State ownership

| State | Authority | Client cache/lifecycle |
|---|---|---|
| Session/actor/effective grants | Server identity/access | Safe projection; invalidate on revoke/stamp changes |
| Chat tree/current leaf/revision | ChatService + SQL | Normalized tree reducer; optimistic operation journal, rollback/reconcile 409 |
| Generation state/parts | Durable run/event log | Per-run cursor/dedup reducer; active branch render projection |
| Composer draft/uploads/local editor selection | Browser tab/device | Namespace user/chat; survive navigation according to settings; no secret sync |
| Personal/admin settings | ConfigRegistry/core settings | Typed effective defaults/provenance/revision; pending save/rollback states |
| Active personal connection metadata | Server extension | User/revision scoped models cache; direct key device-local |
| Direct key and device capability | Browser only | LocalStorage namespace; re-entry if unavailable, cleanup controls |
| Note document/awareness | Document service/CRDT | Yjs state; awareness ephemeral; reconnect vector reconciliation |
| Sidebar/history/folders | Server resources | Paginated query cache; invalidated by domain events/search/mutation |

Do not place full history/secret-bearing config in root React context. Use local hooks/reducer and typed service clients; introduce cache/store library only when ownership/invalidation benefit is concrete. Server components render shell/initial safe state; interactive chat/settings/editor client components. Lazy-load editors, Mermaid/math/artifact/audio/terminal heavy modules by feature, not chat initial bundle.

## Component responsibilities

AppShell manages responsive sidebar/nav, user menu, active resource and footer branding. ChatWorkspace composes header/model picker/tree-view/scroll viewport/composer but contains no provider/auth/SQL implementation. MessageTree reducer handles normalized nodes/current leaf/revision; MessageRenderer consumes typed parts. ChatTransport maps protocol events to reducer. ConnectionManager separates server secret form from Direct local credential form. Settings panels bind registry specs instead of independent boolean copies.

Minimum reusable primitives: Kawan wordmark/icon, modal/drawer/dialog, command/search palette, model picker, tooltip/menu, pending action button, safe error panel, file tile/preview, progress/status badge, permission sharing picker, editor actions, copy code, citation viewer. shadcn components adapted with original tokens; business behaviors not hidden inside generic UI abstraction.

## Screen specifications

### Auth/setup and BYOK onboarding

Centered auth surface with name/logo/version/setup/login/signup states per baseline; footer `by tokengateway.ai.id`. Credentials error inline and accessible; submit pending prevents duplicate mutation; password manager/autocomplete/keyboard supported. MFA challenge separate state, not regular logged-in UI before verification.

After first login without eligible personal connection, show "Hubungkan Gateway" overlay journey. Fields Name, Base URL placeholder `https://api.tokengateway.ai.id/v1`, API Key, default server/Direct selector, "Test koneksi", result count and save/continue. Under URL: "Pakai gateway tokengateway.ai.id? Daftar di sini". Missing gateway/test failure shows CTA "Belum punya API key? Dapatkan di tokengateway.ai.id" with external button. Saving incomplete/untested config allowed only explicit disabled/draft state; onboarding chat-ready requires model discovery or supported local-native readiness.

Existing admin/provider availability remains selectable for full parity; BYOK journey does not hide global/local models or bypass admin policy. Direct explains key remains on device and browser gateway may need CORS. Server form explains encrypted storage/server request transport, no false “we never receive your key” claim.

### Chat shell and sidebar

Sidebar includes new chat/home/search, chronological history/pin/archive/folders, enabled workspace/domain navigation, user/settings/usage controls and bottom attribution. Search debounced/cancellable with paginated empty/loading/error/result states. Rename keyboard Enter/Escape, delete dialogue, pin/archive/move/share controls match selected resource permissions. Nested folder drag/reparent and cycle rejection use service response; mobile drawer focus returns to trigger.

Chat header model picker supports baseline multi-model selection, labels/tags/capability/status/provider disambiguation plus personal connection overlay. Per-chat selection persisted and active connection change visibly reconciles unavailable models; do not silently send old model ID to unrelated gateway. Header context actions system prompt/share/export/overview/temporary controls according to flags.

Main viewport empty greeting/suggestions, streaming replies, reasoning/details/citations/code/math/artifacts/source/file previews, per-model views and tree navigation. Composer has text/rich commands/attachments/tool selection/voice and send/stop/queued state controls; disabled capability gives explanation, not inert button. Input remains usable for baseline queued/branch behavior.

### Message actions and branch navigation

User edit supports submit-as-new-branch and save-in-place where baseline exposes both. Assistant edit supports inplace and save-as-copy; feedback/files copy rules enforced. Regenerate preserves old sibling; continue targets selected node. Branch index controls use stable sibling ordering and update canonical selected leaf; delete action applies [baseline reparent transform](04-chat-execution.md), not default entire subtree.

Copy message Markdown/text and code payload, copied affordance timeout, fenced language labels, downloadable artifacts, source navigation, rate/comment/delete/TTS controls available by actor/profile. Streaming incomplete code/math not crash renderer. Auto-scroll only near bottom or explicit preference; user scroll-up does not get dragged on each token; jump-to-latest control reflects unseen output.

### Settings and administration

Personal tab registry covers General/Interface/Connections/Tools/Personalization/Audio/Notifications/Shortcuts/Data Controls/Archived/Usage/Account/About as present in baseline; exact source catalogue is normative. Admin registry additionally general/auth/users/groups/models/connections/documents/websearch/audio/images/code/tools/subagents/evaluation/pipelines/database/events/I18n and all actual panels.

Every control spec includes key/scope/type/default/provenance/label/help/permission/dependent flags/secret status/save effect/reset behavior. Search indexes actual controls, deep-link selects tab/focuses field, unsaved changes follow baseline behavior. Password/masked fields use explicit keep/replace/remove; mask not submitted as new secret. About shows build version, configured real repo, `by tokengateway.ai.id`. Branding metadata title/description exactly "Kawan — Chat AI by tokengateway.ai.id".

### Workspaces and domain surfaces

Resource lists/editors use version selector, sharing picker, import/export, search/tags/filters and capability binding matching each baseline page. Workspace is not one generic CRUD table replacing model/tool/knowledge editors. Channels include threads/reactions/pins/read/presence; notes include rich editor/Yjs/pins; calendar views/event/attendee/recurrence editor; automation includes schedule/run history; terminal includes dock/file workspace/preview. Domain-specific actions and failure states bind SDD-07/08.

## Shared state matrix

| State | UI requirement | Interaction/persistence |
|---|---|---|
| Empty | Purpose-specific starting action/CTA | No fake content/models |
| Loading | Skeleton/progress without erasing useful prior data | Request abort on obsolete selection |
| Saving | Pending action/version indicator | Prevent duplicate submit; keep recoverable input |
| Error | Safe category/details/retry appropriate to operation | No keys/raw upstream stack trace; retry not duplicate generation |
| Offline/disconnected | Distinguish browser/network/server/provider/Direct | Replay/refresh canonical state; never hidden inference restart |
| Permission denied/revoked | Remove sensitive content/controls promptly | Server remains authority; pending drafts handled safely |
| Disabled capability/feature | Baseline visibility/help state | No selectable engine with fake execution |
| Streaming/cancelling | Per-run status/partial output/stop truthfulness | Cursor dedup; final content persisted before terminal |
| Conflict | Inform current revision; reload/reconcile operation | Do not overwrite other tab edit blindly |
| Read-only public | Sanitized snapshot actions only | No composer/tool/settings/private data hydration |

## Responsive, localization dan accessibility

Test widths 360/390/768/1280/1440 px, mobile landscape, touch/soft keyboard/safe areas. These are test viewport proposals, not claim measured reference breakpoints. Desktop density/sidebar/content widths/type scale/colors captured baseline P00 and stored tokens with light/dark/system variants; screenshots compare geometry/action states while Kawan wordmark/assets excluded from exact pixels.

64 locales written independently; translation key/interpolation/plural coverage audited against reference metadata. Document `dir`, date/number/timezone formatting, model/code LTR regions in RTL UI, long translated labels, fallback and missing-key reports. User-created content not automatically translated.

Keyboard logical focus/visible rings, modal focus trap/restore, menu Escape/arrow keys, accessible field errors/progress/labels, sensible live region updates without announcing every token, contrast, reduced motion, code scroll and IME composition send prevention. Screen reader read-only share and voice permission denial tested. Shortcut contract captures baseline keys and avoids browser reserved shortcuts or IME collisions.

## Frontend performance and safety gates

Long-history virtualization preserves tree/scroll anchors and accessibility; measure 1k/10k messages without sending entire archive to render/root context. Heavy file/image previews lazy-load/bounded. Tokens do not trigger whole app rerender; per-run keyed parts avoid sibling view reset. Render untrusted content in sanitized/sandboxed context, never through uncontrolled same-origin innerHTML.

Goldens keyed baseline/profile/route/role/theme/locale/viewport/state. Visual comparison thresholds chosen at P00 on deterministic snapshots; findings manually classified content/brand difference vs missing behavior. No “pixel-identical 100%” while intentional Kawan assets differ.
