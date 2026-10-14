# Coverage — matriks cakupan fitur (scope nontechnical-v1)

Status: keputusan cakupan. Aplikasi belum ada. Baseline referensi: `f8ae8a6c328946dc62cd0712961a0632574581bf` (`open-webui` 0.12.0), tersedia read-only di `/Users/mekari/tokengateway/open-webui`.

## Cara membaca matriks ini

Setiap baris memetakan satu area fitur pada baseline ke keputusan:

- **include** — masuk scope v1, wajib punya requirement dan test.
- **defer** — tidak di v1, jalur lanjut dicatat; tidak boleh tampil sebagai kontrol aktif.
- **exclude** — keluar dari scope paket ini dengan alasan; bukan kelalaian.

Kolom **Sumber** menyebut lokasi baseline yang diverifikasi secara lokal (bukan ingatan). Verifikasi hanya membuktikan bahwa area itu ada di sumber; ia tidak membuktikan perilaku runtime-nya. Kolom **REQ** menunjuk requirement di `prd.md`. Kolom **Test** menyebut jenis bukti yang diharapkan.

## Aturan klaim

Paket ini **tidak** mengklaim 100% Open WebUI. Angka yang dipegang: 100% untuk baris `include` di tabel di bawah. Baris `defer`/`exclude` tidak dihitung sebagai tercakup, dan tidak ada baris yang dihitung dua kali.

## Matriks

