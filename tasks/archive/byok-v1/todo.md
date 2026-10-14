# Backlog pelaksanaan Kawan

Status semua task: belum dikerjakan. Dokumen ini adalah checklist kerja, bukan laporan implementasi.
Kontrak produk/arsitektur/data/API: [plan.md](plan.md). Instruksi pelaksana: [execution-prompt.md](execution-prompt.md).
Kesetaraan terhadap referensi dan gap di luar backlog: [parity-audit.md](parity-audit.md).

## Cara memakai checklist

- Kerjakan sesuai dependencies; satu task menghasilkan satu slice yang bisa diverifikasi.
- Centang task hanya setelah seluruh acceptance dan verification terpenuhi.
- File di bawah adalah perkiraan scope; pecah task jika implementasi melebar ke banyak subsistem.
- S/M berarti kecil/sedang, biasanya 1–5 file inti. Test fixture bersama tidak ditulis ulang di setiap task.
- `npm test` ditetapkan sebagai unit/integration runner non-watch; `npm run test:e2e` sebagai Playwright. Path suite di bawah adalah target yang perlu dibuat, bukan test yang sudah ada.
- Checkpoint selalu mencakup `npm run typecheck`, `npm run lint`, `npm run build`, dan focused tests perubahan. Gate akhir fase juga menjalankan E2E fase tersebut.
- Catat bukti di bagian akhir dokumen ini; jangan hanya menuliskan “sudah dites”.

## F0 — Referensi dan fondasi

### [ ] F0-01 — Kontrak parity dan UI

**Hasil:** reference notes dan keputusan interaksi untuk seluruh fitur personal dalam brief.
**Acceptance:**
- [ ] Baca layout/chat/Connections/Settings/model DB referensi sesuai tabel plan; catat source path dan commit.
- [ ] Baca parity audit; matrix baseline commit membedakan planned/adapted/excluded/gap, screen states, desktop/mobile dan semantik edit/regenerate/share.
- [ ] Konfirmasi kode/aset dibangun sendiri; “100% referensi” tidak diterjemahkan sebagai copy repo atau seluruh enterprise scope.
**Verification:** review notes melawan `PROMPT.md` dan `tasks/plan.md`; belum perlu test aplikasi.
**Dependencies:** tidak ada. **Files:** `docs/reference-notes.md`, `docs/ui-contract.md`. **Scope:** S.

### [ ] F0-02 — Scaffold stack dan branding dasar

**Hasil:** aplikasi Next.js minimal dengan komponen UI yang sesuai stack.
**Acceptance:**
- [ ] Next 15/TS strict/Tailwind 4/shadcn dipasang dengan versi terkunci, tanpa project generator yang membawa fitur di luar scope.
- [ ] Root layout, CSS tokens, logo Kawan asli, metadata identitas, dan halaman minimal tampil.
- [ ] Script dev/build/start/typecheck/lint tersedia dan clean install dari lockfile dapat dilakukan.
**Verification:** `npm run typecheck`, `npm run lint`, `npm run build`; smoke halaman desktop/mobile.
**Dependencies:** F0-01. **Files:** `package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/brand/brand.tsx` (+ config scaffold). **Scope:** M; pisahkan tooling config bila perlu.

### [ ] F0-03 — Database untuk dua provider

**Hasil:** koneksi Prisma dan mekanisme schema/migrasi SQLite + Postgres.
**Acceptance:**
- [ ] Schema awal User/UserSettings tersedia di dua provider; generator memilih target sebelum build.
- [ ] Migration SQL terpisah dan pengecekan kesamaan domain model disiapkan; tidak mengganti provider lewat URL saja.
- [ ] `.env.example` tanpa secret asli menjelaskan DB/auth/encryption/storage/repo config; DB tidak diinisialisasi saat static build.
**Verification:** validasi/generate/migrate SQLite bersih, migration Postgres bersih pada DB sementara, build target yang benar.
**Dependencies:** F0-02. **Files:** `prisma/sqlite/schema.prisma`, `prisma/postgres/schema.prisma`, `src/lib/db.ts`, `scripts/db-target.mjs`, `.env.example` (+ migrations). **Scope:** M.

**Checkpoint F0-A:** notes, shell, dan DB siap; typecheck/lint/build sukses. Belum ada klaim auth/chat berjalan.

### [ ] F0-04 — Test harness dan gateway fixture

**Hasil:** pengujian yang tidak memerlukan key provider nyata.
**Acceptance:**
- [ ] Unit/integration dan Playwright terpasang dengan test DB terisolasi; script test non-watch tersedia.
- [ ] Fixture gateway menyediakan models dan SSE fragmented/Unicode/401/429/error/absent usage/delay; request dapat dihitung untuk uji idempotency.
- [ ] Test env memiliki allowlist jaringan lokal eksplisit, tidak menonaktifkan guard production.
**Verification:** jalankan smoke fixture dan satu E2E halaman; build tetap sukses.
**Dependencies:** F0-03. **Files:** `vitest.config.ts`, `playwright.config.ts`, `tests/fixtures/gateway.ts`, `tests/integration/fixture.test.ts`, `package.json`. **Scope:** M.

### [ ] F0-05 — Kontrak request dan akses jaringan

**Hasil:** primitives kecil untuk validasi/error/outbound yang dipakai seluruh route user.
**Acceptance:**
- [ ] Schema DTO error/URL Base API dan env validation tersedia; query/fragment/embedded credentials ditolak.
- [ ] Outbound HTTPS public guard menangani IPv4/IPv6/private/DNS/redirect, timeout/size limit; credential tidak mengikuti redirect.
- [ ] DNS validation diterapkan pada koneksi transport sebenarnya atau egress guard yang terbukti; dev/private allowlist hanya operator.
**Verification:** `npm test -- tests/unit/outbound.test.ts tests/unit/validation.test.ts`; uji DNS rebinding/redirect/private metadata dengan fixture; build.
**Dependencies:** F0-04. **Files:** `src/lib/outbound.ts`, `src/lib/validation.ts`, `src/lib/api-error.ts`, `tests/unit/outbound.test.ts`, `tests/unit/validation.test.ts`. **Scope:** M.

**Gate F0:** clean install + minimal app + DB/test fixtures + transport aman, semuanya terverifikasi; `npm run build` sukses.

## F1 — Auth multi-user

### [ ] F1-01 — Registrasi account

