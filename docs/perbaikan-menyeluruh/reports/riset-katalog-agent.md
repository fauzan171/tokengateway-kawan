
# Riset katalog agent pilih-user

Status: **riset; belum ada kode yang diubah**. Lingkup: pola "pengguna memilih
agent lalu menjalankannya" (Grok bot / DSH AgentTeams) dan registry minimal untuk
Kawan. Satu-satunya berkas yang ditulis oleh tugas ini adalah laporan ini.

Baseline kode: `src/lib/tasks/`, `src/lib/chat/generate.ts`, `tasks/agent-v1/`,
`prisma/schema.prisma` pada checkout `/home/hermes/workspace/projects/tokengateway-kawan`
(branch `merge/main-into-feat-nt-p1`, 23 Oktober 2026).

## 1. Keadaan nyata hari ini

Yang **sudah** ada dan bisa dipakai ulang, tanpa engine kedua:

| Fakta | Bukti | Arti untuk katalog |
|---|---|---|
| Task dimiliki lewat `Task.userId`; resource milik orang lain = 404 | `src/lib/tasks/tasks.ts` (kepala berkas + `findOwnedTask`) | Isolasi antar-user sudah benar di lapisan data; katalog tidak boleh menambah jalur baca yang melewatinya |
| Admission task+run+job+pesan+event satu transaksi | `createTask` di `tasks.ts` | Titik tunggal tempat `agentId` harus divalidasi dan dibekukan |
| `TaskRun` menyimpan `connectionId`, `modelId`, `deadlineAt`, `stepCount`, `lastEventSeq` | `prisma/schema.prisma` model `TaskRun` | Sudah ada tempat menempelkan snapshot agent; tidak perlu tabel baru untuk riwayat |
| `appendEvent` mengalokasikan `seq` di dalam transaksi | `tasks.ts` | Audit trail sudah durable dan replay-able lewat SSE `events.ts` |
| Run saat ini **satu putaran model**, tanpa tool loop | `src/lib/tasks/run.ts` kepala berkas: "menjalankan SATU putaran model ... Tool loop/approval/handover/artifact menyusul" | "Agent" hari ini = prompt sistem + model + deadline. Katalog yang menjanjikan lebih akan berbohong |
| System prompt agent di-hardcode | `run.ts` konstanta `SYSTEM_PROMPT` (dua baris) | Kandidat langsung untuk diganti definisi agent |
| Model dipilih per run, bukan per agent | `CreateTaskInput.modelId` lalu `TaskRun.modelId`; `resolveModel` di `run.ts` | Agent harus boleh menetapkan model default, tetapi pilihan user tetap menang (lihat bagian 4) |
| Koneksi gateway per pengguna, key terenkripsi, hanya satu aktif | `src/lib/connections/connections.ts`; `getActiveConnection` dipakai `run.ts` | Agent tidak boleh membawa kredensial sendiri; ia memakai koneksi milik pemanggil |
| Kuota token **belum** ditegakkan | `UsageRecord` (userId, model, token, `reported`) hanya dicatat; tidak ada pembacaan batas di `run.ts` | Batas quota/budget harus dibangun, bukan diasumsikan ada |
| Rate limit hanya untuk login | `src/lib/auth/rate-limit.ts` + tabel `LoginAttempt` | Belum ada pembatas pembuatan task per pengguna |
| Admin sudah punya pola cek role sendiri | `src/app/api/kawan/v1/admin/users/route.ts`, `admin/config/route.ts` (baca `User.role`, 403 bila bukan admin) | Katalog admin bisa mengikuti pola yang sama; tidak perlu abstraksi otorisasi baru |
| Konfigurasi runtime admin satu baris | `AppConfig` (id = "app") | Tempat menaruh flag "katalog agent aktif" bila perlu; bukan tempat menyimpan definisi agent |
| Job kind tertutup daftar kontrak | `src/lib/jobs/kinds.ts` (`JOB_KINDS`, `HANDLED_KINDS`) | Agent baru **tidak** boleh menambah job kind; semuanya tetap `agent.run` |

Kesimpulan keadaan: fondasi eksekusi (run, event, cancel, lease, deadline) sudah
cukup untuk katalog agent versi minimal. Yang tidak ada adalah (a) definisi agent
sebagai data, (b) pemilihan agent oleh pengguna di admission, (c) penegakan
kuota/budget, (d) audit yang menyebut agent mana yang berjalan.

## 2. Pola pembanding (ringkas, tanpa meniru berlebihan)

