# Backlog Kawan — full-feature parity

> Referensi historis. Untuk pekerjaan baru baca [scope aktif](ACTIVE-SCOPE.md). Instruksi full-parity di bawah bukan scope default.

Baseline `f8ae8a6c328946dc62cd0712961a0632574581bf`. Semua task belum dimulai; v1 tasks di archive bukan scope aktif.

[PRD](prd.md) · [Plan](plan.md) · [Schema](schema-contract.md) · [Coverage](coverage.json) · [Reference](reference/README.md) · [Acceptance scenarios](acceptance-scenarios.md)

[SDD engineering design](sdd/README.md) · [Work orders seluruh phases](sdd/work-orders/README.md) · [Contract registry](sdd/contract-registry.json) · [Definition of Ready dan child slices](sdd/10-delivery-work-orders.md). Task ini adalah parent work packages; implement child terfokus setelah relevant baseline contract resolved.

## Definition of Done dan command contract

Scaffold harus menyediakan `npm run typecheck`, `npm run lint`, `npm test` (non-watch), `npm run test:e2e` (Playwright), `npm run test:conformance`, dan `npm run build`. Focused suites di bawah adalah target yang harus dibuat, bukan suite yang sudah ada.

Setiap task: positive/negative permission, validation/state/error/persistence tests yang relevan; all owned reference IDs reviewed. Backend/worker changes juga memakai focused service checks. Checkpoint setiap 2–3 task; typecheck/lint/focused checks/build wajib. Akhir fase E2E + conformance. Task yang terlalu besar dipecah child slice maksimal sekitar 5 file inti; tidak boleh centang parent sebelum semua child pass.

Files di bawah adalah domain targets, bukan instruksi membuat semua file sekaligus. Registry JSON memetakan reference IDs ke task; semantic review source wajib sebelum implementasi.

## P00 — Baseline, PRD dan fondasi

Root layout, initial setup, home, watch, error, workspace shell, offline/PWA behavior, feature flags dan fixture infrastructure.

### [ ] P00-01 — Lock baseline dan source coverage

**Hasil:** Validasi commit bersih, source fingerprints, inventory completeness serta dynamic paths yang perlu trace; hasilnya menjadi acuan differential test.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** None. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P00-02 — Golden behavior fixtures

**Hasil:** Jalankan referensi terisolasi dengan synthetic data; rekam kontrak HTTP/WS, enabled/disabled controls, screenshot states tanpa menyalin kode/aset.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P00-03 — Scaffold stack Kawan

**Hasil:** Siapkan Next 15, TypeScript strict, Tailwind 4, shadcn, AI SDK v5, Auth.js dan toolchain versi terkunci.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P00-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P00-04 — Shell dan navigasi full app

**Hasil:** Bangun sidebar/home/chat/workspace/admin/playground serta routes, error/loading, mobile drawer dan keyboard sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P00-05 — Test profiles dan service fixtures

**Hasil:** Sediakan SQLite/Postgres test DB, provider/MCP/OAuth/Ollama/socket fixtures, fake clock, record/replay contracts tanpa real keys.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P00-06 — Feature registry dan change ledger

**Hasil:** Petakan setiap inventory ID ke requirement/task/profile/test; catat seluruh deltas Kawan sebagai exception yang terukur.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P00 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P00 --task=P00-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p00/` atau service domain; `src/components/p00/`; route API/page terkait; `tests/conformance/p00-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P00-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P00:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P01 — Schema dan data compatibility

Seluruh 43 ORM models, 396 columns, constraints, JSON codecs, timestamp units, migration histories, legacy config dan import/export data.

### [ ] P01-01 — Physical schema contract

**Hasil:** Bandingkan deklarasi ORM dengan migrated live SQLite/Postgres; rekam types/defaults/nullability/indexes/FKs/partial predicates, tanpa menyalin migration source.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P00-01, P00-02, P00-03, P00-04, P00-05, P00-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P01-02 — Identity dan config model mappings

**Hasil:** Implementasikan User/Auth/ApiKey/OAuthSession/Config menggunakan Prisma map sesuai physical baseline; bukan reduced User schema.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P01-03 — Chat dan content model mappings

**Hasil:** Petakan Chat/ChatMessage/ChatFile/SharedChat/Folder/Tag/File/Feedback dan JSONField/native JSON secara konsisten.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P01-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P01-04 — Workspace dan ACL model mappings

**Hasil:** Petakan Model/Prompt/Skill/Tool/Function beserta history, Knowledge/directory/file, Group/GroupMember/AccessGrant.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P01-05 — Collaboration dan scheduling mappings

**Hasil:** Petakan Channel/member/file/webhook, Message/reaction, Note/pinned, Calendar/events/attendees, Automation/run, Memory.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P01-06 — Migration and round-trip fixtures

**Hasil:** Tulis SQL migrasi sendiri; clean install/legacy upgrades/introspection/JSON round-trip serta backup restore diuji dua provider.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P01-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P01-07 — Kawan extension tables

**Hasil:** Tambahkan kw_connection/kw_secret/kw_generation/kw_usage/kw_mcp/kw_job/kw_rate_limit terpisah; core tables tidak diganti namanya.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P01 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P01 --task=P01-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p01/` atau service domain; `src/components/p01/`; route API/page terkait; `tests/conformance/p01-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P01:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P02 — Auth, account dan identity

Email/password, signup policy, first admin, pending accounts, session, account profile/password, MFA/recovery, API keys dan identity integrations.

### [ ] P02-01 — Credentials dan onboarding roles

**Hasil:** Register/login/logout, first admin/pending/active checks, password policy dan bcrypt/argon2 compatibility; Auth.js terikat User/Auth.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P01-01, P01-02, P01-03, P01-04, P01-05, P01-06, P01-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P02-02 — Session stamp dan API keys

