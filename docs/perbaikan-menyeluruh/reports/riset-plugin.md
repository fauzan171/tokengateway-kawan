# Riset plugin system aman (DSH + skill rea)

Tanggal: 2026-10-23. Penulis: riset-plugin. Bahasa: Indonesia.
Lingkup baca: `src/lib/tools/` (compute.ts, chart.ts, qr.ts), `src/lib/chat/file-tool.ts`,
`src/app/api/kawan/v1/capabilities/route.ts`, wiring `src/lib/chat/generate.ts`,
`prisma/schema.prisma` (model Prompt), referensi DSH terpasang
(`@deepseek-ai/dsh-plugin-manager`, `dsh-tools`, `dsh-package-manifest`,
`dsh-skill`, `dsh-skill-filesystem`, `dsh-tool-skill`,
`dsh-agent-preset(-registry)`), skill lokal `agent-reach`,
plus SDD (`tasks/agent-v1/04-execution-tools.md`,
`tasks/agent-v1/01-requirements-architecture.md`) dan rencana
`docs/perbaikan-menyeluruh/02-rencana-implementasi.md`.
Batasan: web_search gagal (model backend 404); web_fetch hanya konfirmasi URL hidup
(github.com/morluto/rea, github.com/deepseek-ai/deepseek-harness).
Tanpa ubah kode selain file laporan ini.

> Ringkasan satu paragraf: Kawan TIDAK butuh plugin loader arbitrer.
> Yang dibutuhkan adalah **registry tool tertutup + manifest JSON deklaratif
> tanpa kode + katalog skill teks**. Executor tetap kode milik repo yang
> sudah dites. DSH dan skill rea hanya dikonsumsi sebagai **pola dan data**,
> bukan runtime yang diimpor. Tanpa FIX-20 (approval) dan FIX-17 (sandbox),
> plugin berefek-tulis dan code/browser tidak boleh dinyalakan.

---

## 1. Yang bisa dipakai ulang (existing, terbukti di repo)

### 1.1 Pola definisi tool aman — `src/lib/chat/file-tool.ts`

- Bentuk tool = objek data `{ type: "function", function: { name, description, parameters } }`
  (contoh: `GENERATE_FILE_TOOL`, `GENERATE_DOCUMENT_TOOL`), dikirim ke gateway sebagai
  `CHAT_TOOLS`. Ini pola yang benar: tool dideklarasikan sebagai data + skema, bukan kode.
- Validator terpisah dan berkode: `parseGenerateFileArgs` / `parseGenerateDocumentArgs`
  melempar `ArtifactError("INVALID_TOOL_ARGS")`. DocSchema invalid dari model dipetakan
  ulang ke `INVALID_TOOL_ARGS`, bukan error internal. Pola ini dipakai ulang untuk semua
  tool baru: definisi skema + fungsi parse yang mengembalikan union sempit per format.
- `assembleToolCalls`: gabung fragmen streaming per index, entri tanpa nama dibuang,
  JSON rusak jadi `arguments: null` tanpa menggagalkan stream. Siap dipakai ulang untuk
  tool loop multi-langkah (amanat SDD-AG-4 langkah 4).

### 1.2 Wiring gateway — `src/lib/chat/generate.ts`

- Fakta: `const toolsEnabled = true` (baris ~1008, HARDCODE) lalu
  `...(toolsEnabled ? { tools: CHAT_TOOLS } : {})` (~1065). Loop SATU ronde,
  `slice(0,3)`, tool asing di-skip diam-diam, gagal tool tidak menggagalkan jawaban.
- Yang dipinjam: titik pasang registry ada (satu tempat kirim tools, satu tempat dispatch).
  Yang TIDAK boleh dipertahankan: hardcode `true` (harus baca capability),
  skip-diam (harus jadi error terstruktur `UNKNOWN_TOOL` ke model), satu ronde
  (kontrak SDD-AG-4: serial, maks 2 koreksi per call).