**Grok bot / agent pilih-user.** Pengguna melihat daftar bot (nama, deskripsi,
kemampuan), memilih satu, lalu percakapan berjalan dengan persona dan toolset bot
itu. Ciri yang relevan: katalog adalah **data**, bukan kode per agent; pilihan
disimpan di percakapan sehingga riwayat tetap dapat dijelaskan; bot tidak membawa
kredensial pengguna.

**DSH AgentTeams.** Katalog berisi peran (kapten, peneliti, reviewer) dengan
kontrak tugas eksplisit: kind, objective, inScope, acceptance, verify. Ciri yang
relevan: peran menentukan **batas kewenangan**, bukan hanya gaya bahasa; setiap
unit kerja punya pemilik dan attempt id; hasil dilaporkan ke atasan, bukan
ditulis langsung ke state bersama.

Pelajaran yang diambil: definisi agent = identitas + prompt + toolset + batas
(budget, deadline, model) + kewenangan. Pelajaran yang **tidak** diambil: swarm,
penugasan otomatis antar-agent, atau orkestrasi bertingkat. Itu FIX-22 dan
eksplisit ditunda sampai single orchestrator terukur
(`docs/perbaikan-menyeluruh/02-rencana-implementasi.md`, bagian FIX-22).

## 3. Usulan registry agent minimal

Prinsip: satu sumber definisi, satu titik validasi, nol tabel baru untuk definisi,
dan riwayat tetap terbaca setelah definisi berubah.

### 3.1 Definisi agent = konstanta TypeScript, bukan baris database

`src/lib/agents/registry.ts` (baru) berisi array beku:

```ts
type AgentDefinition = {
  id: string;                 // stabil, huruf kecil, dipakai di API
  version: number;            // naik saat prompt/toolset berubah
  label: string;              // teks UI (Indonesia)
  description: string;        // satu kalimat, apa yang dikerjakan
  systemPrompt: string;       // menggantikan SYSTEM_PROMPT di run.ts
  tools: readonly string[];   // subset nama tool yang dikenal worker
  defaultModelId: string;     // kosong = ikut pilihan user / koneksi
  limits: {
    maxSteps: number;
    maxTokensPerRun: number;  // anggaran, bukan klaim usage nyata
    deadlineMs: number;       // menggantikan RUN_DEADLINE_MS per agent
  };
  audience: "all" | "admin";  // siapa yang boleh memilih
};
```

Alasan memilih konstanta dan bukan tabel `Agent`: definisi agent adalah
keputusan rilis (seperti `JOB_KINDS` dan `KNOWN_FAMILIES` di
`src/lib/chat/model-budget.ts`), bukan data pengguna. Menyimpannya di database
menambah migrasi, cache, validasi admin, dan jalur "agent diedit saat run
berjalan" - semuanya tanpa kebutuhan yang terbukti. Bila admin nanti benar-benar
perlu mengubah prompt tanpa deploy, tambahkan tabel `AgentOverride` (id agent +
prompt + revision) dan biarkan registry tetap menjadi daftar yang sah.

`ponytail: definisi agent statis; tambah tabel override saat ada kebutuhan nyata mengubah prompt tanpa deploy.`

### 3.2 Snapshot di run, bukan referensi hidup

`TaskRun` ditambah dua kolom aditif:

```prisma
agentId      String @default("default")
agentVersion Int    @default(1)
```

Migrasi additive, nilai `default` menjaga baris lama tetap sah (init existing
tetap). Prompt **tidak** disalin ke run: `agentVersion` + registry berversi sudah
cukup untuk mereproduksi prompt selama registry menyimpan riwayat versi. Bila
kebijakan "prompt tidak boleh berubah retroaktif" diberlakukan ketat, simpan
`systemPromptHash` (sha256) alih-alih teks penuh - hash membuktikan kecocokan
tanpa menyimpan salinan yang bisa bocor lewat ekspor data.

Yang **tidak** ditambahkan: tabel `AgentRun`, `AgentStep`, kolom `agentConfigJson`.
Semua kebutuhan audit sudah terpenuhi oleh `TaskRun` + `TaskEvent`.

### 3.3 Pemilihan oleh pengguna

- `GET /api/kawan/v1/agents` -> `{ agents: [{ id, version, label, description,
  defaultModelId, limits }] }`, disaring `audience` terhadap role pemanggil.
  Tanpa `systemPrompt` dan tanpa daftar tool internal di respons: prompt adalah
  kebijakan server, bukan bahan yang bisa dipakai untuk prompt injection.
- `POST /api/kawan/v1/tasks` menerima `agentId` opsional (bawaan `"default"`).
  Validasi terjadi **di dalam** transaksi `createTask`, sebelum `enqueue`, supaya
  task tidak pernah lahir dengan agent yang tidak sah.
