# Rencana implementasi bertahap — plugin, katalog agent, standar dokumen, dokumentasi tool

Tanggal: 2026-10-23. Penulis: perencana (tim `kawan-riset-masa-depan`).
Status: **rencana; nol kode diubah. Eksekusi hanya setelah pemilik menyetujui.**
Sumber: `reports/riset-plugin.md` (t1), `reports/riset-katalog-agent.md` (t2),
`reports/riset-standar-dokumen.md` (t3), `02-rencana-implementasi.md`,
`03-verifikasi.md`, `STATUS.md`.

Berkas ini satu-satunya keluaran t4. Tidak ada dependency npm baru yang diusulkan
di seluruh rencana (alasan per tahap ada di kolom "dep baru").

---

## 0. Ringkasan untuk pemilik (15 baris, keputusan)

1. Empat pekerjaan dipisah jadi **dua jalur yang tidak saling memblokir**: dokumen
   (D) dan plugin+agent (P/K).
2. Jalur dokumen mulai dengan **menutup 3 cacat terbukti** (sheet XLSX gagal, OOXML
   tidak bisa dibaca balik, konversi biner jadi .md) — murah, wajib lebih dulu.
3. Jalur plugin: **registry tool tertutup (P1)** adalah fondasi; tanpa itu semua
   menempel di `generate.ts` yang sudah 1.265 baris.
4. Manifest plugin = **JSON deklaratif tanpa kode**; tanpa `eval`/impor runtime,
   tanpa tambah executor, tanpa install dari URL/git.
5. DSH dan skill rea dikonsumsi sebagai **pola dan teks Prompt**, bukan runtime
   yang diimpor. Tidak ada paket `@deepseek-ai/*` masuk ke Kawan.
6. Katalog agent = **konstanta beku `src/lib/agents/registry.ts`** + 2 kolom
   aditif di `TaskRun`; tidak ada tabel Agent, tidak ada job kind baru.
7. Efek-tulis apa pun menunggu **FIX-20 (approval)**; tool kode/browser menunggu
   **FIX-17 (sandbox)**. Itu batas isolasi, bukan birokrasi.
8. Urutan eksekusi yang disarankan: **D0 → P1 → (D1→D4 paralel K1→K4) → K5..K8
   → P2 → P8 → P3**; D5 setelah P1.
9. FIX-19 sudah punya `src/lib/tools/app.ts` (untracked, pekerjaan kapten); P1
   **tidak** boleh menyerobot — app tool didaftarkan setelah FIX-19 mendarat.
10. `maxSteps` belum bisa ditegakkan sebelum tool loop FIX-09; simpan angkanya,
    **jangan** klaim penegakan.
11. Kuota token dibaca dari `UsageRecord.reported = 1`; yang tidak dilaporkan
    ditampilkan "tidak tersedia", bukan angka karangan.
12. Dokumentasi tool = **satu data `ToolDoc`, tiga pembaca** (prompt, panel UI,
    `docs/tools/*.md`); hanya tool yang benar-benar terpasang yang didokumentasikan.
13. Perkiraan total: **±18–24 sesi kerja** (definisi "sesi" di §1), tanpa dependency
    baru; ketidakpastian ±40% karena belum ada baseline kecepatan per tahap.
14. FIX-22 (multi-agent) **tidak** disentuh; K1–K4 justru prasyaratnya.
15. Yang **tidak** dijanjikan ada di §10 — baca itu sebelum menyetujui.

---

## 1. Konvensi rencana

- **Satu tahap = satu perubahan yang bisa diuji sendiri** dan punya bukti
  penerimaan sendiri. Tidak ada tahap yang menggabungkan dua jenis risiko.
- **Perkiraan "sesi"** = satu sesi kerja engineer/agen dengan gate hijau
  (`npx tsc --noEmit`, `npx eslint <berkas>`, `npm test`, `npm run build`).
  S = ±0,5 sesi; M = ±1 sesi; L = ±2 sesi. Total dihitung dari jumlah tahap,
  bukan janji tanggal.
