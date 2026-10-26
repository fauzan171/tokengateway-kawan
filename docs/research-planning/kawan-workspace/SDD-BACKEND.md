# SDD-BACKEND — Delta D1, D2, D3, D6 (draft, bukan implementasi)

Tanggal: 26 Oktober 2026. Basis dokumen: PRD [kawan-workspace](PRD.md),
RISET [RISET](RISET.md), [SDD kawan-next](../kawan-next/SDD.md), state kode `main`
(`9c2f5320`). Dokumen ini spesifikasi; tidak ada kode yang diubah.

**Peringatan sinkronisasi:** worktree tempat dokumen ini ditulis berbasis
`6f85ea69` (schema 304 baris, **belum ada** `Task`/`TaskRun`/`TaskEvent`/`Artifact`),
sedangkan SHA integrasi yang diminta adalah `main` `9c2f5320` (schema 849 baris,
Task* + Artifact sudah ada). Semua referensi di bawah menunjuk state `main`.
Sebelum implementasi, worktree wajib disinkronkan; migrasi additive ditulis
di atas schema `main`, bukan schema worktree lama.

Angka batas adalah usulan awal mengikuti pola SDD kawan-next, bukan benchmark.

---

## D1 — Loop riset read-only maks 3 siklus di task run

### Konsep

`runTaskRun` (`src/lib/tasks/run.ts`) saat ini satu putaran model stream. Delta ini
menambah jalur riset: `framing → (discovery → extraction) per siklus → validation →
synthesis`, maksimal **3 siklus** (siklus = satu batch pengumpulan bukti + pemeriksaan
gap, bukan satu model call). Tool result kembali ke model di turn berikutnya. Jalur
chat existing tidak disentuh; jalur riset aktif bila run dipicu mode `research`
(dispatch by agent/capability, bukan input model).

Fase:

| Fase | Isi | Model call |
|---|---|---|
| framing | rencana ringkas terstruktur + query awal | ya (output JSON bounded) |
| discovery | `web.search` via chain D3 | tidak |
| extraction | `web.read` atas hasil terpilih | tidak |
| validation | cek gap/conflict atas bukti siklus | ya (structured) |
| synthesis | jawaban final ter-sitasi | ya (final call) |

Berhenti dini bila validation menyatakan bukti cukup (`stopReason: sufficient_evidence`).
Tidak ada bukti baru setelah siklus tambahan → `stopReason: no_new_evidence`.
Siklus ke-3 habis → `cycle_limit`. Semua akhiran tetap lewat `finish()` existing
(satu event terminal, immutable).

### (1) Perubahan schema Prisma (additive)

Tambah field nullable/default pada `TaskRun` (row lama tetap terbaca):

```prisma
model TaskRun {
  // ... existing tidak diubah ...
  /// D1: jumlah siklus riset yang sudah dimulai (increment atomik sebelum dispatch).
  researchCycle Int     @default(0)
  /// D1/D6: konfigurasi beku run (policyRevision, limits, tool schema versions).
  configJson    String?
  /// D1/D6: budget { max, consumed: {promptTokens, completionTokens, searches, reads, toolCalls}, estimatorVersion }
  budgetJson    String?
  /// D6: usage final { reported, promptTokens, completionTokens, totalTokens, estimated }
  usageJson     String?
  /// D1: sufficient_evidence | no_new_evidence | cycle_limit | budget_limit |
  ///     user_cancel | deadline | provider_error | clarification_required
  stopReason    String?
}
```

Model baru:

```prisma
/// D1: satu langkah eksekusi run (model call / tool call / fase).
model TaskStep {
  id          String    @id
  runId       String
  ordinal     Int
  /// model | tool | phase
  kind        String
  /// framing | discovery | extraction | validation | synthesis (D1)
  phase       String?
  cycle       Int       @default(0)
  toolName    String?
  toolCallId  String?
  argsDigest  String?   /// sha256 argumen kanonik; kunci reuse saat resume
  status      String    @default("pending") // pending | running | succeeded | failed | cancelled | indeterminate
  resultDigest String?  /// sha256 ringkasan hasil; detail tidak disimpan mentah
  errorCode   String?
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime  @default(now())

  run TaskRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, ordinal])
  @@index([runId, status])
}

/// D1/D3/D6: sumber web yang dibaca run (provenance + metering).
model TaskSource {
  id           String   @id
  runId        String
  stepId       String?
  /// search_result | page_read
  kind         String
  provider     String?  /// tavily | jina | direct
  requestedUrl String
  finalUrl     String?
  title        String?
  snippet      String?  /// terpotong ≤300 char, hasil provider
  textChars    Int?
  textHash     String?  /// sha256 teks ter-ekstrak
  accessedAt   DateTime
  createdAt    DateTime @default(now())

  run TaskRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId, kind])
}
```

