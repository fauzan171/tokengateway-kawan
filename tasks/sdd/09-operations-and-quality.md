# SDD-09 — Operations, quality, deployment dan recovery

Owner P00/P24; setiap fase mengikuti gates. Tidak ada deployment nyata pada pekerjaan planning ini.

## Deployment profiles

| Profile | Processes/dependencies | Capability claim |
|---|---|---|
| dev-core | Next web, SQLite, one Node job coordinator, optional local realtime | Developer auth/BYOK/chat fixture progress; full registry tetap open |
| personal-local-full | Web/realtime/workers, SQLite single writer, local private storage, Redis if configured, selected local engines | All enabled personal/full-domain controls tested with configured engines; SQLite concurrency budgets |
| production-full | Node web replicas, Postgres, Redis fan-out/cache, job/generation/realtime/processing/plugin workers, private object storage and configured vector/media engines | Multi-instance profile; adapter matrix tetap wajib, tidak semua engines harus berjalan bersamaan |
| managed-web | Next managed platform + external durable jobs/WS/DB/storage/isolated workers | Allowed only when all protocol/runtime/timeouts/cancel/private file behavior verified |
| offline/slim | Configured local models/runtime assets/engines; slim disables incompatible local heavy workloads explicitly | Offline-enabled/disabled behavior baseline profiles; no network dependency hidden |

No claim Vercel route handler alone hosts long-running generation, WS, Python, GPU and terminal runtime. Container defaults self-host; optional managed vendors chosen later without changing external contracts. Local Ollama/gateway can use exact operator private endpoint allowlist.

## Configuration and environment contract

| Variable | Required use | Exposure |
|---|---|---|
| `AUTH_SECRET` | Auth.js session/auth signing/encryption | Server only |
| `ENCRYPTION_SECRET` + versioned keyring config | 32-byte decoded AES master key and rotation readers | Server/authorized vault process only |
| `DATABASE_URL` / selected provider build profile | Prisma target connection | Server only; provider schema generation explicit |
| `KAWAN_APP_URL` | Canonical session/callback/share origin | Public origin safe, credentials absent |
| `KAWAN_REPO_URL`, `KAWAN_VERSION` | About/build metadata | Public; configured real repo URL |
| `REDIS_URL` | Fan-out/cache service | Internal, authenticated transport |
| `STORAGE_*` | Local/object adapter config | Secret parts vault/env only |
| `INTERNAL_SERVICE_AUTH_*` | Service scoped signing/mTLS credentials | Internal process scopes |
| Operator adapter engine/env keys | Baseline configuration compatibility | Per-key registry provenance/secret policy |

Never expose database/vault/provider keys through `NEXT_PUBLIC_*`. Public variables only deliberate safe build/runtime metadata. Missing required secrets/schema/provider profile fails startup with safe actionable error. `.env.example` names and descriptions only, no functional demo keys. Version file/lockfile/SBOM/generated Prisma clients record exact dependency/runtime profile.

## Startup, shutdown and deployment order

Migration job completes and schema version verified → services start → readiness checks SQL/storage/required runtime configs → workers advertise capacity → web accepts execution. Optional provider unavailable does not make unrelated auth/UI unhealthy; ready model/engine status separate. Liveness indicates process responsiveness, readiness dependency/capacity; no blocking provider models poll in health handler.

Graceful shutdown stops new claim/request admissions, drains short DB transactions, flushes checkpoint, closes provider stream/records interrupted/indeterminate, releases only safe leases, closes socket clients with reconnect hint. Hard termination recovery follows attempt-state inspection, not unconditional retry. Multi-instance test kills web/worker/realtime independently.

Ingress forwards trusted origin/client IP headers from configured proxies only; WS upgrade supported, SSE buffering/compression behavior tested, heartbeat <=proxy idle timeout. TLS/private networking/storage paths/resource limits mounted explicitly. Artifact/runtime separate-origin/frame policies verified. Rolling deploy only compatible event/schema versions; consumers tolerate declared optional fields and reject unsupported major schema versions safely.

## Observability and privacy

Structured fields requestId/user opaque ID/resource kind/run/job/attempt/adapter/config revision/state/duration/byte count/error category. No raw prompt/file content/key/auth header/ciphertext/token args/result in default logs. Trace provider timing/provenance; sampled error debugging requires sanitized payload and user/operator retention policy.

Metrics: auth failures/rate limits/ACL denials, active/queued runs, queue oldest age, DB lock/pool waits, lease reclaim/fencing failures, provider handshake/TTFT/stream relay, durable checkpoint/outbox lag, replay gaps, duplicate events/idempotency conflicts, indeterminate attempts, upload/parse/index errors, vector publish lag, socket clients/reconnect, sandbox budget failures, delivery retries, vault decrypt/key version, unknown/client usage counts.

Labels bounded (adapter class/status, not every user/prompt/model arbitrary label). Personal Usage dashboard is separate from operator telemetry; public shares do not expose either private view. Default alert proposals: outbox lag >30s for 5min, expired-lease reclamations rising for 5min, queue age >configured run SLA, any secret-canary/sandbox-isolation failure immediately. Thresholds calibrated load/profile P00, recorded owner/runbook.