- **Gate bukti** mengikuti `03-verifikasi.md` (V09, V12, V17, V19, V20, V24) dan
  `STATUS.md`. Gate yang butuh key/runtime nyata ditulis `blocked_external`,
  bukan `pass`.
- **Jalur**: D = dokumen; P = plugin/tool; K = katalog agent; G = cross-cutting.
- `+` berarti dua tahap **boleh** dijalankan terpisah; bukan izin menjalankan
  agen paralel pada satu berkas yang sama.

---

## 2. Peta dependency

```
                 ┌── G0 (keputusan pemilik + audit penempatan) ──┐
                 │                                               │
   JALUR D       │                        JALUR P/K              │
   D0a readZip ──┤   FIX-09 (tool loop) ──► P1 registry ──┬─► P2 manifest
   D0b sheet  ───┤                              │          ├─► P8 docs tool (D5 baca P1)
   D0c convert ──┤                              │          └─► P3 gating (butuh FIX-20 utk write)
   D1 batas  ────┤                              │
   D2 tema   ────┤                              └─► K1 registry agent ──► K2 migrasi
   D3 blok   ────┤                                                          │
   D4 template ──┤                                              K3 admission ─┤
   D6 pptx   ────┘                                              K4 eksekusi ──┤
                                                                K5 API ───────┤
                                                                K6 kuota ─────┤
                                                                K7 UI ────────┘
                                                                K8 audit admin

   FIX-17 ──► (boleh registrasi tool code/browser; tidak relevan utk dokumen)
   FIX-20 ──► (boleh manifest/P3 effect=write)
   FIX-19 ──► (app tool masuk registry P1 setelah mendarat; JANGAN diserobot)
   FIX-18 ──► mengukur kualitas agent sebelum katalog mengklaim apa pun
   FIX-23 ──► Plugin + snapshot agent wajib masuk peta penghapusan
   FIX-24 ──► flag default off, metrik, backup, inventaris lisensi font
   FIX-21 ──► konsumen hilir K2 (jadwal butuh agentId snapshot); bukan bagian rencana ini
   FIX-22 ──► TIDAK disentuh; K1–K4 prasyaratnya
```

---

## 3. Tahap jalur dokumen (D)

Rujukan utama: `reports/riset-standar-dokumen.md` §2 (T1–T7), §3.1 (batas), §7.

| ID | Tahap | Baru / berubah | Dep murni | Dep FIX | Dep baru | Est | Risiko utama + mitigasi |
|---|---|---|---|---|---|---|---|
| D0a | `readZip` lewati entri direktori, tetap tolak traversal | UBAH `src/lib/artifacts/zip.ts` | — | — | tidak | S | Menlonggarkan hardening ZIP. Mitigasi: tetap tolak `..`/`.`/absolut/drive/backslash; entri `/` tetap dihitung ke `maxEntries`; tes slip/bomb/duplikat/symlink existing tidak boleh dihapus |
| D0b | Sanitasi nama sheet XLSX + fallback `Sheet1` | UBAH `render-binary.ts` | — | — | tidak | S | Nama sheet berubah dari judul. Mitigasi: sanitasi deterministik, tes judul jahat `Laporan/2026: Q1` |
| D0c | Tolak sumber konversi non-teks dengan `CONVERSION_UNSUPPORTED` | UBAH `artifacts/convert.ts` | — | — | tidak | S | Menolak konversi yang pengguna harap. Mitigasi: kode galat sudah ada; pesan menyebut format sumber |
| D1 | Batas kanonik §3.1 di `parseDocSchema` + `truncated` + `unknownBlocks` | UBAH `artifacts/document.ts` | D0a–D0c | — | tidak | M | Angka batas salah pilih → dokumen sah ditolak. Mitigasi: 12 kolom/2.000 baris/100 bullets sesuai PDF A4 11pt; potong ≠ tolak; `truncated` dilaporkan ke pemanggil |
| D2 | `theme.ts` + dipakai 4 renderer + satu ukuran halaman PDF (A4 595×842) | BARU `artifacts/theme.ts`; UBAH `render.ts`, `render-binary.ts`, `document-export.ts` | D1 | FIX-24 (inventaris lisensi font, hanya bila opsi B) | tidak | M | Dua jalur PDF menyatu → ekspor lama berubah tampilan. Mitigasi: tes MediaBox + catatan `pdf-nonlatin`; opsi B (sematkan TTF Unicode) DITUNDA |
| D3 | Blok baru satu per satu: `pageBreak` → `divider` → `bullets.ordered` → `image` (via `artifactId`) | UBAH `document.ts` + 4 renderer; tes pembaca independen | D2 | — | tidak | L (4 irisan M) | `image` menyelundupkan byte tanpa validasi. Mitigasi: hanya `artifactId` milik user + `ready`, PNG/JPEG/WebP, 4 MiB/gambar, 20 gambar/dokumen, tanpa base64 |
| D4 | Tiga template sebagai data: laporan, surat, rekap | BARU `artifacts/templates.ts` | D2 | — | tidak | M | Template berubah jadi mesin tata letak. Mitigasi: fungsi yang mengembalikan `DocSchemaV2`, bukan mesin; tanpa cover/TOC/nomor halaman/kop logo |
| D6 | Tata letak PPTX: hitung tinggi, satu tabel per slide, 8 kolom | UBAH `render-binary.ts` | D1 | — | tidak | M | Perubahan visual pada dokumen lama. Mitigasi: assert XML `ppt/slides` 0 ≤ y ≤ 5,625 inci; batas PPTX lebih ketat dari tabel kanonik |