### 1.3 Tool deterministik FIX-15 — pola executor yang benar

- `src/lib/tools/compute.ts`: operand **string desimal** + `decimal.js`, batas eksplisit
  (`maxOperandChars 40`, `maxOperandDigits 30`, `maxExponent 1000`, `maxOperations 200`),
  regex hanya desimal/ilmiah, tanpa `eval`/`Function`/shell/SQL. Pembulatan mengembalikan
  `rule` agar pembaca tahu aturannya.
- `src/lib/tools/chart.ts`: SVG deklaratif dari data tervalidasi, escape XML semua label,
  tanpa `<script>`/`on*`/`xlink:href`, plus tabel alternatif untuk pembaca layar.
- `src/lib/tools/qr.ts`: encode lalu **decode ulang via decoder independen (jsqr)**;
  mismatch ditolak. Barcode 1D tanpa encoder/decoder terverifikasi dijawab
  `UNSUPPORTED_SYMBOLOGY`, bukan gambar karangan.
- Route `POST /api/kawan/v1/tools/compute`: model tidak menghitung, ia memanggil endpoint.
  Ketiga file ini adalah template "tool aman Kawan": data-masuk tervalidasi → hitung
  deterministik → hasil terstruktur → batas eksplisit.

### 1.4 Capability gating — `capabilities/route.ts`

- Bentuk respons aditif: boolean lama + objek `capabilities` berisi
  `state/reasonCode/checkedAt/requiresApproval`.
- Aturan bukti yang benar dan WAJIB dipertahankan untuk plugin:
  state hanya dari **koneksi aktif milik user + capability yang DIUMUMKAN gateway**;
  belum diprobe = `unknown`, bukan `false`; boolean lama diturunkan dari state.
- `tools` sudah `requiresApproval: true`. Ini fondasi izin plugin: belum ada gerbangnya
  (FIX-20 planned), tapi benderanya sudah benar.

### 1.5 Model Prompt — pola katalog teks

- `prisma/schema.prisma` model `Prompt` (`userId null` = bawaan, hanya terlihat bila
  `enabled`) + `src/lib/prompts/prompts.ts` (filter hapus per userId, variabel
  `{{isi}}`). Ini 60% kebutuhan katalog: skill rea dan prompt plugin DSH masuk lewat
  jalur ini sebagai **data teks berversi yang direview**, bukan kode.

### 1.6 Kontrak SDD-AG-4 yang mengikat (belum implementasi, tapi desain ikut ini)

- `tasks/agent-v1/04-execution-tools.md`: tipe `ToolEffect = read|local|write`,
  `ToolResult`, `ToolContext (userId/taskId/runId/stepId/signal/deadline/approvedDigest)`;
  registry memasangkan nama/schema/validator/executor di server; dispatch setelah intent
  persisten; panggilan awal serial; nama asing ditolak (tidak diubah jadi shell);
  tools browser/code hanya diregistrasi bila capability server + gate runtime lulus.
- `01-requirements-architecture.md` baris 71: registry berisi definisi tervalidasi dan
  executor; **jangan membuat plugin loader arbitrer**. Non-goal: plugin Python di server.

---

## 2. Referensi DSH + skill rea: yang dipinjam polanya, bukan runtimenya

Sumber: paket DSH yang terpasang di
`/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/` (dibaca langsung,
bukan dari blog). Prinsip: baca kontrak paket, salin idenya dalam bentuk minimal Kawan.

### 2.1 `dsh-tools` — registry + pipeline eksekusi (dipinjam polanya)

- `defineTool({ name, description, parameters, output, execute })`: argumen model
  divalidasi sebelum eksekusi; invalid = error result biasa, bukan crash.
- Registry berlapis + proyeksi skema per agen: `ctx.tools.register()`,
  `restrict(filter)` (mask allow/deny beririsan), `schemas(scope)` tanpa `execute`.
  Model hanya melihat name/description/schema — `execute` tidak pernah ke wire.