**Hasil:** Session revocation/expiry, bearer application keys, endpoint restrictions, user session metadata, cookies/CSRF dan durable auth rate limits.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P02-03 — Account profile dan password

**Hasil:** Name/avatar/banner/bio/timezone serta password change/session revoke sesuai permissions dan field constraints.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P02-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P02-04 — MFA lifecycle

**Hasil:** Enroll/verify/recovery/replacement/reset required, expiry/replay/attempt limits dan auth-method bypass policy sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P02-05 — OAuth/OIDC providers

**Hasil:** Provider registration/callback/refresh/merge/signup policies untuk seluruh provider config baseline; test identity linking dan failures.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P02-06 — LDAP dan trusted-header auth

**Hasil:** Authentication/mapping/auto-provisioning serta trusted proxy boundaries dan disabled-auth/offline operator mode sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P02-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P02-07 — Auth UI dan negative profiles

**Hasil:** Semua login/account states dan authorization shapes dites lewat browser dan differential API fixtures.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P02 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P02 --task=P02-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p02/` atau service domain; `src/components/p02/`; route API/page terkait; `tests/conformance/p02-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P02:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P03 — RBAC, groups, access grants, SCIM

Admin/user/pending roles, resource read/write sharing, group hierarchy/inheritance, user management dan SCIM provisioning.

### [ ] P03-01 — Resource ACL evaluator

**Hasil:** Owner/admin/group/public grants dan per-feature permissions, termasuk perbedaan null/empty sharing policies baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P02-01, P02-02, P02-03, P02-04, P02-05, P02-06, P02-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P03-02 — User administration

**Hasil:** List/search/create/update/disable/delete users, activity/pagination/bulk actions dan admin access rules.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P03-03 — Group hierarchy

**Hasil:** Create/edit/delete groups, parent inheritance/membership and cycle safety, effective permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P03-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P03-04 — Sharing controls lintas resource

**Hasil:** User/group/public read/write picker pada model/prompt/tool/knowledge/note/channel/file sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P03-05 — SCIM provisioning

**Hasil:** Bearer protected Users/Groups CRUD/PATCH/list/filter schema, identity sync/disable/deprovision behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P03-06 — Authorization conformance

**Hasil:** Role/resource/action matrix negative-positive lintas seluruh API dan UI; unauthorized controls tidak sekadar disembunyikan.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P03 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P03 --task=P03-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p03/` atau service domain; `src/components/p03/`; route API/page terkait; `tests/conformance/p03-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P03-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P03:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P04 — Providers, Connections dan BYOK

Global/admin providers, personal Direct, gateway BYOK, model aggregation, provider configs/header/auth, Ollama lifecycle, provider-native proxies.

### [ ] P04-01 — Secret vault dan BYOK row

**Hasil:** AES-GCM/AAD/rotation/mask, onboarding Test models, multiple owned connections, active selection and safe endpoint changes.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P03-01, P03-02, P03-03, P03-04, P03-05, P03-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P04-02 — Admin OpenAI-compatible connections

**Hasil:** Multiple URL/key/config, enable/order/provider options/model IDs/prefixes/custom params/headers/Azure/native provider behavior sesuai catalogue.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P04-03 — Model discovery aggregation

**Hasil:** Base/effective model list, cache/invalidation/tag/order/filter collision semantics serta capability detection.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P04-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P04-04 — Ollama native connections

**Hasil:** Models/tags/show/pull/create/delete/copy/version/chat/generate/embeddings/load-unload progress dan cancellation sesuai endpoints.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P04-05 — Direct provider mode

**Hasil:** Browser-local keys, direct models/chat/integrations/CORS/device loss/logout; tanpa raw key sync ke Kawan.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P04-06 — Outbound policy dan native proxy

**Hasil:** HTTP methods/path/header/stream/image/provider payload compatibility dengan redirect/DNS/SSRF controls dan operator private allowlist.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P04-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P04-07 — Connection UI parity

**Hasil:** User/Admin modals, test states, editable config/passthrough, connection status dan branding gateway CTA.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P04 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P04 --task=P04-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p04/` atau service domain; `src/components/p04/`; route API/page terkait; `tests/conformance/p04-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P04:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P05 — Chat execution, task lifecycle dan realtime

Streaming/non-streaming, stop/retry, task IDs, sockets, temporary chat, background completion, queue, multi-model replies, context variables/tasks.

### [ ] P05-01 — Generation claim dan persistence

**Hasil:** Durable job/run/idempotency/lease, placeholders/status/checkpoints, owner/revision guards dan endpoint compatibility.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P04-01, P04-02, P04-03, P04-04, P04-05, P04-06, P04-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P05-02 — Completion provider execution

**Hasil:** AI SDK plus native protocol adapters; message mapping, params, attachments, system context, request/response shapes and safe errors.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P05-03 — Stream/SSE/socket events

**Hasil:** Reference event/payload/task IDs and browser bridge; chunk/Unicode/tool/reasoning/usage states, reconnect and ordering.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P05-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P05-04 — Stop, queue dan background completion

**Hasil:** Cancel durable jobs, partial output, multi-instance completion/disconnect, queue semantics, task cleanup and resumable UI.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P05-05 — Multi-model response fan-out

**Hasil:** Model selections produce parallel responses and per-model statuses/stop/usage; tabs/comparison modes sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P05-06 — Temporary chat dan context compaction

**Hasil:** Non-persistent mode rules, recoverable tasks/usage policy, context summary/checkpoints, variables/default user data interpolation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P05-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P05-07 — Generated title/tags/follow-ups/autocomplete

**Hasil:** Background task model selection, params/prompts, enable flags and no accidental duplicate requests.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P05-08 — Chat execution regression