Bukti penerimaan D (dari riset §8): round-trip `renderDocxBytes → detectFormat = docx`
(idem xlsx/pptx); judul jahat tetap ter-render; konversi pdf→md = 400; 13 kolom
dipotong ke 12 dengan `truncated: true`; 501 blok = `INVALID_DOC_SCHEMA`;
500 blok × 20k char = dipotong dengan `truncated: true`; PPTX tidak meluber.

> Koreksi 2026-10-23 (setelah D1): kontrak yang **diterapkan** memotong + melaporkan
> (`truncated`/`unknownBlocks`), bukan melempar `TABLE_TOO_WIDE`/`DOC_TOO_LARGE`.
> Kode galat itu tidak pernah ada di `src/`; menyebutnya sebagai bukti penerimaan
> adalah klaim yang salah dan sudah diganti di sini.

---

## 4. Tahap jalur plugin/tool (P)

Rujukan utama: `reports/riset-plugin.md` §4–§5.

| ID | Tahap | Baru / berubah | Dep murni | Dep FIX | Dep baru | Est | Risiko utama + mitigasi |
|---|---|---|---|---|---|---|---|
| P1 | Registry tool tertutup: tipe SDD-AG-4 (`ToolEffect`/`ToolResult`/`ToolContext`) + `{name, description, parameters, effect, validator, handler, timeoutMs, byteCap}` + `list/validate/effectOf` | BARU `src/lib/tools/registry.ts`; UBAH `chat/file-tool.ts`, `chat/generate.ts`, route compute | FIX-09 (loop) untuk konsumen penuh; registrasi bisa lebih awal | FIX-19 (app tool didaftarkan MENDATAR, bukan diserobot) | tidak | M | Refactor memindahkan tool bisa mengubah perilaku. Mitigasi: pindahkan tanpa ubah perilaku; 1 tes registry (nama asing ditolak, argumen invalid = error terstruktur, bukan crash) |
| P2 | Manifest plugin deklaratif: `{manifestVersion:1, id, version, displayName, description, tools[], prompts[], capabilityNeeds[]}`; subset JSON-Schema dibekukan (`type/enum/required/properties/items`), tolak `oneOf/allOf/$ref`; tabel `Plugin` + `sha256` + reviewer | BARU `src/lib/plugins/manifest.ts`, tabel `Plugin`, migrasi aditif 2 provider | P1 | FIX-23 (baris Plugin masuk peta penghapusan), FIX-24 (flag off) | tidak | M | Buka celah `$ref` = lubang SSRF/logic. Mitigasi: subset dibekukan sejak awal, tolak di luar subset, simpan hash, `enabled=true` wajib review manusia |
| P3 | Pasang plugin = nyalakan tool yang SUDAH ada; capability per-tool; `requiresApproval` diturunkan dari `effect`; iris `allowedTools ∩ serverAvailable` di server | UBAH `capabilities/route.ts`, `chat/generate.ts` | P1, P2 | **FIX-20 wajib** sebelum `effect: write`; FIX-17 wajib sebelum `code.run`/browser | tidak | M | Hardcode `toolsEnabled = true` masih ada → plugin mematikan/menyalakan sendiri. Mitigasi: ganti hardcode dengan pembacaan capability + registry; tanpa FIX-20 tolak semua manifest `write` |
| P8 | Dokumentasi tool: `ToolDoc[]` satu sumber, tiga pembaca (prompt, panel UI, `docs/tools/*.md`), tes kesesuaian; `buildCapabilityBlock` memuat nama + kapan dipakai + batas + larangan | BARU `src/lib/tools/catalog.ts`, `docs/tools/<id>.md`; UBAH `chat/prompt-builder.ts` + panel UI read-only | P1 | FIX-24 (docs gate) | tidak | M | Drift antara data dan dokumen. Mitigasi: satu tes kesesuaian; `kapanJangan` wajib; setiap kode galat wajib punya `tindakanModel`; hanya tool terpasang yang didokumentasikan |
| D5 | Dokumentasi `generate_file`/`generate_document` sebagai `ToolDoc` pertama (bagian dari P8, urutan bisa lebih awal karena tool sudah ada) | sama dengan P8 | P1 | — | tidak | S | Menjanjikan format yang belum ada (`zip/html/png` untuk `generate_file`). Mitigasi: dokumentasi menyebut hanya yang didukung |