- Pipeline tetap: `tools/pre-execute` (allow/deny/ask) → guard monotonik →
  `tools/execute` (timeout/retry) → `tools/post-execute` → `tools/result` (observe-only).
  Tool tak dikenal = `UNKNOWN_TOOL` terstruktur, turn tidak mati.
  Pembatalan kooperatif via `exec.signal` yang wajib diobservasi tool.
- Yang dipakai ulang di Kawan: urutan pipeline ini + aturan "skema ke model, executor
  tetap di server" + `UNKNOWN_TOOL` eksplisit. Yang TIDAK dibawa: framework Cordis,
  mode PTC/`run_code`, SDK generation.

### 2.2 `dsh-package-manifest` — format deklaratif (dipinjam bentuknya)

- Tipe: `DshPackageManifest { name, version, description?, icon?, engines?, dsh? }`,
  `DshManifest { manifestVersion?: 1, bundle?: { patch }, client? }`,
  `engines.dsh` rentang SemVer eksak. Tiap reader punya validasi + default sendiri.
- Pelajaran untuk Kawan: manifest = **versi format + identitas + patch deklaratif**,
  bukan kode. Manifest Kawan harus punya `manifestVersion` sendiri (angka 1) yang
  independen dari versi paket/app, persis seperti DSH memisahkan keduanya.

### 2.3 `dsh-plugin-manager` — instalasi dan izin (dipinjam kebijakannya, bukan mekanismenya)

- `inspect(spec)` SEBELUM install (registry/`pnpm view`, path, git, tarball);
  jawaban: nama/versi/bundle atau `problem: invalid-spec | already-installed |
  not-found | not-a-package | not-a-bundle | network | unknown`.
- Compat check sebelum unduh: range `engines`/peer yang tak cocok ditolak sebelum
  pnpm jalan; exemption hanya untuk pasangan eksak `package@version` + runtime eksak
  + `--accept-risk` eksplisit; tidak mewarisi antar versi.
- Build-script approval terpisah (`allowBuilds` per nama paket, ditolak YAML anchor);
  Web menyetujui grup yang ditampilkan, tool menyetujui atas nama user setelah user
  menyetujui di percakapan. Gagal install = restore `package.json`+lockfile snapshot.
- Perbedaan arsitektur yang menentukan: DSH memasang Host code **in-process di luar
  workspace sandbox** (butuh pnpm + lock + HMR/recomposition). Kawan adalah Next.js
  modular monolit + tabel relasional (SDD-01/ADR), tanpa isolasi proses untuk kode
  pihak ketiga. Maka mekanisme install-then-execute DSH **dilarang** di Kawan;
  yang dibawa hanya kebijakannya: inspect-dulu, tolak-inkompatibel-dulu,
  approval-skrip-terpisah, restore-saat-gagal.

### 2.4 `dsh-skill` + `dsh-skill-filesystem` + `dsh-tool-skill` — katalog skill (dipinjam polanya)

- Registry satu katalog gabungan dari banyak provider; provider gagal = dilewati,
  konsumen pakai last-good. Load on-demand per nama kebab-case eksak; nama invalid
  = no skill, bukan throw.
- Format skill diskrit: direktori `<name>/SKILL.md` atau flat `<name>.md`,
  frontmatter wajib `name`+`description`, opsional `whenToUse`,
  `disable-model-invocation`, `user-invocable`. Nilai boolean nonstandar =
  drop skill + warning, bukan izin diam-diam. Discovery (frontmatter) dan load (body)
  punya lifecycle terpisah; edit body tanpa versioning.
- Konsumen model: katalog durable per sesi (nama + deskripsi capped) + tool loader
  `skill` + gesture eksplisit `/nama`; perubahan katalog = replacement lengkap,
  katalog kosong = pensiunkan nama lama. Anti-double-load: ikuti blok yang sudah
  diinjeksi, jangan load ulang dari ringkasan.
