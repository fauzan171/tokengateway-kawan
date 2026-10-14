# SDD-05 — Identity, authorization dan trust boundaries

Owner P02/P03/P04/P12/P24. Product key locality mengikuti [PRD](../prd.md); native API-token compatibility mempunyai fixtures sendiri. Di sini security adalah implementasi behavior, bukan approval workflow tambahan untuk task rutin.

## Authentication design

Gunakan Auth.js Credentials dengan **JWT session strategy** dan core User/Auth persistence milik Kawan. Credentials provider tidak otomatis membuat user/password storage dan mensyaratkan JWT sessions pada kontrak provider resminya; registration/password hashing/MFA/status checks ditulis melalui IdentityService. Jangan memakai stock Prisma Auth.js adapter schema untuk menimpa core tables. [Auth.js Credentials reference](https://authjs.dev/reference/core/providers/credentials)

JWT/cookie memuat minimal user ID/auth method/session stamp/issued-at/expiry; tidak memuat provider keys/permissions snapshot permanen. Secure HttpOnly SameSite cookie sesuai deployment origin, Auth.js signing/encryption secrets terpisah ENCRYPTION_SECRET. Server authentication callback/route guard reloads user role/Auth.active/session stamp; request authorization tidak bergantung stale role dalam JWT. Realtime join dan worker execution menggunakan pengecekan yang sama.

First admin creation adalah atomic bootstrap operation; dua concurrent signup tidak boleh sama-sama menjadi initial admin karena `count(users)==0` tanpa lock. Signup-disabled/pending/allowlist/trusted-header/offline-auth profiles mengikuti baseline. Password errors generic; configurable durable rate limits; hash storage compatibility bcrypt/Argon2 independently verified. New hashing algorithm/parameters recorded security contract and migration-on-login, never plaintext migration.

Auth middleware cukup routing/preliminary checks; Node handler tetap mengautentikasi/authorize. Jangan import Prisma/Node crypto ke edge middleware tanpa compatible runtime, dan jangan menganggap middleware pass berarti seluruh resources boleh diakses.

## MFA dan identity linking

Credential flow validates password lalu MFA when required sebelum membuat regular Auth.js session. Step-up challenge signed/hashed single-purpose, owner/auth-method/session-bound, default proposal expiry 3 min, limited attempts. TOTP time window/recovery/reset policies captured baseline; accepted code/recovery credential cannot replay. Enrollment pending secret encrypted sampai confirmed; recovery codes hashed, ditampilkan saat issuance saja. Failure does not leave partial logged-in cookie.

OIDC/OAuth issuer/audience/state/nonce/PKCE/linking/signup claims sesuai configured profile; token refresh per identity link serialized untuk menghindari refresh-token race. Access/refresh credentials disimpan encrypted references, tidak pada client session JSON. Existing baseline user.oauth/oauth_session projections maintained safe compatible fields with explicit secret delta.

Link identity melalui verified subject/issuer/provider or deliberate authenticated merge policy. Matching email saja tidak otomatis mempercayai issuer lain. LDAP TLS/search/filter escape/service credential redaction/attribute/group mappings dan trusted proxy source/header strip rules diuji. SCIM token berbeda scope dari app API key; deprovisioning invalidates session stamp/jobs/access cache.

## Authorization evaluator

Inputs actor, action, resource kind/ID, feature config revision, effective groups/parent memberships and core grants. Action capability granularity follows baseline inventory; no invented owner-only simplification. Decision lookup may be cached with bounded TTL + invalidation version, but sensitive write/tool/file download rechecks current status/grant.

Checks ordered: identity active → feature/role permission → resource existence/read visibility → owner/admin/group/public grant → operation-specific constraints → linked resources → configured execution capability. Record safe reason code, never expose private resource existence to unauthorized caller. 404 vs 403 follows compatibility profile or Kawan error contract.

User and application token permissions cannot broaden because actor claims a userId/role in body or socket event. Public share actor only sees sanitized snapshot + bounded share-file capabilities; cannot initiate inference/tool calls, enumerate parent chat, inspect usage/system/private files. Group/public write grants are honored where baseline allows; cross-owner invariants use authorized grants rather than blanket “owner only”.

## Key encryption and rotation

Versioned envelope: schema version, key ID, 12-byte random nonce, ciphertext, 16-byte GCM tag; all components base64url. AES-256-GCM key is exactly 32 decoded bytes from ENCRYPTION_SECRET or operator keyring; invalid/missing key causes startup configuration failure, not silent hash/default fallback. AAD includes version/row ID/owner/scope/resource/purpose using canonical byte encoding.

Encryption rotation: add new key ID → deploy readers that accept old+new/write new → batch decrypt/re-encrypt with per-row revision CAS and checkpoint → verify envelope samples/full counts → backup recovery set → retire old key only after retention/restore policy. Do not rotate Auth.js secret and vault secret in one undifferentiated operation. No decrypt-on-list just to derive key mask.

Transient key arrives in HTTPS create/replace/server-test body; input state cleared after submission, request logging/tracing disabled, errors sanitized. Server resolves key only inside authorized provider/worker operation. Queues/events/UI props/caches store secret references, never ciphertext/raw headers. Native import of plaintext credentials immediately encrypts and redacts import/export reports; intentional compatibility delta recorded.

Direct raw key stored only namespace user/connection/revision in localStorage per original requirement, accessed only client module. This is browser-JavaScript-accessible; CSP/XSS prevention limits exposure, but no claim it becomes protected like HttpOnly secret. User can remove key/logout clear local device data. Direct mode has no server verification of local key, no background server takeover, no implicit fallback after browser CORS failure.

## Outbound request policy

Shared policy for gateways/MCP/OpenAPI/search/crawlers/webhooks/cloud/terminal; per-purpose permission grants. Parse URL with standard parser, reject userinfo/fragments/unsupported schemes, normalize host/port. DNS lookup must validate all IPv4/IPv6 results and connect using the validated resolution with correct original hostname/TLS verification; check-before-unpinned-fetch leaves rebinding gap.

Default server policy denies loopback/link-local/private/multicast/metadata targets unless precise operator allowlist for legitimate self-host Ollama/on-prem gateway. Operator private allowlist evaluated by host/CIDR/port/purpose with no user-controlled wildcard bypass. Redirects bounded, revalidate each destination, remove credentials on origin change; provider/MCP auth redirects cannot send original API key to new origin implicitly. Proxy environment must not bypass policy.

Timeouts/bounded body/stream size/concurrency/per-user egress budgets; cancellation connected to HTTP client. Native gateway passthrough only registered methods/paths/headers, no arbitrary GET server URL. User configured headers with secrets routed through vault; forbid hop-by-hop/Host/Set-Cookie/control headers or unsafe network overrides. Model request destination changes require conscious credential handling.

Browser Direct requests governed browser CORS/network/private access behavior; server SSRF protections cannot police requests it does not issue. CSP `connect-src` needs deliberate Direct gateway support; `https:` may be required for arbitrary BYOK origins, documented separate from strict script/worker/frame policies. Self-host local HTTP Direct gateways need explicit environment policy/mixed-content limitations, not a promise all browsers permit them.

## Rendering, files and plugin execution

Markdown HTML sanitized with explicit allowlist; Mermaid/math links/embedded URLs handled same policy. Artifacts on separate origin or sandboxed opaque-origin iframe with minimal permissions. Parent bridge validates source/origin/session nonce + typed messages; no parent cookie/key exposure. User SVG/HTML download/preview uses safe content-type/disposition, no active same-origin script execution.

Files authorize DB resource/grants before issuing narrow storage handle; object key names not authorization. Signed URLs short-lived, range limits, share revocation tested. Cloud OAuth scopes/file imports metadata sanitized. Extraction sandbox limits zip bombs/archive traversal/CPU/memory/media decompression; scanned parse failure is visible, not fake attached-ready state.

Python plugins/pipelines/Jupyter/terminal run isolated execution identities/filesystem/egress/resource scopes. Separate process alone is not a sandbox; full public multi-user profile needs container/OS isolation under operator policy. Support package dependencies/valves/hooks per baseline contract but no auto-elevated host mounts/secrets. Resource caps configurable; policy failures reported as execution errors/deltas, not feature removed. External tool side effects classified; approval/elicitation follows selected profile, not blanket user reconfirmation on every ordinary task.

## Security acceptance and early warnings

| Case | Evidence |
|---|---|
| Cross-user ID in path/body/file/tool/socket | Negative fixtures across all resource families, zero unauthorized data/side effects |
| Group/share revoke during active task | Next sensitive action denied; sockets/grants invalidated; durable cancel outcomes |
| Session/API token misuse/MFA replay/OAuth link race | Generic auth error and no broadened actor; session stamp updated |
| Ciphertext copied to another row/user | GCM AAD decrypt failure; no cross-context secret return |
| DNS rebind/redirect/IPv6/private metadata | Request never reaches forbidden address unless explicit operator profile permits target |
| Markdown/artifact/CRDT injection | No parent JS execution/session/key reads; payload validated before persist/render |
| Plugin escape/cross-tenant output/path traversal | Sandbox failure, resource cleanup and safe error; no host/user leakage |
| Log/share/export/metrics scrubbing | Seed canary secrets absent in artifacts; private prompt text absent default telemetry |

Early warning metrics: auth/session mismatch, policy-denied outbound origin, dropped foreign socket room join, sandbox escape probe, vault decrypt failure/revision conflict, secret redaction canary hit. Any secret exposure blocks release; do not label feature verified until remedied.

## Open contracts

Baseline MFA/reset/rate policies, auth-disabled mode privilege behavior, bearer token issuer claims and plugin callback capabilities require P00/P02/P12 review. New recovery/reset flows only where baseline exposes them or explicit Kawan account security addition is documented. Public product repo/license and self-host operator secret distribution remain release configuration, not fabricated defaults.