Yang **tidak** masuk rencana ini: framework plugin umum, SDK konektor umum,
auto-install URL/git/tarball, build script pihak ketiga, MCP eksternal (P9 riset),
vector DB/Redis, billing.

---

## 5. Tahap jalur katalog agent (K)

Rujukan utama: `reports/riset-katalog-agent.md` §3–§5.

| ID | Tahap | Baru / berubah | Dep murni | Dep FIX | Dep baru | Est | Risiko utama + mitigasi |
|---|---|---|---|---|---|---|---|
| K1 | Registry agent beku + tipe `AgentDefinition` (id, version, label, description, systemPrompt, tools, defaultModelId, limits, audience); satu agent `default` = `SYSTEM_PROMPT` sekarang | BARU `src/lib/agents/registry.ts` | — | — | tidak | S | Definisi di kode = butuh deploy untuk ubah prompt. Mitigasi: `ponytail` komentar; tabel `AgentOverride` hanya bila kebutuhan nyata muncul |
| K2 | Migrasi aditif `TaskRun.agentId` + `TaskRun.agentVersion` (default `"default"`/`1`) | UBAH `prisma/schema.prisma` + migrasi 2 provider | K1 | FIX-23 (snapshot ikut peta hapus) | tidak | S | Baris lama jadi tidak sah. Mitigasi: default mengisi baris lama; `node scripts/check-migrations.mjs`; `npm run db:generate` |
| K3 | Admission: validasi `agentId` DI DALAM transaksi `createTask`/`followUp`; tulis snapshot; pakai `limits.deadlineMs` menggantikan `RUN_DEADLINE_MS`; galat `AGENT_UNKNOWN` 422 / `AGENT_FORBIDDEN` 403 | UBAH `src/lib/tasks/tasks.ts` | K2 | FIX-08 (verified) | tidak | M | Task lahir dengan agent tak sah bila validasi di luar transaksi. Mitigasi: satu titik validasi; `agentId` tidak bisa diubah `PATCH` |
| K4 | Eksekusi: `run.ts` pakai `definition.systemPrompt` + `defaultModelId`; event `run.queued`/`run.started` ditambah `agentId`/`agentVersion`; `maxTokensPerRun` via `estimateTokens`/`overBudget` | UBAH `src/lib/tasks/run.ts` | K3 | FIX-09 (loop) untuk `maxSteps` bermakna | tidak | M | Menjanjikan agent melakukan lebih dari yang bisa (satu putaran model). Mitigasi: `maxSteps` disimpan, tidak ditegakkan sampai loop ada; pesan UI jujur |
| K5 | API: `GET /api/kawan/v1/agents` disaring `audience`, tanpa `systemPrompt`/daftar tool internal; `agentId` opsional di body `POST /tasks` | BARU route `agents`, UBAH route tasks | K3 | FIX-24 (flag katalog) | tidak | M | Prompt bocor lewat API. Mitigasi: respons hanya id/version/label/description/defaultModelId/limits |
| K6 | Kuota per user: token dari `UsageRecord.reported = 1`, run nonterminal, task per jendela; 429 + `Retry-After`; konstanta di `src/lib/config/env.ts` | BARU modul kuota kecil; UBAH `tasks.ts` | K3 | FIX-24 (metrik) | tidak | M | Angka kuota dikira billing. Mitigasi: label "batas, bukan tagihan"; usage tak dilaporkan = "tidak tersedia"; `ponytail` pindah ke tabel counter bila agregasi mahal |
| K7 | UI: pemilih agent di `task-view.tsx`; label agent aktif di detail task | UBAH `src/components/task-view.tsx` | K5 | FIX-24 (flag) | tidak | M | UI menyembunyikan id tidak sah = rasa aman palsu. Mitigasi: server tetap menolak; UI hanya membaca `GET /agents` |
| K8 | Audit admin: daftar run per agent dari `TaskRun` + `TaskEvent`; tanpa tabel audit baru | UBAH route admin | K4 | FIX-24 (metrik) | tidak | S | Log memuat prompt. Mitigasi: `logger.ts` tetap hanya requestId/route/latency/result |

