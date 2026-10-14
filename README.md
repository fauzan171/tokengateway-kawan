# Kawan — paket PRD, planning dan SDD

Kawan, by [tokengateway.ai.id](https://tokengateway.ai.id), ditargetkan sebagai pembangunan ulang full-feature Open WebUI dengan personal BYOK. Repository ini sekarang berisi **planning/design specifications**, belum implementasi aplikasi.

> **Status permintaan terbaru.** Brief terbaru meminta target pengguna nonteknis dengan chat selengkap ChatGPT untuk pemakaian pribadi dan fitur overkill dikecualikan. Paket dokumen untuk brief itu ada di **[tasks/nontechnical-v1/](tasks/nontechnical-v1/README.md)** dan menjadi scope yang direkomendasikan aktif. Paket full-parity di bawah (PRD/SDD/plan/todo/coverage full) tetap tersedia sebagai **referensi alternatif**, bukan requirement default. Paket nontechnical-v1 tidak mengklaim 100% Open WebUI; ia mengklaim 100% untuk scope terpilih yang tercantum di matriks cakupannya.

Baseline lokal read-only: `/Users/mekari/tokengateway/open-webui`, commit `f8ae8a6c328946dc62cd0712961a0632574581bf`. Kode/aset/translations/migrations Kawan ditulis sendiri. Scope terbaru mengaktifkan seluruh domain baseline, termasuk fitur yang dikecualikan brief awal.

## Mulai di sini

**Brief terbaru (nonteknis, scope terpilih): [tasks/nontechnical-v1/](tasks/nontechnical-v1/README.md)** — PRD, SDD, plan, coverage, execution prompt, pemeriksa konsistensi.

Paket full-parity (referensi alternatif):

1. [PRD](tasks/prd.md): produk/semua mandatory requirements.
2. [SDD engineering index](tasks/sdd/README.md): arsitektur/data/API/state/security/UI/domain/workers/ops/ADRs.
3. [Plan dan milestones](tasks/plan.md), [backlog](tasks/todo.md).
4. [Work orders per phase](tasks/sdd/work-orders/README.md) dan [child breakdown/Definition of Ready](tasks/sdd/10-delivery-work-orders.md).
5. [Prompt pelaksana](tasks/execution-prompt.md): first assignment P00, kemudian task/child yang ditugaskan mandor.

## Kontrak dan evidence

- [Core schema contract](tasks/schema-contract.md) dan [reference inventory](tasks/reference/README.md).
- [Kawan API JSON Schema](tasks/sdd/kawan-api-contracts.json) dan [synthetic examples](tasks/sdd/api-examples.json).
- [Coverage](tasks/coverage.md), [coverage registry](tasks/coverage.json), [SDD contract registry](tasks/sdd/contract-registry.json).
- [Acceptance scenarios](tasks/acceptance-scenarios.md), [engineering readiness](tasks/sdd/engineering-readiness.md), [SDD verification](tasks/sdd/sdd-verification.md).

25 phases, 224 parent work packages, 36 starter child slices, 12 numbered SDD chapters, 10 ADRs, 59 typed JSON Schema definitions. Existing inventory: 43 ORM entities/396 fields, 581 API declarations, 421 config keys, 64 locales; runtime contracts belum semuanya diverifikasi.

`PROMPT.md` menyimpan brief awal. Branding/security/stack masih berlaku, tetapi exclusion list/Direct optional/urutan MVP digantikan full-parity planning aktif. `tasks/archive/byok-v1/` hanya history. Default server mode menerima dan menyimpan key terenkripsi lalu meneruskan request; Direct key tetap browser-local. Kawan tidak menambahkan billing token.

Build/runtime testing dilakukan saat implementasi. Konsistensi dokumen tidak membuktikan aplikasi identik 100%; baseline runtime/schema/defaults/engines/UI evidence harus ditutup sesuai gates. Branding Kawan, key privacy/security, BYOK overlay dan stack/runtime rewrite tetap declared differences.
