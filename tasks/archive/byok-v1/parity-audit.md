# Audit kesetaraan Kawan terhadap Open WebUI

Tanggal: 12 Oktober 2026.
Status: audit planning, bukan verifikasi implementasi.
Dokumen yang dibandingkan: [plan.md](plan.md), [todo.md](todo.md), dan brief `PROMPT.md`.
Baseline lokal Open WebUI: commit `f8ae8a6c328946dc62cd0712961a0632574581bf`.
Repo upstream juga dibuka untuk mengecek area utama; `main` dapat berubah dan tidak diasumsikan identik dengan baseline lokal.

## 1. Kesimpulan yang boleh disampaikan

**Rencana Kawan belum sama 100% dengan seluruh produk atau schema Open WebUI.**

Rencana sudah memetakan setiap kelompok fitur wajib yang disebut dalam brief Kawan, berikut fase, task, acceptance dan checks. Itu merupakan coverage kebutuhan pada tingkat planning. Belum ada aplikasi, schema Prisma executable, bukti build, atau E2E yang membuktikan kesetaraan fungsional.

Tiga target berikut berbeda:

| Target | Status saat ini |
|---|---|
| Semua kebutuhan eksplisit brief Kawan punya pekerjaan | Sudah terpetakan; Direct masih opsional sesuai brief |
| Hampir seluruh pengalaman personal Open WebUI | Belum; gap personal tercatat di bagian 4 |
| Semua fitur, tabel/kolom/API dan format data Open WebUI identik | Tidak; scope, stack dan desain BYOK Kawan berbeda |

Jangan memberi angka seperti “95% sama” tanpa daftar fitur baseline, bobot dan test yang mendukungnya. Jumlah tabel juga bukan ukuran kualitas/parity fitur.

## 2. Coverage brief Kawan

| Kebutuhan brief | Pekerjaan | Coverage planning | Batas yang harus disebut |
|---|---|---|---|
| Auth multi-user | F1-01–04 | Ada | Credentials saja; bukan OAuth/LDAP/MFA/full account panel |
| Onboarding URL/key/test models | F2-01–04 | Ada | Mode default key server encrypted; bukan seluruh konfigurasi provider OWUI |
| Multiple connections + aktif | F2-05–06 | Ada | Satu connection aktif; bukan aggregation banyak provider sekaligus |
| Streaming/stop/regenerate | F3-01–06 | Ada | SSE Kawan; tidak memakai protokol/tasks OWUI |
| History/search/rename/pin/delete/folder/date | F4-01–04 | Ada | Folder satu tingkat; belum archive/tags/unread |
| Edit user + branches | F4-05–06 | Ada | Model tree setara secara konsep, format persistence berbeda |
| Markdown/code/copy | F5-01 | Ada | GFM/highlight; bukan seluruh extensions/artifacts OWUI |
| Gambar/PDF/teks | F5-02–05 | Ada | PDF text; tanpa RAG/OCR dan file workspace |
| System prompt/model per chat | F3-05 | Ada | Belum advanced generation params/prompt presets |
| Dark/responsive | F5-06–07 | Ada | id/en dan light/dark/system; bukan seluruh interface options |
| Settings General/Connections/About | F2-05, F5-06 | Ada | Tiga area yang diminta; bukan semua tab personal OWUI |
| Export Markdown/share public read-only | F6-01–03 | Ada | Snapshot cabang aktif; tanpa public bytes/raw tools/import JSON |
| Usage daily/model/connection | F6-04–05 | Ada | Monitoring saja; bukan seluruh statistik/heatmap referensi |
| Direct browser | F7-01–04 | Ada, opsional | Browser-local key; MCP server-side tidak tersedia di Direct v1 |
| MCP URL/auth/tools/model calling | F8-01–05 | Ada | Remote HTTP/SSE none/Bearer; bukan seluruh integrasi/tool ecosystem |
| Branding/self-host | F0-02, F5-06–07, F9 | Ada | URL repo/deployment/lisensi final masih butuh data pemilik |

## 3. Perbandingan schema