**Hasil:** user dapat membuat akun lewat form nyata.
**Acceptance:**
- [ ] Name/email/password divalidasi; email normalized unik; password async memory-hard dengan salt unik.
- [ ] Form register menunjukkan submitting/error/success dan tidak mengembalikan hash/password.
- [ ] Duplikat email tidak merusak DB, dan input berlebih/body invalid ditolak aman.
**Verification:** `npm test -- tests/integration/register.test.ts`; submit form sukses/gagal secara browser.
**Dependencies:** F0 gate. **Files:** `src/lib/password.ts`, `src/app/api/register/route.ts`, `src/app/(auth)/register/page.tsx`, `src/components/auth/auth-form.tsx`, `tests/integration/register.test.ts`. **Scope:** M.

### [ ] F1-02 — Login/session/logout

**Hasil:** Auth.js Credentials bekerja untuk user yang terdaftar.
**Acceptance:**
- [ ] Credentials authorize memakai user DB; cookie/session konfigurasi aman; JWT tidak mengandung password/key.
- [ ] Login valid masuk workspace; invalid memberi error generic; logout menghapus session browser.
- [ ] Helper require-user memberi owner ID dari session dan memverifikasi sessionVersion; private layout/API menolak anonymous.
**Verification:** `npm run test:e2e -- tests/e2e/auth.spec.ts`; cookie/session checks dan route anonymous.
**Dependencies:** F1-01. **Files:** `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(workspace)/layout.tsx`, `tests/e2e/auth.spec.ts`. **Scope:** M.

**Checkpoint F1-A:** register/login/logout E2E dan build berhasil; cookie/hash tidak bocor.

### [ ] F1-03 — Auth limits dan mutation protection

**Hasil:** auth tidak bergantung limiter memory dan route mutasi memeriksa asal request.
**Acceptance:**
- [ ] Counter durable atau limit deployment diuji untuk login/register; expired bucket dibersihkan.
- [ ] Auth.js CSRF dan Origin check route custom benar; request cross-site ditolak.
- [ ] Anonymous/invalid payload/429 menggunakan pesan aman tanpa email enumeration atau log password.
**Verification:** `npm test -- tests/integration/auth-security.test.ts`; request burst dan cross-origin fixture.
**Dependencies:** F1-02. **Files:** kedua schema/migration, `src/lib/rate-limit.ts`, `src/lib/request-origin.ts`, `tests/integration/auth-security.test.ts`. **Scope:** M; pisahkan schema migration bila melebar.

### [ ] F1-04 — Workspace dan onboarding guard

**Hasil:** routing dan shell akun siap menerima connection.
**Acceptance:**
- [ ] Login pertama menuju onboarding placeholder form nyata fase berikutnya; user anonymous ke login.
- [ ] Shell sidebar/user menu/new chat/settings route tersedia tanpa fake history/model; branding login/sidebar tampil.
- [ ] Header, drawer, focus, keyboard navigation dan logout bisa dipakai pada 320 px.
**Verification:** E2E auth redirect + browser responsive; `npm run build`.
**Dependencies:** F1-03. **Files:** `src/components/sidebar/workspace-shell.tsx`, `src/components/sidebar/user-menu.tsx`, `src/app/(workspace)/page.tsx`, `src/app/(workspace)/onboarding/page.tsx`, `tests/e2e/auth.spec.ts`. **Scope:** M.

**Gate F1:** user baru dapat register/login/logout; route privat terlindungi; build sukses. Onboarding belum diklaim lengkap sampai F2.

## F2 — BYOK Connections dan onboarding

### [ ] F2-01 — Enkripsi dan model Connection

**Hasil:** persistence key gateway default yang tidak bocor ke response.
**Acceptance:**
- [ ] Connection schema sesuai plan, termasuk nullable secret untuk Direct; migrasi kedua provider.
- [ ] AES-256-GCM 32-byte env secret/IV unik/tag/AAD/version; decrypt gagal aman untuk tampering/wrong scope.
- [ ] DTO allowlist dan mask tidak pernah memuat plaintext/ciphertext; logging secret dilarang.
**Verification:** `npm test -- tests/unit/crypto.test.ts`; inspect DB record/DTO fixtures; build tanpa raw secret client.
**Dependencies:** F1 gate. **Files:** kedua schema/migration, `src/lib/crypto.ts`, `src/lib/connections.ts`, `tests/unit/crypto.test.ts`. **Scope:** M.

### [ ] F2-02 — Test gateway dari form

**Hasil:** test URL/key benar-benar memanggil models endpoint.
**Acceptance:**
- [ ] `${baseUrl}/models` memakai Bearer key via safe outbound; tidak menambah `/v1` dua kali.
- [ ] Validate/deduplicate models; return count; empty/malformed/401/timeout ditampilkan berbeda.
- [ ] Key transient tidak disimpan dan tidak dikembalikan; endpoint auth/rate limited.
**Verification:** `npm test -- tests/integration/connections-test.test.ts`; hitungan request fixture memastikan tidak ada chat completion.
**Dependencies:** F2-01. **Files:** `src/app/api/connections/test/route.ts`, `src/lib/connections.ts`, `src/lib/validation.ts`, `tests/integration/connections-test.test.ts`. **Scope:** M.

### [ ] F2-03 — Simpan connection dan aktif tunggal

**Hasil:** connection pertama dapat disimpan, lalu dipilih aktif secara atomik.
**Acceptance:**
- [ ] POST/GET/activate memakai owner session, encrypt key, DTO masked; save validasi konfigurasi akhir server-side.
- [ ] First connection aktif; aktivasi bersamaan tetap menghasilkan maksimal satu aktif/user di SQLite dan Postgres.
- [ ] Direct create hanya menerima metadata dan menolak field secret; URL/mode invariants konsisten.
**Verification:** `npm test -- tests/integration/connections.test.ts`; concurrent activate dan cross-user IDs.
**Dependencies:** F2-02. **Files:** `src/app/api/connections/route.ts`, `src/app/api/connections/[id]/activate/route.ts`, `src/lib/connections.ts`, `tests/integration/connections.test.ts`. **Scope:** M.

**Checkpoint F2-A:** key encrypted/masked, test models nyata, single active dan owner checks lulus; build sukses.

### [ ] F2-04 — UI Hubungkan Gateway

**Hasil:** user baru selesai onboarding sampai siap memilih model.
**Acceptance:**
- [ ] Form name/Base URL/API Key/Test koneksi menampilkan loading/success/failure/count; edit input membatalkan hasil test lama.
- [ ] Save success mengosongkan key form dan masuk chat; tidak ada persistence key default di localStorage.
- [ ] Attribution/link registrasi gateway/CTA gagal sesuai branding; form accessible/mobile.
**Verification:** `npm run test:e2e -- tests/e2e/onboarding.spec.ts`; network/storage inspection key default.
**Dependencies:** F2-03. **Files:** `src/app/(workspace)/onboarding/page.tsx`, `src/components/connections/connection-form.tsx`, `src/components/connections/gateway-cta.tsx`, `tests/e2e/onboarding.spec.ts`. **Scope:** M.