**Hasil:** Happy/error/timeout/offline/race/abort/reload suites; every token/state event mapped to baseline or declared exception.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P05 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P05 --task=P05-08` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p05/` atau service domain; `src/components/p05/`; route API/page terkait; `tests/conformance/p05-08.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P05:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P06 — History, tree, folders, tags, share dan data controls

Edit/regenerate/branch, clone/fork, nested folders/sharing, archive/unread/search, export/import/shared snapshots and bulk actions.

### [ ] P06-01 — Message tree editing

**Hasil:** User edit in-place vs submit-as-sibling, assistant edit vs Save As Copy, regenerate/continue/model-slot dan sibling navigation sesuai baseline. Delete-message menghapus node dan immediate children, mempertahankan/reparent grandchildren; explicit delete-subtree adalah operasi berbeda. JSON/projection/current leaf konsisten.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P05-01, P05-02, P05-03, P05-04, P05-05, P05-06, P05-07, P05-08. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P06-02 — History search and ordering

**Hasil:** Title/content/search filter tags/folders/pinned/archived/shared, unread/read timestamps, cursor pagination/date groups.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P06-03 — Folder hierarchy and sharing

**Hasil:** Recursive folders/reparent/move/cycle prevention, knowledge attachments/folder context and shared folder grants.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P06-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P06-04 — Tags, pin dan archive

**Hasil:** Tags CRUD/auto tags, pin/unpin, archive/unarchive, rename/delete/unread and bulk actions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P06-05 — Clone/fork/share snapshots

**Hasil:** Clone whole or selected subtree, public share modes, snapshot updates/revoke/clone/read-only permissions sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P06-06 — Import/export formats

**Hasil:** Open WebUI-compatible JSON versioned payload/tree; text/Markdown/PDF exports, ChatGPT import where present, bulk backup/data controls.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P06-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P06-07 — History cleanup and integrity

**Hasil:** Delete semantics preserve authorized references/usage; import malicious/cyclic/cross-owner payloads rejected; branch round-trip tests.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P06 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P06 --task=P06-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p06/` atau service domain; `src/components/p06/`; route API/page terkait; `tests/conformance/p06-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P06:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P07 — Message rendering, composer dan artifacts

Full Markdown/extensions, rich text composer/mentions, reasoning/structured outputs, citations, math/diagrams/code blocks/artifacts previews.

### [ ] P07-01 — Markdown extension rendering

**Hasil:** GFM, code/highlight, KaTeX/math, Mermaid, citations/footnotes/details/alerts/colon fences/mentions sesuai source surfaces.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P06-01, P06-02, P06-03, P06-04, P06-05, P06-06, P06-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P07-02 — Rich text composer and mentions

**Hasil:** Editor formatting/commands/prompt suggestions, @model/#knowledge/notes references, queued drafts/paste/image actions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P07-03 — Structured outputs and reasoning

**Hasil:** Response parts, streaming reasoning/details, code execution/subagent results, error/status metadata without fabricated reasoning.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P07-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P07-04 — Message actions and feedback UI

**Hasil:** Copy/edit/continue/regenerate/rate/comment/delete/TTS actions and availability sesuai role/feature/temporary flags.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P07-05 — Artifacts preview and editing

**Hasil:** Code/HTML/iframe/SVG/interactive previews, artifact edits/downloads with sandbox isolation and configured behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P07-06 — Overview and comparison views

**Hasil:** Message-tree flow overview, multi-response modes, embeds and message virtualisation/scroll preferences.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P07-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P07-07 — Rendering/accessibility goldens

**Hasil:** Every message/composer surface state at desktop/mobile, keyboard/IME/copy, incomplete streaming Markdown and unsafe content controls.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P07 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P07 --task=P07-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p07/` atau service domain; `src/components/p07/`; route API/page terkait; `tests/conformance/p07-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P07:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P08 — Seluruh personal Settings dan localization

General, Interface, Notifications, Shortcuts, Connections, Tools, Personalization, Audio, Data Controls, Usage, Archived Chats, Account, About; all locale coverage.

### [ ] P08-01 — Settings navigation and search

**Hasil:** Tab/search/deep link/save/reset behavior, state ownership and available controls berdasarkan permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P07-01, P07-02, P07-03, P07-04, P07-05, P07-06, P07-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P08-02 — General/model parameters

**Hasil:** Theme/language/system defaults plus every generation parameter/custom param, profiles and persistence precedence.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P08-03 — Interface preferences

**Hasil:** Density/type scale/font/layout/bubbles/widescreen/background/markdown/scroll/collapse/floating controls/haptics sesuai settings catalogue.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P08-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P08-04 — Shortcuts and notification controls

**Hasil:** Shortcut discovery/remapping/supported hotkeys, browser/sound notification states and disabled permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P08-05 — Personalization/memory/audio/data panels

**Hasil:** Controls all connected to real feature services; Account/Usage/Archive/About not placeholder panels.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P08-06 — All baseline locales

**Hasil:** 64 locale surfaces, interpolation/plurals/date/RTL/fallback and glossary; translations written independently.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P08-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P08-07 — Settings value conformance

**Hasil:** Every SET/CFG/Pydantic UI field gets default/change/persist/reset/disabled-state test; no unimplemented toggles.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P08 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P08 --task=P08-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p08/` atau service domain; `src/components/p08/`; route API/page terkait; `tests/conformance/p08-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P08:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P09 — Files, storage dan document processing

Upload/preview/extract/delete/search/access, folders/cloud file pickers, image/video/audio/docs/spreadsheets/PDF/OCR where supported; async extraction and lifecycle.

### [ ] P09-01 — Storage backends and private access

**Hasil:** Local/S3/GCS/Azure-style configured storage adapters present in baseline, signed access/ownership/range/cleanup semantics.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P08-01, P08-02, P08-03, P08-04, P08-05, P08-06, P08-07. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-02 — Upload/file records and formats

**Hasil:** Mime/size/quota/hash metadata, direct upload and file states; all baseline supported document/media inputs catalogued.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-03 — Document parsing and OCR pipelines

**Hasil:** PDF/Office/text/HTML/table/media extraction plus local/external parser engines; job progress and retry semantics.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-04 — Image/media preprocessing

**Hasil:** Resize/compression/HEIC and image payloads, audio/video preprocessing, model file capabilities.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-05 — Cloud drive pickers

**Hasil:** Google Drive/OneDrive auth/config pickers, file selection/import/progress/error/security ownership.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-06 — Files UI and lifecycle

**Hasil:** Files modal/FileNav previews/search/download/delete/bulk actions, shared references and expired orphan cleanup.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-A01 — Adapter datalab_marker

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/datalab_marker.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A02 — Adapter external_document

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/external_document.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A03 — Adapter external_web

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/external_web.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-9:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-A04 — Adapter local

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/local.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A05 — Adapter main

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/main.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A06 — Adapter microsoft_web_iq

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/microsoft_web_iq.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-12:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-A07 — Adapter mineru

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/mineru.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A08 — Adapter mistral

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/mistral.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A08` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a08.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A09 — Adapter paddleocr_vl

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/paddleocr_vl.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A09` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a09.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-15:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-A10 — Adapter pdf

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/pdf.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A10` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a10.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A11 — Adapter tavily

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/tavily.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A11` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a11.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P09-A12 — Adapter youtube

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/loaders/youtube.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A12` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a12.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P09-18:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P09-A13 — Adapter provider

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/storage/provider.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P09 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P09 --task=P09-A13` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p09/` atau service domain; `src/components/p09/`; route API/page terkait; `tests/conformance/p09-a13.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P09:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P10 — Workspace models dan Playground

Custom model wrappers/presets/agents, capabilities/params/tools/knowledge/avatar/tags/sharing/versioning, base model management and playground chat/completions/images.

### [ ] P10-01 — Model CRUD and metadata

**Hasil:** Custom wrappers with base model, name/avatar/tags/capabilities/system/default params and resource grants.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P09-01, P09-02, P09-03, P09-04, P09-05, P09-06, P09-A01, P09-A02, P09-A03, P09-A04, P09-A05, P09-A06, P09-A07, P09-A08, P09-A09, P09-A10, P09-A11, P09-A12, P09-A13. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P10-02 — Model revisions and history

**Hasil:** Version create/select/rollback/clone/import/export and history consistency with model_id resolution.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P10-03 — Model capabilities and binding

**Hasil:** Tools/knowledge/skills/functions/variables availability and per-user/group constraints enforced at inference.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P10-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P10-04 — Admin model management

**Hasil:** Multiple provider models/Ollama management, order/default/visibility/load/unload/cache operations and progress states.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P10-05 — Playground surfaces

**Hasil:** Chat/completions/images mode params/request/response/streaming/export behavior aligned with available providers.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P10-06 — Community model import/export

**Hasil:** Validated preset/community/external origin interactions, metadata/version handling, no automatic untrusted execution.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P10 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P10 --task=P10-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p10/` atau service domain; `src/components/p10/`; route API/page terkait; `tests/conformance/p10-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P10-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P10:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P11 — Prompts, skills dan version histories

Workspace prompt templates/slash commands/variables/localized metadata and reusable skills/files/versions/sharing/import/export.

### [ ] P11-01 — Prompt CRUD and commands

**Hasil:** Create/edit/delete/search templates, slash command uniqueness, variables/forms, activation and access.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P10-01, P10-02, P10-03, P10-04, P10-05, P10-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P11-02 — Prompt versions and import/export

**Hasil:** Version IDs/history/diff/rollback/public references and compatible JSON payloads.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P11-03 — Skill CRUD and files

**Hasil:** Instructions plus skill file operation validation, names/tags/description/localized metadata and activation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P11-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P11-04 — Skill history and sharing

**Hasil:** Version snapshots/diff/restore, resource grants, import/export and owner consistency.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P11-05 — Composer/model integration

**Hasil:** Select prompts/skills, render variables and combine instructions at documented precedence without leaking private resources.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P11-06 — Community workspace flows

**Hasil:** External import prompts, origin validation, preview/confirm and round-trip compatibility.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P11 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P11 --task=P11-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p11/` atau service domain; `src/components/p11/`; route API/page terkait; `tests/conformance/p11-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P11-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P11:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P12 — Tools, MCP, functions, pipelines dan integrations

MCP/MCPO/OpenAPI remote tool servers, OAuth/auth/elicitation, local tool definitions, Python functions/filters/pipes/actions, valves, marketplace/versioning.

### [ ] P12-01 — Tool server CRUD/discovery/auth

**Hasil:** Remote endpoint profiles, Bearer/custom/OAuth credentials, OpenAPI/MCPO/MCP schemas, connection lifecycle and resource grants.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P11-01, P11-02, P11-03, P11-04, P11-05, P11-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P12-02 — MCP transports and elicitation

**Hasil:** HTTP/SSE and operator-local transport where baseline supports it, OAuth redirects, tool/resource/prompt discovery and ask-user lifecycle.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P12-03 — Tools composer and execution

**Hasil:** Selected/deferred tools, allowlist/search, namespacing, validated inputs/results, multi-step model use, abort and history replay.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P12-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P12-04 — Python tool/function runtime

**Hasil:** Own isolated executor for baseline Python plugin interface; packages/source reviewed, per-user valves/event hooks, no web-process arbitrary execution.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P12-05 — Filters, pipes and actions

**Hasil:** Inlet/outlet/stream hooks, model pipe selection/actions/buttons and priority/order semantics with error isolation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P12-06 — Pipelines admin and versions

**Hasil:** Upload/install/config/delete pipelines, history for Tool/Function, rollback/import/export/community interfaces.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P12-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P12-07 — Integration conformance

**Hasil:** Actual tool calls/results/model continuation, auth expiry/timeout/collision/side-effects, permission and resource cleanup tests.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P12-A01 — Adapter client

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/utils/mcp/client.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P12 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P12 --task=P12-A01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p12/` atau service domain; `src/components/p12/`; route API/page terkait; `tests/conformance/p12-a01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P12:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P13 — Knowledge, RAG, embeddings dan vector stores

Knowledge hierarchy/files/grants, all document/index/query/RAG config, embedding/rerank/hybrid modes, citations and supported vector backends.

### [ ] P13-01 — Knowledge CRUD and hierarchy

**Hasil:** Collections/directories/files/metadata/access grants, bulk operations/search/sort/shared contexts.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P12-01, P12-02, P12-03, P12-04, P12-05, P12-06, P12-07, P12-A01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-02 — Indexing pipeline

**Hasil:** Load/chunk/embed/upsert jobs with collection permissions/idempotency/progress/reindex/cancel/delete propagation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-03 — Embedding engines and models

**Hasil:** Local/remote provider/model/config/update/download operations, batch/token/timeout handling.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-04 — Retrieval and reranking

**Hasil:** Semantic/hybrid/BM25/full-context/focused query, top-k/threshold/reranker/merge and metadata filters.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-05 — Citation/source integration

**Hasil:** Grounded context assembled only from authorized docs; source retrieval, quotes, citations and file preview in chat.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-06 — Vector store engine contracts

**Hasil:** All engine options in baseline remain required; profile-specific adapters tested for indexes/filters/tenant scope/delete.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-07 — RAG config and admin document panels

**Hasil:** All catalogue keys/control defaults/persist/reset/config endpoints, external knowledge/loaders and upgrade behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A01 — Adapter chroma

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/chroma.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A02 — Adapter elasticsearch

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/elasticsearch.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-9:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-A03 — Adapter mariadb_vector

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/mariadb_vector.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A04 — Adapter milvus

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/milvus.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A05 — Adapter milvus_multitenancy

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/milvus_multitenancy.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-12:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-A06 — Adapter opengauss

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/opengauss.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A07 — Adapter opensearch

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/opensearch.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A08 — Adapter oracle23ai

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/oracle23ai.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A08` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a08.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-15:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-A09 — Adapter pgvector

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/pgvector.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A09` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a09.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A10 — Adapter pinecone

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/pinecone.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A10` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a10.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A11 — Adapter qdrant

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/qdrant.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A11` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a11.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-18:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-A12 — Adapter qdrant_multitenancy

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/qdrant_multitenancy.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A12` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a12.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A13 — Adapter s3vector

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/s3vector.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A13` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a13.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P13-A14 — Adapter valkey

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/valkey.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A14` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a14.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P13-21:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P13-A15 — Adapter weaviate

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/vector/dbs/weaviate.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P13 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P13 --task=P13-A15` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p13/` atau service domain; `src/components/p13/`; route API/page terkait; `tests/conformance/p13-a15.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P13:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P14 — Web search, memories dan context integrations

Web engines/crawl/loaders/search/query generation, consent/context, memory CRUD/user context/background review and external document knowledge.

### [ ] P14-01 — Search provider catalogue

**Hasil:** All supported web engines credentials/params/results/rate limits mapped to external search adapters.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P13-01, P13-02, P13-03, P13-04, P13-05, P13-06, P13-07, P13-A01, P13-A02, P13-A03, P13-A04, P13-A05, P13-A06, P13-A07, P13-A08, P13-A09, P13-A10, P13-A11, P13-A12, P13-A13, P13-A14, P13-A15. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-02 — Web loading/crawling and citations

**Hasil:** Safe URL fetch/parse/multilanguage/context extraction, image/source search and citation metadata.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-03 — Search composer and task integration

**Hasil:** Enable/always/manual selection, query generation/model tasks/provider consent and answer grounding.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-04 — Memory CRUD and retrieval

**Hasil:** User memories/types/path/metadata, create/edit/delete/search/extract/query and context owner scoping.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-05 — Background memory review

**Hasil:** Review cadence/char limits/user controls, model-assisted updates and prevention of cross-user pollution.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-06 — External knowledge APIs

**Hasil:** Configured external loaders/retrieval integrations and file/content access/auth/error profiles.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A01 — Adapter azure

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/azure.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A02 — Adapter bing

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/bing.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A03 — Adapter bocha

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/bocha.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-9:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A04 — Adapter brave

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/brave.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A05 — Adapter brave_llm_context

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/brave_llm_context.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A06 — Adapter duckduckgo

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/duckduckgo.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-12:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A07 — Adapter exa

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/exa.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A08 — Adapter external

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/external.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A08` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a08.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A09 — Adapter firecrawl

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/firecrawl.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A09` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a09.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-15:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A10 — Adapter google_pse

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/google_pse.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A10` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a10.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A11 — Adapter jina_search

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/jina_search.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A11` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a11.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A12 — Adapter kagi

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/kagi.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A12` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a12.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-18:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A13 — Adapter linkup

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/linkup.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A13` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a13.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A14 — Adapter main

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/main.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A14` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a14.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A15 — Adapter microsoft_web_iq

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/microsoft_web_iq.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A15` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a15.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-21:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A16 — Adapter mojeek

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/mojeek.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A16` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a16.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A17 — Adapter ollama

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/ollama.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A17` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a17.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A18 — Adapter openserp

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/openserp.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A18` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a18.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-24:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A19 — Adapter perplexity

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/perplexity.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A19` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a19.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A20 — Adapter perplexity_search

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/perplexity_search.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A20` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a20.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A21 — Adapter searchapi

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/searchapi.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A21` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a21.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-27:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A22 — Adapter searxng

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/searxng.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A22` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a22.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A23 — Adapter serpapi

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/serpapi.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A23` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a23.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A24 — Adapter serper

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/serper.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A24` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a24.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-30:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A25 — Adapter serphouse

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/serphouse.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A25` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a25.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A26 — Adapter serply

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/serply.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A26` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a26.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A27 — Adapter serpstack

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/serpstack.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A27` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a27.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-33:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A28 — Adapter sougou

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/sougou.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A28` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a28.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A29 — Adapter staan

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/staan.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A29` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a29.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A30 — Adapter tavily

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/tavily.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A30` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a30.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-36:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A31 — Adapter utils

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/utils.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A31` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a31.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A32 — Adapter yacy

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/yacy.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A32` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a32.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P14-A33 — Adapter yandex

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/yandex.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A33` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a33.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P14-39:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P14-A34 — Adapter ydc

**Hasil:** Tulis ulang integrasi pada `backend/open_webui/retrieval/web/ydc.py` sesuai request/response/auth/config/cancellation/error semantics baseline. Tidak meng-copy file referensi.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P14 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P14 --task=P14-A34` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p14/` atau service domain; `src/components/p14/`; route API/page terkait; `tests/conformance/p14-a34.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P14:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P15 — Audio, STT/TTS dan realtime voice