Inventaris lokal menemukan **43 deklarasi ORM `class ...(Base)`** di `backend/open_webui/models/*.py`. Ini hasil scan model pada baseline lokal, bukan jumlah tabel live DB, bukan seluruh migration history, dan bukan klaim terhadap setiap commit upstream.

Rencana Kawan mendefinisikan **13 entitas domain**. Nama/kolom di plan adalah rancangan; belum schema Prisma runnable. Perbedaan jumlah tersebut disengaja tetapi menegaskan schema tidak identik.

### Entitas inti

| Open WebUI | Kawan direncanakan | Perbedaan penting |
|---|---|---|
| `User` + `Auth` | `User` + `UserSettings`, Auth.js JWT/session | Hash berada di User; tidak ada auth table identik, role pending/admin, MFA, SCIM/profile lengkap |
| `Config`, `User.settings` dan connection config | `Connection` per user | URL/key menjadi row terpisah encrypted; tidak meniru parallel arrays/settings JSON |
| `Chat` | `Chat` | Tidak ada full `chat` JSON compatibility, archived/variables/summary/last_read_at/timer_at pada baseline Kawan |
| `ChatMessage` | `Message` | `parentId` dipertahankan; done/status_history/output/usage tidak ditiru kolom demi kolom |
| `Folder` | `Folder` | OWUI memiliki parent_id dan metadata; Kawan awal satu tingkat |
| `File` + `ChatFile` | `Attachment` + `MessageAttachment` | Storage/extracted text dan referensi berbeda; bukan format file record OWUI |
| `SharedChat` | `Share` | Snapshot Kawan allowlist cabang aktif; bukan seluruh chat JSON OWUI |
| Usage di message/settings responses | `Generation` + `UsageRecord` | Run-level idempotency dan summary monitoring domain Kawan |
| `Tool`/connection integrations | `McpServer` + message parts | Remote MCP auth/server model Kawan; bukan marketplace tool/function tables |

