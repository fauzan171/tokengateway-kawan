# Parity target v2 — scope seluruh Open WebUI

User telah mengubah target dari selected BYOK personal scope menjadi seluruh fitur pada commit `f8ae8a6c328946dc62cd0712961a0632574581bf`.

Seluruh 15 gap audit lama kini masuk mandatory requirements dan phases. RAG/Ollama/marketplace/RBAC/admin/calendars/notes/audio/images/channels/automations/memory/evaluations/terminal/code tidak lagi dikeluarkan. Direct bukan opsional. Core schema tidak lagi 13 entitas disederhanakan: semua 43 reference ORM declarations dan 396 columns dipetakan melalui schema contract.

Audit lama tetap tersedia di [archive/byok-v1/parity-audit.md](archive/byok-v1/parity-audit.md) untuk riwayat; bukan instruksi scope aktif.

## Apa yang sudah dilakukan pada planning

- Pinned baseline dan working tree bersih direkam.
- Scan seluruh Python backend berhasil tanpa parse errors.
- Semua ORM/models/columns, endpoint declarations/request shapes, config keys, routes/UI/settings/locales/integration adapters masuk [reference inventory](reference/README.md).
- Semua enumerated obligations punya owner/task/status/test obligation pada [coverage registry](coverage.json).
- Full-domain PRD, schema contract, dependencies, phases dan gates menggantikan scope v1.
- [SDD engineering lengkap](sdd/README.md) menambahkan architecture/data/API/state/security/UX/domain/worker/operations contracts, 10 ADRs, typed JSON Schemas dan task briefs. [SDD verification](sdd/sdd-verification.md) memeriksa konsistensi desain; bukan proof runtime.

## Apa yang belum boleh diklaim

Belum ada implementasi/build/live DB conformance atau pengujian runtime full parity. Static scan tidak memastikan semua semantics internal, defaults env, conditional branches dan UI bindings dinamis. P00/P01 review dan P24 closure wajib menyelesaikan hal itu.

Planning sekarang menetapkan **seluruh fitur baseline sebagai mandatory target**. Itu tidak sama dengan bukti bahwa PRD hasil audit manual semua branches atau aplikasi sudah identik 100%. [Coverage](coverage.md) menjelaskan denominator, verification levels dan exceptions.

Branding Kawan, keamanan key encrypted/browser-local, BYOK overlay dan rewrite stack tetap merupakan declared differences. Jangan mengklaim literal byte-identical source/assets atau DB/API-token drop-in tanpa proof khusus.
