# Riset iteratif, analisis data, evaluasi Kawan

Tanggal pemeriksaan: 24 Oktober 2026 UTC. Baseline kode `027e17d`. Status: **rancangan untuk persetujuan; bukan implementasi atau bukti kesiapan produksi**. Scope hanya riset web, inspeksi file, perhitungan, sandbox analisis, provenance, evaluasi. Tidak mengubah source, secret, konfigurasi atau deployment.

## 1. Kesimpulan dan prioritas

1. **P0: sambungkan kemampuan yang sudah ada**, bukan menambah framework agen. SearXNG, pembaca HTML/PDF, ExcelJS, decimal.js, registry tertutup dan pencatatan sumber dapat digunakan kembali. Task runner masih satu putaran model; keberadaan handler bukan bukti loop riset berjalan.
2. **P0: inspeksi file bounded dan kontrak bukti.** Model melihat metadata, sampel dan rentang terpilih, bukan seluruh workbook. Semua angka hasil analisis berasal dari tool deterministik; setiap angka mempunyai sumber sel/baris/halaman, aturan transformasi, unit dan perlakuan nilai kosong.
3. **P0: tutup gap resource/provenance sebelum memperluas input.** Limit sesudah `arrayBuffer()`/load workbook bukan batas memori; hasil terpotong wajib eksplisit. Label “eksak” tidak tepat untuk semua operasi Decimal berpresisi terbatas.
4. **P1: Python/JavaScript hanya setelah gate sandbox live.** Kalkulator enum bukan arbitrary-code execution. Tidak menyediakan fallback eksekusi host saat provider mati. Adapter E2B saat ini belum membuktikan enforcement network/CPU/memori.
5. **P1: evaluasi berlapis fixture dan live.** Sitasi valid tidak otomatis berarti klaim didukung. Tidak menjanjikan nol halusinasi; target keamanan berlaku pada suite terdefinisi, bukan jaminan universal.

## 2. Bukti kode aktual, bukan status dokumen lama

