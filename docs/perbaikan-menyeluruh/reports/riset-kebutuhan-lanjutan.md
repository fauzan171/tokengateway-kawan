# Riset kebutuhan lanjutan: plugin, katalog agent, standar dokumen, dokumentasi tool

Tanggal: 2026-10-23. Penulis: riset (baca saja, tanpa ubah kode, tanpa commit).
Sumber baca: STATUS.md, 02-rencana-implementasi.md, 03-verifikasi.md,
tasks/agent-v1 README, 01-requirements-architecture.md, 04-execution-tools.md, plus recon kode
(sed -n/head/grep berskopa). Baseline: FIX-01..15 verified, FIX-16..24 planned.

Batas riset: web_search gagal (backend model 404, bukan kesimpulan tidak ada hasil);
web_fetch hanya konfirmasi URL hidup. Pola desain bertumpu pada kode repo + SDD sendiri.

---

## 1. Kondisi kode saat ini (yang SUDAH ada, bisa dipakai ulang)

### 1.1 Tool: dua tool, tanpa registry

- src/lib/chat/file-tool.ts (224 baris): GENERATE_FILE_TOOL, GENERATE_DOCUMENT_TOOL,
  CHAT_TOOLS berisi keduanya, assembleToolCalls (gabung fragment by index, JSON rusak jadi null),
  parseGenerateFileArgs / parseGenerateDocumentArgs (lempar ArtifactError berkode).
- src/lib/chat/generate.ts (1265 baris): kirim CHAT_TOOLS ke gateway bila toolsEnabled = true
  (baris 1008, HARDCODE, bukan dari capability/profil), loop SATU ronde, slice(0,3),
  unknown tool di-skip diam-diam, gagal tool tidak menggagalkan jawaban.
- Kontrak registry SDD-AG-4 (04-execution-tools.md): tipe ToolEffect read/local/write, ToolResult,
  ToolContext (userId/taskId/runId/stepId/signal/deadline/approvedDigest) BELUM diimplementasi;
  generate.ts dan src/lib/tasks/run.ts tidak memakainya. run.ts (379 baris) eksekutor satu
  putaran tanpa tool loop (kontrak disiapkan, FIX-09+).
- Tool deterministik FIX-15: src/lib/tools/compute.ts (calculate/describe/countText), chart.ts
  (SVG deklaratif), qr.ts (encode lalu decode ulang via jsqr), route POST /api/kawan/v1/tools/compute.
  Tanpa eval. Pola benar untuk semua tool hitung.
- src/app/api/kawan/v1/tools/ baru berisi compute. Belum ada konvensi src/lib/tools per-nama.

### 1.2 Capability gating (fondasi plugin dan katalog)

- GET /api/kawan/v1/capabilities (route.ts, 168 baris): boolean lama + objek per-capability
  state/reasonCode/checkedAt/requiresApproval. State: available/unconfigured/unsupported/
  temporarily_unavailable/permission_required/unknown. tools sudah requiresApproval=true.
  Aturan bukti benar: koneksi aktif milik user + capability yang DIUMUMKAN gateway;
  belum diprobe jadi unknown, bukan false.
- Yang BELUM: toolsEnabled hardcode (tidak baca capability), belum ada capability per-tool
  (mis. webRead, codeExecution seperti contoh JSON di 02 section 3.1),
  belum ada tools per-agent/per-task.

### 1.3 Dokumen: DocSchema kanonik SUDAH ada

- src/lib/artifacts/document.ts (67 baris): DocSchema = title + blocks, blok heading / paragraph /
  bullets / table / code; parseDocSchema clip teks 20000 char, maks 500 blok, blok tak dikenal
  di-skip. Ini skema kanonik yang diminta keinginan pemilik, tinggal diperluas.
- Renderer: render.ts + render-binary.ts (renderPdfBytes/DocxBytes/XlsxBytes/PptxBytes), format.ts
  (MIME, batas 25 MiB, sanitizeDisplayName), create.ts, zip.ts (slip/bomb/symlink/duplikat).
  CSV formula-injection dinetralkan prefix kutip di render.ts.
- Ekspor chat: src/lib/chat/document-export.ts (exportChatPdf/Docx/XlsxBytes).
  Pola transkrip-menjadi-dokumen sudah jalan.
- Deps SUDAH terpasang: pdfkit, exceljs, docx, pptxgenjs, decimal.js, qrcode, jsqr, undici.
  BELUM ada: zod, sharp, mammoth (hanya rencana di 02 section 2).
- Yang BELUM ala Claude web UI: XLSX typed cells (angka/tanggal, cek renderXlsxBytes dulu),
  multi-sheet, header/footer, kop, daftar isi, nomor halaman, preset tema standar.