Voice recording/input/transcription/TTS playback/voices/local engines/realtime calls and all audio config/provider profiles.

### [ ] P15-01 — Recording and transcription UI

**Hasil:** Mic permissions/devices/record-upload/progress/error, transcription insertion and mobile lifecycle.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P14-01, P14-02, P14-03, P14-04, P14-05, P14-06, P14-A01, P14-A02, P14-A03, P14-A04, P14-A05, P14-A06, P14-A07, P14-A08, P14-A09, P14-A10, P14-A11, P14-A12, P14-A13, P14-A14, P14-A15, P14-A16, P14-A17, P14-A18, P14-A19, P14-A20, P14-A21, P14-A22, P14-A23, P14-A24, P14-A25, P14-A26, P14-A27, P14-A28, P14-A29, P14-A30, P14-A31, P14-A32, P14-A33, P14-A34. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P15-02 — STT engines

**Hasil:** Local Whisper plus configured OpenAI/Deepgram/Azure and engine branches inventory; preprocessing/chunks/limits/model updates.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P15-03 — TTS engines and voices

**Hasil:** Generate/cache/stream speech, voice list/model/options/defaults/provider adapters and interruption controls.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P15-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P15-04 — Realtime voice session

**Hasil:** Realtime provider token/server bridge/WebSocket, turn-taking/VAD/transcript/model tools and call disconnect.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P15-05 — Audio settings and local inference worker