- Contoh lokal sejalan: `agent-reach` (`SKILL.md` + envelope hasil seragam +
  `doctor` bila channel gagal). Format ini cukup untuk skill rea.

### 2.5 `dsh-agent-preset(-registry)` — katalog agen (dipinjam idenya)

- Preset = baris deklaratif biasa (id, plugins/tools, prompt sections, skills);
  definisi gagal tetap terlihat; sesi lama pegang komposisi yang sudah dipakai;
  default per deployment + pilihan user tersimpan (`selectedDefault`).
- Pelajaran: katalog agen Kawan = tabel + pilihan tersimpan, bukan direktori scan.
  Definisi baru/override = patch berversi yang direview (analog `"insert"` bundle
  via `plugin_manager`), bukan file yang di-drop lalu auto-execute.

### 2.6 Skill rea (morluto/rea) — status temuan

- URL hidup saat dikunjungi (HTTP 200), tapi isi halaman tidak bisa diekstrak penuh
  (shell JS). Tidak ada klaim struktur internal yang bisa diverifikasi dari sini.
- Keputusan desain tetap: perlakukan rea sebagai **sumber teks skill** (setara satu
  atau beberapa `SKILL.md`), konsumsi via **vendoring + review manusia + simpan
  sebagai Prompt bawaan**. Bukan fetch saat runtime, bukan submodule auto-update,
  bukan eksekusi.

---

## 3. Kesenjangan (yang belum ada di Kawan)

1. **Tidak ada registry tool.** Tidak ada `src/lib/tools/registry.ts`; tidak ada tipe
   `name/schema/validator/handler/effect/timeout/byteCap` seperti amanat 02 §3.2.
   Tool tersebar: konstanta di `file-tool.ts`, modul `tools/compute.ts`,
   search di `generate.ts`. Akibat: setiap tool baru menempel di `generate.ts`
   yang sudah ±1265 baris.
2. **Tidak ada manifest plugin.** Tidak ada format deklaratif
   `id/version/tools/prompts/capabilityNeeds` yang bisa dibaca dan dicentang tanpa
   eksekusi kode.
3. **Gating belum tersambung.** `toolsEnabled` hardcode `true`; capability global
   tidak dibaca; belum ada capability per-tool (mis. `webRead`, `codeExecution`);
   belum ada irisan "agen meminta vs server menyediakan".
4. **Approval belum ada** (FIX-20 planned). Tanpa interaction approval, manifest
   dengan `effect: write` tidak punya gerbang izin.
5. **Sandbox belum ada** (FIX-17 planned). Tanpa runner terisolasi, `code.run` /
   browser tidak boleh diregistrasi (amanat SDD-AG-4).
6. **Dokumentasi tool user-facing belum ada** (tugas tim riset lain). Tidak ada halaman
   Tools, tidak ada docs per tool; system prompt tidak memuat katalog tool aktual.

---

## 4. Usulan desain minimal (YAGNI)

Prinsip pengunci: **manifest = data JSON, bukan kode. Semua yang dari luar
(DSH/rea/komunitas) masuk sebagai data berversi yang direview manusia; executor
tetap kode milik repo yang sudah dites.** Satu baris = satu perubahan terkecil
yang bisa diuji sendiri.

### P1 — Registry tool tertutup (fondasi semua)

- BARU `src/lib/tools/registry.ts`: tipe SDD-AG-4 (`ToolEffect`, `ToolResult`,
  `ToolContext`) + `{ name, description, parameters, effect, validator, handler,
  timeoutMs, byteCap }` + fungsi `list/validate/effectOf`.
- Daftarkan yang SUDAH ada dulu: 2 tool chat + `calculate/describe/countText` +
  `web.read`. Tanpa ini semua plugin/katalog menempel di `generate.ts`.
- Dep baru: tidak. Risiko: kecil (refactor pemindahan, dicover test existing).