### [ ] F2-05 — CRUD Connections di Settings

**Hasil:** kelola beberapa gateway dan aktifnya melalui UI.
**Acceptance:**
- [ ] Rename/edit/key replacement/test saved/delete tersedia; blank key keep hanya untuk URL/mode sama.
- [ ] URL berubah meminta key baru; secret lama tidak dicoba pada endpoint baru; delete tidak menghapus histori.
- [ ] Delete aktif memilih pengganti deterministik atau onboarding jika kosong; UI memiliki pending/error/empty/CTA.
**Verification:** `npm test -- tests/integration/connections.test.ts`; E2E dua gateway + edit URL + delete aktif.
**Dependencies:** F2-04. **Files:** `src/app/api/connections/[id]/route.ts`, `src/app/api/connections/[id]/test/route.ts`, `src/app/(workspace)/settings/[section]/page.tsx`, `src/components/connections/connection-list.tsx`, `tests/e2e/connections.spec.ts`. **Scope:** M.

### [ ] F2-06 — Model list dan picker

**Hasil:** model yang ditampilkan berasal dari connection aktif nyata.
**Acceptance:**
- [ ] Models route owner-scoped; refresh aman; cache jika ada terikat user/connection dan invalidated saat edit.
- [ ] Picker search menunjukkan model ID aktual, connection name, loading/error/empty; tidak ada hardcoded model list.
- [ ] Switching active connection membatalkan response models stale dan me-reset selection yang invalid tanpa mengubah pesan lama.
**Verification:** `npm run test:e2e -- tests/e2e/connections.spec.ts`; race switch fixture; `npm run build`.
**Dependencies:** F2-05. **Files:** `src/app/api/connections/[id]/models/route.ts`, `src/components/chat/model-picker.tsx`, `src/components/chat/chat-header.tsx`, `src/lib/connections.ts`, `tests/e2e/connections.spec.ts`. **Scope:** M.

**Gate F2:** register → test gateway → encrypted save → chat dengan model list; dua connections/negative flows berjalan; build sukses.

## F3 — Streaming chat yang persisten

### [ ] F3-01 — Chat tree dan generation claim

**Hasil:** database dapat membuat chat, nodes, dan satu run atomik.
**Acceptance:**
- [ ] Chat/Message/Generation schema, indexes, revision, lease, idempotency sesuai plan tersedia di kedua DB.
- [ ] Create/get chat ownership benar; send claim membuat user + assistant placeholder sekali saja.
- [ ] Parent/current/connection consistency dan satu active generation/chat diverifikasi server, bukan flag UI.
**Verification:** `npm test -- tests/integration/generation-claim.test.ts`; concurrency dan duplicate request kedua DB.
**Dependencies:** F2 gate. **Files:** kedua schema/migration, `src/lib/generation.ts`, `src/app/api/chats/route.ts`, `tests/integration/generation-claim.test.ts`. **Scope:** M; pisahkan GET detail bila perlu.

### [ ] F3-02 — Provider compatible dan SSE server

**Hasil:** inferensi benar-benar mengalir dari gateway milik user ke browser.
**Acceptance:**
- [ ] AI SDK v5 provider memakai URL/key connection user melalui transport aman; tidak memakai gateway provider default SDK.
- [ ] Konteks ancestry + system prompt, event start/delta/error/finish, metadata model/run sesuai kontrak SSE v1.
- [ ] Prestream error JSON, poststream error SSE, status terminal/persistence/catch cleanup benar.
**Verification:** `npm test -- tests/integration/streaming.test.ts`; fixture capture request verifies endpoint/auth/context; error/Unicode stream.
**Dependencies:** F3-01. **Files:** `src/app/api/chats/[id]/generate/route.ts`, `src/lib/generation.ts`, `src/lib/stream-protocol.ts`, `src/lib/message-tree.ts`, `tests/integration/streaming.test.ts`. **Scope:** M.

### [ ] F3-03 — Composer dan render incremental

**Hasil:** user dapat mengirim dan melihat jawaban bertambah.
**Acceptance:**
- [ ] Fetch SSE parser menangani partial chunks/CRLF/UTF-8/EOF; tidak menganggap chunk sebagai event.
- [ ] Composer Enter send/Shift+Enter newline/IME, loading, draft, error/retry, disabled valid state bekerja.
- [ ] Auto-scroll mengikuti user di bawah; scrolling ke atas tidak direbut; navigation tidak membuat response masuk chat lain.
**Verification:** `npm test -- tests/unit/stream-parser.test.ts`; `npm run test:e2e -- tests/e2e/chat-stream.spec.ts`.
**Dependencies:** F3-02. **Files:** `src/lib/stream-protocol.ts`, `src/components/chat/chat-workspace.tsx`, `src/components/chat/composer.tsx`, `src/components/chat/message-list.tsx`, `tests/unit/stream-parser.test.ts`. **Scope:** M.

**Checkpoint F3-A:** kirim chat menghasilkan request gateway dan SSE nyata; parser/context/ownership lulus; build sukses.

### [ ] F3-04 — Stop dan partial persistence

**Hasil:** Stop menghentikan upstream dan menyimpan jawaban parsial.
**Acceptance:**
- [ ] Durable stop route + AbortSignal/checkpoint heartbeat bekerja lintas request; tidak memakai process-global controller sebagai sumber kebenaran.
- [ ] Partial content saved bounded interval dan final status stopped; cancel/start race dan double Stop idempotent.
- [ ] Cleanup berjalan pada complete/error/abort; unknown usage tetap unknown; expired lease tidak mengunci chat selamanya.
**Verification:** `npm test -- tests/integration/stream-stop.test.ts`; E2E Stop → reload; fixture memverifikasi upstream aborted.
**Dependencies:** F3-03. **Files:** `src/app/api/generations/[id]/stop/route.ts`, `src/app/api/generations/[id]/route.ts`, `src/lib/generation.ts`, `src/components/chat/chat-workspace.tsx`, `tests/integration/stream-stop.test.ts`. **Scope:** M.

### [ ] F3-05 — Prompt/model dan retry run