- `agentId` tidak dapat diubah lewat `PATCH /tasks/{id}`: agent adalah bagian
  dari identitas run, bukan properti yang bisa diedit. Follow-up memakai agent
  yang sama dengan run sebelumnya kecuali body menyebut lain - dan bila menyebut
  lain, itu run baru dengan `agentId` baru, bukan mutasi riwayat.

Kode galat baru: `AGENT_UNKNOWN` (422, id tidak ada di registry) dan
`AGENT_FORBIDDEN` (403, `audience` menolak role pemanggil). Keduanya
`ApiError` biasa, mengikuti pola `INVALID_INPUT` yang sudah ada.

### 3.4 Penegakan batas

**Budget per run** (sudah ada tempatnya, tinggal dipakai):

- `limits.deadlineMs` menggantikan `RUN_DEADLINE_MS` (30 menit) saat
  `createTask`/followUp menulis `TaskRun.deadlineAt`. `run.ts` sudah menegakkan
  deadline sebagai batas keras sebelum memanggil model - tidak perlu kode baru
  selain sumber angkanya.
- `limits.maxSteps` dibandingkan dengan `TaskRun.stepCount` yang sudah
  di-increment di akhir run. Untuk run satu-putaran ini praktis selalu 1; nilainya
  baru berarti setelah tool loop FIX-09 selesai.
- `limits.maxTokensPerRun` adalah **anggaran**, bukan usage. `run.ts` sudah
  memisahkan `reported` dari `estimatedReservedTokens`; penegakan memakai
  `estimateTokens` + `overBudget` dari `src/lib/chat/context-budget.ts` untuk
  menolak prompt yang jelas melebihi anggaran sebelum panggilan berbayar.

**Kuota per user** (belum ada; usulan paling kecil yang bekerja):

Baca langsung dari data yang sudah ada, tanpa tabel baru:

- token terpakai: jumlah `UsageRecord.totalTokens` untuk `userId` dalam jendela
  (harian/bulanan) - hanya baris `reported = 1`, sesuai arti kolom itu.
- run aktif: hitung `TaskRun` nonterminal milik user (sudah ada indeks
  `[status, deadlineAt]`; tambahkan `[taskId, status]` bila query per user
  melambat - task sudah terindeks `[userId, status, updatedAt, id]`).
- task per jendela: hitung `Task` milik user dengan `createdAt` di jendela.

Batas disimpan di env/registry konfigurasi (`src/lib/config/env.ts`), bukan di
tabel: `AGENT_DAILY_TOKEN_QUOTA`, `AGENT_MAX_ACTIVE_RUNS`,
`AGENT_TASK_WINDOW_LIMIT`. Alasan: kuota adalah kebijakan deployment, sama
seperti `DEFAULT_LOGIN_RATE_LIMIT_MAX`; menaruhnya di database menuntut UI admin
dan audit perubahan yang belum diminta.

Penolakan memakai 429 dengan `Retry-After` dari sisa jendela - pola yang sama
dengan `isRateLimited` di `src/lib/auth/rate-limit.ts` (yang menghitung
`retryAfterSeconds` dari data, bukan timer proses).

`ponytail: kuota dari agregasi UsageRecord; pindahkan ke tabel counter saat volume agregasi mulai mahal.`

**Isolasi antar-user.** Sudah ditegakkan `Task.userId` dan tidak boleh
dilonggarkan oleh katalog:

1. Agent tidak membawa kredensial; koneksi gateway selalu milik pemanggil
   (`getActiveConnection` / `connectionId` yang divalidasi kepemilikannya).
2. `artifactIds` yang masuk tetap divalidasi "milik user dan `ready`".
3. Tool yang boleh dipanggil agent dibatasi daftar `tools` di definisinya, dan
   worker tetap memakai `userId` dari task - model tidak pernah menerima id
   pengguna lain.
4. Agent `audience: "admin"` tidak boleh muncul di daftar pengguna biasa, dan
   pemilihannya ditolak 403 walau id-nya ditebak.

### 3.5 Audit

Yang sudah cukup: `TaskEvent` durable + SSE `afterSeq`. Yang perlu ditambah
hanya **isi**, bukan mekanisme:

- event `run.started` sudah membawa `modelId`; tambahkan `agentId` dan
  `agentVersion` di payload yang sama (tanpa event baru).
- `run.queued` membawa `{ taskId }`; tambahkan `agentId` supaya run yang gagal
  sebelum start tetap dapat diatribusikan.