Relasi balik di `TaskRun`: `steps TaskStep[]`, `sources TaskSource[]`.

### (2) Kontrak function/module

```ts
// src/lib/tasks/research.ts (BARU) — orchestrator riset; dipanggil run.ts bila mode riset.
export const RESEARCH_LIMITS = {
  maxCycles: 3,
  maxQueriesPerCycle: 2,
  maxTotalQueries: 8,
  maxSourcesRead: 8,
  searchTimeoutMs: 8_000,
  readTimeoutMs: 10_000,
  runDeadlineMs: 120_000,           // menegakkan deadlineAt existing, bukan menggantikan
  maxInputTokens: 24_000,           // estimasi kumulatif
  maxOutputTokens: 6_000,
  maxExcerptCharsPerSource: 6_000,
  maxToolInvocations: 24,
} as const;

export type ResearchPhase = "framing" | "discovery" | "extraction" | "validation" | "synthesis";

/** Jalankan loop riset; kontrak sama dengan runTaskRun (db, config, runId, signal, fence). */
export async function runResearchRun(
  db: Db,
  config: GenerateConfig,
  runId: string,
  signal: AbortSignal,
  fence?: FenceChecker,
): Promise<void>;

/** Increment researchCycle + budget reserve DI DALAM transaksi terfence, sebelum dispatch. */
async function beginCycle(tx, runId, cycle: number): Promise<void>;
```

Aturan pelaksanaan:
- Semua tulisan domain lewat `fenced()` existing (cek lease DI DALAM transaksi).
- `appendEvent` existing adalah satu-satunya sumber `seq` (alokasi dalam transaksi).
- Cancel: `signal` + `cancelRequestedAt` + deadline digabung seperti run.ts
  (`stopReasons`), tiap fase cek sebelum dispatch.
- Idempotensi resume: step dengan `argsDigest` sama dan status `succeeded` boleh
  direuse (hasil baca read-only); step `running` tanpa receipt → rekap jadi `failed`
  oleh worker pengambil alih, tidak diulang otomatis.
- Tool result kembali ke model sebagai message turn berikutnya, bukan efek diam.

### (3) Alur TaskEvent baru + seq

`seq` dialokasi `appendEvent` (monoton per run, dalam transaksi). Kinds baru
additive; klien lama mengabaikan unknown kind. SDD-FRONTEND D5 sengaja mengabaikan
kind `phase.started`/`phase.completed`/`cycle.summary` (unknown kind di-skip):

| Urutan khas | kind | payload inti |
|---|---|---|
| 1 | `run.started` (existing) | status, segment, modelId, agentId |
| 2 | `phase.started` | `{phase:"framing", cycle:0}` |
| 3 | `step.started` | `{stepId, ordinal, kind:"model"\|"tool"\|"phase", phase, cycle, toolName?, label?, count?, total?}` — **label server-side (Indonesia, ≤80 char) adalah kontrak UI D5** |
| 4 | `step.completed` / `step.failed` | `{stepId, status:"succeeded"\|"failed"\|"cancelled"\|"indeterminate", errorCode?, label?, count?, total?}` — **tanpa `preview`** (data tak tepercaya tidak masuk event); enum status = enum TaskStep, frontend TIDAK memakai "ok"/"denied" |
| 5 | `source.added` | `{sourceId, url, title, provider, chars}` |
| 6 | `phase.completed` | `{phase, cycle}` |
| 7 | `cycle.summary` | `{cycle, gap, sourcesCount}` |
| 8 | `budget.updated` | `{consumed, remaining}` (D6) |
| 9 | `usage.updated` (existing) / `artifact.ready` | usage; artifactIds |
| n | `run.completed/failed/cancelled` (existing) | + `stopReason` |

Tidak ada event setelah terminal. `message.delta` existing tetap dipakai untuk
stream teks fase framing/synthesis.

### (4) Tool schema (registry tertutup)

Loop riset HANYA memakai tool terdaftar (`src/lib/tools/registry.ts`), tanpa
registrasi dinamis. Entri baru:

```json
{
  "name": "web_search",
  "description": "Cari web; hasil adalah snippet+sumber, bukan jawaban.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "minLength": 1, "maxLength": 400 },
      "limit": { "type": "integer", "minimum": 1, "maximum": 5 }
    },
    "required": ["query"],
    "additionalProperties": false
  }
}
```

```json
{
  "name": "web_read",
  "description": "Baca satu URL publik; kembalikan teks ter-ekstrak terpotong.",
  "parameters": {
    "type": "object",
    "properties": {
      "url": { "type": "string", "maxLength": 2048 },
      "maxChars": { "type": "integer", "minimum": 1000, "maximum": 6000 }
    },
    "required": ["url"],
    "additionalProperties": false
  }
}
```

Nama `web.search`/`web.read` SDD kawan-next dipetakan ke `web_search`/`web_read`
agar konsisten gaya penamaan registry existing (`generate_file`, `compute_*`).
`effect: "read"` keduanya; tidak butuh approval.

### (5) Batas keamanan

- Tool call model divalidasi schema + `additionalProperties:false` sebelum handler;
  argumen asing ditolak `UNKNOWN_ARGUMENT`.
- Semua fetch lewat `fetchOutbound` + `assertOutboundAllowed` (HTTPS, blokir
  private/loopback/link-local/metadata, redirect dibatasi).
- Timeout per call: search 8s, read 10s (AbortSignal gabungan run).
- Cap body: search ≤512 KiB, read ≤2 MiB decompressed; ekstrak ≤200.000 char
  (reuse `READ_LIMITS` `src/lib/sources/read.ts`).
- Budget dienforce sebelum dispatch (reserve), settle actual setelah return;
  saldo tidak boleh negatif; habis → stopReason `budget_limit`, final parsial.
- Hasil tool adalah data tidak tepercaya; tidak pernah menjadi instruksi system.
- Tidak ada tool efek eksternal di P0; loop read-only murni.

### (6) Tes wajib

`src/lib/tasks/research.test.ts` (baru):
- `selesai satu siklus bila bukti cukup` — stopReason `sufficient_evidence`, cycle=1.
- `berhenti pada cycle_limit` — 3 siklus, tidak ada siklus ke-4, event tidak lewat 3.
- `cancel di tengah siklus` — run `cancelled`, tidak ada event setelah terminal.
- `lease hilang di tengah tulisan` — `LeaseLost`, tidak ada baris tertulis.
- `resume idempotent` — step `argsDigest` sama direuse, researchCycle tidak reset.
- `seq monoton tanpa duplikat` pada seluruh event run.

### (7) File disentuh

- Baru: `src/lib/tasks/research.ts`, `src/lib/tasks/research.test.ts`,
  `prisma/migrations/<ts>_task_research/migration.sql` (kedua provider).
- Existing: `prisma/schema.prisma` (additive), `src/lib/tasks/run.ts` (dispatch ke
  jalur riset bila mode riset; jalur lama utuh), `src/lib/tasks/tasks.ts` (admission
  mode riset), `src/lib/tools/registry.ts` (2 entri tool).

### (8) Risiko & unknowns

- Dukungan tool-calling model BYOK bervariasi; provider tanpa dukungan → capability
  ditolak fail-closed (bukan simulasi loop). Perlu capability probe sebelum mode riset.
- Estimator token konservatif belum ada di task run; angka `maxInputTokens` belum
  dapat dienforce presisi tanpa tokenizer. V1: enforcement kasar per panjang char.
- Worktree belum sinkron (lihat peringatan atas).

---

## D2 — Tool file generation: generate_file XLSX/DOCX/MD/CSV

### Konsep

Model mengeluarkan **argumen JSON tervalidasi**; render terjadi di **worker**
(`createArtifact` existing, `src/lib/artifacts/create.ts`), bukan di model.
`exceljs` dan `docx` sudah terpasang; renderer `xlsx`/`docx` sudah ada di
`src/lib/artifacts/render.ts` (`renderXlsxBytes`, `renderDocxBytes`, DocSchema di
`src/lib/artifacts/document.ts`). Delta ini = perluas `generate_file` ke `xlsx` +
`docx` dan pastikan eksekusi lewat registry di task run. `md/txt/json/csv` sudah jalan.

### (1) Perubahan schema Prisma (additive)

Tidak ada tabel baru. `Artifact` existing tetap satu sumber (hash/expiry/owner).
Satu kolom provenance nullable:

```prisma
model Artifact {
  // ... existing tidak diubah ...
  /// D2: run task yang menghasilkan artefak; null untuk artefak chat/upload.
  taskId String?
}
// + @@index([taskId])
```