### P2 — Manifest plugin deklaratif tanpa kode

- BARU `src/lib/plugins/manifest.ts`: fungsi `parse + validate` untuk:
  `{ manifestVersion: 1, id (kebab-case), version (semver), displayName,
  description, tools[] { name, parameters?: subset, effect }, prompts[] { title, body },
  capabilityNeeds[] }`.
- Subset JSON-Schema yang dibekukan: hanya `type/enum/required/properties/items`.
  Di luar itu ditolak (zona "nanti": `oneOf/allOf/$ref`).
- BARU tabel `Plugin (id, version, enabled, manifestJson, sha256, installedBy,
  installedAt)`. Install = simpan JSON + hash + reviewer, bukan eval/import.
  Update = baris baru berversi, bukan mutasi diam-diam.
- Dep baru: tidak. Risiko: sedang (subset schema harus dibekukan sejak awal;
  buka celah `$ref` = buka lubang SSRF/logic).

### P3 — Pasang plugin = nyalakan tool yang SUDAH ada

- Manifest hanya boleh mereferensikan **nama tool terdaftar di P1**; nama asing
  ditolak seperti `UNKNOWN_TOOL` di SDD-AG-4 (tidak diubah jadi shell).
- Perluas `capabilities/route.ts`: sediakan ketersediaan **per-tool** dari bukti
  yang sama (koneksi aktif + pengumuman gateway + gate FIX-17/20);
  `requiresApproval` diturunkan dari `effect`, bukan ditulis tangan per tool.
- Skill rea = N baris Prompt bawaan (`userId null, enabled`), bukan executor.
- Dep baru: tidak. Risiko: kecil bila P1 selesai; sedang bila P1 dilewati.

### Yang SENGAJA tidak diusulkan

Framework plugin umum, SDK konektor umum, auto-install dari URL/git/tarball,
eksekusi build script pihak ketiga, vector DB/Redis khusus plugin, billing,
klaim E2E. MCP eksternal (klien read-only + allowlist host) minimal ditolak
sampai P1–P3 jalan dan ada 1 kebutuhan nyata (aturan 02 §2).

---

## 5. Modul baru / berubah, dependency, risiko

| ID | Baru / berubah | Dependency baru | Risiko + mitigasi |
|---|---|---|---|
| P1 | BARU `registry.ts`; UBAH `file-tool.ts`, `generate.ts`, route compute | tidak | Kecil. Mitigasi: pindahkan tanpa ubah perilaku; test existing + 1 test registry (unknown ditolak, invalid jadi error terstruktur) |
| P2 | BARU `plugins/manifest.ts` + tabel `Plugin`; migrasi additive dua provider (wajib `node scripts/check-migrations.mjs` + `npm run db:generate`) | tidak | Sedang. Mitigasi: bekukan subset schema; tolak `$ref/oneOf/allOf`; simpan `sha256` manifest; butuh review manusia sebelum `enabled=true` |
| P3 | UBAH `capabilities/route.ts` + wiring `generate.ts` (baca registry + capability, bukan hardcode) | tidak | Kecil–sedang. Mitigasi: iris `allowedTools ∩ serverAvailable` di server, bukan klien; tanpa FIX-20, tolak semua `effect: write` dari manifest |
| DSH | Tidak diimpor; hanya pola yang disalin (pipeline, manifestVersion, inspect-dulu, katalog skill, preset deklaratif) | tidak (L ARANG tambah dep DSH/Cordis) | Besar bila dilanggar (membawa runtime in-process + pnpm + HMR ke Next monolit). Mitigasi: larangan di §6 butir 2–3 |
| rea | Vendoring teks → Prompt bawaan; tidak ada fetch runtime | tidak | Kecil bila via review; besar bila auto-sync. Mitigasi: pin hash + reviewer + `enabled` flag |