- Untuk admin: query `TaskRun` menurut `agentId` + jendela waktu cukup untuk
  menjawab "agent mana yang dipakai berapa kali, berapa yang gagal". Tidak perlu
  tabel audit terpisah; `errorCode` sudah ada di `TaskRun`.
- Prompt tidak masuk log (`src/lib/api/logger.ts` hanya mencatat requestId,
  route, latency, result) dan tidak boleh mulai masuk lewat katalog.

## 4. Keputusan yang perlu dinyatakan eksplisit

| Pertanyaan | Usulan | Alasan |
|---|---|---|
| Siapa menang antara `modelId` user dan `defaultModelId` agent? | User menang; agent hanya mengisi bila user tidak memilih | Model berbayar milik koneksi user; agent tidak boleh menaikkan biaya diam-diam |
| Bolehkah pengguna membuat agent sendiri? | Tidak, untuk sekarang | Itu editor prompt + penyimpanan + moderasi + audit perubahan; tidak ada permintaan yang membuktikannya |
| Apakah agent menggantikan chat biasa? | Tidak | `chat.generate` dan `agent.run` tetap jalur terpisah seperti sekarang |
| Apakah agent boleh punya job kind sendiri? | Tidak | `JOB_KINDS` adalah kontrak worker; katalog tidak boleh memperluasnya |
| Apakah katalog perlu flag on/off? | Ya, satu baris di `AppConfig` bila rilis bertahap | Pola yang sama dengan `registrationOpen` |

## 5. Urutan implementasi yang diusulkan

1. **Registry + tipe** - `src/lib/agents/registry.ts`, satu agent `default` yang
   isinya persis `SYSTEM_PROMPT` sekarang. Nol perubahan perilaku.
2. **Migrasi aditif** - `TaskRun.agentId`, `TaskRun.agentVersion` (+ default),
   `node scripts/check-migrations.mjs`, `npm run db:generate`.
3. **Admission** - `createTask`/`followUp` memvalidasi `agentId`, menulis
   snapshot, memakai `limits.deadlineMs`.
4. **Eksekusi** - `run.ts` memakai `definition.systemPrompt` dan
   `defaultModelId`; payload event `run.queued`/`run.started` ditambah
   `agentId`/`agentVersion`.
5. **API** - `GET /agents`; `agentId` di body `POST /tasks`.
6. **Kuota** - pemeriksaan sebelum admission (429 + `Retry-After`), konstanta di
   `src/lib/config/env.ts`.
7. **UI** - pemilih agent di composer `src/components/task-view.tsx`; label
   agent aktif pada detail task.
8. **Audit admin** - daftar run per agent; tanpa tabel baru.

Langkah 1-4 sudah memberi "pilih agent lalu jalan" yang jujur. Langkah 5-8 boleh
menyusul; jangan membalik urutannya, karena UI tanpa validasi server hanya
menyembunyikan id yang tidak sah.

## 6. Batas dan risiko

- `run.ts` belum punya tool loop, sehingga perbedaan agent saat ini terbatas
  pada prompt, model default, dan deadline. Menjanjikan "agent bisa browsing"
  sebelum FIX-09/FIX-17 selesai adalah klaim palsu.
- `maxSteps` tidak dapat ditegakkan sebelum tool loop ada; simpan nilainya,
  jangan mengklaim penegakan.
- Kuota token bergantung pada `UsageRecord.reported = 1`; gateway yang tidak
  melaporkan usage membuat kuota tidak dapat dihitung untuk run itu. Perilaku
  yang benar: hitung yang dilaporkan, tampilkan "tidak tersedia" untuk sisanya -
  jangan mengarang angka.
- Agent `audience: "admin"` bukan batas keamanan penuh: admin tetap dapat
  membaca data pengguna lewat endpoint admin yang sudah ada. Katalog hanya
  membatasi siapa yang boleh **menjalankan** agent.
- Belum ada rate limit pembuatan task; kuota bagian 3.4 adalah pekerjaan baru,
  bukan konfigurasi yang tinggal dinyalakan.

## 7. Ringkasan satu paragraf

Katalog agent minimal untuk Kawan = daftar definisi beku di
`src/lib/agents/registry.ts` (id, versi, prompt, toolset, model default,
limit, audience) + dua kolom snapshot di `TaskRun` + validasi `agentId` di dalam
transaksi admission + pemakaian `limits.deadlineMs`/`maxTokensPerRun` yang sudah
punya tempat di `run.ts` + kuota per user yang dihitung dari `UsageRecord` dan
run nonterminal + audit lewat `agentId`/`agentVersion` di payload event yang
sudah ada. Tidak ada tabel agent, tidak ada job kind baru, tidak ada engine kedua.