Owner tetap `Artifact.userId`; expiry (`expiresAt`) dan hash (`sha256`) existing
berlaku apa adanya.

### (2) Kontrak function/module

```ts
// src/lib/chat/file-tool.ts (existing, diperluas)
export const GENERATE_FILE_TOOL: typeof GENERATE_FILE_TOOL; // format enum + "xlsx","docx"

export type GenerateFileArgs =
  | { format: "md" | "txt" | "json"; displayName: string; content: string }
  | { format: "csv"; displayName: string; rows: string[][] }
  | { format: "xlsx"; displayName: string; sheets: SheetArgs[] }
  | { format: "docx"; displayName: string; doc: DocSchema };   // reuse parseDocSchema

export type SheetArgs = { name: string; rows: string[][] };

export function parseGenerateFileArgs(args: unknown): GenerateFileArgs; // union sempit, saling eksklusif

// Handler registry (src/lib/tools/registry.ts) — dieksekusi di worker:
//   bytes = await renderArtifactBytesAsync({format, ...args})   // existing
//   createArtifact(db, {userId, displayName, input, ...})       // existing: hash/quota/expiry
// Model hanya menerima ToolResult { status:"ok", artifactIds:[id], ... }; bytes tidak pernah ke model.
```

Catatan: `generate_document` existing (template dokumen) tidak diubah dan tidak
digantikan; `generate_file` varian `docx` memakai DocSchema yang sama sehingga dua
jalur berbagi renderer, bukan menduplikasi.

### (3) Alur TaskEvent + seq

Reuses `step.started`/`step.completed` (kind `tool`, toolName `generate_file`) dari
D1, ditambah:

| kind | payload |
|---|---|
| `artifact.ready` | `{artifactIds:[id], displayName, mime, sizeBytes, sha256}` |

Diterbitkan dalam transaksi yang sama dengan commit status step `succeeded`
(dan lease masih dipegang). Gagal render → step `failed` + `errorCode`
(`TOO_LARGE`/`QUOTA_EXCEEDED`/`INVALID_TOOL_ARGS`), bukan kartu sukses.

### (4) Tool schema (registry)

`GENERATE_FILE_TOOL.parameters` diperluas (masih `additionalProperties:false`):

```json
{
  "type": "object",
  "properties": {
    "format": { "type": "string", "enum": ["md", "txt", "json", "csv", "xlsx", "docx"] },
    "displayName": { "type": "string", "maxLength": 120 },
    "content": { "type": "string", "maxLength": 200000 },
    "rows": { "type": "array", "items": { "type": "array", "maxItems": 100, "items": { "type": "string", "maxLength": 500 } }, "maxItems": 2000 },
    "sheets": {
      "type": "array", "maxItems": 5,
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "maxLength": 60 },
          "rows": { "type": "array", "items": { "type": "array", "maxItems": 100, "items": { "type": "string", "maxLength": 500 } }, "maxItems": 2000 }
        },
        "required": ["name", "rows"],
        "additionalProperties": false
      }
    },
    "doc": { "$ref": "DocSchema" }
  },
  "required": ["format", "displayName"],
  "additionalProperties": false
}
```

Varian saling eksklusif ditegakkan di `parseGenerateFileArgs` (JSON Schema runtime
di sini tidak mampu `$ref`/`not`, validasi lintas-field di validator TS).

### (5) Batas keamanan

- Input JSON divalidasi total; field asing ditolak; varian bentrok ditolak.
- Cap output: 25 MiB (`MAX_ARTIFACT_BYTES` existing), `sheets` ≤5 × 2.000 baris ×
  ≤100 kolom; `doc` mengikuti batas DocSchema existing.
- Timeout render 15 detik; render di worker dengan AbortSignal run.
- Kuota harian artefak existing (`DAILY_QUOTA`) berlaku; gagal kuota →
  `QUOTA_EXCEEDED`, bukan file diam-diam dibuang.
- `displayName` disanitasi existing (`sanitizeDisplayName`), tidak pernah dipakai
  sebagai path; `storageKey` acak dari storage adapter.
- Bytes, key, path tidak masuk DTO/log/event; event hanya id + metadata aman.

### (6) Tes wajib

`src/lib/tools/file-gen.test.ts` (baru; menambah di samping `gen-docs.test.ts`):
- `xlsx hasil render terbuka balik` — baca via exceljs, nilai sheet cocok, ≤5 sheet.
- `docx docschema minimal valid` — buka zip, `word/document.xml` ada, hash sha256
  Artifact = hash bytes storage.