**Hasil:** konfigurasi tiap chat benar-benar dipakai generation berikutnya.
**Acceptance:**
- [ ] Chat update menyimpan system prompt/model/connection dengan revision dan owner checks.
- [ ] Retry/regenerate membuat assistant sibling baru; bukan menimpa assistant sebelumnya atau mengulang POST otomatis.
- [ ] Model lama pada historical node tetap; prompt/provider error/limit ditampilkan aman.
**Verification:** `npm test -- tests/integration/chat-config.test.ts`; fixture input prompt/model dan retry count; UI prompt edit.
**Dependencies:** F3-04. **Files:** `src/app/api/chats/[id]/route.ts`, `src/components/chat/chat-controls.tsx`, `src/lib/generation.ts`, `src/components/chat/message-actions.tsx`, `tests/integration/chat-config.test.ts`. **Scope:** M.

### [ ] F3-06 — Reload, disconnect dan stale run

**Hasil:** lifecycle stream tidak membuat history hilang atau false success.
**Acceptance:**
- [ ] Reload mengambil checkpoint DB; active run dipoll bounded; expired run jadi interrupted dan boleh generate baru.
- [ ] Dua tab/retry request/stale revision tidak membuat dua inferensi atau kehilangan node; 409 ditangani UI.
- [ ] Upstream early EOF/error/timeout/maxDuration tidak diklaim completed; navigation/unmount lifecycle ditangani.
**Verification:** `npm run test:e2e -- tests/e2e/chat-lifecycle.spec.ts`; integration crash/lease fixture; `npm run build`.
**Dependencies:** F3-05. **Files:** `src/lib/generation.ts`, `src/components/chat/chat-workspace.tsx`, `src/app/(workspace)/c/[chatId]/page.tsx`, `tests/integration/generation-lifecycle.test.ts`, `tests/e2e/chat-lifecycle.spec.ts`. **Scope:** M.

**Gate F3:** streaming/stop/partial/reload/model/prompt/idempotency berjalan; build sukses.

## F4 — History, folders, branching

### [ ] F4-01 — Sidebar history dan date groups

**Hasil:** seluruh chat owned user dapat dibuka ulang.
**Acceptance:**
- [ ] List metadata paginated/sort stable, pinned terpisah, tanggal mengikuti timezone user.
- [ ] Klik chat mengambil tree DB dan branch aktif; URL refresh/deep link bekerja.
- [ ] Empty/loading/error/retry dan drawer mobile berfungsi tanpa fake history.
**Verification:** `npm run test:e2e -- tests/e2e/history.spec.ts`; pagination/date boundary integration.
**Dependencies:** F3 gate. **Files:** `src/app/api/chats/route.ts`, `src/components/sidebar/chat-list.tsx`, `src/components/sidebar/workspace-shell.tsx`, `src/lib/chat-dates.ts`, `tests/e2e/history.spec.ts`. **Scope:** M.

### [ ] F4-02 — Rename, pin, delete

**Hasil:** aksi menu history tersimpan dan UI konsisten.
**Acceptance:**
- [ ] Rename/pin/unpin memakai mutation revision/ownership; failed optimistic action dipulihkan.
- [ ] Delete butuh konfirmasi, tidak menghapus chat user lain; bila chat terbuka dihapus, kembali new chat.
- [ ] Reload mempertahankan title/pin; active generation delete ditolak/dihentikan dengan perilaku eksplisit.
**Verification:** E2E history actions + cross-user mutation tests; build checkpoint.
**Dependencies:** F4-01. **Files:** `src/app/api/chats/[id]/route.ts`, `src/components/sidebar/chat-menu.tsx`, `src/components/sidebar/chat-list.tsx`, `tests/integration/chat-actions.test.ts`, `tests/e2e/history.spec.ts`. **Scope:** M.

### [ ] F4-03 — Search judul dan isi

**Hasil:** search dapat menemukan isi pesan, bukan hanya title.
**Acceptance:**
- [ ] Query owner-scoped mencari title dan text content nodes, mengembalikan chat unik dengan snippet aman.
- [ ] Debounce/batalkan request stale, empty/no result, cursor/paging, folder/pin filters tersedia.
- [ ] Tidak mencari body file raw/tool auth; tidak mengunduh seluruh histories ke browser untuk search.
**Verification:** `npm test -- tests/integration/history-search.test.ts`; E2E query hanya ada di pesan, bukan judul.
**Dependencies:** F4-02. **Files:** `src/app/api/chats/route.ts`, `src/lib/history-search.ts`, `src/components/sidebar/chat-search.tsx`, `tests/integration/history-search.test.ts`, `tests/e2e/history.spec.ts`. **Scope:** M.

**Checkpoint F4-A:** sidebar, menu, search persist dengan data owned; build sukses.

### [ ] F4-04 — Folder personal

**Hasil:** user dapat mengelompokkan chat dalam folder.
**Acceptance:**
- [ ] Create/rename/delete satu tingkat dan move chat via menu bekerja dengan ownership.
- [ ] Delete folder memindahkan chat ke tanpa folder; tidak ikut menghapus chat/history.
- [ ] Folder dan count/filter persist; empty/error/name validation ditangani.
**Verification:** `npm test -- tests/integration/folders.test.ts`; E2E create/move/delete folder.
**Dependencies:** F4-03. **Files:** kedua schema/migration, `src/app/api/folders/route.ts`, `src/app/api/folders/[id]/route.ts`, `src/components/sidebar/folder-list.tsx`, `tests/integration/folders.test.ts`. **Scope:** M.

### [ ] F4-05 — Edit user menghasilkan branch

**Hasil:** mengedit user message tidak menghilangkan percakapan lama.
**Acceptance:**
- [ ] Edit menghasilkan user sibling + assistant child; nodes lama/descendants tidak dimutasi.
- [ ] Edit mempertahankan attachment reference yang valid; submit empty/streaming/stale parent ditolak aman.
- [ ] Konteks model hanya ancestry branch baru; transaction rollback tidak meninggalkan placeholder orphan.
**Verification:** `npm test -- tests/integration/branching.test.ts`; example U1/A1/U2/A2 → edit U1; fixture request context.
**Dependencies:** F4-04. **Files:** `src/lib/message-tree.ts`, `src/lib/generation.ts`, `src/components/chat/message-editor.tsx`, `src/components/chat/message-actions.tsx`, `tests/integration/branching.test.ts`. **Scope:** M.

### [ ] F4-06 — Sibling navigation dan integritas tree

**Hasil:** semua alternatif edit/regenerate bisa diakses ulang.
**Acceptance:**
- [ ] Pager `1/n` sibling bekerja pada user dan assistant; selected descendant/current leaf disimpan valid.
- [ ] Navigasi antar-branch tidak mengirim inferensi; regenerating branch memakai parent yang dipilih.
- [ ] Cycle/cross-chat parent/invalid current ID ditolak server; revision conflict tidak membuang perubahan tab lain.
**Verification:** `npm test -- tests/unit/message-tree.test.ts tests/integration/branching.test.ts`; `npm run test:e2e -- tests/e2e/branches.spec.ts`; build.
**Dependencies:** F4-05. **Files:** `src/components/chat/branch-switcher.tsx`, `src/components/chat/message-list.tsx`, `src/lib/message-tree.ts`, `tests/unit/message-tree.test.ts`, `tests/e2e/branches.spec.ts`. **Scope:** M.