Source upstream pendukung: [Chat](https://github.com/open-webui/open-webui/blob/main/backend/open_webui/models/chats.py), [ChatMessage](https://github.com/open-webui/open-webui/blob/main/backend/open_webui/models/chat_messages.py), [User](https://github.com/open-webui/open-webui/blob/main/backend/open_webui/models/users.py), [Auth](https://github.com/open-webui/open-webui/blob/main/backend/open_webui/models/auths.py), [Folder](https://github.com/open-webui/open-webui/blob/main/backend/open_webui/models/folders.py).

### Field mapping inti yang harus dipertahankan secara perilaku

| Konsep OWUI | Kawan | Aturan |
|---|---|---|
| chat.user_id | Chat.userId | Owner dari session; seluruh lookup privat scoped |
| chat.current_message_id / history.currentId | Chat.currentMessageId | Menunjuk leaf/cabang terpilih pada chat yang sama |
| message.parent_id / parentId | Message.parentId | Parent dari chat sama; acyclic; edit/regenerate membuat sibling |
| history.childrenIds | childrenByParent hasil derive | Urutan sibling stabil; bukan array chat linear |
| message.model_id | Message.model + Generation requested/returned model | Model historis tidak berubah saat picker berganti |
| message.done/error | Message.status/errorCode + Generation.status | Complete/stopped/failed/interrupted dibedakan |
| message.output / tool output | Validated content parts | Tool-call/result replay tetap valid |
| message.usage | UsageRecord + generation metadata | Angka gateway nullable; tidak double-count |
| chat.pinned/folder_id | Chat.pinned/folderId | Persist dan owner validation |
| SharedChat.chat | Share.messagesSnapshot | Snapshot immutable, tidak mengikuti original |

### Model lokal yang tidak direplikasi

Dalam inventaris baseline: `AccessGrant`, `Automation`, `AutomationRun`, `Calendar`, `CalendarEvent`, `CalendarEventAttendee`, `Channel`, `ChannelMember`, `ChannelFile`, `ChannelWebhook`, `Config`, `Feedback`, `FunctionHistory`, `Function`, `Group`, `GroupMember`, `Knowledge`, `KnowledgeDirectory`, `KnowledgeFile`, `Memory`, `MessageReaction`, `Message` untuk domain channels, `ModelHistory`, `Model`, `Note`, `PinnedNote`, `OAuthSession`, `PromptHistory`, `Prompt`, `SkillHistory`, `Skill`, `Tag`, `ToolHistory`, `Tool`, `ApiKey`.

Beberapa konsep Config/Tool memang diadaptasi oleh Kawan, tetapi tabelnya tidak direplikasi. `Message` domain channel berbeda dari `ChatMessage`; jangan menyamakan keduanya hanya karena nama model Kawan `Message`.

`ApiKey` Open WebUI adalah key akses aplikasi Open WebUI; **bukan otomatis key gateway BYOK**. Jangan menyamakan dengan `Connection.apiKeyEncrypted` Kawan.

Implikasinya: DB Open WebUI tidak bisa langsung digunakan sebagai DB Kawan; endpoint dan auth token juga tidak compatible. Migrasi/import OWUI membutuhkan importer/version mapping khusus yang belum masuk backlog utama.

## 4. Gap personal untuk target kesetaraan lebih tinggi

Gap berikut bukan otomatis task mandatory. Sebagian tidak diminta brief, sebagian keputusan penyederhanaan plan. Mencatat gap tidak sama dengan persetujuan memperluas scope.

| Gap | Bukti referensi lokal | Status Kawan sekarang | Perubahan planning bila dipilih |
|---|---|---|---|
| GAP-01 Archive/unarchive dan daftar archived | `Settings/ArchivedChats.svelte`, `Sidebar/ChatMenu.svelte` | Belum ada | Chat.archived, query filters, archive actions, Settings list |
| GAP-02 Folder bertingkat | `models/folders.py`, `Sidebar/RecursiveFolder.svelte` | Folder satu tingkat | Folder.parentId; recursive nav, cycle guards, delete/move subtree rules |
| GAP-03 Tags personal/filter tags | `models/tags.py`, `chat/Tags.svelte`, `Sidebar/SearchInput.svelte` | Belum ada | Tag/ChatTag atau equivalent, CRUD, search/tag chips |
| GAP-04 Temporary chat | `Chat.svelte`, `Messages/ResponseMessage.svelte`, User interface settings | Semua chat default persisten | Explicit transient lifecycle/TTL, upload/usage/share policy; UI mode jelas |
| GAP-05 Clone/duplicate/fork chat | `Sidebar/ChatMenu.svelte`, public share route | Regenerate bukan clone | Clone tree/subtree, attachment reference ownership, title/selection rules |
| GAP-06 Import/export JSON dan Data Controls | `Settings/DataControls.svelte`, `Sidebar/ChatMenu.svelte` | Export Markdown saja | Versioned JSON Kawan; OWUI importer terpisah, validate tree/size/owner; bulk controls |
| GAP-07 Advanced model parameters | `Settings/General.svelte`, `Settings/Advanced/AdvancedParams.svelte` | System prompt/model saja | Validated temperature/top_p/max_tokens/etc; compatibility per gateway/model |
| GAP-08 Account settings/change password/MFA | `Settings/Account.svelte`, `Account/UpdatePassword.svelte`, `Account/Mfa.svelte` | Register/login/logout saja | Profile edits, credential changes/session revoke; MFA sebagai fitur terpisah |
| GAP-09 Response feedback | `models/feedbacks.py`, `Messages/ResponseMessage.svelte` | Belum ada | Owned message rating/comment; no model-training claim |
| GAP-10 Prompt templates/slash commands | `models/prompts.py`, `models/prompt_history.py` | Starter prompts/system prompt saja | Personal prompt presets + command UI; versioning jika dibutuhkan |
| GAP-11 Banyak tab/opsi settings personal | `SettingsModal.svelte`, Interface/Notifications/Shortcuts/Audio/Personalization | General/Connections/About + MCP | Pilih opsi yang ingin setara; definisikan persist/behavior satu per satu |
| GAP-12 Reasoning/artifacts dan Markdown extensions | `Messages`/`Artifacts.svelte`, markdown renderer referensi | Text/tool parts + GFM | Reasoning parts bila disediakan model, presentation rules, artifacts sandbox; bukan mengarang chain-of-thought |
| GAP-13 Multi-model comparison/response paralel | `Chat.svelte`, model controls | Satu model per run | Fan-out runs, per-model siblings/status/cancel/usage dan UI compare |
| GAP-14 Background generation/queue/stream resume | Lifecycle tasks/socket di `Chat.svelte` | SSE request-bound/checkpoint/poll | Durable background execution + resumable protocol; perubahan operasi besar |
| GAP-15 Rich provider connection config | `AddConnectionModal.svelte`, admin Connections | OpenAI-compatible Bearer URL/key | Custom headers/parameter passthrough/providers/connection policies; review credential forwarding |

Gap settings dibuktikan oleh tab yang ada; audit ini belum membandingkan setiap toggle, interaksi, atau kondisi enabled/permissions di seluruh aplikasi. Gap visual juga belum diukur dengan screenshot karena Kawan belum diimplementasikan.

## 5. Fitur luas yang sengaja keluar scope brief

RAG/knowledge, native Ollama, tools/functions marketplace, RBAC/groups/access grants, admin kompleks, calendars dan notes memang dikeluarkan oleh pemilik dalam brief. Rencana juga tidak memasukkan channels, automations, skills marketplace, voice, image generation, OAuth/LDAP/SCIM, dan memory system.

Sebagian fitur tambahan ini adalah fitur personal juga, sehingga tidak tepat menyebut semuanya “enterprise”. Mengeluarkannya tetap berarti full-product parity tidak tercapai. Daftar luas fitur referensi dapat dilihat pada [repo Open WebUI](https://github.com/open-webui/open-webui).

## 6. Rekomendasi mandor

Target yang konsisten dengan brief awal adalah **parity fitur personal BYOK yang dipilih**, dengan schema Kawan sendiri. Untuk mendekati seluruh pengalaman personal Open WebUI, kandidat awal perluasan adalah GAP-01–11, lalu nilai GAP-12–15 menurut kebutuhan produk; jangan memasukkan semuanya tanpa menilai biaya integrasi.

Jika pemilik meminta schema benar-benar identik, langkah planning harus berubah:

1. Pin versi/commit Open WebUI yang menjadi target, bukan moving `main`.
2. Inventaris semua tabel/kolom/default/nullability/index/constraint/JSON payload/API behavior pada versi itu.
3. Tentukan arti identik: nama/type saja, compatibility import/export, database drop-in, atau API drop-in. Empat target ini berbeda.
4. Selesaikan konflik dengan Auth.js/Prisma, BYOK encrypted rows, penghapusan enterprise scope dan format SSE Kawan.
5. Susun backlog compatibility serta conformance fixtures baru sebelum implementasi.

**Jangan memperkenalkan schema compatibility hanya lewat rename field.** Butuh JSON format, timestamp, auth, indexes, deletion semantics, ownership, dan migration behavior yang cocok juga.

## 7. Gate agar pelaksana tidak mengklaim parity berlebihan

- F0-01 wajib membaca audit ini, menghasilkan matrix pinned-baseline, lalu memisahkan planned/equivalent/adapted/excluded/gap.
- Planned berarti ada pekerjaan; equivalent baru boleh dipakai setelah behavior tests lulus.
- F9-04 menilai matriks brief dan matrix reference secara terpisah. “Seluruh brief lolos” tidak berarti “seluruh Open WebUI sama”.
- Setiap gap tambahan yang dipilih harus masuk plan/schema/task/acceptance; gap yang belum dipilih tetap bukan instruksi implementasi.
- Laporan akhir menyebut baseline commit, fitur setara, adaptations, omissions dan compatibility limits. Tidak ada persentase tanpa denominator jelas.

Seluruh audit ini hanya menambah kejelasan planning; tidak mengimplementasikan schema atau menambah fitur ke aplikasi.