Keputusan eksplisit yang diwarisi dari t2 dan **tidak dibuka lagi** di eksekusi:
user menang atas `defaultModelId`; pengguna tidak membuat agent sendiri; agent tidak
menggantikan chat biasa; agent tidak menambah job kind; isolasi tetap lewat
`Task.userId`.

---

## 6. Cross-cutting (G)

| ID | Tahap | Isi | Dep | Est |
|---|---|---|---|---|
| G0 | Gerbang keputusan pemilik | Pemilik menyetujui §0 + memilih urutan (D dulu vs P1 dulu); audit penempatan modul (`src/lib/tools/`, `src/lib/agents/`, `src/lib/plugins/`) supaya tidak bertabrakan dengan FIX-19 yang sedang berjalan (`src/lib/tools/app.ts` untracked) | — | S |
| G1 | Flag & rollout | `AppConfig` flag (pola `registrationOpen`) untuk katalog agent dan plugin; default off sampai gate lulus; satu capability per-tool di `capabilities/route.ts` | P3/K5 | S |
| G2 | Peta penghapusan | `Plugin` + snapshot `TaskRun.agentId` masuk dependency map FIX-23 (tombstone → cleanup idempotent) | P2/K2 | S |
| G3 | Eval | Sebelum katalog membandingkan agent/model, jalankan dataset FIX-18; ukur kualitas pada gateway yang sama | K4 | (milik FIX-18) |
| G4 | Gate rilis | `npm test`, `npx tsc --noEmit`, `eslint`, `npm run build`, `node scripts/check-migrations.mjs`, dua checker dokumen, fresh+upgrade dua provider; gate live tanpa key = `blocked_external` | semua | per tahap |

---

## 7. Dependency baru

**Nol paket npm baru** di seluruh rencana. Alasan per area:

| Area | Yang menggoda untuk ditambah | Kenapa tidak |
|---|---|---|
| Registry/manifest | framework plugin, validator schema umum (zod/ajv) | subset JSON-Schema yang dibekukan cukup ditulis dengan fungsi parse biasa; menambah validator umum memperluas permukaan serangan |
| Dokumen | mesin template, font Unicode | template = fungsi kecil; font = keputusan lisensi FIX-24, opsi A (font inti) dipilih sekarang |
| Katalog agent | ORM/registry baru, tabel Agent | konstanta TypeScript + 2 kolom aditif sudah cukup |
| Dokumentasi tool | generator docs | satu array + satu tes kesesuaian lebih murah |
| Kuota | Redis/counter store | agregasi `UsageRecord` cukup sampai volume membuktikan sebaliknya |
| Plugin DSH/rea | `@deepseek-ai/*`, Cordis, pnpm manager | membawa runtime in-process ke monolit Next.js = pelanggaran isolasi SDD-AG-5 |

