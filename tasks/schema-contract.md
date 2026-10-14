# Schema contract — Kawan full parity

Status: spesifikasi planning; belum schema Prisma executable atau live DB conformance.
Baseline: `f8ae8a6c328946dc62cd0712961a0632574581bf`.
Field/constraint inventory lengkap: [reference/schema.md](reference/schema.md), descriptors lengkap di [reference/inventory.json](reference/inventory.json).

## 1. Kontrak inti

Seluruh 43 entitas ORM dan 396 kolom reference masuk mandatory schema scope. Jangan memakai schema 13 entitas MVP lama, menggabungkan User/Auth, menghapus metadata/version/history tables, atau menghilangkan columns hanya karena belum terlihat di UI.

Gunakan physical table/column names baseline lewat Prisma `@map`/`@@map` dan migration SQL sendiri. Nama model TypeScript boleh berbeda untuk menghindari collision, tetapi bentuk persisted data tetap sesuai kontrak. `ChatMessage` dan `Message` channels adalah dua domain berbeda.

Physical conformance meliputi table/column names, SQL types, lengths, nullability, primary/composite keys, unique constraints, FK/actions, index ordering/partial predicates/expression indexes, server defaults, codecs, timestamp units, migration state dan data lifecycle. Sama nama kolom belum berarti sama schema.

ORM inventory merupakan titik awal. Migration-only indexes/constraints/data transforms serta legacy tables harus diambil dari clean migrated live DB pada P01. Database hasil migrasi adalah acuan untuk physical compatibility; metadata extraction belum menggantikannya. Bila declared ORM berbeda dari migration/live state, catat perbedaan dan test contract, jangan memilih diam-diam.

## 2. Semua entitas baseline

| Domain | Physical tables wajib | Hubungan/perilaku yang tidak boleh hilang |
|---|---|---|
| Identity | `user`, `auth`, `api_key`, `oauth_session` | User/Auth linked by ID; roles/active/MFA/session stamp; API access keys dan OAuth sessions berbeda dari provider keys |
| Config | `config` | Per-key storage `key/value/updated_at`, default/env/persistent precedence, import legacy config |
| Access | `group`, `group_member`, `access_grant` | Parent group/membership; resource/principal/permission grants; composite uniqueness dan null/public/private semantics |
| Chat | `chat`, `chat_message`, `chat_file`, `shared_chat`, `folder`, `tag` | Chat JSON + materialized messages/current leaf, subtree/siblings, folder hierarchy/archive/pin/unread/tasks/summary/timer, snapshots |
| Files | `file` | Hash/path/data/meta/owner/timestamps; linkage melalui ChatFile/KnowledgeFile/ChannelFile |
| Models | `model`, `model_history` | Base model wrappers, params/meta, version ID, active state, histories/rollback |
| Prompts | `prompt`, `prompt_history` | Slash commands/variables/name/content/data/tags/localized metadata/version |
| Skills | `skill`, `skill_history` | Instruction/files/content/data/meta/version/active state |
| Tools | `tool`, `tool_history`, `function`, `function_history` | Plugin content/specs/valves/metadata/history/functions/filter/pipe/action semantics |
| Knowledge | `knowledge`, `knowledge_directory`, `knowledge_file` | Collection/folder tree/file assignment/metadata/ACL and cascade/indexing lifecycle |
| Memory | `memory` | User/type/path/content/meta/created-updated fields and retrieval/review lifecycle |
| Channels | `channel`, `channel_member`, `channel_file`, `channel_webhook`, `message`, `message_reaction` | Members/read state/replies/parents/pins/reactions/attachments/webhook auth; chat messages are separate |
| Notes | `note`, `pinned_note` | Note content/data/meta/versions if present, user pins, sharing/collaboration persistence |
| Calendar | `calendar`, `calendar_event`, `calendar_event_attendee` | Default calendar, timed/all-day/rrule/cancelled/data/meta, attendee states and unique participation |
| Automations | `automation`, `automation_run` | Prompt/model/rrule/targets/folder/terminal/active/last-next run, success/error/chat links |
| Evaluation | `feedback` | Version/type/data/meta/snapshot/user/timestamps; rating/evaluation ownership/history |

Tidak ada model di tabel di atas yang opsional pada full schema. Provider/service default disabled bukan alasan menghapus tabelnya.

## 3. Type mapping dan serializer

