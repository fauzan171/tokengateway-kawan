# Coverage dan aturan pengukuran parity

Baseline `f8ae8a6c328946dc62cd0712961a0632574581bf`. Semua obligations mandatory; status not_started/not_verified.

| Area | Obligations |
|---|---:|
| orm_models | 43 |
| orm_columns | 396 |
| api_endpoints | 581 |
| router_mounts | 33 |
| static_mounts | 6 |
| payload_shapes | 446 |
| socket_events | 15 |
| socket_emit_occurrences | 35 |
| business_events | 191 |
| config_keys | 421 |
| environment_occurrences | 938 |
| settings_surfaces | 67 |
| locales | 64 |
| ui_components | 645 |
| frontend_routes | 57 |
| integration_adapters | 63 |
| migrations | 64 |
| source_fingerprints | 1176 |

Feature slices: 161. Implementation tasks: 224 (termasuk 63 adapter slices).

## Source → requirement → task → proof

Machine-readable [coverage.json](coverage.json) menyimpan semua IDs/owners/tasks/source/test obligations. [inventory.json](reference/inventory.json) memuat descriptors lengkap. Source phase assignment merupakan klasifikasi kerja awal, perlu dicek pada P00; pindah owner tidak boleh menghilangkan row.

## Pass levels

Planned = requirement/task tersedia. Reviewed = contract/semantics source tervalidasi. Implemented = slice nyata. Verified = evidence sesuai baseline/profile. Tidak satupun level tersebut saling menggantikan.

## Formula

Feature coverage = verified requirement slices / semua mandatory requirement slices. Contract coverage dihitung terpisah untuk DB fields/constraints, endpoints/shapes/events, config/settings, routes/UI surfaces, adapters dan profiles. Full parity gate membutuhkan 100% pada seluruh kategori plus zero unknown dynamic branch/undocumented delta, bukan rata-rata tertimbang yang menyembunyikan kategori kosong.

645 komponen mencakup icons/helpers: jangan menganggap semua adalah fitur produk independen. 581 endpoint merupakan deklarasi, wildcard methods dan conditional profiles harus di-expand dalam contract fixtures. Static extraction tidak mengukur seluruh runtime behavior.

1.176 source fingerprints adalah kewajiban review sumber, bukan tambahan fitur user. Fingerprint/hash yang cocok hanya memvalidasi baseline; behavioral test tetap wajib. Scope fingerprint saat ini `src/`, `backend/open_webui/`, `docs/`; root packaging/deployment, scripts, static runtimes dan dynamic provider branches masuk expansion audit P00 sebelum denominators dikunci. Angka 5.241 adalah obligations metadata awal yang saling melengkapi, bukan 5.241 fitur independen.

## Exception ledger

| Exception | Outcome | Classification |
|---|---|---|
| Branding/assets Kawan | Kawan + by attribution, icons/assets asli | Intentional visual/content delta |
| Credential handling | Key encrypted/masked, Direct browser-local | Intentional security/API delta |
| BYOK overlay | Onboarding/personal active connection + usage | Additional product behavior |
| Stack/runtime rewrite | Next/Prisma/Auth.js/services sendiri | Implementation difference; must preserve outward behavior |

Full product-feature coverage dapat menjadi target 100%; byte-identical source/assets/DB drop-in/API-token compatibility tidak diklaim otomatis. Literal “sama persis tanpa pengecualian” belum benar selama ledger memiliki perbedaan. Kebutuhan Kawan memang memerlukan beberapa perbedaan itu.

## Closure rule

Row yang belum dipahami tetap open. Missing external credentials berarti integration belum verified. Unsupported engine/tab/role bukan N/A pada full profile. Disabled baseline profile harus dibuktikan sama-sama disabled dengan config yang sama; enabled profile tetap mandatory. Upstream diff setelah pin dibuat perubahan scope baru.