### 1.4 Cikal katalog agent (tersebar, belum bernama begitu)

- Prompt tersimpan: src/lib/prompts/prompts.ts + variables.ts (variabel curly-isi), model Prompt
  (userId null = bawaan, hanya terlihat bila enabled), API /prompts dan /prompts/promptId,
  UI src/components/prompt-picker.tsx. Ini 60 persen kebutuhan pilih-agent-lalu-jalan.
  Kurang: bundel prompt + tools + model + batas.
- System prompt per chat: src/lib/chat/system-prompt.ts (154 baris, role system seq 0) dengan celah
  integrasi yang diakui file itu sendiri (getChat/runGeneration belum filter/kirim).
- Task agent: model Task/TaskRun/TaskMessage/TaskEvent/TaskInteraction, lib tasks.ts (686 baris)
  + run.ts, UI task-view.tsx.
- FIX-19 (tools aplikasi via service, bukan HTTP localhost) dan FIX-13 (memory scope/category/consent)
  adalah bahan personalisasi agent.

### 1.5 Pencarian web (keinginan pemilik no 1, sebagian ada)

- src/lib/search/web.ts (143 baris): readWebSearchConfig, webSearch, SearchError; FIX-10 verified:
  web.read (baca HTML/PDF via egress FIX-07, tanpa cookie/script) + provenance
  (fetchedAt/contentHash/reach) + verifikasi DOI via Crossref. Search = SearXNG operator.
- Dokumentasi tool untuk USER (daftar tool + kapan dipakai + contoh) BELUM ADA di repo maupun UI;
  dokumentasi yang ada adalah SDD untuk developer.

---

## 2. Kesenjangan

### (a) Plugin system yang aman: BELUM ADA, dan SDD membatasi bentuknya

Fakta kunci: 01-requirements-architecture.md baris 71: registry tools berisi definisi tervalidasi
dan executor; JANGAN membuat plugin loader arbitrer. Non-goals: tanpa plugin Python di server.
Jadi keinginan pemilik (komponen plugin DSH + skill rea) TIDAK BOLEH diartikan sebagai
menjalankan kode pihak ketiga di server Kawan.

Celah konkret:
1. Tidak ada registry: tidak ada src/lib/tools/registry.ts, tidak ada tipe
   name/schema/validator/handler/effect/timeout/byteCap/policy seperti amanat 02 section 3.2.
   Tool = konstanta tersebar (file-tool.ts, tools/compute.ts, search di generate.ts).
2. Tidak ada manifest: tidak ada format deklaratif id/version/tools/prompt yang bisa dibaca
   dan dicentang tanpa eksekusi kode.
3. Komponen DSH (deepseek-ai/deepseek-harness) adalah komponen UI/plugin untuk ekosistem DSH,
   bukan paket npm yang bisa di-import ke Next.js Kawan; butuh adaptor manual per komponen.
   Skill rea (morluto/rea) adalah prompt/skill teks. Bentuk satu-satunya yang aman dikonsumsi
   adalah sebagai data teks yang direview manusia lalu disimpan sebagai Prompt bawaan, bukan kode.
4. Approval: TaskInteraction approval (FIX-20) belum dibangun; tanpa itu plugin berefek-tulis
   tidak punya gerbang izin.

### (b) Katalog agent: fondasi 60 persen, bundel belum ada

Ada: prompt tersimpan + variabel + picker UI; system prompt per chat; Task + run satu putaran;
capability global. Belum: entitas Agent (id, nama, deskripsi, systemPrompt, allowedTools,
suggestedModel, batasOverride, builtIn); pilihan user tersimpan; run multi-langkah + tool loop
di task (FIX-09); capability per-agent (irisan: agent minta versus server sediakan).
Tanpa bundel, pilih-agent-lalu-jalan = prompt picker yang menyamar; tool dan batas tidak ikut berubah.

### (c) Standar dokumen PDF/Excel ala Claude: skema ada, standar presentasi belum

- DocSchema hanya 5 tipe blok; belum: gambar, page-break, catatan kaki, TOC, header/footer,
  multi-sheet XLSX, tipe sel (angka/tanggal), lebar kolom, freeze pane, kop/logo.
- Belum ada preset gaya (font/ukuran/warna/margin standar Kawan); setiap render pakai default
  library, hasil tidak konsisten antar format.
- Belum ada template surat/laporan: cover, daftar isi, tabel rapi, lampiran chat.
- XLSX input (exceljs, formula disimpan tanpa dieksekusi, FIX-14 verified) vs output
  (renderXlsxBytes) belum diuji round-trip untuk tipe sel kaya.

### (d) Dokumentasi tool: belum ada untuk user

- Tidak ada halaman/panel Tools di UI; tidak ada docs per tool (kapan dipakai, contoh argumen,
  batas, butuh approval); capability route tidak mendeskripsikan tool satu per satu.