| Reference | Mapping requirement |
|---|---|
| SQLAlchemy String/Text | Preserve physical type/length sesuai live schema; Prisma String dengan native mapping/migration SQL yang tepat |
| BigInteger | Prisma BigInt atau raw-compatible numeric mapping; tidak diubah menjadi DateTime seluruhnya |
| Integer/Boolean/Date | Preserve nullable/default/data representation lintas SQLite/Postgres |
| Native JSON | Preserve JSON shape dan SQL native JSON vs JSONB yang dipakai baseline; jangan mengganti JSON ke JSONB tanpa memeriksa query/index compatibility |
| `JSONField` TypeDecorator | TEXT-backed JSON codec; jangan otomatis menganggap semua kolom ini native JSON/JsonB |
| FK/constraints | Preserve effective relationships/actions; tidak menambah Cascade global yang mengubah delete semantics |
| Default callable vs server_default | Bedakan default aplikasi dan SQL server; evaluate per runtime operation dengan units benar |

Core table compatibility mungkin membutuhkan migration SQL/raw queries atau Prisma unsupported type adapter pada bagian yang tidak bisa dipetakan langsung. Selidiki dengan introspection terlebih dahulu. Jangan menutupi perubahan physical types sebagai “Prisma limitation”; catat proof dan explicit compatibility decision.

Reference memakai timestamp seconds, nanoseconds, dan timer units pada domain berbeda. Jangan menyatukannya ke JS milliseconds. `Message` channels menyimpan time_ns; Chat/created-at domain lain harus diperiksa per field. Numeric JSON besar membutuhkan serializer/parser lossless agar nanoseconds tidak kehilangan presisi karena `Number`.

Compatibility APIs mempertahankan numeric JSON representation yang diperlukan reference, dengan encoder yang aman untuk BigInt. DTO internal Next boleh memakai string untuk 64-bit values bila conversion eksplisit; itu tidak mengubah external compatibility contract secara diam-diam.

Legacy JSON double encoding/legacy scalar/array/history shapes harus dites dari fixture. Jangan melakukan blanket `JSON.parse` dua kali pada semua string; gunakan compatibility rules versi/source. Inherited Pydantic shape fields/validators/default factories/aliases diperlukan untuk API contract, bukan hanya daftar ORM fields.

## 4. Chat persistence yang harus setara

Reference memiliki `Chat.chat` JSON dan materialized `chat_message` records. Target mempertahankan kedua bentuk yang dipakai API/import/runtime; tentukan transaction/projection owner agar tidak drift.

- History JSON: map pesan berdasarkan ID, parent/children IDs, currentId, selected models, content/output/file/status/usage metadata yang dipakai baseline.
- Materialized messages: chat/user/parent/role/content/output/model/files/sources/embeds/meta/done/status_history/error/usage/context_summary/timestamps.
- Chat row: title/pin/archive/folder/variables/meta/tasks/summary/current_message_id/last_read_at/timer_at/timestamps dan kolom baseline lain yang tercantum inventory.
- Shared chat: full selected share-mode snapshot shape, owner/token/title/timestamps; update/revoke/clone semantics mengikuti baseline, credential fields tetap disanitasi.
- ChatFile: mempertahankan unique/owner/chat/message/file semantics; tidak diganti hanya menjadi join MessageAttachment yang berbeda.

Transaksi edit/regenerate/clone/import/cancel/delete harus menjaga edge consistency, snapshots, materialized projection dan runtime tasks. Parent/current leaf berada dalam chat yang sama; cycles ditolak. Multiple model replies tetap sibling/subtree sesuai baseline.

Temporary chat memiliki persistence contract tersendiri, bukan `Chat.archived=true`. Task/usage/checkpoint retention temporary mode harus sama dengan profile baseline, ditambah extension monitoring policy yang dinyatakan.

## 5. Identity dan Auth.js

Credentials membaca `Auth.password` dan `Auth.active`, linked User.id, roles, MFA/session_stamp. Auth.js tidak memberi izin menggabungkan Auth ke User. Hash verifier mendukung bcrypt/Argon2 sesuai hash prefix dan baseline password policy/rehash behavior.

Auth.js cookie/JWT bukan token Open WebUI yang otomatis compatible. Reference bearer/application API-key endpoints perlu compatibility boundary sendiri; sign-in/session/revocation fields dibandingkan pada P02/P24. Config/token secrets tidak dibocorkan untuk memenuhi contoh response.

User.settings/info/variables/oauth/scim tetap tersedia dengan JSON shape yang dipakai reference. User profile/name/avatar/banner/bio/gender/date/timezone/status/presence fields dalam inventory dipertahankan, walaupun UI tertentu permission-disabled.

User/group deletion dan SCIM disable/revoke tidak boleh meninggalkan akses tool/vector/shared channel terbuka. ACL per-resource tetap mengikuti null/empty/public grants yang berbeda; owner-only shortcut tidak diterima.

## 6. Extension Kawan, terpisah dari schema referensi

Tambahan Kawan tidak mengganti core tables. Prefix physical `kw_` membuat compatibility boundary terlihat.