**Hasil:** Admin/personal controls, engine readiness/GPU/offline profile and resource lifecycle.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P15-06 — Audio conformance profiles

**Hasil:** Fake audio/provider tests plus capability device smoke; no fake transcription or success without external engine.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P15 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P15 --task=P15-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p15/` atau service domain; `src/components/p15/`; route API/page terkait; `tests/conformance/p15-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P15-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P15:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P16 — Image generation/editing dan media playground

Image generate/edit settings and provider engines, ComfyUI workflows, AUTOMATIC1111, OpenAI/Gemini branches, uploads and generated output history.

### [ ] P16-01 — Generation provider engines

**Hasil:** Config/test/model discovery and actual generate requests across all baseline branches.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P15-01, P15-02, P15-03, P15-04, P15-05, P15-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P16-02 — ComfyUI/Automatic1111 workflows

**Hasil:** Workflow node mapping/params/sampler/model controls, polling/stream progress/upload and cancellation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P16-03 — Image edit and masks

**Hasil:** Reference image/mask upload, edit provider options, generated output/metadata and safe storage.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P16-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P16-04 — Chat and playground integration

**Hasil:** Composer generation/edit action, image prompt task, progress/error/history/gallery/download behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P16-05 — Media permissions and quota

**Hasil:** Image feature/model/user permission gates, secret protection/private file access and content limits.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P16-06 — Engine conformance matrix