**Gate F4:** history/search/folder/pin/edit/regenerate/branch restore lengkap; build sukses.

## F5 — Markdown, attachments, settings

### [ ] F5-01 — Markdown dan code actions

**Hasil:** jawaban/code dapat dibaca dan disalin dengan aman.
**Acceptance:**
- [ ] Markdown GFM/code highlighting/table/list/streaming incomplete fence tampil; code scroll dalam container.
- [ ] Copy jawaban/code memakai clipboard dan feedback; error clipboard ditangani.
- [ ] Raw HTML/scripts/unsafe links/remote tracking images tidak dijalankan atau auto-fetch.
**Verification:** `npm test -- tests/unit/markdown-safety.test.tsx`; browser code/copy/XSS payload.
**Dependencies:** F4 gate. **Files:** `src/components/chat/markdown.tsx`, `src/components/chat/code-block.tsx`, `src/components/chat/message-list.tsx`, `tests/unit/markdown-safety.test.tsx`. **Scope:** M.

### [ ] F5-02 — Private storage dan upload validation

**Hasil:** file masuk penyimpanan privat dengan batas yang jelas.
**Acceptance:**
- [ ] Attachment/MessageAttachment schema kedua DB; upload multipart limit/MIME sniff/owner; bytes di luar public.
- [ ] Local persistent storage serta driver production yang dipilih berjalan; GET bytes auth/ownership/nosniff aman.
- [ ] MIME spoof/path traversal/oversize/unsupported ditolak; metadata DTO tanpa storage credentials.
**Verification:** `npm test -- tests/integration/attachments.test.ts`; storage fixture private retrieval user A/B.
**Dependencies:** F5-01. **Files:** kedua schema/migration, `src/lib/storage.ts`, `src/app/api/attachments/route.ts`, `src/app/api/attachments/[id]/route.ts`, `tests/integration/attachments.test.ts`. **Scope:** M; driver object store dapat dipisah subtask.

### [ ] F5-03 — Lampiran gambar di composer dan model

**Hasil:** image input sampai ke gateway, bukan sekadar preview UI.
**Acceptance:**
- [ ] Attach/remove/preview/status sebelum send bekerja dan jumlah/size mengikuti backend.
- [ ] Message mengikat owned file ID; server membangun image parts dari private bytes untuk model.
- [ ] Branch/edit/reload mempertahankan file refs; model text-only mendapat error aman, tanpa klaim vision palsu.
**Verification:** gateway fixture capture multimodal payload; `npm run test:e2e -- tests/e2e/attachments.spec.ts`.
**Dependencies:** F5-02. **Files:** `src/components/chat/attachment-picker.tsx`, `src/components/chat/composer.tsx`, `src/lib/attachments.ts`, `src/lib/generation.ts`, `tests/e2e/attachments.spec.ts`. **Scope:** M.

**Checkpoint F5-A:** Markdown aman, private upload, multimodal payload benar; build sukses.

### [ ] F5-04 — PDF dan teks sebagai konteks

**Hasil:** dokumen dapat dipakai model tanpa RAG pipeline.
**Acceptance:**
- [ ] PDF text dan UTF-8 allowlist diekstrak dengan page/time/text limits dan status parsing/ready/failed.
- [ ] Gateway mendapat bounded document context dari attachment yang dipilih; text disimpan sebagai data, bukan system instruction.
- [ ] Scan/encrypted/malformed/oversize text menghasilkan pesan jelas; truncation tidak diam-diam.
**Verification:** `npm test -- tests/integration/document-context.test.ts`; fixtures PDF text/scan/malformed + captured model payload.
**Dependencies:** F5-03. **Files:** `src/lib/attachments.ts`, `src/lib/pdf-text.ts`, `src/components/chat/attachment-picker.tsx`, `src/lib/generation.ts`, `tests/integration/document-context.test.ts`. **Scope:** M.

### [ ] F5-05 — Attachment lifecycle

**Hasil:** cleanup file tidak merusak shared reference antar-branch.
**Acceptance:**
- [ ] Draft/orphan TTL dan quota checks berjalan dengan job/procedure yang didokumentasikan.
- [ ] Remove/delete chat melepaskan referensi; bytes hanya dihapus jika tak lagi dipakai.
- [ ] Private file cannot access via public share/raw storage path; failure cleanup bisa dicoba ulang aman.
**Verification:** `npm test -- tests/integration/attachment-lifecycle.test.ts`; simulate branch reuse/delete/orphan cleanup.
**Dependencies:** F5-04. **Files:** `src/lib/attachments.ts`, `scripts/cleanup-attachments.ts`, `src/app/api/chats/[id]/route.ts`, `src/app/api/attachments/[id]/route.ts`, `tests/integration/attachment-lifecycle.test.ts`. **Scope:** M.

### [ ] F5-06 — General, locale, About

**Hasil:** Settings lengkap sesuai scope personal Kawan.
**Acceptance:**
- [ ] Theme light/dark/system, locale id/en dan timezone IANA tersimpan per user; perubahan UI benar-benar diterapkan.
- [ ] General/Connections/About navigable; About versi build/repo configurable/attribution nyata.
- [ ] Theme hydration/flash ditangani tanpa server secret ke client; settings bukan arbitrary JSON bag.
**Verification:** `npm run test:e2e -- tests/e2e/settings.spec.ts`; theme/language/reload, DB user isolation.
**Dependencies:** F5-05. **Files:** `src/app/api/settings/route.ts`, `src/components/settings/settings-panel.tsx`, `src/components/settings/theme-provider.tsx`, `src/lib/i18n/index.ts`, `tests/e2e/settings.spec.ts` (+ dictionaries). **Scope:** M.

### [ ] F5-07 — Responsive dan accessibility finish

**Hasil:** auth/onboarding/chat/settings dapat dipakai desktop dan mobile.
**Acceptance:**
- [ ] 320/768/1024/1440 px tanpa page overflow; mobile keyboard/safe area/composer/drawer bekerja.
- [ ] Keyboard/IME, focus trap/restore, labels, contrast, reduced-motion dan error announcements masuk akal.
- [ ] Seluruh branding yang sudah masuk scope tampil konsisten; tidak ada console/hydration error.
**Verification:** Playwright screenshot + keyboard smoke + automated accessibility checks yang relevan; `npm run build`.
**Dependencies:** F5-06. **Files:** `src/app/globals.css`, `src/components/sidebar/workspace-shell.tsx`, `src/components/chat/composer.tsx`, `src/components/settings/settings-panel.tsx`, `tests/e2e/responsive.spec.ts`. **Scope:** M.