| Extension | Field/logical contract |
|---|---|
| `kw_connection` | id, user_id, name, base_url, api_key_encrypted?, key_mask?, is_direct, is_active, provider_kind/config refs, created_at/updated_at |
| `kw_secret` | id, owner/scope/resource ref, encrypted envelope/version/key_id/mask, created_at/updated_at; seluruh integration credentials tidak plaintext |
| `kw_generation` | id, user/chat/message refs, provider snapshot, requested/returned model, status/idempotency/mode/lease/start-finish metadata |
| `kw_usage` | id/run ref/user/connection/model, prompt/completion/total nullable, source gateway/browser, timestamps; per-step facts bila dibutuhkan aggregate yang benar |
| `kw_mcp` | user-owned server/auth reference/transport/config/metadata; original config tool server shapes tetap dipetakan |
| `kw_job` | durable kind/payload owner/resource/state/cancel/lease/retry/outbox/TTL metadata; index/scheduler jobs tidak memory-only |
| `kw_rate_limit` | durable scoped counter/window/expiry, tanpa menyimpan password/key atau raw IP jika tidak diperlukan |

Topologi extension dapat dibagi child tables untuk step/job/outbox bila dibutuhkan. Semua FK/retention/indexes/uniqueness ditetapkan sebelum migration, termasuk single active connection/user dan generation concurrency. Tidak boleh menambahkan satu JSON blob universal untuk menghindari contract.

AES-GCM secret berformat versioned envelope, random nonce/auth tag/AAD yang mengikat user/type/resource. Encryption secret 32-byte base64 env, berbeda dari auth secret; mask disimpan ketika key dibuat. Response default tidak memuat plaintext maupun ciphertext.

Core Config/Open WebUI legacy provider config yang mengandung key diadaptasi menjadi secure references pada runtime Kawan. Import plaintext secret dilakukan sekali melalui proses owner/operator yang jelas lalu dienkripsi; export/public response disanitasi. Ini **intentional credential compatibility difference**, bukan schema sama tanpa perbedaan.

Direct key disimpan browser-only; jangan memasukkan plaintext ke User.settings/directConnections ketika settings disinkronkan DB. Bridge tools/results dan metadata boleh melewati server, model key tetap lokal. Logout/mode switch/new device lifecycle jelas.

## 7. Migration plan

1. P01 membuat DB reference bersih dengan migrations pinned; capture schema facts/DDL fingerprints/data fixtures pada SQLite dan Postgres.
2. Tulis schema Prisma/migrations Kawan sendiri dari kontrak, tanpa copy migration source. Kedua provider punya migration directories berbeda.
3. Cocokkan all 43 core tables/396 declared fields plus migration-only physical objects. Preserve final schema behavior, bukan harus menggunakan Alembic revision filenames di Prisma.
4. Versioned importer compatibility menangani legacy migration/schema generations, profile data, config JSON, histories/file references/permissions. Buat new target DB, verifikasi round-trip; jangan in-place migrate production tanpa backup/approval konkret.
5. Supported migration versions/ranges ditentukan dari 64 revision inventory, setiap transform diuji dengan representative fixture; data yang tidak dapat direcover dilaporkan, bukan silently dropped.
6. Migration deploy/generate target/rollback/restore tested. URL Postgres tidak otomatis mengubah Prisma provider. DB push bukan migration production.
7. Uji extension creation/secret import/re-encryption/remove plus no-core-data-loss. Deleting connection/job extension tidak cascade menghapus core chats/analytics.

V1 planning belum memiliki installed app/data; tidak ada migrasi aktual yang dilakukan sekarang. Database drop-in compatibility dengan Open WebUI runtime asli tidak diasumsikan, terutama karena encryption/auth/runtime differences. Target schema parity harus dilaporkan sebagai core conformance + extension/delta, bukan binary-identical DB.

## 8. Schema acceptance gate

- Semua DB reference IDs dan individual column IDs memiliki physical fixture/evidence; every PK/FK/index/default/nullability/codec conformance dicatat.
- Core type/constraint parity berlaku untuk SQLite dan Postgres; extension types/transactions juga diuji keduanya.
- Bcrypt/Argon2/MFA/state/session fields compatibility dan no credential leak diuji.
- Nanosecond/64-bit JSON serialization tidak membulatkan data.
- Chat JSON + materialized messages + files/shared snapshot + selected leaf projection tetap konsisten sesudah seluruh mutation/import/branch/cancel.
- All ACL/group/channel/note/calendar/knowledge references delete/revoke/share behavior sama sesuai profile.
- Import/export identity/workspace/chat/config/file metadata round-trip dengan fixtures versioned; orphan file/vector cleanup tidak menghapus shared resources.
- Report membedakan intended Kawan additions, secure credential deltas dan unresolved incompatibilities. Open failure berarti schema gate belum lulus.