- System prompt tidak memuat katalog tool yang benar-benar tersedia (FIX-10 memuat hasil web,
  bukan daftar tool), sehingga model tidak tahu tool apa yang bisa dipanggil kapan.

---

## 3. Usulan desain minimal (YAGNI)

Prinsip: manifest = data JSON, bukan kode. Semua yang dari luar (DSH/rea/komunitas) masuk sebagai
data berversi yang direview manusia; executor tetap kode milik repo yang sudah dites.
Satu baris = satu perubahan terkecil yang bisa diuji sendiri.

P1 Registry tool tertutup. BARU src/lib/tools/registry.ts (tipe SDD-AG-4 + list/validate/effectOf);
daftarkan 2 tool chat + compute + web.read. Tanpa ini semua plugin/katalog menempel di generate.ts
yang sudah 1265 baris. Dep baru: tidak. Risiko kecil (refactor pemindahan, dicover test existing).

P2 Manifest plugin deklaratif tanpa kode. BARU src/lib/plugins/manifest.ts (parse + validasi: id,
version, tools berisi name + parameters subset JSON-Schema + effect, prompts berisi title + body,
capabilityNeeds) + tabel Plugin (id, version, enabled, manifestJson). DSH/rea dikonsumsi sebagai
DATA berversi; install = simpan JSON + review manusia, bukan eval/import. Dep baru: tidak.
Risiko sedang: subset JSON-Schema harus dibekukan (hanya type/enum/required/properties).

P3 Pasang plugin = nyalakan tool yang SUDAH ada. registry + capabilities/route.ts: manifest hanya
boleh referensikan nama tool terdaftar; nama asing ditolak seperti unknown tool di SDD-AG-4.
Menutup lubang plugin-menambah-executor; skill rea = Prompt bawaan baru, bukan kode.
Dep baru: tidak. Risiko kecil, asal P1 selesai.

P4 Entitas Agent untuk katalog. Tabel AgentPreset (id, nama, deskripsi, systemPrompt, allowedTools,
suggestedModel, batasOverride, builtIn) + API CRUD + UI pilih-di-composer. Bundel terkecil yang
membuat pilih-lalu-jalan benar-benar mengubah perilaku, bukan label. Dep baru: tidak.
Risiko sedang: allowedTools irisan capability server wajib dihitung server, bukan klien.

P5 Agent eksekusi = Task existing. tasks/run.ts: tool loop SDD-AG-4 (serial, maks 2 koreksi per call)
ditambah approvedDigest dari P1. Tidak ada orchestrator kedua; chat tetap, task untuk kerja panjang
(amanat 02 section 1). Dep baru: tidak (FIX-17 menyusul untuk sandbox). Risiko sedang:
dibutuhkan FIX-09 selesai dulu.

P6 Perluasan DocSchema bertahap. document.ts: tambah image (ref artifactId, bukan base64), lalu
pageBreak, lalu sheet kedua dst untuk xlsx; tiap tipe + 1 renderer + 1 test reader independen.
Skema kanonik ada; tiap tipe blok teruji sendiri ala V12. Dep baru: tidak (sharp HANYA bila
resize butuh; mammoth HANYA bila docx-input butuh). Tolak blok html mentah karena XSS via renderer.

P7 Preset gaya dokumen Kawan. BARU src/lib/artifacts/theme.ts (font/margin/warna/ukuran standar,
1 objek) dipakai semua renderer. Konsistensi antar PDF/DOCX/XLSX tanpa framework template.
Dep baru: tidak (font Unicode berlisensi dicatat di inventaris FIX-24). Risiko kecil: pin 1 font
Latin + fallback; CJK/emoji = risiko fidelity yang diakui.

P8 Dokumentasi tool user-facing. BARU 5 file docs per tool (generate_file, generate_document, compute,
web.search, web.read) + panel UI read-only dari registry P1. Model + user membaca sumber yang SAMA
(registry ke docs ke system prompt), tidak ada drift janji. Dep baru: tidak. Risiko kecil; wajib
sebut batas + butuh-approval per tool.

P9 MCP eksternal bila perlu. Adapter klien MCP ke tool effect=read saja, allowlist host, tanpa
kredensial ke sandbox. MCP = protokol manifest+tool yang sudah standar; lebih aman dari format
sendiri bila perlu interop. Dep baru: sdk MCP HANYA saat ada 1 kebutuhan nyata (aturan 02 section 2:
tanpa framework umum sebelum 2 kebutuhan). TOLAK sampai P1-P3 jalan.

SENGAJA tidak diusulkan: framework plugin umum, SDK konektor umum, vector DB, Redis/queue eksternal,
billing, klaim E2E encryption.