**Hasil:** Fixtures each backend success/failure/unsupported feature; real configured engine smoke before parity claim.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P16 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P16 --task=P16-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p16/` atau service domain; `src/components/p16/`; route API/page terkait; `tests/conformance/p16-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P16-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P16:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P17 — Channels, messaging dan realtime collaboration

Channel CRUD/share/members/messages/replies/reactions/pins/files/webhooks/model interactions/notifications/presence/socket rooms.

### [ ] P17-01 — Channel/member management

**Hasil:** Create/edit/archive/delete/search channel and participant membership/access controls.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P16-01, P16-02, P16-03, P16-04, P16-05, P16-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P17-02 — Channel message threads

**Hasil:** Messages/replies/edit/delete/reactions/pins, cursor/history/read status and attachment metadata.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P17-03 — Realtime rooms and presence

**Hasil:** Socket room join/leave/heartbeat/events/order/reconnect, online status and cross-instance relay.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P17-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P17-04 — Files/webhooks and external events

**Hasil:** ChannelFile/webhook CRUD/auth/payload limits, inbound/outbound event policies.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P17-05 — Model and automation channel integration

**Hasil:** Mention model/selected chat/task action and scheduled targets use correct channel ACL/context.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P17-06 — Collaboration race tests

**Hasil:** Simultaneous edits/join/revoke/delete, private room isolation and seconds/ns timestamp precision.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P17 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P17 --task=P17-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p17/` atau service domain; `src/components/p17/`; route API/page terkait; `tests/conformance/p17-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P17-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P17:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P18 — Notes, rich editor dan collaborative documents

Personal/shared notes, pinned notes, search/folders/model assistance, rich content/export/import and Yjs collaboration.

### [ ] P18-01 — Notes CRUD and organization