Dokumen [STATUS](../../../tasks/agent-v1/STATUS.md) bertanggal 17 Oktober masih menyatakan implementasi belum dimulai; gunakan pembacaan kode berikut untuk baseline saat ini. Aturan produk/isolasi tetap mengikuti [scope aktif](../../../tasks/ACTIVE-SCOPE.md#L91-L128).

| Area | Bukti aktual | Implikasi / gap |
|---|---|---|
| Dependency | [manifest](../../../package.json#L20-L52): decimal.js, exceljs, pdf-parse, undici tersedia. Versi lokal terbaca decimal.js 10.6.0, exceljs 4.4.0, pdf-parse 2.4.5 | Tidak perlu pandas, SymPy, vector DB atau framework baru untuk MVP. Versi terpasang tidak berarti parser aman tanpa cap |
| Pencarian | [webSearch](../../../src/lib/search/web.ts#L88-L158): SearXNG, default 5 hasil, timeout default 8 detik, snippet 300 karakter | Satu query per fungsi; wrapper batch 2–4 query belum ada. Validasi `options.limit`, byte cap respons dan penggabungan abort+timeout perlu ditutup |
| Baca sumber | [readSource](../../../src/lib/sources/read.ts#L121-L204): HTML/plain/PDF, SHA-256 bytes, waktu, URL final; enrich default dua halaman | `arrayBuffer()` mendahului cek 2 MiB; 200.000 karakter dipotong tanpa flag eksplisit. PDF flattened kehilangan locator halaman pada hasil web |
| Prompt sumber | [buildSearchSystem](../../../src/lib/search/prompt.ts#L69-L104): penanda S1, status blocked/dead, 6.000 karakter per sumber | Konten sumber dirangkai sebagai system text; ubah pemisahan trust dan jangan mengandalkan instruksi prompt sebagai kontrol keamanan |
| SSRF | [policy](../../../src/lib/net/policy.ts#L1-L36): resolve+pinned dispatcher, HTTPS default, redirect lintas-host ditolak | Reuse jalur ini; jangan menambah fetch bebas. Tetap perlu cap streaming di pemanggil |
| File | [extractText](../../../src/lib/documents/extract.ts#L121-L170): magic/MIME; PDF text per halaman; [OCR_UNAVAILABLE](../../../src/lib/documents/extract.ts#L60-L82) | OCR tidak tersedia, jangan menebak angka pada scan; CSV/JSON belum jadi parser tabular tersendiri |
| Excel | [extractXlsx](../../../src/lib/documents/office.ts#L130-L181): ExcelJS, sheet/address/formula; 50 sheet, 20.000 cell metadata | Workbook seluruhnya dimuat lebih dahulu; `lines` tetap dibangun setelah cap cell. Komentar menjanjikan cache formula terpisah, implementasi hanya menyimpan teks formula saat formula ada. Tidak boleh menganggap cache hasil telah tersedia |
| Kalkulator | [compute](../../../src/lib/tools/compute.ts#L14-L205): enum op, operand string, batas digit/eksponen, tanpa eval | `plain()` mengklaim eksak dan `rounded:false`; `1/3` nyata 20 digit signifikan. Presisi/mode harus dicatat dan label diperbaiki sebelum klaim eksak umum |
| Registry | [ToolResult/Context](../../../src/lib/tools/registry.ts#L50-L79), [compute entries](../../../src/lib/tools/registry.ts#L543-L592) | Return helper `ok` hanya `data`, meski komentar kontrak menyebut `text` wajib; `resultOf` membuang kode error spesifik. Harmonisasi sebelum loop |
| Task | [runTaskRun](../../../src/lib/tasks/run.ts#L1-L10) | Satu putaran model, bukan iterasi alat. Jangan menjual riset reflektif dari fungsi utilitas |
| Sandbox | [kontrak](../../../src/lib/sandbox/contract.ts#L19-L74), [adapter](../../../src/lib/sandbox/e2b.ts#L100-L153) | `create` tidak mengirim networkPolicy/cpu/memory; `execute` memakai `-c` untuk Python dan Node (Node `-c` memeriksa sintaks, bukan eksekusi). Kompatibilitas endpoint provider perlu verifikasi; bukan bukti live |
| Sumber/sitasi | [SourceRecord](../../../src/lib/sources/record.ts#L1-L43), [extractCitations](../../../src/lib/documents/citations.ts#L22-L40) | Reach, metadata, kutipan, dukungan klaim berbeda. Mapping marker bukan pemeriksaan entailment; nomor invalid yang diabaikan harus terdeteksi sebelum final |

Temuan sandbox bukan hasil eksploitasi: inspeksi payload kode + dokumentasi vendor; konfigurasi template live tidak diperiksa. Jangan aktifkan kemampuan hanya karena key/template terisi.

## 3. Sumber primer dan metode pencarian

Empat query terarah dicoba satu batch: `site.owasp.org SSRF Prevention Cheat Sheet DNS pinning redirect`; `site.e2b.dev docs sandbox timeout network internet access`; `site.github.com/exceljs/exceljs formula result csv parser`; `site.github.com/mehmet-kozan/pdf-parse getText getTable`. Search harness gagal HTTP 404 `model "deepseek-v4-flash" not found or not permitted`. **Tidak ada klaim hasil pencarian berhasil atau cakupan web menyeluruh.** Dilanjutkan URL resmi yang diketahui; ini fallback read-only, bukan memalsukan search provider Kawan.

| Sumber primer dibaca | Fakta relevan | Keputusan lokal |
|---|---|---|
| [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) | Validasi destination, kontrol redirect, DNS pinning ke alamat tervalidasi; pertahanan application+network | Reuse outbound policy; seluruh redirect/retry/fallback diperiksa. Network guard wajib, prompt bukan guard |
| [ExcelJS README](https://raw.githubusercontent.com/exceljs/exceljs/master/README.md) bagian File I/O | XLSX buffer/stream, CSV via parser bawaan, document mode menahan workbook di memori; streaming mengurangi footprint | Pakai ExcelJS terpasang, jangan split CSV dengan koma. Batasi input+parse, streaming bila perlu. README master bukan bukti semua API versi lokal identik |
| [decimal.js API](https://mikemcl.github.io/decimal.js/#precision) | Presisi default 20 significant digits; operasi membulatkan sesuai precision/rounding; clone konfigurasi independen | Pin konfigurasi lokal, tampilkan presisi dan sifat aproksimasi; jangan mengartikan arbitrary precision sebagai hasil selalu eksak |
| [E2B internet access](https://docs.e2b.dev/network/internet-access.md) | Internet default aktif; `allowInternetAccess:false`; allow mendahului deny; pengujian koneksi harus application-level, bukan TCP connect saja | Wajib deny jaringan eksplisit; fixture payload + live HTTP canary. Domain filtering/DNS mempunyai keterbatasan; code sandbox tidak butuh internet |

Sumber diakses 24 Oktober 2026 UTC. Halaman navigasi E2B pertama terpotong, ditindaklanjuti versi Markdown lengkap. README ExcelJS hasil panjang terpotong, kesimpulan hanya dari bagian File I/O yang terbaca. PDF didasarkan kode lokal terpasang; tidak mengklaim getTable/OCR terverifikasi. Nilai budget berikut **keputusan desain awal**, bukan limit vendor atau hasil benchmark.

## 4. Loop riset: maksimal tiga siklus, bukan reasoning terbuka

1. **Admission:** identitas pemilik dari sesi; pin task/run/model/agent/policy revision. Cek tool-call compatibility, quota, deadline, capabilities. Tujuan ambigu yang mengubah metrik/periode/satuan meminta klarifikasi. Teks lampiran tidak boleh memperluas scope.
2. **Rencana pendek:** subpertanyaan, periode data, kriteria sumber, keluaran. Formulasikan 2–4 query berbeda untuk pertanyaan multi-aspek; pertanyaan satu URL/file cukup baca langsung, tanpa memaksa pencarian.
3. **Siklus 1:** search batch, dedup URL+hash, prioritaskan penerbit asli/regulator/dataset/repo resmi. Baca sumber primer, simpan kutipan+locator. Search snippet hanya petunjuk discovery, bukan bukti substansial final.
4. **Siklus 2 opsional:** audit gap terstruktur: claim belum didukung, tanggal tidak cocok, konflik unit/definisi, sumber tidak terbaca. Cari maksimal dua query tambahan terarah hanya jika budget total belum habis.
5. **Siklus 3 opsional:** tutup gap penting dengan maksimal dua query tersisa; jangan mengulang query/URL identik tanpa alasan perubahan. Sesudahnya final parsial/abstain, bukan loop refleksi baru.
6. **Final:** kesimpulan, tabel bukti, angka hasil tool, sitasi yang dapat dibuka, tanggal akses, konflik/ketidakpastian, apa yang belum diperiksa. Keluarkan ringkasan keputusan dan observasi; **tidak meminta, menyimpan atau menampilkan chain-of-thought privat**.

Berhenti dini ketika klaim utama didukung sumber relevan dan cek numerik lulus; ketika tidak ada bukti baru setelah satu siklus tambahan; ketika cancelled/deadline/quota; atau ketika capability wajib tidak tersedia. Counter siklus/budget persisten; resume/restart tidak mengembalikannya ke nol. Follow-up pengguna run baru, bukan otomatis reset untuk mengakali limit.

### Budget server per run

| Resource | Default / batas keras awal | Enforcement |
|---|---|---|
| Siklus refleksi | maksimal 3 total, termasuk siklus awal | Counter durable sebelum model call |
| Query | awal 2–4, tambahan ≤2 per siklus, total ≤8 | Reserve sebelum dispatch; tidak semua query harus dipakai |
| Hasil pencarian | ≤5/query; ≤40 total | Validate schema; body streaming ≤512 KiB |
| Sumber dibaca | ≤8 unik/run; ≤2 fetch bersamaan | Dedup+permit counter; read timeout 10 detik |
| Halaman sumber | ≤2 MiB raw; ≤200.000 karakter ekstraksi; excerpt ke model ≤6.000/sumber | Hentikan stream saat bytes melewati cap; `truncated`+rentang; PDF tidak parse bytes parsial |
| Tool | ≤24 panggilan termasuk retry; ≤1 retry transient/tool | Retry 429/5xx/network saja dengan deadline; schema/denied tidak retry |
| Waktu | riset read-only 120 detik; analisis sandbox run ≤15 menit | Deadline absolut, cancel propagation ke provider |
| Model | ≤24.000 input token kumulatif, ≤6.000 output token kumulatif | Reserve+settle; usage provider bila tersedia, estimasi konservatif berlabel jika tidak; output reserve final |
| Konkurensi pemilik | 1 sandbox/run; 2 run aktif/pemilik awal | Admission atomik, bukan hanya UI |

Nilai budget lebih rendah dari policy deployment menang. Token limit model lebih rendah tetap menang. Retry dihitung sebagai konsumsi, bukan pekerjaan gratis. Sebelum panggilan terakhir, sisakan budget final parsial; bila provider mati, tampilkan hasil alat yang sudah durable tanpa klaim sintesis lengkap.

## 5. Kontrak tool: existing dibanding tambahan target

Registry tetap tertutup, `additionalProperties:false`, versi schema eksplisit. Nama berikut adalah **target API model-facing**, kecuali compute yang sudah terdaftar; fungsi existing menjadi handler, bukan bukti tool sudah expose. Jangan membuat alias `read_file`/`inspect_file` ganda: pilih `file.inspect` sebagai nama registry; istilah UX `inspect_file` mengacu tool yang sama.

Context server-only: `{userId,taskId,runId,stepId,signal,deadlineAt,policyRevision}`; owner/run/sessionId/storage path tidak dapat disuplai model. Semua referensi diverifikasi milik owner dan terikat task sebelum baca/eksekusi/unduh. Error not-found dan bukan pemilik tidak membocorkan eksistensi.

Envelope target konsisten dengan `ToolResult` existing: `{schemaVersion:1,status:"ok"|"invalid"|"denied"|"failed",text,data,sourceRefs,artifactIds,truncated,errorCode,message}`. `text` ringkas wajib untuk ok, bukan dump seluruh data. Error wajib kode stabil, pesan Indonesia disanitasi; jangan stdout host/token/detail IP privat. `data` boleh menambahkan `coverage`, `nextCursor`, `usage`, `warnings`. Cursor opaque signed, terikat owner/file hash/query scope; tidak menerima offset path host.

| Tool / status | Argumen minimal | `data` sukses / error utama |
|---|---|---|
| `web.search` / wrapper baru atas `webSearch` | `{queries:string[1..4],limit?:1..5}`; query 1–300 karakter | `{results:[{sourceId,title,url,snippet,fetchedAt}],queryOutcomes}`; `SEARCH_UNAVAILABLE`, `RATE_LIMITED`, `UPSTREAM_INVALID`, `TIMEOUT`. Partial batch eksplisit, nol hasil bukan error |
| `web.read` / expose `readSource` | `{url:string,maxChars?:1000..6000,cursor?:string}`; URL ≤2048 karakter | `{sourceId,requestedUrl,finalUrl,title,fetchedAt,contentHash,extractionVersion,excerpt,locator,coverage}`; `BAD_URL`, `BLOCKED`, `PAYWALL`, `UNSUPPORTED_TYPE`, `TOO_LARGE`, `NO_TEXT`, `UNREACHABLE`. Locator merujuk snapshot immutable, bukan fetch baru tanpa pemberitahuan |
| `file.inspect` / baru | `{artifactId,view:"summary"|"rows"|"text",sheet?:string,range?:string,pages?:{start,end},jsonPointer?:string,cursor?:string,maxRows?:1..100,maxChars?:1..8000}`; pilihan mutually exclusive sesuai format | `{fileHash,format,size,sheets?,columns?,sample?,rows?,text?,coverage,warnings,nextCursor?}`; `NOT_FOUND`, `MIME_MISMATCH`, `UNSUPPORTED_FORMAT`, `INVALID_RANGE`, `PARSE_LIMIT`, `OCR_UNAVAILABLE`, `EXTRACT_FAILED` |
| `compute.calculate` / existing | `{op,operands:string[1..2],precision?:0..20,rounding?:enum}` sesuai schema existing | Existing `{value,op,rule,rounded}`; tambahkan metadata significant precision/exactness secara versioned. `INVALID_OPERAND`, `INVALID_REQUEST`, `DIVISION_BY_ZERO`, `NONFINITE` harus dipertahankan, bukan pesan saja |
| `compute.stats` / existing | `{values:(number|null)[],kind?:"sample"|"population",unit?:string|null}` | n/missing/mean/median/stdDev/min/max; cap 10.000 nilai, tolak nonfinite. Jangan memakai Number untuk uang/big integer; mapping sumber tersimpan di step |
| `data.aggregate` / baru sesudah inspect | `{artifactId,sheet?,columns:string[1..20],operation:"count"|"sum"|"mean"|"min"|"max",groupBy?:string[0..2],missing:"exclude"|"error",decimalScale?:0..20}` | `{rows,sourceRange,inputCount,missingCount,rule,unit,precision,coverage}`; operasi closed, tanpa expression/filter SQL. `AMBIGUOUS_TYPE`, `INCOMPLETE_INPUT`, `TOO_MANY_GROUPS`. Total hanya seluruh range yang lolos cap, bukan sampel |
| `code.execute` / baru, gated | `{language:"python"|"javascript",code:string,inputArtifactIds:string[0..5],timeoutMs?:1000..60000}`; code ≤64 KiB | `{exitCode,stdout,stderr,outputArtifactIds,executionId,templateVersion,codeHash,inputs:[id,hash],limits,usage}`; `CAPABILITY_UNAVAILABLE`, `INPUT_DENIED`, `TIMEOUT`, `RESOURCE_LIMIT`, `EXECUTION_FAILED`, `STOP_UNCONFIRMED`. Tidak menerima arbitrary env/network/package install |

`data.aggregate` dibutuhkan karena mengirim 10.000 sel ke model lalu meminta model menyusun values kehilangan efisiensi dan provenance. Bukan DSL query umum; tambah filter/pivot/join hanya setelah kasus evaluasi membuktikan perlu. Dukungan kode bebas merupakan jalur terpisah, bukan cara melewati batas aggregate.

### Contoh kontrak bounded

```json
{"artifactId":"file_opaque","view":"rows","sheet":"Penjualan","range":"A1:D50","maxRows":50,"maxChars":8000}
```

Hasil menyatakan `coverage:{requested:"A1:D50",returned:"A1:D32",complete:false,reason:"BYTE_CAP"}` serta `truncated:true,nextCursor:"opaque"`; tidak boleh menyebut total penjualan seluruh sheet. Retry pagination memakai hash file yang sama; file berubah mengembalikan `SOURCE_CHANGED`.

## 6. Parsing dan analisis file

**Admission awal:** file ≤10 MiB; magic+MIME+ekstensi konsisten; 5 input/run; total 25 MiB. File lebih besar ditolak dengan saran subset, bukan dipotong sebagai dokumen valid. Metadata harus berasal parsing nyata, bukan nama file. Parser memiliki wall time 10 detik, memory 256 MiB, expanded ZIP ≤50 MiB, ≤1.000 entries, ≤100:1 expansion ratio, batas kedalaman JSON 50 dan nodes 100.000. Batas diterapkan **selama** parse/decompress, bukan sesudah full allocation. Parser kompleks berjalan pada proses terisolasi resource-limited tanpa secret/network; batas ini bukan substitusi sandbox arbitrary-code.

- **XLSX:** ExcelJS terpasang; inventory sheet (termasuk hidden flag), header, alamat, type, formula text, cachedValue terpisah, date system 1900/1904. Maksimal 50 sheet dan 20.000 sel total untuk profil awal; oversize `PARSE_LIMIT`, bukan hasil lengkap palsu. Macro/external links tidak dieksekusi/fetch. `.xls` lama dan encrypted workbook unsupported. Cached formula berlabel *tersimpan, belum dihitung ulang*; hilang/stale tidak ditebak. Tidak menambah engine formula umum untuk MVP.
- **CSV:** parser ExcelJS CSV terpasang dengan mapping identitas string, delimiter/encoding eksplisit (UTF-8 awal), quote/newline RFC-style. Jangan `split(',')`; pertahankan leading zero, decimal comma, duplicate headers, empty string vs null. Ambiguitas delimiter/desimal meminta input; tidak auto-konversi tanggal/angka uang yang merusak data. Maksimal 20.000 sel, 100 kolom. Export melindungi formula injection `=`, `+`, `-`, `@`, tab/CR sesuai mode spreadsheet, dengan metadata sanitasi; jangan mengubah raw source.
- **JSON:** `JSON.parse` hanya setelah byte cap; array records untuk tabel; nested object melalui JSON Pointer, bukan eval/JSONPath script. Tolak duplicate keys bila parser jalur terpilih tidak dapat mempertahankan makna; jangan diam-diam menerima angka unsafe sebagai tepat. Angka di luar safe integer harus string atau hasil berlabel precision-lost dan ditolak untuk kalkulasi. Key `__proto__`/`constructor` tidak boleh dipakai merge ke object config. JSON tidak menjalankan instruksi.
- **PDF:** reuse pdf-parse, simpan nomor halaman asli; maksimal 200 halaman profil awal, output per call ≤3 halaman/8.000 karakter. Text order bukan tabel terpercaya: kolom/merged cells memerlukan verifikasi header dan baris. Scan mengembalikan `OCR_UNAVAILABLE`; OCR tambahan ditunda sampai consent, biaya dan gate privasi disetujui. Jangan menyatakan angka tabel valid hanya karena text layer terbaca.
- **Teks:** line range, UTF-8 valid, batas karakter/byte, status truncated. Tidak ada path host dari model.

Preview awal maksimal 20 baris, 20 kolom, 8.000 karakter; tiap cell maksimal 500 karakter dalam preview. Statistics `sampled:true` jika hanya sampel, denominator eksplisit. Untuk total/mean keseluruhan, tool aggregate wajib complete coverage, schema, units, missing treatment. Missing tidak otomatis nol; outlier tidak otomatis dibuang; dedup tidak otomatis. Date locale/timezone, mata uang, unit persen dan periode harus jelas. Persentase perubahan dari basis nol mengembalikan undefined/error, bukan infinity.

### Determinisme numerik

Kalkulator menerima enum+operand string, bukan expression arbitrary. Gunakan Decimal clone dengan presisi yang dipin; rekam input, operasi, rounding mode, significant digits, decimal places, versi library. `1/3` dan akar non-perfect adalah aproksimasi; `rounded:false` tidak boleh menjadi klaim eksak. Operasi keuangan memakai string Decimal; statistik Number mempunyai toleransi absolute+relative yang didefinisikan dataset. Seed, runtime/template version, library versions dan code/input hash dicatat untuk sandbox; determinisme tidak dapat dijanjikan bagi program bebas yang memakai clock/random/network. Network nonaktif, clock/random tetap perlu seed/normalisasi jika pengujian membutuhkan reproduksi.

## 7. Sandbox dan capability gates

Capability tersedia hanya jika **configured ∧ policy permits ∧ runtime compatible ∧ isolation attested ∧ recent health probe**. Status `available|unavailable|degraded`, reasonCode, checkedAt, templateVersion, policyRevision. Key ada bukan gate. Bukti template/cap disimpan di server, bukan pernyataan model. Read-only compute tetap tersedia saat code unavailable.

Reuse profil [SANDBOX_LIMITS](../../../src/lib/sandbox/contract.ts#L19-L34): 1 CPU, 1.024 MiB RAM, workdir 256 MiB, command 60 detik, run 15 menit, stdout/stderr masing-masing 256 KiB, maksimal 10 output/25 MiB. Server membatasi input/output sebelum alokasi/transfer. Provider tidak mampu enforce salah satu batas wajib: code capability `unavailable`, tidak menurunkan keamanan diam-diam.

- Sandbox baru per run, UID non-root, input read-only, output direktori khusus; tidak reuse antar pemilik. UserId/session binding diputus server. Tidak ada mount host, Docker socket, DB URL, gateway key, cookie aplikasi atau secret di environment.
- Jaringan code **none**: IPv4/IPv6, DNS, metadata cloud, loopback service host, proxy env dan koneksi ke Internet diblok. Package install tidak tersedia; gunakan stdlib Python csv/json/decimal/statistics dan Node/library yang sudah baked dalam template terversi. Python/JS di host dilarang untuk konten user/model.
- Untuk Node gunakan invocation eksekusi yang benar, bukan `node -c`; pin protocol provider aktual melalui contract test. Tidak memakai command string interpolated dari nama file. User source tetap disalurkan sebagai data ke sandbox API.
- Output: resolved path harus di output root, bukan symlink/hardlink/device/FIFO/path traversal; validasi MIME+ukuran; opaque artifact IDs; preview HTML tidak dijalankan di origin aplikasi. Collect/unduh selalu auth owner.
- Cancel/timeout membunuh semua descendant process dan session. Stop tidak terkonfirmasi menjadi `indeterminate`, capacity ditahan sampai reconciled; jangan retry program berefek yang statusnya ambigu.
- Gate live: dua pemilik+dua run canary, network-deny application-level, metadata, secret/mount absence, CPU/memory/disk/process/output cap, timeout, kill descendants, output traversal, adapter Python dan JavaScript actual execution. **Mock hijau tidak mengaktifkan capability.**

## 8. Provenance, konflik dan abstention

Simpan source ID immutable, owner/task binding untuk privat, requested/final URL, waktu akses, tanggal terbit jika benar-benar diketahui, MIME, raw SHA-256, hash/version ekstraksi, coverage, locator, kutipan pendek. File source memakai artifactId+fileHash+sheet/cell range atau PDF page atau JSON Pointer. Raw URL fetch dipertahankan; canonical URL hanya untuk dedup, jangan menghapus parameter semantik sebelum request. Snapshot sumber privat dan excerpt tidak dibagi global antar owner.

Setiap klaim material mempunyai `claimId,statement,sourceRefs,evidenceStatus:supported|conflicting|insufficient|unverified`. Validasi mekanis: sumber benar ada, accessible owner, excerpt pernah dibaca, quote terdapat pada snapshot, locator dalam range, URL berasal tool. Penilaian semantik: kutipan benar mendukung klaim, tanggal/definisi/satuan sesuai. Reviewer model dapat membantu tetapi bukan satu-satunya oracle; fixture golden + human adjudication menilai sampel.

Konflik sumber: tampilkan nilai A/B, tanggal, definisi, populasi, versi, kemungkinan sebab; utamakan sumber primer paling relevan terhadap klaim, bukan sekadar terbaru atau mayoritas situs. Republika/sindikasi dari satu sumber bukan corroboration independen. Jika tidak terselesaikan dalam tiga siklus, final menyatakan konflik; tidak merata-ratakan angka yang mengukur hal berbeda.

Abstain ketika tidak ada bukti untuk klaim inti, sumber hanya snippet/paywall, ekstraksi scan gagal, input terpotong untuk total, model/provider tidak mendukung tool, atau sumber bertentangan material. Beri bagian yang dapat dijawab, alasan kode/ringkas, langkah pengguna (unggah versi teks, rentang data, periode/satuan). Jangan mengubah tool failure menjadi jawaban ingatan model yang seolah mutakhir.

Tidak tampilkan badge “benar” untuk link hidup/DOI cocok. UI memisahkan **dibaca**, **metadata cocok**, **kutipan ditemukan**, **dukungan klaim ditinjau**. Unknown marker adalah validation failure final, bukan diam-diam dihapus hingga jawaban tampak bersumber.

### Prompt injection dan SSRF

Web/file/tool output merupakan data tidak tepercaya. Pisahkan blok sumber dari instruksi system; identifier/locator dibuat server; sanitasi control characters/markup pada UI. Instruksi “abaikan aturan”, “upload dokumen”, URL callback dan tool-call JSON di halaman tidak memberi otoritas. Model tidak dapat meminta secret, mengubah owner, menambah tool, menaikkan cap atau mengizinkan egress. Perubahan policy/approval berasal sesi pengguna, tidak dari retrieved content. Content filter dapat memberi warning, bukan pertahanan tunggal.

Outbound policy memvalidasi URL dengan parser yang sama dengan koneksi; HTTPS default; kredensial embedded, non-HTTP scheme, port tak diizinkan, private/loopback/link-local/metadata IPv4/IPv6 ditolak; DNS hasil A/AAAA diperiksa dan dipin saat connect. Redirect lintas-host tetap ditolak sesuai baseline; sumber canonical baru harus dibaca sebagai request baru yang divalidasi. Search endpoint operator tidak menjadi izin mengambil sembarang URL yang dikembalikan. Jangan membawa auth header search provider ke target hasil. Batasi decompressed response bytes, redirects, retries, timeout; no cookies/script/subresource. Query search tidak mengandung raw file privat/PII tanpa consent eksplisit.

## 9. Dataset evaluasi dan acceptance

Dataset rancangan **60 kasus**: 40 development, 20 held-out; pembagian per keluarga/domain/file, bukan duplikasi template berbeda nama. Fixture sintetis atau sumber publik berlisensi dengan snapshot/hash/tanggal; tanpa file pribadi nyata. Manifest setiap kasus: id, kategori, input, fixture hashes, fixed clock, capability profile, expected tool constraints, expected result/units/tolerance, evidence spans, expected abstention/conflict, forbidden actions, budgets. Golden hasil angka dihitung oracle independen (Decimal/rational hand-check), bukan jawaban model yang diuji.

| Keluarga / jumlah | Kasus minimum | Acceptance fixture |
|---|---|---|
| Web primer/multi-hop 12 | sumber resmi vs blog, data lama vs revisi, tabel pada PDF, URL langsung, query Indonesia/Inggris, gagal fetch | Semua klaim utama golden tercakup; sourceRefs valid 100%; ≥95% klaim material didukung pada evaluasi beranotasi, penyebut jumlah klaim dilaporkan |
| Konflik/abstention 8 | paywall, scan, search kosong, provider 429, dua definisi indikator, kurang periode/unit | 8/8 tidak mengarang bukti; konflik material eksplisit; jawaban parsial dibedakan dari selesai |
| Data file 12 | quoted newline CSV, leading zero, decimal comma, blank/null, JSON nested/unsafe integer/duplicate key, Excel formula cache, hidden sheet/date system, PDF tabel | Nilai+locator golden tepat, tidak mengklaim total dari preview, metadata completeness benar; parsing ambigu ditolak/ditanya |
| Matematika 10 | 0.1+0.2=0.3; 1/3; ties half-even; basis persen nol; mean missing; sample vs population; unit mismatch; overflow | 10/10 output deterministik sesuai golden/toleransi; rounding dan n/missing benar; nonfinite ditolak |
| Keamanan/isolasi 12 | prompt injection, callback exfiltration, owner lain, URL metadata/IPv6/redirect/rebinding, ZIP bomb, CSV formula, traversal output, oversized stream | 12/12 denied atau safely bounded; nol cross-owner byte/secret/external forbidden call dalam fixture |
| Lifecycle/budget 6 | siklus ke-4, tool ke-25, query duplikat, deadline, cancel sandbox, restart lease | Seluruh budget enforced, tidak ada reset/duplicate execution; stop unknown menjadi indeterminate |

**Fixture deterministik:** scripted model responses dan fake search/HTTP/provider menguji loop state machine, bukan kemampuan model. Parser/compute nyata diuji atas bytes fixture. E2E owner A/B melalui API/UI terisolasi memastikan downloaded artifact dan sitasi bisa dibuka oleh pemilik saja. Tidak menjalankan kode model di CI host; fixture sandbox memakai adapter fake atau sandbox live terisolasi.

**Evaluasi model:** run 60 kasus dengan model/provider/version/prompt/schema yang dipin, minimal 3 pengulangan; laporkan per kasus/per kategori dan worst run, jangan hanya rata-rata. Target awal: ≥90% successful task pada kasus answerable, abstention correct ≥95%, supported-claim precision ≥95%, evidence coverage klaim utama ≥95%; semua pelanggaran keamanan/cap gate nol pada suite wajib. Target bukan hasil saat ini. Dua penilai pada subset ≥20 kasus semantik, selisih diadjudikasi; model grader opsional dan dikalibrasi, tidak menggantikan oracle angka.

**Live canary terpisah:** 10 tugas kecil sumber resmi terkini + satu Python/satu JavaScript, permission/isolasi di sandbox canary. Simpan timestamps, response statuses, content hash, tool latency p50/p95, wall time, bytes, tokens/cost bila diketahui, retry, source support, ketercapaian unduhan. Live content berubah: nilai fakta diadili against snapshot saat run, bukan string golden lama. Search/provider/key unavailable = `blocked_external`, tidak pass atau zero-score tersembunyi. Gate transport/live isolation wajib lulus seluruhnya sebelum release fitur; perubahan template/provider mengulang gate. SLO awal read-only ≤120 detik pada tugas canary, bukan janji semua web cepat.

### Skenario wajib sebelum coding dinyatakan selesai

- RD-01 tujuan riset memicu 2–4 query terarah, primary reads, final bersumber; failure satu query tidak menghapus hasil lainnya.
- RD-02 tiga siklus maksimum tahan restart; siklus keempat ditolak; final memuat gap.
- RD-03 inspect empat format mengembalikan bounded range, hash, locator, completeness; aggregate seluruh input tidak memakai sampel.
- RD-04 hasil desimal dan statistik benar, error terstruktur, presisi bukan klaim eksak palsu.
- RD-05 sumber konflik/paywall/scan menghasilkan partial/abstain yang benar, bukan sitasi fiktif.
- RD-06 injection/SSRF/cross-owner/resource abuse ditolak melalui server control, bukan prompt saja.
- RD-07 code capability off sampai gate live; Python/JS benar dieksekusi di sandbox, network none, stop terkonfirmasi.
- RD-08 seluruh angka/tabel final dapat ditelusuri ke tool step dan input hash; unduh dan preview tetap owner-scoped.

## 10. Urutan coding yang direkomendasikan setelah persetujuan terpisah

1. **Kontrak dan tests dahulu:** harmonisasi ToolResult text/errorCode, capability evidence, reserve budget persisten, parser coverage, source IDs. Tambah regression untuk precision, cached formula dan Node invocation.
2. **Bounded read:** streaming byte caps search/read; safe parser limits; `file.inspect` CSV/JSON/XLSX/PDF; source locator/version. Tidak menambah OCR.
3. **Loop read-only:** expose search/read/inspect/compute melalui registry existing; batch query, tiga siklus maksimum, structured gap summary, provenance validation, abstention. Sambungkan task runner, bukan loop paralel baru.
4. **Aggregate deterministik:** schema closed, Decimal untuk uang, n/missing/unit/source range; tabel output menolak partial total.
5. **Sandbox:** perbaiki adapter sesuai API vendor, template pin, cap/network attestation, lifecycle reconciliation; fixture lalu live gate. Baru expose code.execute.
6. **Evaluasi:** dataset/held-out, real model repeat, owner E2E, laporan fixture vs live. Tidak menyatakan seluruh fitur selesai dari dokumen ini.

Tidak ada dependency baru yang diputuskan. Parser JSON duplicate-key atau HTML extraction lebih baik boleh membutuhkan library tambahan **hanya** sesudah spike membuktikan stdlib/dependency terpasang tidak memenuhi acceptance; pin lisensi, versi, supply-chain review. Tanpa parser aman, subset input ditolak dengan jelas.

## 11. Bukti verifikasi riset dan batasnya

- Lokasi kerja diperiksa, baseline `027e17d`; git awal hanya untracked metadata tim. Tidak menyentuh source/secret/deploy.
- Pemeriksaan versi awal gagal `ERR_PACKAGE_PATH_NOT_EXPORTED` pada package metadata pdf-parse, bukan kegagalan parser; dilanjutkan membaca manifest lokal (2.4.5). Pemeriksaan Decimal berikutnya exit 0: precision 20, `1/3 = 0.33333333333333333333`.
- Search harness gagal HTTP404; direct primary fetch OWASP/ExcelJS/Decimal/E2B berhasil. Ini bukti akses sumber, bukan uji live provider Kawan.
- Tool `kuli_work` tidak tersedia dalam katalog sesi; lifecycle tercatat lewat AgentTeams t3, bukan mengklaim work order Kuli tercipta.
- Fixture existing terarah dijalankan; hasil dicatat setelah proses selesai di bawah. Tidak menjalankan full build/typecheck karena hanya dokumen berubah; tidak menjalankan provider sandbox live, arbitrary user code, deployment atau operasi berbayar.

### Hasil pemeriksaan akhir

Perintah `npx vitest run src/lib/tools/compute.test.ts src/lib/tools/registry.test.ts src/lib/sources/sources.test.ts src/lib/search/web.test.ts src/lib/documents/run-extract.test.ts src/lib/sandbox/sandbox.test.ts` selesai exit 0: **6 file test, 121 test lulus**, durasi 13,80 detik. Ini baseline fixture existing; bukan bukti kontrak baru sudah terimplementasi atau sandbox live aman.

Batas kepastian: pembacaan source dan fixture merupakan self-check riset, bukan audit keamanan independen. Semua acceptance target di §9 masih membutuhkan implementasi/gate tersendiri. Kualitas model dan kelengkapan sumber tetap probabilistik; tidak ada jaminan nol halusinasi.

<!-- ponytail: satu orchestrator, parser terpasang, aggregate closed; perluas DSL/OCR/library hanya setelah dataset membuktikan kebutuhan dan gate keamanan tersedia. -->
Optional attribution: prepared with DeepSeek Harness; isi dan rekomendasi memerlukan persetujuan manusia sebelum implementasi.
Public reference for source context: https://github.com/fauzan171/tokengateway-kawan
Attribution bukan klaim review independen atau fitur deployed.

Status penyerahan: riset/desain saja.