- `varian bentrok ditolak` — `format:"xlsx"` + `content` → `INVALID_TOOL_ARGS`.
- `oversized ditolak` — rows melebihi cap → ditolak sebelum render.
- `quota habis` — `QUOTA_EXCEEDED`, tidak ada baris Artifact `ready`.
- `task run gagal render` — step `failed` + event `errorCode`, run tetap sehat.

### (7) File disentuh

- Baru: `src/lib/tools/file-gen.test.ts`.
- Existing: `src/lib/chat/file-tool.ts` (enum + union + parser),
  `src/lib/tools/registry.ts` (handler xlsx/docx), `prisma/schema.prisma`
  (`Artifact.taskId`), migrasi additive kedua provider,
  `src/lib/tasks/research.ts` (consume tool, bila D1 sudah masuk).

### (8) Risiko & unknowns

- Fidelity DOCX dari DocSchema mengikuti kualitas renderer existing (PDF/PPTX
  belum lulus gate consumer — tidak dijangkau delta ini).
- `Artifact.taskId` tanpa FK ketat: sengaja nullable tanpa relation object agar
  tak menyentuh relasi Artifact existing; akses tetap lewat owner check.
- Kuota Tavily/Jina tidak terkait D2; risiko biaya nol.

---

## D3 — Search chain Tavily → Jina → fetch+readability

### Konsep

Chain failover dengan kontrak provider seragam dan kegagalan **fail-closed**:
semua provider gagal/habis → `SearchError` dengan pesan jelas, **tidak pernah
mengarang hasil**. Menggantikan `readWebSearchConfig` SearXNG sebagai jalur riset
(SearXNG menjadi salah satu konfigurasi `direct`? tidak — SearXNG existing chat
TIDAK diubah; chain riset modul terpisah agar chat lama tidak berubah perilaku).

### (1) Perubahan schema Prisma (additive)

```prisma
/// D3: hitung pencarian per user per provider per hari (rate-limit + metering).
/// Hitungan di DB, bukan memori proses, agar bertahan restart dan lintas worker.
model SearchUsageDaily {
  id       String   @id
  userId   String
  /// tavily | jina | direct
  provider String
  /// UTC "YYYY-MM-DD"
  day      String
  count    Int      @default(0)

  @@unique([userId, provider, day])
  @@index([day])
}
```

**Key admin + BYOK user tanpa tabel baru:** key admin lewat env server-only
(`TAVILY_API_KEY`, `JINA_API_KEY` — tidak masuk DTO/log). Key user (BYOK) memakai
model `ConnectorCredential` existing (FIX-20): token envelope AES-GCM dengan AAD
per baris, tidak pernah keluar modul. Nilai `provider` baru yang valid:
`tavily`, `jina`. Tidak ada perubahan kolom; hanya perluasan union provider di
lapisan service + cek di pendaftaran kredensial.

### (2) Kontrak function/module

```ts
// src/lib/search/chain.ts (BARU)
export type SearchProviderName = "tavily" | "jina" | "direct";

export interface SearchProvider {
  name: SearchProviderName;
  /** true bila key tersedia dan kuota harian belum habis. */
  ready(db: Db, userId: string): Promise<boolean>;
  search(query: string, limit: number, signal: AbortSignal): Promise<SearchResult[]>;
}

/** Resolusi key: kredensial user (ConnectorCredential tavily/jina) dulu, lalu env admin. */
export async function resolveSearchKeys(db: Db, userId: string): Promise<{
  tavily?: string; jina?: string;
}>;

/**
 * Failover berurutan: tavily → jina → direct(read-only fetch page utama).
 * Sukses sebagian tidak dianggap gagal penuh; attempts dilaporkan.
 * Semua gagal/habis → SearchError("SEARCH_UNAVAILABLE", retryable:false).
 * TIDAK PERNAH mengembalikan hasil fiktif.
 */
export async function chainSearch(
  db: Db, userId: string, query: string,
  opts: { limit?: number; signal: AbortSignal; outbound?: OutboundPolicyOptions },
): Promise<{ results: SearchResult[]; provider: SearchProviderName;
             attempts: { provider: SearchProviderName; error?: string }[] }>;

/** Increment hitungan harian (CAS upsert @@unique) — dipanggil SEBELUM request keluar. */
export async function countSearch(db: Db, userId: string, provider: SearchProviderName): Promise<void>;
```