**Hasil:** Create/edit/delete/pin/search/share/grants/tags/folder linkage and note content metadata.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P17-01, P17-02, P17-03, P17-04, P17-05, P17-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P18-02 — Rich editor and content transforms

**Hasil:** Baseline rich text/Markdown/editor commands/media/table/code/export interfaces without content loss.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P18-03 — Collaborative document sync

**Hasil:** Yjs update/state/awareness room protocol, reconnect/conflict/persistence and ACL checks.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P18-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P18-04 — Note/chat integrations

**Hasil:** Mentions/context references/model assisted actions/citations and selected note permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P18-05 — Pinned and shared note navigation

**Hasil:** Home/sidebar/pinned list/shared detail, access-loss/delete and owner lifecycle.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P18-06 — Note round-trip and race conformance

**Hasil:** Concurrent documents, file attachments, serialize/import/export and read-only role tests.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P18 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P18 --task=P18-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p18/` atau service domain; `src/components/p18/`; route API/page terkait; `tests/conformance/p18-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P18-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P18:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P19 — Calendars, events dan attendees

Calendars/default/color/sharing, event CRUD/ranges/recurrence/attendee responses/agent integrations and timezone.

### [ ] P19-01 — Calendar management

**Hasil:** Create/edit/delete/default calendars, grants/color/meta and calendar navigation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P18-01, P18-02, P18-03, P18-04, P18-05, P18-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P19-02 — Event editor and range queries

**Hasil:** Timed/all-day/location/description events, create/edit/cancel/delete and date ranges.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P19-03 — Recurrence and timezone

**Hasil:** RRULE expansion/minimum intervals/exceptions/series modification, DST and bounded evaluation.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P19-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P19-04 — Attendees and permissions

**Hasil:** Invite/status/pending/response/lifecycle, resource grants, private event fields and access loss.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P19-05 — Calendar model/tool integration

**Hasil:** Chat tools/event suggestions and authorized calendar actions match baseline supported flows.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P19-06 — Calendar UI and boundary fixtures

**Hasil:** Month/week/list/editor states from source; DST/recurrence overlaps/attendee race E2E.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P19 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P19 --task=P19-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p19/` atau service domain; `src/components/p19/`; route API/page terkait; `tests/conformance/p19-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P19-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P19:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P20 — Automations, schedules, subagents dan background work

Scheduled prompts/models/RRULE folders/targets/terminal, run history, timers/internal chats/subagents/review and task ownership.

### [ ] P20-01 — Automation CRUD and schedules

**Hasil:** Name/prompt/model/rrule/folder/target/terminal config, active state, next-runs UI.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P19-01, P19-02, P19-03, P19-04, P19-05, P19-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P20-02 — Durable scheduler and execution

**Hasil:** Exactly-once claim/idempotency/leases, next/last run, retries, offline/catch-up/timezones and limits.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P20-03 — Runs/targets/notifications

**Hasil:** History success/error links, chat/channel targets, stop/delete/access revoked/provider key changes.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P20-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P20-04 — Subagent model orchestration

**Hasil:** Configured subagent models/limits/prompts/internal chats, selected tools/delegation/result/event UI sesuai baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P20-05 — Timers and compaction hooks

**Hasil:** Chat timer/internal task paths, status/unread/summary and background context/memory work integration.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P20-06 — Restart and multi-instance tests

**Hasil:** Scheduler restart/race/revocation/no duplicate inferensi, job retention and failure recovery.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P20 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P20 --task=P20-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p20/` atau service domain; `src/components/p20/`; route API/page terkait; `tests/conformance/p20-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P20-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P20:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P21 — Terminal, code execution, file workspace dan browser bridge

Remote terminal servers, HTTP/WS sessions, code interpreter Jupyter/Pyodide, file tree/edit/preview/diff/ports/notebooks/SQLite and execution tools.

### [ ] P21-01 — Terminal server connections

**Hasil:** Admin/personal configuration/auth/access/test, remote HTTP/WS routing and session ownership.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P20-01, P20-02, P20-03, P20-04, P20-05, P20-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P21-02 — Terminal sessions and dock

**Hasil:** Create/attach/resize/input/output/close terminal, reconnect/cwd/chat linkage and real xterm UI behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P21-03 — File workspace browser/editor

**Hasil:** List/tree/upload/download/rename/delete/bulk/edit/diff/search/JSON/notebook/SQLite preview and path safety.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P21-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P21-04 — Jupyter/Pyodide execution

**Hasil:** Code execution engine settings/auth/timeouts, packages/artifacts/output/files and kernel/session cleanup.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P21-05 — Port/browser previews and interactions

**Hasil:** Remote port preview, sandbox/iframe bridge/browser-related tool actions supported by baseline, explicit session permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P21-06 — Execution containment conformance

**Hasil:** Isolated worker/egress/fs/process/resource policies, user separation/cancel/disconnect and generated file privacy.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P21 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P21 --task=P21-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p21/` atau service domain; `src/components/p21/`; route API/page terkait; `tests/conformance/p21-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P21-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P21:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P22 — Feedback, evaluations, arena, analytics dan usage

Ratings/comments/annotations/datasets/model evaluations/arena, user/admin analytics/heatmaps/token timing/connection monitoring.

### [ ] P22-01 — Feedback persistence

**Hasil:** Message rating/comment/tags/details/snapshot/update/delete/export and available permissions.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P21-01, P21-02, P21-03, P21-04, P21-05, P21-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P22-02 — Evaluation datasets and jobs

**Hasil:** Create/configure/evaluate model runs, progress/results/dataset management and statistical display.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P22-03 — Arena/blind comparison

**Hasil:** Model selection/blind votes/scoring/leaderboards/history/control flags sesuai enabled baseline.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P22-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P22-04 — Usage aggregation and heatmaps