## Backup and recovery

Recovery set: SQL consistent snapshot + private blob manifest/version policy + vector active-index manifest/data-or-rebuild inputs + operator config + vault keyring + deployed schema/app/runtime versions. Keys exported through operator secret backup process, not regular chat/config export. Postgres PITR or snapshot strategy and SQLite WAL-safe backup tested on actual profile.

Default proposed objectives for self-host benchmark: SQL metadata RPO 15min, full recovery RTO 4h on fixture dataset; external vector rebuild time separately reported. These are design goals awaiting measured restore drills and operator budget, not guarantees. Local SQLite cannot promise multi-node failover without supported topology.

Restore into clean environment, verify schema/identity/grants/vault decrypt/file checksums, reconnect/rebuild vectors, reconcile jobs/outbox without replaying already-sent uncertain inference, run E2E read/write/checkpoint/share isolation. Backup not considered complete until restore drill successful. Rotation recovery drill checks older backups' key versions remain accessible under policy.

## Migration, rollout and rollback

Expand compatible schema/API/event support → backfill with revision checkpoints → verify counts/hashes/grants/codecs → switch readers/writers via registered flag → observe errors/latency/reconciliation → retire obsolete representations only after rollback window. No database `push` as production migration. SQLite/Postgres migrations separate, written from contract independently.

Rollback app/workers to last schema-compatible release; queue/job payload versions must remain readable. Incompatible migration requires tested restore or forward fix, not optimistic “git revert restores data”. Never automatically rewind external tool effects or resend uncertain model call. Public deploy/DNS/release separately authorized after concrete verified build/review.

## Commands contract

Scaffold implements commands below with non-watch behavior; planning currently contains no runnable application scripts.

```text
npm ci
npm run typecheck
npm run lint
npm test -- --run
npm run test:e2e -- --project=chromium
npm run test:conformance -- --phase=P04 --task=P04-01
npm run test:conformance -- --profile=sqlite
npm run test:conformance -- --profile=postgres
npm run build
npm run db:migrate -- --provider=sqlite
npm run db:migrate -- --provider=postgres
npm run verify:contracts
```

`npm test` itself must be non-watch as old backlog requires; `--run` optional framework-supported filter and must not be invented failing flag. Contract runner resolves task/reference IDs/profile and writes sanitized evidence JSON/report. Worker Python/containers have their own lint/type/pytest/smoke entrypoints after runtime chosen; build gate includes those services, not only Next compile.

## Test architecture and budgets

| Level | Concern | Strategy |
|---|---|---|
| Unit | Tree transforms/codecs/ACL resolution/param precedence/usage math/RRULE | Meaningful edge cases/property invariants; no tests merely restating implementation |
| SQL integration | Constraints/transactions/leases/idempotency/revision/import | Both providers, concurrent writers, crash injection, precision round trips |
| Protocol fixtures | Provider/MCP/OpenAPI/storage/vector/audio/image/terminal | Deterministic mock wire server + malformed/timeout/partial/abort/auth cases |
| Differential conformance | Baseline API/schema/config/events/native tools/UX states | Isolated reference synthetic dataset + Kawan same inputs; declared deltas classified |
| E2E | User/admin/public/group journeys | Browser actual UI/network/storage, mobile/RTL/voice mocks/editor conflicts |
| Interoperability | Real configured external engines | Credentialed smoke sandbox account/services, no production key assumption |
| Resilience/load | Restart/reconnect/outbox/unknown external outcomes | Process/network failure injection, deterministic checkpoints/fake clocks |
| Security/accessibility | ACL/secret/SSRF/XSS/sandbox/keyboard/screen reader | Dedicated negative cases and canary/redaction/interaction evidence |

Baseline golden normalized volatile IDs/timestamps only when contract-independent; do not strip meaningful status/ordering/token/timing/timezone differences to make diff pass. Snapshot updates require reason/reference/source evidence. Tests can share contract fixtures but retain explicit task/requirement/reference IDs. Count coverage by verified behavior/categories, not line coverage or source-file hash.

CI fast lane every change: types/lint/focused tests/build. Phase gate: relevant both-provider integration/E2E/conformance + worker/container smoke. Release full matrix: all requirements/reference obligations/profiles + all configured external adapters/runtime closure/security/restore/benchmark. External unavailable stays blocked verification; no global N/A success.

## Ready / done / release gates

Ready for child implementation: source contract resolved, DTO/state/auth/side-effects/recovery acceptance precise, dependency interfaces stable, ≤5 core files proposed, focused test commands and fixtures defined. Done: real slice works + tests/build + evidence + no production mock/inert UI. Phase done: all child/parent/adapter obligations verified. Release: no unknown dynamic branch/unexplained delta; exception ledger/backup/restore/profile evidence complete; owner review for publish.

Open owner configuration before release: public repo/license, deployment vendor/domain, secret distribution/test credential inventory, retention/operational budgets, notification/webhook targets. P00/P24 owned checklist resolves these; ordinary reversible implementation choices do not require repeated user permission.
