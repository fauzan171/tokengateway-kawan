# Baseline inventory Open WebUI

Commit `f8ae8a6c328946dc62cd0712961a0632574581bf`. Metadata hasil scan, bukan source code aplikasi. Seluruh row masuk target planning; status perilaku belum diverifikasi.


| Area | Jumlah |
|---|---:|
| orm_models | 43 |
| api_endpoints | 581 |
| router_mounts | 33 |
| payload_shapes | 446 |
| socket_events | 15 |
| migrations | 64 |
| config_keys | 421 |
| environment_occurrences | 938 |
| ui_components | 645 |
| frontend_routes | 57 |
| settings_surfaces | 67 |
| locales | 64 |
| integration_adapters | 63 |
| business_events | 191 |
| socket_emit_occurrences | 35 |
| static_mounts | 6 |
| source_fingerprints | 1176 |
| parse_errors | 0 |
| orm_columns | 396 |

Detail terstruktur: [inventory.json](inventory.json). Detail schema: [schema.md](schema.md). Endpoint/event: [api.md](api.md). Settings/config: [settings.md](settings.md). Halaman/komponen: [ui.md](ui.md).

Semua artefak bersumber dari commit lokal yang bersih. Default referensi berupa simbol perlu dievaluasi pada profile env target; scan tidak mengeksekusi Python/DB.