Satu-satunya aset non-npm yang mungkin perlu dicatat: **lisensi font TTF Unicode**
(opsi B D2), dan itu pun ditunda sampai ada permintaan non-Latin nyata.

---

## 8. Perkiraan total dan urutan eksekusi yang disarankan

| Jalur | Tahap | Est |
|---|---|---|
| D | D0a, D0b, D0c, D1, D2, D3(×4), D4, D6 | ±8–9 sesi |
| P | P1, P2, P3, P8 | ±4 sesi |
| K | K1, K2, K3, K4, K5, K6, K7, K8 | ±6 sesi |
| G | G0, G1, G2 | ±3 sesi |
| **Total** | | **±18–24 sesi** |

Urutan serial yang disarankan untuk satu eksekutor:

1. **G0** — keputusan pemilik + audit penempatan.
2. **D0a → D0b → D0c** — tiga cacat terbukti, murah, tanpa dependensi.
3. **P1** — registry tool (fondasi; jangan menyerobot `src/lib/tools/app.ts`).
4. **D1 → D2** dan **K1 → K2** (tahap kecil, boleh berselang-seling).
5. **K3 → K4** — "pilih agent lalu jalan" sudah jujur dan teruji.
6. **D3**, **D5/P8**, **K5**, **K6**, **K7**, **K8**, **D4**, **D6**.
7. **P2 → P3** — terakhir, karena P3 `effect: write` menunggu FIX-20.
8. **G1 → G2 → G4** menutup rilis.

Aturan urut yang tidak boleh dibalik:

- UI katalog (K7) tidak boleh mendahului validasi server (K3/K5).
- P3 tidak boleh memberi efek tulis sebelum FIX-20.
- Tool `code.run`/browser tidak boleh didaftarkan sebelum FIX-17.
- D3 (`image`) tidak boleh mendahului D1 (batas).
- Dokumen tool (P8) tidak boleh mendokumentasikan tool yang belum terpasang.

---

## 9. Risiko lintas tahap

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tabrakan berkas dengan FIX-17..24 yang dikerjakan kapten (`tools/app.ts`, `run.ts`, `tasks.ts`) | Konflik + gate merah | G0 audit penempatan; satu WP per sesi; P1 registrasi app tool menyusul |
| Refactor `generate.ts` (1.265 baris) saat P1/P3 | Regresi chat | Pindahkan tanpa ubah perilaku; test existing sebagai jaring; tanpa membesarkan berkas |
| Batas dokumen salah pilih | Dokumen sah ditolak | Potong ≠ tolak; `truncated` dilaporkan; batas per format boleh lebih ketat, tidak lebih longgar |
| Kuota berbasis `reported = 1` | Angka kuota tidak lengkap | Tampilkan "tidak tersedia"; jangan mengarang |
| `maxSteps` belum bisa ditegakkan | Klaim palsu | Simpan, jangan klaim; tegakkan setelah FIX-09 |
| Plugin `enabled=true` tanpa review | Tool berbahaya menyala | Hanya referensi tool terdaftar; hash + reviewer; default off |
| Dua penulis PDF menyatu | Ekspor lama berubah | D2 memutuskan satu ukuran halaman + tes MediaBox |
| Fitur dirilis tanpa flag | Regresi pengguna | G1 flag default off; rollback kode hanya schema-compatible |

---

## 10. Yang TIDAK dijanjikan

1. **Plugin loader arbitrer** dan eksekusi kode pihak ketiga di server Kawan —
   dilarang SDD (01-requirements-architecture.md:71), tidak diusulkan di sini.
2. **Kompatibilitas penuh dengan DSH**, impor runtime `@deepseek-ai/*`, Cordis,
   pnpm manager, atau pemasangan plugin sekali klik. DSH hanya sumber pola.
3. **rea sebagai runtime** — hanya teks Prompt berversi yang direview manusia,
   tanpa fetch saat runtime, tanpa submodule auto-update.