Urutan: P1 → P2 (+ docs tool paralel) → P3. P3 efek-tulis menunggu FIX-20;
tool code/browser menunggu FIX-17. Itu batas isolasi SDD-AG-5, bukan birokrasi.

---

## 6. Larangan keamanan (non-negotiable)

1. **Tidak ada eval/remote-code.** Dilarang: `eval`, `new Function`, `vm`,
   `child_process`, shell, impor dinamis dari path/URL manifest, fetch kode saat
   runtime, auto-install dari URL/git/tarball, build script pihak ketiga.
2. **Tidak ada impor runtime DSH.** Dilarang menambahkan dependensi
   `@deepseek-ai/*`/Cordis/pnpm-manager/HMR ke Kawan. DSH hanya referensi pola.
   Komponen DSH dipasang per komponen via **adaptor manual + review + test**,
   tidak pernah sekali-klik. Menjanjikan kompatibilitas penuh = bohong.
3. **Plugin tidak menambah executor.** Manifest yang mereferensikan tool tak dikenal
   ditolak; tidak ada fallback ke shell/Python/browser. Skill luar = teks prompt
   yang direview, bukan program. (SDD: jangan membuat plugin loader arbitrer;
   non-goal: tanpa plugin Python di server.)
4. **Validasi di server, bukan klien.** Semua parse manifest, irisan capability,
   dan keputusan approval di server. Klien hanya membaca state.
5. **Approval tidak bisa dari model/tool output** (02 §3.2, FIX-20): diam bukan izin;
   digest berubah = approval hangus; aksi sensitif (send/pay) butuh idempotensi.
   Tanpa FIX-20: tolak manifest `effect: write`.
6. **Tanpa sandbox, tanpa eksekusi.** Tanpa FIX-17: tidak ada registrasi
   `code.run`/browser; paket Python/JS bawaan hanya via template build operator,
   bukan perintah model. Kredensial/secret tidak pernah ke plugin; egress ikut
   policy FIX-07 (DNS pin, allowlist, batas byte/redirect, tanpa cookie/script).
7. **Dokumen/artefak statis-aman.** Tolak blok HTML mentah (XSS via renderer);
   formula XLSX/CSV disimpan sebagai teks dan dinetralkan, tidak dieksekusi;
   macro/URL eksternal tidak dijalankan.
8. **Klaim jujur.** Tidak ada janji: ingatan tanpa batas, halusinasi nol,
   determinisme lintas provider, kompatibilitas DSH penuh, fidelity piksel-identik
   antar format, E2EE saat server mendekripsi untuk model, jadwal tepat-detik saat
   perangkat mati, suara sebagai identitas.

---

## Sumber

- Repo: `src/lib/tools/compute.ts`, `chart.ts`, `qr.ts`;
  `src/lib/chat/file-tool.ts`, `generate.ts` (~1008, ~1065);
  `src/app/api/kawan/v1/capabilities/route.ts`;
  `src/app/api/kawan/v1/tools/compute/route.ts`; `src/lib/prompts/prompts.ts`;
  `src/lib/artifacts/document.ts`; `prisma/schema.prisma` (Prompt);
  skill lokal `agent-reach/SKILL.md`.
- DSH terpasang: `dsh-tools`, `dsh-package-manifest/lib/types/types.d.ts`,
  `dsh-plugin-manager`, `dsh-skill`, `dsh-skill-filesystem`,
  `dsh-tool-skill`, `dsh-agent-preset(-registry)`, `dsh-authorization` READMEs.
- SDD: `tasks/agent-v1/04-execution-tools.md` (kontrak registry/pipeline/batas),
  `01-requirements-architecture.md:71` (larangan loader arbitrer);
  `docs/perbaikan-menyeluruh/02-rencana-implementasi.md` (§3.1/§3.2, FIX-17/20).
- Eksternal (URL hidup, isi tidak terekstrak penuh):
  <https://github.com/deepseek-ai/deepseek-harness>,
  <https://github.com/morluto/rea>.