| ID | Area fitur baseline | Sumber (verified lokal) | Keputusan | Alasan | REQ | Test |
|---|---|---|---|---|---|---|
| COV-01 | Registrasi/login sesi dasar | `backend/open_webui/routers/auths.py`; `src/routes/auth/` | include | Inti multi-user | REQ-NT-11..16 | E2E auth + cookie |
| COV-02 | Admin pertama otomatis | `routers/auths.py` | include | Cegah instance tanpa admin | REQ-NT-12 | Uji konkurensi |
| COV-03 | Manajemen pengguna oleh admin | `routers/users.py` | include (subset) | Butuh aktif/nonaktif/hapus | REQ-NT-74..76 | E2E admin |
| COV-04 | Role & grup & access grant granular | `models/groups.py`, `models/access_grants.py`, `routers/groups.py` | exclude | Enterprise; tidak dibutuhkan target nonteknis | — | — |
| COV-05 | SCIM provisioning | `routers/scim.py` | exclude | Enterprise | — | — |
| COV-06 | LDAP / trusted header auth | `routers/auths.py`, `utils/auth.py` | exclude | Enterprise; operator dapat menambah kemudian | — | — |
| COV-07 | OAuth/OIDC pihak ketiga | `utils/oauth.py` | defer | Berguna tetapi bukan kebutuhan v1; butuh kredensial provider | — | — |
| COV-08 | MFA/TOTP | `routers/mfa.py`, `utils/mfa.py` | defer | Nilai keamanan nyata tetapi menambah kompleksitas onboarding | — | — |
| COV-09 | API key aplikasi (bearer) | `models/auths.py`, `routers/auths.py` | defer | Berguna untuk integrasi; bukan jalur pengguna nonteknis | — | — |
| COV-10 | Connections / provider [OI] | `routers/openai.py` (`/config`, `/verify`, `/models`, `/chat/completions`) | include | Inti BYOK | REQ-NT-01..10, 17..21 | Integrasi + E2E onboarding |
| COV-11 | Koneksi Ollama native | `routers/ollama.py` | defer | Berguna untuk self-host lokal; menambah jalur protokol | — | — |
| COV-12 | Direct connections (key di browser) | `src/lib/components/chat/Settings/Connections/` | defer | Ditunda v1; keputusan default server dicatat | REQ-NT-08 | — |
| COV-13 | Model discovery + cache | `routers/openai.py` `/models` | include | Pemilih model | REQ-NT-18, 20 | Integrasi fixture |
| COV-14 | Chat streaming | `src/lib/components/chat/Chat.svelte`; `routers/chats.py` | include | Inti | REQ-NT-22 | Fixture Unicode terbelah |
| COV-15 | Stop / regenerate | `Chat.svelte`, `routers/chats.py` | include | Inti | REQ-NT-23, 24 | E2E |
| COV-16 | Pohon pesan (edit, branch) | `routers/chats.py`, `models/chats.py` | include | Inti | REQ-NT-25..27 | Uji pohon + E2E |
| COV-17 | Riwayat, search, rename, pin | `routers/chats.py` (`/search`, `/{id}/pin`) | include | Inti | REQ-NT-32, 33 | E2E |
| COV-18 | Arsip chat | `routers/chats.py` (`/archived`) | include | Inti | REQ-NT-34 | E2E |
| COV-19 | Folder bertingkat (nested) | `routers/folders.py` (`/update/parent`, `/update/expanded`) | defer | v1 satu tingkat; nested menambah kompleksitas | REQ-NT-35 | — |
| COV-20 | Tag chat | `routers/chats.py` (`/all/tags`, `/tags`) | defer | Fitur sekunder | — | — |
| COV-21 | Share link publik | `routers/chats.py` (`/share/{share_id}`) | include | Kebutuhan berbagi dasar | REQ-NT-36..38, 41 | Uji canary + revoke |
| COV-22 | Export/import chat | `routers/chats.py` (`/import`, `/stats/export`) | include (JSON+MD) | Anti vendor lock-in | REQ-NT-39, 40 | Round-trip |
| COV-23 | Export PDF | `routers/chats.py` | defer | Bukan kebutuhan v1 | — | — |
| COV-24 | Markdown + code + copy | `src/lib/components/chat/Messages/` | include | Inti rasa ChatGPT | REQ-NT-42 | Snapshot |
| COV-25 | Math (KaTeX) | `src/lib/components/chat/` | include | Umum dipakai | REQ-NT-43 | Snapshot |
| COV-26 | Mermaid | `src/lib/components/chat/` | include (P1) | Diagram dari model | REQ-NT-45 | Snapshot |
| COV-27 | Attach image (vision) | `src/lib/components/chat/MessageInput/` | include (gated) | Kebutuhan umum | REQ-NT-46, 66 | Capability matrix |
| COV-28 | Attach dokumen + Q&A RAG | `routers/retrieval.py`, `routers/knowledge.py` | include (sederhana) | Nilai inti nonteknis | REQ-NT-47, 54..61 | Fixture dokumen + sitasi |
| COV-29 | Knowledge base / collections penuh | `routers/knowledge.py`, `models/knowledge.py` | exclude | Workspace tingkat lanjut | — | — |
| COV-30 | Web search | `routers/retrieval.py` (`/process/web/search`) | include (gated) | Berguna, tapi harus dikonfigurasi | REQ-NT-51..53 | Uji gated |
| COV-31 | Prompt tersimpan (slash commands) | `routers/prompts.py` | include (pribadi) | Produktivitas dasar | REQ-NT-62..64 | E2E |
| COV-32 | Skills | `routers/skills.py`, `models/skills.py` | exclude | Tingkat lanjut | — | — |
| COV-33 | Tools / functions / pipelines / valves | `routers/tools.py`, `routers/functions.py`, `routers/pipelines.py` | exclude | Eksekusi kode; risiko dan kompleksitas | — | — |
| COV-34 | MCP / MCPO / OpenAPI tool server | `utils/mcp/`, `src/lib/components/chat/ToolServersModal.svelte` | defer | Bukan kebutuhan v1; ditinjau ulang bila esensial | — | — |
| COV-35 | Image generation | `routers/images.py` (`/generations`, `/edit`) | include (gated) | Kebutuhan umum | REQ-NT-65 | Uji gated |
| COV-36 | Audio STT/TTS | `routers/audio/__init__.py` (`/transcriptions`, `/speech`) | include (gated) | Dikte dan baca jawaban | REQ-NT-67, 68 | Uji gated |
| COV-37 | Realtime voice | `routers/audio/realtime.py` | exclude | Kompleksitas transport; bukan v1 | — | — |
| COV-38 | Memories | `routers/memories.py` | defer | Berguna; butuh desain privasi | — | — |
| COV-39 | Channels (messaging) | `routers/channels.py` | exclude | Sosial/kolaborasi; di luar target | — | — |
| COV-40 | Notes (editor kolaboratif) | `routers/notes.py` | exclude | CRDT/Yjs; di luar target | — | — |
| COV-41 | Calendar | `routers/calendar.py` | exclude | Di luar target | — | — |
| COV-42 | Automations / scheduler | `routers/automations.py` | exclude | Worker otonom; di luar target | — | — |
| COV-43 | Evaluations / arena | `routers/evaluations.py` | exclude | Di luar target | — | — |
| COV-44 | Analytics admin penuh | `routers/analytics.py` | exclude | Digantikan status sistem sederhana | REQ-NT-77 | — |
| COV-45 | Terminal / code execution | `routers/terminals.py`, `utils/code_interpreter.py` | exclude | Eksekusi arbitrer; risiko keamanan | — | — |
| COV-46 | Playground | `src/routes/(app)/playground/` | exclude | Untuk pengguna teknis | — | — |
| COV-47 | Workspace (models/prompts/tools admin) | `src/routes/(app)/workspace/` | exclude | Tingkat lanjut | — | — |
| COV-48 | Admin settings penuh (421 key) | `routers/configs.py`; `src/routes/(app)/admin/settings/` | exclude | Digantikan konfigurasi env + halaman admin dasar | REQ-NT-77 | — |
| COV-49 | Personal settings (General/Interface/Account) | `src/lib/components/chat/Settings/` | include (subset) | Tema, bahasa, akun | REQ-NT-70 | E2E |
| COV-50 | Usage personal | `src/lib/components/chat/Settings/Usage.svelte` | include (non-billing) | Monitoring, bukan billing | REQ-NT-71..73 | Uji reported flag |
| COV-51 | Data controls (hapus semua data) | `Settings/DataControls.svelte` | include (subset) | Privasi dasar | REQ-NT-75, 79 | E2E admin |
| COV-52 | Notifications / webhook | `routers/notifications.py` | exclude | Di luar target | — | — |
| COV-53 | Multi-model paralel | `src/lib/components/chat/` | defer | Satu model per pesan di v1 | — | — |
| COV-54 | Temporary chat | `routers/chats.py` | defer | Berguna; butuh kontrak retensi | — | — |
| COV-55 | Context compaction / summary | `utils/context_compaction.py` | defer | Berguna untuk chat panjang | — | — |
| COV-56 | Model wrapper / custom model | `routers/models.py`, `models/models.py` | defer | Tingkat lanjut | — | — |
| COV-57 | Feedback / rating pesan | `models/feedbacks.py` | defer | Sekunder | — | — |
| COV-58 | i18n multi-locale | `src/lib/i18n/` (64 locale pada baseline) | include (subset) | Indonesia + Inggris cukup untuk v1 | REQ-NT-70 | Snapshot locale |
| COV-59 | Tema gelap/terang | `src/lib/components/chat/` | include | Dasar | REQ-NT-49 | Snapshot |
| COV-60 | Responsif mobile | `src/lib/components/` | include | Pengguna nonteknis sering di ponsel | REQ-NT-49 | Snapshot 360 px |
| COV-61 | PWA / offline | `src/` | defer | Berguna; bukan v1 | — | — |
| COV-62 | Ollama pull/create/delete model | `routers/ollama.py` | exclude | Manajemen model lokal | — | — |
| COV-63 | Provider-native proxy (`/openai`, `/ollama` mounts) | `backend/open_webui/main.py` mounts | defer | Untuk klien eksternal | — | — |
| COV-64 | Socket.IO realtime | `backend/open_webui/socket/` | exclude | Digantikan SSE | SDD-4 | — |