**Gate F5:** attachments end-to-end, Markdown/copy, settings persist, UI responsif; build sukses.

## F6 — Export, share, metering

### [ ] F6-01 — Export Markdown cabang aktif

**Hasil:** user mengunduh percakapan yang sedang dilihat.
**Acceptance:**
- [ ] Export memakai ancestry current leaf, menjaga Markdown/code, judul/role/nama file; filename disanitasi.
- [ ] Tidak memasukkan ciphertext/key/base URL privat/system prompt/hidden branches.
- [ ] Owner auth diperlukan; empty chat memiliki perilaku jelas.
**Verification:** `npm test -- tests/integration/export.test.ts`; download browser dan inspect content.
**Dependencies:** F5 gate. **Files:** `src/app/api/chats/[id]/export/route.ts`, `src/lib/export-chat.ts`, `src/components/chat/chat-controls.tsx`, `tests/integration/export.test.ts`. **Scope:** M.

### [ ] F6-02 — Create snapshot share dan public view

**Hasil:** link publik hanya membaca snapshot yang dipilih user.
**Acceptance:**
- [ ] Share preview dan create mengambil cabang aktif dengan allowlist fields; token berentropi tinggi, schemaVersion.
- [ ] Public page tidak memerlukan login, tanpa composer, attachment bytes/raw tool output/private metadata.
- [ ] Original chat berubah tidak mengubah snapshot; noindex/no-store/no-referrer disetel.
**Verification:** `npm test -- tests/integration/share.test.ts`; `npm run test:e2e -- tests/e2e/share.spec.ts` anonymous browser.
**Dependencies:** F6-01. **Files:** kedua schema/migration, `src/app/api/chats/[id]/share/route.ts`, `src/app/s/[token]/page.tsx`, `src/components/chat/share-dialog.tsx`, `tests/integration/share.test.ts`. **Scope:** M.

### [ ] F6-03 — Manage/revoke share

**Hasil:** owner dapat mencabut akses link yang sudah dibuat.
**Acceptance:**
- [ ] List/revoke share owner-scoped; revoke repeated idempotent; token revoked jadi 404.
- [ ] Delete chat mencabut seluruh share terkait; caching tidak mempertahankan snapshot publik revoked.
- [ ] UI share list/copy link/error bekerja tanpa mengubah snapshot lama secara diam-diam.
**Verification:** E2E anonymous open → owner revoke/delete → anonymous 404; cross-user revoke ditolak.
**Dependencies:** F6-02. **Files:** `src/app/api/chats/[id]/shares/route.ts`, `src/app/api/chats/[id]/shares/[shareId]/route.ts`, `src/app/api/chats/[id]/route.ts`, `src/components/chat/share-dialog.tsx`, `tests/e2e/share.spec.ts`. **Scope:** M.

**Checkpoint F6-A:** export/snapshot/revoke aman dan berfungsi; build sukses.

### [ ] F6-04 — Usage persistence idempotent

**Hasil:** usage gateway tersimpan satu summary per generation.
**Acceptance:**
- [ ] UsageRecord schema/indexes kedua DB; prompt/completion/total nullable, actual/requested model, source dan connection snapshot.
- [ ] Final/upsert idempotent, abort/error hanya mencatat angka yang tersedia; absent usage tidak jadi zero palsu.
- [ ] Connection/chat delete tidak menghilangkan monitoring historis; ownership tetap benar.
**Verification:** `npm test -- tests/integration/usage-recording.test.ts`; fixture usage/absent/duplicate finish/abort.
**Dependencies:** F6-03. **Files:** kedua schema/migration, `src/lib/usage.ts`, `src/lib/generation.ts`, `tests/integration/usage-recording.test.ts`. **Scope:** M.

### [ ] F6-05 — Usage page dan aggregations

**Hasil:** user dapat memantau token per hari/model/connection.
**Acceptance:**
- [ ] Filter periode/connection/timezone; total dan daily/model sums konsisten; unknown usage ditampilkan terpisah.
- [ ] Grafik harian accessible dan tabel model/connection berasal dari DB; empty/error/loading benar.
- [ ] Tidak ada billing/pricing/fake values; timezone boundary dan deleted connection ditangani.
**Verification:** `npm test -- tests/integration/usage-query.test.ts`; `npm run test:e2e -- tests/e2e/usage.spec.ts`; build.
**Dependencies:** F6-04. **Files:** `src/app/api/usage/route.ts`, `src/app/(workspace)/usage/page.tsx`, `src/components/usage/usage-dashboard.tsx`, `src/lib/usage.ts`, `tests/integration/usage-query.test.ts`. **Scope:** M.

**Gate F6:** share/export/usage benar dari data nyata, tidak double-count/leak; build sukses.

## F7 — Direct opsional

Fase ini direkomendasikan untuk menyelesaikan seluruh opsi brief. Jika pemilik memilih menunda, catat keputusan dan jangan tampilkan toggle/function yang belum bekerja.

### [ ] F7-01 — Direct connection lifecycle

**Hasil:** metadata connection disimpan server; key hanya perangkat browser.
**Acceptance:**
- [ ] Toggle Direct + key localStorage namespace user/connection; server DTO/schema tidak punya secret Direct.
- [ ] Logout/delete/mode switch cleanup; perangkat lain meminta key lagi; server ↔ Direct meminta key baru.
- [ ] UI menjelaskan localStorage/CORS dan history masih di server; gagal Direct tidak fallback ke proxy.
**Verification:** network/storage assertions pada `tests/e2e/direct.spec.ts`; inspect DB Direct secret null.
**Dependencies:** F6 gate. **Files:** `src/lib/direct-connections.ts`, `src/components/connections/connection-form.tsx`, `src/components/connections/connection-list.tsx`, `src/components/sidebar/user-menu.tsx`, `tests/e2e/direct.spec.ts`. **Scope:** M.

### [ ] F7-02 — Models/test browser dan Direct run claim