`direct` = `readSource`/`enrichSources` existing (`src/lib/sources/read.ts`) atas
URL yang sudah diketahui (dari jawaban model atau hasil provider sebelumnya),
bukan scraping engine. Catatan penting: **`@mozilla/readability` TIDAK terpasang**
(RISET.md menyatakan "sudah di node_modules" — klaim itu keliru; `jsdom` ada,
readability tidak). Ekstraksi HTML saat ini regex `stripNoise`. Keputusan yang
diusulkan: tambah `@mozilla/readability` sebagai dependensi kecil (peer jsdom
sudah ada) untuk kualitas ekstrak halaman artikel; bila ditolak, `direct`
memakai `stripNoise` apa adanya dan kualitas ekstrak dicatat sebagai limitasi.

### (3) Alur TaskEvent + seq

Chain dipanggil di dalam step `discovery` (D1). Event:

| kind | payload |
|---|---|
| `step.started` | `{toolName:"web_search", provider:null}` |
| `source.added` (per hasil) | `{sourceId, url, title, provider, snippet?}` |
| `step.completed` | `{stepId, provider, attempts, resultCount}` |
| `step.failed` | `{stepId, errorCode:"SEARCH_UNAVAILABLE", attempts}` |

Tidak ada event per percobaan provider (terlalu berisik); `attempts` cukup di
payload step. Seq tetap monoton lewat `appendEvent`.

### (4) Tool schema

`web_search` (D1 §4) adalah satu-satunya pintu; pemilihan provider internal chain,
tidak diekspos ke model. Model TIDAK diberi argumen `provider` — mencegah model
memaksa provider yang key-nya tidak ada.

### (5) Batas keamanan

- Semua request lewat `fetchOutbound`/`assertOutboundAllowed` (HTTPS, blokir IP
  privat/metadata, redirect dibatasi, timeout 8s).
- Key tidak pernah masuk DTO/log/event/error yang sampai klien; error upstream
  disanitasi (`SearchError` pesan generik, kode stabil).
- Rate-limit: hitung sebelum request (`countSearch`); habis → provider `ready`
  false → dilewati, bukan error. Default: tavily ≤100/hari/user (buffer atas
  1.000/bln), jina ≤50/hari/user, direct ≤40/hari/user. Angka usulan.
- Fail-closed: tanpa hasil valid → `SearchError`, loop D1 mencatat gap, bukan
  mengarang. Snippet ≤300 char (`SNIPPET_MAX` pola existing).
- Query tidak boleh membawa isi file privat/PII: di v1 loop riset belum membaca
  artefak privat sebelum fase web (urutan fase menahan taint `privateContextSeen`
  — kontrak penuh di SDD kawan-next D09, tidak diubah di sini).

### (6) Tes wajib

`src/lib/search/chain.test.ts` (baru):
- `failover tavily gagal ke jina` — attempts tercatat, hasil dari jina.
- `semua provider gagal → SEARCH_UNAVAILABLE` — tidak ada hasil, tidak ada hasil
  fiktif, error retryable:false.
- `kuota harian habis → provider dilewati` — SearchUsageDaily menghalangi ready.
- `key tidak bocor` — error object/DTO tidak memuat key (assert string).
- `countSearch idempotent lintas restart` — upsert naik 1, bukan baris ganda.
- `timeout provider memicu failover` — AbortSignal 8s.

### (7) File disentuh

- Baru: `src/lib/search/chain.ts`, `src/lib/search/chain.test.ts`, migrasi additive
  `SearchUsageDaily` (kedua provider).
- Existing: `prisma/schema.prisma` (model baru), `src/lib/connectors` (union
  provider `tavily`/`jina` di validator), `src/lib/tasks/research.ts` (konsumen),
  opsional `package.json` (+`@mozilla/readability`) menunggu keputusan pemilik.

### (8) Risiko & unknowns

- Multiplikator kredit Tavily per endpoint belum terverifikasi (RISET.md mencatat).
- Masa berlaku free key Jina pasca-akuisisi Elastic belum diketahui.
- `@mozilla/readability` belum terpasang — perlu keputusan tambah dependensi.
- SearXNG existing chat tidak disentuh; dua jalur search (chat SearXNG, riset
  chain) hidup berdampingan sampai keputusan pemilik menyatukan.

---

## D6 — Metering per run

### Konsep