4. **Plugin menambah executor/capability** — manifest yang mereferensikan tool tak
   dikenal ditolak; tidak ada fallback ke shell/Python/browser.
5. **Dokumen seperti Claude secara piksel** — yang dijamin struktur tervalidasi dan
   konsisten antar-format; CJK, emoji, tabel lebar, font hilang tetap risiko sisa
   (PDF font inti = Latin-1, karakter >U+00FF diganti `?`).
6. **Konversi dua arah** PDF/DOCX/XLSX → teks; rekonstruksi butuh LibreOffice
   headless dan di luar lingkup.
7. **XLSX penuh** — satu sheet, tanpa formula dieksekusi, tanpa macro/pivot; tipe
   sel kaya belum dijamin sampai renderer diuji.
8. **Template tanpa batas** — tiga template, bukan sistem template pengguna.
9. **Dokumentasi tool yang lengkap** — hanya tool yang benar-benar terpasang;
   `compute`/`web.search`/`web.read` sebagai rencana sampai terdaftar.
10. **Agent yang lebih pintar dari model** — hari ini perbedaan agent hanya prompt,
    model default, dan deadline; "agent bisa browsing" palsu sebelum FIX-09/17.
11. **Penegakan `maxSteps`** sebelum tool loop ada.
12. **Kuota token sebagai billing** — batas operasional, bukan tagihan; usage tak
    dilaporkan tidak dihitung.
13. **Ingatan tanpa batas, halusinasi nol, determinisme lintas provider, E2EE saat
    server mendekripsi untuk model** (02-rencana-implementasi.md §8 tetap berlaku).
14. **Multi-agent/swarm** — FIX-22 tidak disentuh; tanpa manfaat terukur, requirement
    bantuan model dipenuhi mode review terbatas.
15. **Jadwal tepat-detik** (FIX-21) dan **identitas dari wajah/suara** (FIX-16).
16. **Gate live tanpa sumber daya** (PostgreSQL, Docker, sandbox runtime, SMTP,
    OAuth) dicatat `blocked_external`, tidak dianggap lulus.

---

## 11. Gerbang persetujuan pemilik

Rencana ini **belum dieksekusi**. Sebelum tahap pertama:

1. Pemilik menyetujui §0 dan §10.
2. Pemilik memilih jalur mulai: **D0 lebih dulu (disarankan)** atau **P1 lebih dulu**.
3. Kapten mengonfirmasi penempatan berkas terhadap pekerjaan FIX-17..24 yang
   sedang berjalan (khususnya `src/lib/tools/app.ts` dan `src/lib/tasks/run.ts`).
4. Setelah itu setiap tahap dibuka sebagai WP terpisah dengan bukti penerimaan
   tahapnya sendiri; tidak ada WP yang menggabungkan dokumen + plugin + agent.

---

## 12. Catatan keadaan saat rencana ditulis (2026-10-23)

Diverifikasi dari worktree, bukan klaim:

- **D0a/D0b/D0c sudah tampak dikerjakan di luar tim ini** saat rencana ini ditulis
  (perubahan belum commit pada `src/lib/artifacts/zip.ts`, `convert.ts`,
  `render-binary.ts`). Untuk D0a–D0c artinya **verifikasi + bukti penerimaan**,
  bukan mengulang dari nol. `npx vitest run src/lib/artifacts` lulus saat dicatat
  (3 berkas, 38 tes) — gate penuh (`tsc`/`eslint`/`npm test`/`build`) tetap wajib.
- `src/lib/tools/app.ts` + `app.test.ts` (FIX-19) ada sebagai berkas untracked
  milik pekerjaan kapten. P1 wajib mendaftarkannya **setelah** FIX-19 mendarat.
- Tidak ada paket baru terpasang dan tidak ada migrasi baru. Gate dasar terakhir di
  `STATUS.md` masih hijau, tetapi setiap tahap wajib menjalankan gate sendiri:
  status lama bukan bukti untuk tahap baru.
- Risiko tabrakan berkas adalah risiko **nyata**, bukan teoretis: satu WP per sesi dan
  G0 harus dikonfirmasi kapten sebelum tahap pertama dibuka.