**Hasil:** gateway discovery Direct dan run persistence tidak membawa key ke Kawan.
**Acceptance:**
- [ ] Browser GET models dengan credential langsung ke origin gateway; CORS error/help/count/model selection nyata.
- [ ] Direct run claim owner/revision/idempotency membuat node/run; API tidak menerima raw key.
- [ ] Mutation result default mode ditolak dan payload output bounded tervalidasi.
**Verification:** fixture CORS allow/deny; network assertion Authorization hanya ke gateway; integration Direct claim checks.
**Dependencies:** F7-01. **Files:** `src/lib/direct-connections.ts`, `src/app/api/chats/[id]/direct-runs/route.ts`, `src/app/api/generations/[id]/direct-result/route.ts`, `src/lib/generation.ts`, `tests/integration/direct-runs.test.ts`. **Scope:** M.

**Checkpoint F7-A:** key Direct tidak pernah ke Kawan; model test/claim dan local cleanup berjalan; build sukses.

### [ ] F7-03 — Direct stream dan persistence

**Hasil:** browser menjalankan LLM sendiri sambil history/usage tetap tersedia.
**Acceptance:**
- [ ] OpenAI SSE browser diparse terpisah dan dipetakan ke lifecycle chat; send/stop/regenerate/edit branch bekerja.
- [ ] Partial/final output dikirim tanpa key ke result endpoint; source usage browser-reported dan idempotent.
- [ ] Disconnect/error/reload/lease conflict benar; tidak ada request server gateway tersembunyi.
**Verification:** `npm run test:e2e -- tests/e2e/direct.spec.ts`; stream abort fixture, upload result tampering tests.
**Dependencies:** F7-02. **Files:** `src/lib/direct-stream.ts`, `src/components/chat/chat-workspace.tsx`, `src/app/api/generations/[id]/direct-result/route.ts`, `src/lib/usage.ts`, `tests/e2e/direct.spec.ts`. **Scope:** M.

### [ ] F7-04 — Direct attachments dan boundary tools

**Hasil:** opsi file Direct jelas dan tidak merusak batas server/browser.
**Acceptance:**
- [ ] Image Blob dan text/PDF parsing browser membentuk input gateway tanpa raw key masuk upload/server metadata.
- [ ] Metadata/teks lewat endpoint Direct tersimpan DB; bytes IndexedDB lokal dihapus saat logout/delete; missing image di perangkat lain meminta reattach sebelum inferensi.
- [ ] MCP server-side dinonaktifkan di Direct dengan penjelasan dan pilihan eksplisit connection default; tanpa mode switch otomatis.
**Verification:** Direct image/text/PDF payload capture + reload states; `npm run build`.
**Dependencies:** F7-03. **Files:** `src/lib/direct-attachments.ts`, `src/app/api/attachments/direct-metadata/route.ts`, `src/components/chat/attachment-picker.tsx`, `src/lib/direct-stream.ts`, `tests/e2e/direct.spec.ts`. **Scope:** M; batas tools composer memakai state mode yang sudah tersedia.

**Gate F7:** seluruh request LLM Direct dari browser, key hanya gateway/local storage, history dan error lifecycle benar; build sukses.

## F8 — MCP, fitur terakhir

### [ ] F8-01 — MCP server CRUD dan auth

**Hasil:** user mendaftarkan remote MCP server pribadi.
**Acceptance:**
- [ ] Schema/DTO/CRUD owner-scoped, URL/transport HTTP/SSE dan none/Bearer auth encrypted+masked.
- [ ] Settings Integrations form/list/edit/delete/enabled bekerja; URL berubah meminta auth baru.
- [ ] Tidak ada stdio/shell/command/forward cookie; guard outbound yang sama diterapkan.
**Verification:** `npm test -- tests/integration/mcp-servers.test.ts`; ciphertext/DTO/IDOR checks dan form flow.
**Dependencies:** F6 gate + F7 gate atau keputusan resmi skip. **Files:** kedua schema/migration, `src/app/api/mcp/servers/route.ts`, `src/app/api/mcp/servers/[id]/route.ts`, `src/components/mcp/server-settings.tsx`, `tests/integration/mcp-servers.test.ts`. **Scope:** M.

### [ ] F8-02 — Discovery dan transport cleanup

**Hasil:** test MCP handshake/tools-list benar-benar menghubungi server remote.
**Acceptance:**
- [ ] Fixture MCP HTTP/SSE menyediakan discovery/tools/errors; SDK exports/types dipin sesuai AI SDK v5.
- [ ] Test/list tools mengembalikan metadata aman dengan schema/tool count/timeout limits; auth error terpisah dari empty tools.
- [ ] Client ditutup pada success/error/abort; DNS/redirect/secondary endpoint guard tetap berlaku.
**Verification:** `npm test -- tests/integration/mcp-discovery.test.ts`; fixture resource/session cleanup counters.
**Dependencies:** F8-01. **Files:** `src/lib/mcp.ts`, `src/app/api/mcp/servers/[id]/test/route.ts`, `src/app/api/mcp/servers/[id]/tools/route.ts`, `tests/fixtures/mcp.ts`, `tests/integration/mcp-discovery.test.ts`. **Scope:** M.

### [ ] F8-03 — Tools picker di composer

**Hasil:** user memilih tools yang tersedia untuk turn tertentu.
**Acceptance:**
- [ ] Tombol tools membuka server/tools/descriptions/status; loading/auth failure/empty jelas.
- [ ] Checkbox membentuk allowlist server/tool ID yang divalidasi lagi server; tool unselected tidak dikirim ke model.
- [ ] Namespaced tool names mencegah collision; Direct mode menunjukkan boundary yang ditentukan plan.
**Verification:** E2E discovery/select tools dengan dua server nama tool sama dan user A/B.
**Dependencies:** F8-02. **Files:** `src/components/mcp/tools-picker.tsx`, `src/components/chat/composer.tsx`, `src/lib/mcp.ts`, `tests/e2e/mcp.spec.ts`. **Scope:** M.

**Checkpoint F8-A:** CRUD/discovery/tools selection nyata dan key auth isolated; build sukses.

### [ ] F8-04 — Model tool execution dan replay

**Hasil:** model memakai MCP tool lalu menjawab dari hasilnya.
**Acceptance:**
- [ ] AI SDK tool loop v5 dengan max 5 langkah, validated args, selected tools dan server-side execute memakai auth user.
- [ ] Tool-call/result dikirim balik model, disimpan parts history dan dirender status; follow-up context replay valid.
- [ ] Usage seluruh langkah diagregasi sekali/run; tool errors/output limits aman; client cleanup semua terminal states.
**Verification:** `npm test -- tests/integration/mcp-generation.test.ts`; fixture model requests tool, fixture MCP returns data, model final answer menggunakan hasil.
**Dependencies:** F8-03. **Files:** `src/lib/mcp.ts`, `src/lib/generation.ts`, `src/lib/usage.ts`, `src/components/mcp/tool-result.tsx`, `tests/integration/mcp-generation.test.ts`. **Scope:** M.