## Ringkasan

| Keputusan | Jumlah baris |
|---|---:|
| include | 27 |
| defer | 17 |
| exclude | 20 |
| **Total** | **64** |

## Exception ledger (perbedaan yang disengaja)

| Perbedaan | Bentuk | Klasifikasi |
|---|---|---|
| Branding dan aset Kawan | Nama, logo, atribusi berbeda | Perbedaan visual/konten yang disengaja |
| Kredensial terenkripsi + mask | API tidak pernah mengembalikan key | Perbedaan keamanan/API yang disengaja |
| Overlay BYOK onboarding | Layar Hubungkan Gateway | Perilaku produk tambahan |
| Stack Next/Prisma/Auth.js | Implementasi berbeda dari baseline | Perbedaan implementasi; perilaku keluar dijaga |
| SSE menggantikan Socket.IO | Protokol berbeda | Perbedaan implementasi |
| Tanpa billing | Tidak ada harga/saldo | Konsekuensi model BYOK |

## Catatan verifikasi sumber

Area di atas diverifikasi keberadaannya pada sumber lokal (`git status` bersih, commit `f8ae8a6c328946dc62cd0712961a0632574581bf`). Yang **belum** diverifikasi dan karenanya ditandai `PERLU-BUKTI` di `sdd.md`:

- Bentuk pasti payload `GET /models` pada `routers/openai.py` untuk pemetaan kapabilitas.
- Perilaku persis penghapusan pesan (reparent) pada `models/chats.py`.
- Bentuk snapshot share pada `routers/chats.py` (`/share/{share_id}`).
- Unit waktu dan format JSON pada `models/chats.py`/`models/messages.py`.

Baris `include` yang menyentuh area tersebut tidak boleh diimplementasikan sebelum fakta ini diambil dari sumber. Tidak ada angka pada tabel di atas yang berasal dari luar sumber lokal.