**Hasil:** Original personal totals/daily/weekly/cumulative plus kw usage connection filter, reported/missing/browser sources and token/timing models.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P22-05 — Admin analytics dashboards

**Hasil:** User/model/chat/activity/usage filter/export drill-down, admin data access and bounded queries.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P22-06 — Analytics numerical conformance

**Hasil:** Usage every model/tool/subagent step once, timezone buckets/dedup/absent usage/privacy and comparison dataset tests.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P22 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P22 --task=P22-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p22/` atau service domain; `src/components/p22/`; route API/page terkait; `tests/conformance/p22-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P22-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P22:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P23 — Seluruh Admin Settings, events dan operations

General/auth/interface/connections/models/audio/images/documents/web search/code/tools/subagents/evaluations/pipelines/external knowledge/database/events/I18n.

### [ ] P23-01 — Config registry and precedence

**Hasil:** All 421 persistent keys plus env occurrences; defaults/env/persist overrides/reset/import/export and secret references.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P22-01, P22-02, P22-03, P22-04, P22-05, P22-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P23-02 — All admin panels and search

**Hasil:** Every Settings source surface mapped to working control, visibility permissions and pending/error/success states.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P23-03 — Notification targets and event webhooks

**Hasil:** 191 event definitions, target CRUD/default/test, routing/payload templates/auth and safe delivery lifecycle.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P23-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P23-04 — Database and system operations

**Hasil:** Health/version/update/import/export/maintenance/access defaults/slim-offline options and admin destructive operations with clear review.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P23-05 — Interface/brand/localization administration

**Hasil:** Banners/notices/model order/defaults/I18n and display settings preserve Kawan required attribution.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P23-06 — Admin config change conformance

**Hasil:** Every key/type/default/control is tested with enabled/disabled profiles; secrets never returned raw or traced.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P23 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P23 --task=P23-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p23/` atau service domain; `src/components/p23/`; route API/page terkait; `tests/conformance/p23-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P23-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

**Gate P23:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## P24 — Compatibility, full acceptance dan self-host release

Complete feature/schema/API/event/settings conformance, data migration, production multi-service deployment, backup/restore/offline and release handover.

### [ ] P24-01 — Endpoint and payload differential closure

**Hasil:** 581 HTTP/WS declarations plus 446 shape descriptors compared status/body/headers/permissions/pagination/stream behavior.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-01` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P23-01, P23-02, P23-03, P23-04, P23-05, P23-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-01.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P24-02 — Schema and import/export closure

**Hasil:** 43 models/396 fields/64 migrations physical semantics, legacy JSON/timestamp/hashes and SQLite/Postgres round trips.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-02` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-01. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-02.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P24-03 — UI/settings/locale parity closure

**Hasil:** 57 route surfaces/645 components/67 settings surfaces/64 locales with enabled/disabled/mobile/read-only/error screenshots.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-03` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-02. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-03.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P24-3:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P24-04 — All adapter/profile closure

**Hasil:** Every integration catalogue/provider branch gets protocol fixture and configured environment smoke; missing external service is not a global pass.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-04` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-03. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-04.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P24-05 — Production deployment and CI

**Hasil:** Node web + worker/socket/queue + Postgres/vector/private storage; containers/proxy/SSE/WS/migrations/rollback/backup/restore docs tested.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-05` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-04. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-05.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

### [ ] P24-06 — Performance/security/accessibility verification

**Hasil:** Load/context/long histories/large docs/queues, SSRF/ACL/XSS/plugin sandbox, auth/rate limits/telemetry redaction and accessible UI.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-06` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-05. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-06.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Checkpoint P24-6:** semua slice terakhir pass; typecheck/lint/focused conformance/build; failure tetap open.

### [ ] P24-07 — Final owner handover and publish review

**Hasil:** Report closed obligations/open failures/declared deltas, real test evidence and exact commit; deployment/publication separate explicit instruction.

**Acceptance:**
- [ ] Seluruh perilaku slice dan reference IDs terkait dipetakan source → contract → implementasi; tidak ada source body/aset disalin.
- [ ] Happy path + failure/permission/disabled/cancel/persistence states yang relevan bekerja end-to-end sesuai golden baseline dan declared Kawan exception.
- [ ] Semantics/schema/config/event effects tidak dipangkas; registry row memiliki test/evidence, tidak ada mock production atau kontrol inert.
- [ ] Cases ACC-P24 pada [acceptance scenarios](acceptance-scenarios.md) yang terkait slice lulus; child case memakai input/expected/assertion spesifik reference ID.
**Verification:** `npm run test:conformance -- --phase=P24 --task=P24-07` + focused `npm test`/E2E dan worker checks sesuai slice; checkpoint `npm run build`.
**Dependencies:** P24-06. **Scope:** S/M setelah child slicing. **Files target:** `src/lib/domains/p24/` atau service domain; `src/components/p24/`; route API/page terkait; `tests/conformance/p24-07.test.ts`; schema migration hanya bila diperlukan.
**Bukti spesifik:** fixture input/output + response/event/schema/UI diff yang membuktikan hasil pada deskripsi task; log dan screenshot disanitasi.

**Gate P24:** seluruh task domain dan adapter mandatory pass; all inventory obligations reviewed/implemented/verified, E2E + conformance profile + `npm run build` sukses. Scope belum lengkap tidak boleh N/A demi melewati gate.

## Format handover mandor

Task IDs; reference IDs; perubahan perilaku; file utama; command + exit code + ringkasan; fixture/screenshot/network/schema evidence; exact baseline/profile; exception/change ledger; open failures; commit; task berikutnya. Jangan tulis “100%” tanpa completed registry/gates.

## Status eksekusi

Belum ada task implementasi atau build aplikasi yang dijalankan. Seluruh checkbox adalah pekerjaan untuk pelaksana lain.