### [ ] F8-05 — MCP failure, abort, isolation

**Hasil:** tools tetap terkendali saat error dan stop.
**Acceptance:**
- [ ] Wrong auth/timeout/invalid arguments/collision/unknown selected tool ditangani; model tanpa tools support error jelas.
- [ ] Stop menutup client/abort transport tanpa mengklaim undo side-effect; mutating tool tidak otomatis retry.
- [ ] Server/user auth tidak tertukar; log/share/export tidak mengandung raw tool secret; step limit benar.
**Verification:** `npm test -- tests/integration/mcp-failures.test.ts`; `npm run test:e2e -- tests/e2e/mcp.spec.ts`; build.
**Dependencies:** F8-04. **Files:** `src/lib/mcp.ts`, `src/lib/generation.ts`, `src/components/mcp/tools-picker.tsx`, `tests/integration/mcp-failures.test.ts`, `tests/e2e/mcp.spec.ts`. **Scope:** M.

**Gate F8:** tools benar-benar dipanggil server-side dan model memakai result; replay/usage/abort/error/cleanup lulus; build sukses.

## F9 — Integrasi, self-host dan release review

### [ ] F9-01 — Production Postgres dan migration parity

**Hasil:** fitur yang lolos SQLite juga berjalan pada Postgres.
**Acceptance:**
- [ ] Clean production migration + correct Prisma generation + build; schema domain parity check lolos.
- [ ] Auth/active connection/generation revision/branching/search/usage diuji Postgres, termasuk concurrency.
- [ ] Backup/restore DB dan encryption secret separation diuji; rotasi secret prosedur jelas tanpa data loss.
**Verification:** focused integration suite dua provider + restore fixture; `npm run build` target production.
**Dependencies:** F8 gate. **Files:** `scripts/db-target.mjs`, `scripts/check-schema-parity.mjs`, `tests/integration/database-parity.test.ts`, `docs/database.md`, `docs/secrets.md`. **Scope:** M.

### [ ] F9-02 — Self-host deployment package

**Hasil:** operator lain dapat menjalankan Kawan dari clean checkout.
**Acceptance:**
- [ ] Docker multi-stage + Compose Node/Postgres/private volume, healthcheck, migration release command dan env example bekerja.
- [ ] Reverse proxy SSE tanpa buffering; upload/request/maxDuration sesuai platform; graceful shutdown/cleanup teruji.
- [ ] README local setup/production/storage/HTTPS/CORS/backup/upgrades/troubleshooting mengikuti command yang benar-benar diuji.
**Verification:** clean checkout/container boot → register → gateway fixture → stream → restart → history tetap ada.
**Dependencies:** F9-01. **Files:** `Dockerfile`, `compose.yaml`, `.dockerignore`, `README.md`, `docs/self-host.md`. **Scope:** M.

### [ ] F9-03 — CI dan privacy regression

**Hasil:** repository dapat mencegah regression utama secara otomatis.
**Acceptance:**
- [ ] CI lockfile install/typecheck/lint/test/build/E2E smoke/Postgres migrations berjalan tanpa provider key nyata.
- [ ] Regression network/IDOR/XSS/SSRF/key leak/share leakage/idempotency memiliki test yang relevan.
- [ ] Log default tidak menyimpan prompt/key/raw file; dependency audit hasil diperiksa sesuai dampak nyata.
**Verification:** pipeline run bersih; inspect trace/artifacts/logs untuk secret redaction.
**Dependencies:** F9-02. **Files:** `.github/workflows/ci.yml`, `tests/e2e/privacy.spec.ts`, `tests/integration/security-regression.test.ts`, `docs/verification.md`. **Scope:** M.

**Checkpoint F9-A:** production DB/self-host/CI terbukti; build sukses. Deployment publik belum dilakukan.

### [ ] F9-04 — Parity dan branding acceptance akhir

**Hasil:** semua permintaan user memiliki bukti penerimaan, bukan sekadar tampilan.
**Acceptance:**
- [ ] Jalankan matriks A01–B01 pada plan; setiap baris pass atau Direct N/A dengan keputusan pemilik; laporan reference parity terpisah dan tidak mengklaim schema/full-product parity.
- [ ] Screenshots auth/onboarding/chat/settings/usage/share desktop/mobile, keyboard smoke, console/hydration clean.
- [ ] Repo URL nyata/versi/lisensi kode baru/brand attribution benar; tidak ada TODO kosong/fake models/dead actions.
**Verification:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`; simpan evidence report.
**Dependencies:** F9-03. **Files:** `docs/acceptance-report.md`, `tests/e2e/branding.spec.ts`, `README.md`, `LICENSE` setelah keputusan pemilik. **Scope:** M.

### [ ] F9-05 — Handover dan keputusan publish

**Hasil:** hasil siap direview pemilik dengan batas/kebutuhan operasi yang jelas.
**Acceptance:**
- [ ] Laporan fitur, bukti checks, limits hosting, recovery/retention decisions dan konfigurasi release lengkap.
- [ ] Real gateway smoke opsional memakai credential operator yang sah dan dibatasi; bila belum ada, tercatat belum diverifikasi tanpa klaim palsu.
- [ ] Pengajuan deploy/publish hanya setelah hasil konkret siap; domain/DNS/repo publication tidak dilakukan dari planning ini.
**Verification:** review mandor terhadap acceptance report + clean-start docs; semua gate sebelumnya pass.
**Dependencies:** F9-04. **Files:** `docs/handover.md`, `docs/acceptance-report.md`, `docs/release-checklist.md`. **Scope:** S.

**Gate F9:** seluruh mandatory parity, security, production migration, clean self-host dan build lulus; deliverable reviewable. Pemilik menentukan waktu deployment/publikasi.

## Format laporan setiap checkpoint/fase

```text
Fase/task:
Status: selesai / gagal / perlu data konfigurasi
Acceptance yang terbukti:
File utama berubah:
Command verifikasi dan hasil (exit code + ringkasan):
Flow manual/E2E yang dicoba:
Bukti screenshot/network/DB yang sudah disanitasi:
Risiko/keterbatasan yang masih ada:
Perubahan kontrak/scope (jika ada):
Commit ID (bila repo sudah ada):
Task berikutnya dan dependencies:
```

## Catatan pelaksanaan

Belum ada task implementasi atau gate build yang dijalankan. Tambahkan laporan di sini ketika pelaksana mulai mengerjakan; jangan mengubah status rencana menjadi selesai hanya karena file ini sudah dibuat.