---

## 4. Urutan kerja + dependency ke FIX berjalan

FIX-09 (tool loop task) -> P1 registry -> P2 manifest -> P3 pasang-tanpa-kode.
P2 -> P8 docs tool (bisa paralel dengan P2).
FIX-09 -> P5 agent-eksekusi -> P4 katalog UI (butuh P1 + P5).
FIX-11/12/14 (artifact/input, verified) -> P6 blok DocSchema -> P7 tema.
Sebelum P6 XLSX kaya: cek renderXlsxBytes untuk typed cells dulu.
FIX-20 (approval TaskInteraction) = prasyarat WAJIB sebelum manifest effect=write dipakai user.
FIX-17 (sandbox runner) = prasyarat WAJIB sebelum tool code.run / browser didaftarkan.
FIX-07 (egress, verified_fixture) sudah menaungi web.read/search; MCP (P9) menumpanginya.
FIX-18 (eval) mengukur klaim agent A lebih baik sebelum katalog membandingkan model.
FIX-24 (gate rilis, flag default off) = semua P dirilis behind-flag sampai V-gate lulus.

Aturan urut: P1, lalu P2+P8 paralel, lalu P3, lalu P4+P5 setelah FIX-09, lalu P6+P7 setelah cek
renderer. Tidak ada P yang boleh mendahului FIX-20 untuk efek tulis atau FIX-17 untuk eksekusi
kode. Itu bukan birokrasi, itu batas isolasi SDD-AG-5. Gate bukti ikut 03-verifikasi
(V09 tool loop, V12 dokumen, V17 isolasi, V20 approval).

---

## 5. Yang TIDAK boleh dijanjikan (batas keamanan dan kejujuran)

1. Plugin tidak boleh eval/import kode arbitrer. Manifest JSON + executor milik repo; skill luar =
   teks prompt yang direview, bukan program. (SDD: jangan membuat plugin loader arbitrer.)
2. Komponen DSH tidak dipasang sekali klik. Itu kode ekosistem lain; tiap komponen butuh adaptor +
   review + test di Kawan. Menjanjikan kompatibilitas penuh = bohong.
3. Tidak ada ingatan tanpa batas / halusinasi nol / determinisme lintas provider (02 section 8;
   tetap berlaku untuk agent katalog).
4. Agent tidak menambah capability. allowedTools adalah subset yang diminta; server menentukan
   available via probe. Pilihan user tidak menyalakan sandbox/konektor yang belum lulus gate.
5. Dokumen seperti Claude = struktur rapi, bukan piksel-identik. Fidelity layout (CJK, emoji, tabel
   panjang, font hilang) diakui sebagai risiko sisa V12; tidak ada janji DOCX versus PDF identik.
6. Formula XLSX tidak dieksekusi (disimpan sebagai teks, dinetralkan seperti CSV); macro/URL
   eksternal tidak dijalankan. Standar dokumen Kawan adalah statis-aman.
7. Approval tidak bisa dari model/tool output (02 section 3.2, FIX-20): diam bukan izin; digest
   berubah = approval hangus; send/pay ganda dicegah idempotensi.
8. Jadwal/alarm tidak tepat-detik saat perangkat mati (FIX-21); suara bukan identitas
   (diarization A/B, tanpa voiceprint, FIX-16).
9. Ekspor/hapus mengikuti retention + deletion ledger (FIX-23); tidak ada klaim E2EE ketika server
   mendekripsi untuk model.

---

## Sumber

Repo: STATUS.md, 02-rencana-implementasi.md, 03-verifikasi.md,
tasks/agent-v1/01-requirements-architecture.md, 04-execution-tools.md, tasks/agent-v1/README.md.
Kode: file-tool.ts, generate.ts, tasks/run.ts, artifacts document/render/render-binary/format.ts,
tools compute/chart/qr.ts, capabilities dan tools/compute dan prompts route.ts, lib prompts.
Eksternal (keterbacaan terbatas, URL hidup saat dikunjungi):
- https://modelcontextprotocol.io/docs/learn/server-concepts (pola tool/capability MCP).
- https://github.com/exceljs/exceljs (API workbook/sheet/cell renderer).
- https://pdfkit.org/docs/getting_started.html (503 saat dikunjungi; referensi renderer PDF).
- https://github.com/deepseek-ai/deepseek-harness (sumber komponen plugin DSH, ekosistem DSH).
- https://github.com/morluto/rea (sumber skill teks; konsumsi sebagai data prompt, bukan kode).
Isi halaman di atas tidak dapat diekstrak penuh (shell JS / 503); pola desain laporan ini
mengandalkan kontrak SDD repo sendiri. Verifikasi API/library resmi versi terpasang wajib saat
implementasi (amanat SDD).