Token usage + sumber dibaca dicatat di `TaskRun` (kolom D1: `usageJson`,
`budgetJson`) dan `TaskSource`, diekspos lewat API snapshot task existing.
Prinsip: `reported` jujur — gateway tidak melapor → angka estimator berlabel,
bukan klaim.

### (1) Perubahan schema Prisma

Tidak ada tambahan di luar D1 (`usageJson`, `budgetJson`, `TaskSource`).

### (2) Kontrak function/module

```ts
// src/lib/tasks/budget.ts (BARU, kecil)
export type RunBudget = {
  max: { inputTokens: number; outputTokens: number };
  consumed: { promptTokens: number; completionTokens: number; totalTokens: number;
              searches: number; reads: number; toolCalls: number };
  estimatorVersion: 1;
};

/** Settle actual setelah model/tool return; CAS revision run dalam transaksi terfence. */
export async function settleUsage(db, fence, runId: string, delta: Partial<RunBudget["consumed"]>): Promise<void>;

/** Bentuk DTO metering untuk snapshot API (additive field response existing). */
export function toRunMetering(run: { usageJson: string | null; budgetJson: string | null;
                                     sources: { kind: string; provider: string | null }[] }): {
  usage: { reported: boolean; promptTokens: number | null; completionTokens: number | null;
           totalTokens: number | null };
  consumed: RunBudget["consumed"];
  sourcesRead: number;
};
```

### (3) Alur TaskEvent + seq

| kind | kapan | payload |
|---|---|---|
| `budget.updated` | tiap settle (per step/model call) | `{consumed, remaining}` |
| `usage.updated` (existing) | sebelum terminal | angka final reported/estimated |

### (4) Tool schema

Tidak ada tool baru. Metering bukan tool.

### (5) Batas keamanan

- Estimator konservatif + label `reported:false` bila gateway tak melapor; jangan
  isi angka karangan (aturan `UsageRecord` existing diikuti).
- Tidak ada biaya/rupiah ditampilkan sampai tarif tepercaya tersedia (non-goal billing).
- DTO tidak memuat key, prompt, isi file; hanya angka + URL/judul sumber bounded.

### (6) Tes wajib

`src/lib/tasks/budget.test.ts` (baru):
- `usage reported dari stream` — parser usage → `usageJson` reported:true.
- `tanpa usage → reported:false` — tidak ada angka karangan.
- `settleUsage CAS` — dua settle bersamaan tidak menghilangkan delta.
- `sourcesRead dihitung dari TaskSource` — kind `page_read` unik per finalUrl+hash.
- `snapshot API mengekspos metering` — response additive; run lama (kolom null)
  tetap valid dengan nilai nol/`reported:false`.

### (7) File disentuh

- Baru: `src/lib/tasks/budget.ts`, `src/lib/tasks/budget.test.ts`.
- Existing: `src/lib/tasks/research.ts` (pemanggil settle), `src/lib/tasks/tasks.ts`
  (proyeksi DTO snapshot), route snapshot task existing (response additive),
  `src/app/api/kawan/v1/tasks/[taskId]/route.ts` (baca kolom, tanpa perubahan kontrak
  breaking).

### (8) Risiko & unknowns

- Estimasi token dari panjang char kasar (±30%); perbaikan butuh tokenizer per
  model — ditunda sampai ada kebutuhan nyata.
- API snapshot existing belum diverifikasi bentuk responsenya di worktree lama
  (file ada di `main`); implementer wajib membaca route aktual sebelum menambah field.

---

## Urutan WO backend dan dependency

```
WO-B1 (schema additive D1/D2/D3/D6: TaskRun fields, TaskStep, TaskSource,
       SearchUsageDaily, Artifact.taskId + migrasi dua provider + db:generate)
  ├─→ WO-B2 (D3 search chain: chain.ts, key resolver, SearchUsageDaily, tests)
  │     └─ (readability: keputusan dep terpisah, tidak blocking WO-B2 core)
  ├─→ WO-B4 (D2 file gen: file-tool enum+parser, registry handler xlsx/docx, tests)
  └─→ WO-B3 (D1 loop riset: research.ts, registry web_search/web_read, dispatch run.ts,
             tests)  — butuh WO-B1 + WO-B2 (web_search butuh chain)
        └─→ WO-B5 (D6 metering: budget.ts, settle di loop, DTO snapshot, tests)
              — butuh WO-B3 (budget dikonsumsi loop) + WO-B1
```

