# Prompt pelaksana — Kawan full parity v2

Kamu pelaksana pembangunan ulang Kawan dengan target **seluruh fitur Open WebUI pada pinned baseline**, bukan BYOK MVP yang disederhanakan.

Workspace `/Users/mekari/tokengateway/tokengateway-chat`; reference read-only `/Users/mekari/tokengateway/open-webui`; commit `f8ae8a6c328946dc62cd0712961a0632574581bf`.

Penugasan awal: P00 saja. Penugasan berikutnya harus menyebut phase/task ID; jangan sekaligus mengerjakan seluruh backlog tanpa koordinasi mandor.

## Dokumen wajib dan precedence

1. Instruksi terbaru pemilik: seluruh fitur referensi masuk scope; hanya planning telah dibuat, belum ada aplikasi.
2. `tasks/plan.md`, `tasks/prd.md`, `tasks/schema-contract.md`.
   Technical design: `tasks/sdd/README.md`, chapter sesuai phase, `tasks/sdd/contract-registry.json`, `tasks/sdd/work-orders/`, `tasks/sdd/kawan-api-contracts.json`.
3. `tasks/todo.md`, `tasks/coverage.md`, `tasks/coverage.json`, `tasks/acceptance-scenarios.md`.
4. `tasks/reference/inventory.json` serta schema/API/settings/UI inventories.
5. `tasks/parity-audit.md`, `AGENTS.md` bila tersedia.

`PROMPT.md` adalah brief awal: branding/BYOK/security/stack masih berlaku, tetapi daftar fitur yang dulu dikeluarkan serta status Direct opsional sudah digantikan instruksi full parity. `tasks/archive/byok-v1/` hanya historical reference; jangan mengikuti constraints MVP di sana.

Kontradiksi kalimat “tidak menyimpan key/tidak menjadi perantara” diselesaikan mengikuti requirement teknis rinci: default encrypted persistence + server transport; Direct browser-local + direct gateway transport. Read/list responses tidak mengembalikan saved raw key. Jelaskan dua mode dengan akurat di UI/dokumentasi.

## Aturan kerja

- Stack web Next 15, TS strict, Tailwind 4, shadcn, AI SDK v5, Prisma SQLite dev/Postgres prod dan Auth.js. Runtime pendukung terisolasi boleh untuk full baseline capability, bukan dependency tanpa alasan.
- Seluruh baseline user/admin/workspace/RAG/Ollama/audio/images/memory/channels/notes/calendar/automation/evaluation/terminal/plugin/tool features wajib; feature disabled tetap punya enabled profile implementasi nyata.
- Tulis kode/aset/translations/migrations sendiri. Jangan clone/copy Open WebUI menjadi aplikasi atau memakai backend referensi sebagai production backend.
- Core 43 entities/396 fields baseline dipertahankan lewat Prisma physical mappings; User/Auth dipisah. `kw_*` extensions terpisah. Jangan kembali ke reduced 13-entity model.
- Setiap task wajib baca relevant source, resolve runtime contracts, implement slice end-to-end, focused tests, registry evidence; checkpoint setiap 2–3 task dan build sukses tiap phase.
- Task besar dipecah child task maksimum sekitar 5 file inti/subsystem yang terfokus; semua child acceptance inherited, parent belum selesai sebelum semua pass.
- 224 tasks adalah parent work packages. Baca SDD Definition of Ready, precise first child breakdown, ports/DTO/state/recovery/ADRs dan brief phase; resolve source/runtime facts sebelum coding. JSON Schema memvalidasi bentuk, bukan authorization atau baseline wire equivalence.
- Tree actions jangan disederhanakan: user/assistant punya in-place vs branch/copy; baseline delete-message mempertahankan dan reparent grandchildren, bukan hapus subtree. Ikuti SDD-04 dan runtime golden fixtures.
- Semua API/routes/events/settings/config/adapters inventory mandatory. Missing provider credential/profile tidak boleh ditandai pass/N/A global.
- Golden reference berjalan terisolasi dengan synthetic data untuk contract/screenshot comparison; tidak menyalin files/source/assets/data user nyata.
- Ownership/role/group/grants ditegakkan server; semua credential encrypted/redacted, Direct key browser-local; tidak ada credential responses mentah.
- Long-running generation/indexing/scheduler/socket/plugin tasks memakai durable services/leases/idempotency; tidak hanya in-memory flags/route request lifecycle.
- Native protocol adapter tetap diperlukan untuk baseline capability yang tidak tercakup AI SDK. Jangan memaksa Ollama/plugins/audio/RAG ke generic text SDK.
- Branding Kawan/by tokengateway wajib; exception ledger menjelaskan perbedaan yang disengaja tanpa menghapus domain feature.
- Tidak ada mocked production behavior, fake model data, TODO kosong, inert controls atau tab/engine tidak bekerja yang diklaim selesai.
- Jangan deploy/publish/DNS/domain writes tanpa penugasan eksplisit setelah hasil siap review.

## Command/evidence contract

Sediakan `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run test:conformance`, `npm run build`. Conformance runner memfilter `--phase`/`--task` dan obligation IDs. Worker checks dan container smoke disertakan bila berubah. Semua command harus nyata; planning ini belum menyediakan runner aplikasi.

Laporan: phase/task + reference IDs; behavior implemented; acceptance pass/fail; files; command/exit/result; sanitized schema/network/event/UI evidence; enabled profile dan baseline; declared differences; open failures; commit; next dependency. Update checkbox/coverage hanya bila terbukti.

Jangan tulis “100% sama persis” karena build hijau saja. Full parity membutuhkan semua categories verified, dynamic unknowns closed dan exceptions terlihat jelas. Preview milestone belum release full parity.