| WO | Delta | Blocking | Diblok oleh | Deliverable |
|---|---|---|---|---|
| WO-B1 | schema | WO-B2, B3, B4, B5 | — | schema.prisma + 2 migrasi + `db:generate` + `check-migrations.mjs` lulus |
| WO-B2 | D3 | WO-B3 | WO-B1 | `chain.ts` + tes; key admin env + BYOK ConnectorCredential |
| WO-B4 | D2 | WO-B3 (konsumsi di loop) | WO-B1 | `file-tool.ts` + registry handler + tes render balik |
| WO-B3 | D1 | WO-B5 | WO-B1, WO-B2, **WO-B4** (loop mengonsumsi generate_file) | `research.ts` + loop + 2 tool registry + tes |
| WO-B5 | D6 | — | WO-B1, WO-B3 | `budget.ts` + settle + DTO snapshot + tes |

WO-B2 dan WO-B4 paralel setelah WO-B1. Gate integrasi penuh (tsc, eslint, test,
build, build dua klien Prisma) milik coordinator per WO selesai.

## Batas umum yang berlaku lintas delta

- Kredensial (key Tavily/Jina/koneksi) tidak pernah masuk DTO, log, event, snapshot.
- Migrasi additive; row lama nullable/default; init existing tidak diubah.
- Semua output model berjalan di worker/server, bukan host langsung; sandbox tetap
  non-goal sampai gate isolasi live.
- Bahasa komentar/pesan/UI Indonesia; ID server-generated; `schemaVersion:1` di
  payload event/DTO.

---

## D4 — Onboarding fokus (backend; melengkapi SDD-FRONTEND)

**Keputusan penyimpanan:** field `onboarding` di `UserSetting` (whitelist `writeSettings`
existing, `src/lib/settings/settings.ts:65`), String `@default("")`. Validasi server:
kosong = belum dijawab; nilai = `riset|data|tulis|campur` atau `custom:<teks>` (teks
≤200 char, disanitasi). Tidak ada tabel baru — kolom additive, merge tanpa data loss.

**Titik injeksi prompt:** di admission task (`src/lib/tasks/tasks.ts` submit, dalam
transaksi yang sama dengan create TaskRun snapshot): nilai onboarding user dibaca dan
disimpan ke kolom snapshot config run (`TaskRun.configJson` field `focus`) — run record
immutable, perubahan setting setelahnya tidak mengubah run berjalan/tercatat. Builder
prompt loop (`research.ts`) menyuntikkan satu kalimat peran dari `focus` (template
bahasa Indonesia, bukan teks user mentah — `custom:` dipotong 200 char).

**Tes wajib** (`src/lib/tasks/admission-onboarding.test.ts` baru):
- submit menyimpan focus ke configJson snapshot run.
- nilai tak valid ditolak dengan pesan jelas (PATCH settings).
- run lama (focus null) tetap valid; prompt tanpa kalimat fokus.
- perubahan setting setelah submit tidak mengubah configJson run sudah ada.

**Kontrak DTO metering (S2-2 review): backend = sumber kebenaran.** DTO final:
`{usage:{reported,promptTokens,completionTokens,totalTokens}, consumed, sourcesRead}`.
Frontend D6 disesuaikan ke nama ini; `estimatedCostUsd` TIDAK diproduksi (aturan
non-goal billing tetap); `stopReason` dibaca dari field run level, bukan metering.

## Klarifikasi pasca-review (26 Okt)

1. **CSV/xlsx cap sel**: tiap baris ≤100 kolom, tiap sel string ≤500 char
   (ditambahkan di schema di atas); validator menolak sebelum render.
2. **`preview` dihapus dari payload step** — data hasil tool tak tepercaya tidak
   pernah masuk TaskEvent/SSE.
3. **`countSearch` increment sebelum request**: request gagal tetap menghabiskan
   kuota harian — perilaku disengaja (rate-limit anti-abuse), dicatat sebagai
   batasan produk, bukan bug.
4. **`clarification_required`**: tidak membuat jalur `waiting_input` baru; mengikuti
   REV-02/REV-03 kawan-next (run berhenti partial dengan pertanyaan di jawaban,
   follow-up = run baru).
5. **readability**: keputusan final ada di IMPLEMENTATION-PLAN.md (disetujui,
   masuk WO-B2); bagian D3 yang "menunggu keputusan" berlaku untuk WO-B2 core saja.
6. **Egress consent (S1-2)**: lihat IMPLEMENTATION-PLAN.md WO-B2c — query dari
   prompt user ke provider pihak ketiga wajib lewat gate egress sebelum WO-B3.
