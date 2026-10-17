# SDD — Kawan (scope nontechnical-v1)

> Untuk implementasi agen, gunakan [SDD agen lengkap](../agent-v1/README.md); dokumen ini adalah baseline chat yang tidak bertentangan.

> Arah produk diperbarui 17 Oktober 2026: baca [scope aktif](../ACTIVE-SCOPE.md) terlebih dahulu. Keputusan agen, prioritas, dan pengurangan scope di sana mengesampingkan bagian lama yang bertentangan.

Status: spesifikasi desain untuk implementasi. Kode aplikasi ada di akar repo; backend chat sudah tersedia, UI NT-P3 masih parsial. Bagian target di bawah bukan klaim implementasi.
Baseline referensi: `https://github.com/open-webui/open-webui`, commit `f8ae8a6c328946dc62cd0712961a0632574581bf`, versi paket 0.12.0, tersedia read-only di `/Users/mekari/tokengateway/open-webui`.

Dokumen ini adalah Software Design Description: kontrak diselesaikan sebelum coding. Requirement produk ada di `prd.md`; keputusan cakupan per fitur ada di `coverage.md`; urutan kerja ada di `plan.md`.

## Cara membaca

Setiap keputusan diberi label:

- **WAJIB** — konsekuensi requirement P0/P1 di `prd.md`.
- **USULAN** — pilihan teknis Kawan yang boleh diganti dengan bukti tanpa menghapus fitur.
- **PERLU-BUKTI** — nilai pasti harus diambil dari sumber/runtime baseline, bukan diasumsikan dari nama fitur.

Jika dokumen ini bertentangan dengan `prd.md`, requirement produk menang.

---

## SDD-1. Arsitektur

### SDD-1.1 Bentuk sistem

**USULAN (WAJIB untuk v1):** modular monolith Next.js dengan dua proses pendamping opsional.

```text
Browser (Next App Router, React Server Components + client components)
   |
   |-- HTTPS --> Next.js web + route handlers (Node runtime)
   |                   |-- Prisma --> PostgreSQL (prod) / SQLite (dev)
   |                   |-- Storage adapter --> disk lokal atau objek
   |                   |-- SSE endpoint (stream generasi)
   |                   |-- Job runner (worker in-process ATAU proses terpisah)
   |                   `-- Outbound gateway client (kompatibel [OI])
   `-- (opsional) worker proses terpisah, satu binary yang sama, mode worker
```

Prinsip:

1. **Satu basis kode, satu image.** Worker adalah entry point berbeda dari image yang sama (`node worker.js` vs `node server.js`). Tidak ada microservice per fitur.
2. **Satu database relasional sebagai sumber kebenaran.** SQLite untuk dev/pengguna tunggal; PostgreSQL untuk produksi. Schema dikelola Prisma dengan SQL migrasi yang ditulis sendiri.
3. **Tidak ada Redis di v1.** Job diklaim dari tabel `Job` dengan lease berbasis DB. Redis dicatat sebagai jalur lanjutan bila ada bukti beban (lihat SDD-1.6).
4. **Boundary proses mengikuti perbedaan kepercayaan dan sumber daya**, bukan perbedaan domain. Worker memisahkan pekerjaan yang berjalan lama atau memakan memori dari permintaan HTTP.
5. **Eksekusi kode dan browser agen hanya melalui sandbox terisolasi.** Tidak ada plugin Python atau terminal arbitrer di proses web/worker terpercaya; detail batas kepercayaan di `../ACTIVE-SCOPE.md`.

**Mengapa bukan full-parity multi-service:** paket full-parity lama membutuhkan Redis, worker Python terisolasi, vector service, socket gateway. Untuk scope terpilih, itu semua menambah biaya operasional tanpa melayani pengguna nonteknis. `prd.md` 4.2 nomor 7 mencatat penundaan ini secara eksplisit.

### SDD-1.2 Struktur direktori (target)

```text
src/
  app/
    (auth)/masuk, daftar, lupa-sandi
    (app)/onboarding            # layar Hubungkan Gateway
    (app)/c/[id]                # chat
    (app)/pengaturan/...
    (app)/admin/...
    (app)/pemakaian
    share/[token]               # tautan publik
    api/
      auth/[...nextauth]/
      kawan/v1/                 # API internal Kawan
      models/                   # daftar model dari koneksi aktif
      chat/                     # stream + mutasi pohon
      files/                    # unggah + status ingestion
      share/                    # buat/cabut tautan
  components/                   # ui/chat/settings/admin/onboarding
  lib/
    auth/                       # sesi, kredensial, rate limit
    secrets/                    # envelope AES-GCM, rotasi, mask
    connections/                # CRUD koneksi + normalisasi URL + test
    providers/                  # klien kompatibel [OI], discovery model
    chat/                       # pohon pesan, lifecycle generasi, DTO
    rag/                        # ekstraksi, chunk, retrieval, sitasi
    storage/                    # adapter disk/objek
    jobs/                       # klaim, lease, retry, heartbeat
    config/                     # registry konfigurasi + default
    access/                     # pemeriksaan izin
    obs/                        # log, redaksi, metrik
  worker/                       # entry point worker
prisma/
  schema.prisma
  migrations/
tests/
  unit/ integration/ e2e/ conformance/ fixtures/
tasks/nontechnical-v1/          # dokumen ini
```

Struktur ini target, bukan larangan membuat file tambahan. Aturan yang dipegang: tidak ada abstraksi tanpa pemakai kedua yang nyata.

### SDD-1.3 Batas modul dan arah ketergantungan

| Modul | Tanggung jawab | Boleh bergantung pada |
|---|---|---|
| `app/*` (pages, route handlers) | HTTP, render, validasi input, memanggil service | service domain, `lib/access`, `lib/auth` |
| `lib/chat` | Pohon pesan, lifecycle generasi, DTO pesan | `lib/jobs`, `lib/providers`, `lib/secrets` (hanya untuk resolve), `prisma` |
| `lib/connections` | CRUD koneksi, normalisasi, test, discovery | `lib/secrets`, `lib/providers` |
| `lib/providers` | Panggilan HTTP ke gateway, parsing stream, mapping error | `lib/net` (SSRF policy), `lib/obs` |
| `lib/rag` | Ekstraksi, chunk, embedding opsional, retrieval, sitasi | `lib/jobs`, `lib/storage`, `prisma` |
| `lib/secrets` | Enkripsi/dekripsi, mask, rotasi | env/kunci saja |
| `lib/jobs` | Klaim, lease, retry, heartbeat, idempotensi | `prisma` |
| `lib/access` | Pemeriksaan izin per resource | `prisma`, sesi |

Aturan arah: `lib/*` tidak boleh mengimpor dari `app/*`. Modul domain tidak boleh saling memanggil secara melingkar. `prisma` hanya diakses dari modul domain, bukan dari komponen UI.

**WAJIB:** otorisasi ditegakkan di route handler/service, bukan di middleware saja. Middleware hanya untuk routing awal.

### SDD-1.4 Asumsi beban (untuk benchmark, bukan janji kapasitas)

| Asumsi | Perhitungan | Implikasi desain |
|---|---|---|
| 200 pengguna harian × 20 pesan | 4.000 pesan/hari ≈ 0,05/detik rata-rata | CRUD ringan; generasi streaming yang dominan |
| Puncak 20× rata-rata, generasi 20 detik | ≈1 generasi aktif/detik × 20 s ≈ 20 generasi aktif | Pool koneksi DB dan batas konkurensi per pengguna diukur |
| 3 KB per pesan (input+output) | ≈12 MB/hari | Basis data bukan hambatan |
| 50 unggahan/hari × 2 MB | 100 MB/hari ≈ 36 GB/tahun | Penyimpanan dan pembersihan lebih penting daripada ukuran DB |
| 20 generasi aktif × 20 chunk/detik | 400 event/detik pada puncak | Coalesce pembaruan UI; ukur throughput SSE |

SLO internal **USULAN**: API non-provider p95 ≤400 ms; tambahan relay stream p95 ≤150 ms; interaksi composer p95 ≤100 ms. Batas ini ditetapkan ulang berdasarkan benchmark pada perangkat uji yang sama sebelum menjadi gate. Latensi provider tidak dihitung sebagai latensi Kawan.

### SDD-1.5 Konfigurasi dan environment

| Variabel | Kegunaan | Paparan |
|---|---|---|
| `DATABASE_URL` | Koneksi Prisma | Server saja |
| `AUTH_SECRET` | Penandatanganan sesi Auth.js | Server saja |
| `ENCRYPTION_SECRET` | Kunci AES-256-GCM (32 byte ter-decode) | Server saja |
| `ENCRYPTION_KEY_ID` | ID kunci untuk rotasi | Server saja |
| `KAWAN_APP_URL` | Origin kanonik untuk callback dan tautan berbagi | Publik aman |
| `KAWAN_VERSION`, `KAWAN_REPO_URL` | Metadata halaman About | Publik; nilai dari env, bukan URL karangan |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `STORAGE_S3_*` | Adapter penyimpanan | Bagian rahasia hanya server |
| `EMBEDDING_*` | Mesin embedding opsional | Server saja |
| `WEBSEARCH_*` | Mesin pencarian opsional | Server saja |
| `MAX_UPLOAD_BYTES` | Batas unggahan | Server saja |

**WAJIB:** kunci rahasia tidak pernah muncul dengan awalan `NEXT_PUBLIC_`. `.env.example` hanya berisi nama dan deskripsi, tanpa kunci contoh yang berfungsi. Bila `ENCRYPTION_SECRET` hilang atau panjangnya bukan 32 byte setelah decode, aplikasi gagal start dengan pesan jelas — bukan memakai default atau hash diam-diam.

### SDD-1.6 Jalur lanjutan (dicatat, tidak dibangun sekarang)

Redis untuk fan-out dan cache; pemisahan worker berdasarkan beban; vector database khusus bila retrieval melebihi kapasitas Postgres; multi-node. Semua ini `USULAN` dan hanya ditambahkan bila ada pengukuran yang menunjukkan kebutuhan. `ponytail:` jalur ini sengaja ditulis supaya keputusan sadar, bukan kelalaian.

---

## SDD-2. Kepemilikan schema dan model data

### SDD-2.1 Prinsip

1. **WAJIB** Setiap tabel punya satu modul pemilik. Modul lain mengaksesnya lewat service pemilik, bukan query langsung.
2. **WAJIB** Semua timestamp disimpan UTC. Kolom waktu yang ditampilkan memakai zona pengguna saat render, bukan saat simpan.
3. **USULAN** Presisi waktu memakai milidetik (`BigInt`/`DateTime`) kecuali kebutuhan ekspor memerlukan lebih. Presisi yang lebih tinggi dicatat per kolom bila ada.
4. **WAJIB** Uang tidak dimodelkan karena tidak ada billing.

### SDD-2.2 Tabel inti dan pemilik

| Tabel | Pemilik | Kolom kunci | Catatan |
|---|---|---|---|
| `User` | `lib/auth` | id, email unik, name, role (user/admin), status (aktif/nonaktif/pending), createdAt | Email disimpan lowercase ternormalisasi |
| `Credential` | `lib/auth` | userId unik, passwordHash (Argon2id), updatedAt | Dipisah dari `User` mengikuti pola baseline `user`/`auth` |
| `Session` | `lib/auth` | id, userId, tokenHash, expiresAt, userAgentHash, revokedAt | Token mentah tidak disimpan |
| `Connection` | `lib/connections` | id, userId, name, baseUrl, apiKeyEncrypted, keyId, isActive, status(draft/active/error), lastTestAt, lastTestStatus, createdAt | Kunci dienkripsi; status draft dari REQ-NT-04 |
| `ModelCache` | `lib/connections` | id, connectionId, modelListJson, fetchedAt | TTL dari REQ-NT-20 |
| `Chat` | `lib/chat` | id, userId, title, modelRef, folderId nullable, pinned, archived, shareId nullable, createdAt, updatedAt | `modelRef` menyimpan id model yang dipakai chat (REQ-NT-19) |
| `ChatMessage` | `lib/chat` | id, chatId, parentId nullable, role, contentJson, status, usageJson nullable, createdAt, seq | Pohon: `parentId` + urutan; leaf aktif disimpan di `Chat.currentMessageId` |
| `ChatMessagePart` | `lib/chat` | id, messageId, kind (text/tool/image/citation), payloadJson, ordinal | Bagian bertipe agar render tidak menebak |
| `Folder` | `lib/chat` | id, userId, name, createdAt | Satu tingkat (REQ-NT-35) |
| `ShareLink` | `lib/chat` | id, chatId, token unik, snapshotJson, expiresAt nullable, revokedAt nullable, createdAt | Snapshot beku (REQ-NT-36/37/38) |
| `Document` | `lib/rag` | id, userId, filename, mimeType, sizeBytes, storageKey, status, errorCode nullable, createdAt | Status ingestion (REQ-NT-54) |
| `DocumentChunk` | `lib/rag` | id, documentId, ordinal, content, sourceRefJson (halaman/bagian), embedding nullable | Sitasi (REQ-NT-55/57) |
| `Prompt` | `lib/chat` | id, userId nullable (null = bawaan admin), title, body, variablesJson, enabled | REQ-NT-62/64 |
| `UsageRecord` | `lib/chat` | id, userId, chatId nullable, model, promptTokens, completionTokens, totalTokens, reported(bool), createdAt | `reported=false` bila gateway tidak melaporkan (REQ-NT-71) |
| `Setting` | `lib/config` | key, valueJson, scope (system/user), userId nullable, updatedAt | Registry konfigurasi |
| `Job` | `lib/jobs` | id, kind, payloadJson, state, attempts, maxAttempts, availableAt, leaseOwner, leaseToken, leaseExpiresAt, lastError, createdAt | Lihat SDD-4 |
| `AuditLog` | `lib/obs` | id, actorId nullable, action, targetKind, targetId, result, createdAt | Tanpa isi prompt/kredensial |

**Catatan kepemilikan:** kolom `apiKeyEncrypted` hanya ditulis/dibaca `lib/secrets` melalui `lib/connections`. Tidak ada modul lain yang boleh membaca ciphertext.

### SDD-2.3 Status dan enum

- `User.status`: `pending` | `active` | `disabled`.
- `Connection.status`: `draft` | `active` | `error`.
- `ChatMessage.status`: `pending` | `streaming` | `complete` | `stopped` | `error`.
- `Document.status`: `queued` | `processing` | `ready` | `failed`.
- `Job.state`: `queued` | `leased` | `running` | `succeeded` | `failed` | `cancelled` | `indeterminate`.

**WAJIB** `indeterminate` dipakai ketika hasil pekerjaan tidak dapat dipastikan (mis. worker mati di tengah panggilan provider). Jangan menandai `failed` lalu mencoba ulang otomatis, karena bisa menggandakan permintaan berbayar.

### SDD-2.4 Aturan integritas

- **WAJIB** Pesan: `parentId` harus berada di `chatId` yang sama. Menghapus pesan mempertahankan anak-cucu dengan cara menyambung ulang ke parent (baseline memiliki perilaku ini; **PERLU-BUKTI** detail persisnya dari `backend/open_webui/models/chats.py`, jangan menebak).
- **WAJIB** `Chat.currentMessageId` harus menunjuk pesan yang ada, atau null.
- **WAJIB** Deteksi siklus saat menyusun ancestry dari leaf ke root (visited set).
- **WAJIB** Siklus impor/dangling reference dari JSON yang tidak sah ditolak dengan pesan jelas.
- **USULAN** Foreign key `ON DELETE CASCADE` hanya untuk data milik pengguna (chat, dokumen, koneksi) agar penghapusan akun (REQ-NT-75) bersih. Untuk `Document`→`DocumentChunk`, cascade diperlukan.
- **WAJIB** Menghapus koneksi tidak menghapus chat (REQ-NT-09). `Chat.modelRef` menjadi referensi mati dan UI menampilkan catatan.

### SDD-2.5 Migrasi

**WAJIB** Alur migrasi: expand → backfill → verifikasi → pindah pembaca/penulis → kontrak (hapus kolom lama) hanya setelah backup dan review. Setiap migrasi harus reversibel secara prosedur (ada langkah mundur yang terdokumentasi), walaupun tidak semua otomatis.

**WAJIB** Uji migrasi pada SQLite dan PostgreSQL pada CI: buat DB kosong, jalankan semua migrasi, bandingkan schema hasil dengan yang diharapkan.

### SDD-2.6 Retensi dan penghapusan

| Data | Retensi default | Catatan |
|---|---|---|
| Chat & pesan | Sampai pengguna menghapus | Termasuk di ekspor (REQ-NT-40) |
| Dokumen & chunk | Sampai pengguna menghapus | Menghapus dokumen menghapus chunk dan embedding (REQ-NT-59) |
| UsageRecord | 12 bulan **USULAN** | Agregasi harian tetap disimpan |
| Job selesai | 30 hari **USULAN** | Job gagal disimpan lebih lama untuk diagnosis |
| AuditLog | 12 bulan **USULAN** | Tanpa isi sensitif |
| Sesi dicabut | 30 hari | Untuk mendeteksi penyalahgunaan token |

---

## SDD-3. Kontrak API

### SDD-3.1 Prinsip

- Semua endpoint internal Kawan berada di bawah `/api/kawan/v1/*` untuk menghindari bentrok dengan rute halaman.
- **WAJIB** Server menurunkan identitas pengguna dari sesi. Body tidak dipercaya untuk `userId`.
- **WAJIB** Respons galat memakai bentuk seragam.
- **WAJIB** Kredensial tidak pernah masuk query string atau path.
- **WAJIB** Logging body dimatikan untuk endpoint kredensial.

Bentuk galat:

```json
{
  "error": {
    "code": "CONNECTION_TEST_FAILED",
    "message": "Key ditolak oleh gateway. Periksa kembali.",
    "requestId": "req_abc123",
    "retryable": false,
    "details": { "upstreamStatus": 401 }
  }
}
```

`details` hanya berisi field yang aman untuk peran pemanggil. Kode status: 400 input salah bentuk; 401 belum masuk; 403 izin ditolak; 404 tidak ada atau tidak boleh diketahui keberadaannya; 409 konflik (revisi/idempotensi/status); 422 bentuk benar tetapi nilai tidak sah; 429 batas laju; 502 gateway membalas tidak sah; 503 ketergantungan tidak tersedia; 504 timeout handshake.

### SDD-3.2 Onboarding dan koneksi

**`POST /api/kawan/v1/connections/test`** — uji koneksi tanpa menyimpan.

```json
// request
{ "baseUrl": "https://api.tokengateway.ai.id/v1", "apiKey": "sk-..." }
// 200 sukses
{ "ok": true, "modelCount": 12, "sampleModels": ["gpt-4o-mini", "claude-sonnet"] }
// 200 gagal (bukan 4xx: ini hasil uji, bukan galat request)
{ "ok": false, "reason": "UNAUTHORIZED", "message": "Key ditolak oleh gateway." }
```

`reason` ∈ `UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `TIMEOUT` | `DNS` | `TLS` | `EMPTY_MODELS` | `BAD_URL` | `UPSTREAM_ERROR`.

**`POST /api/kawan/v1/connections`** — buat koneksi.

```json
{ "name": "Gateway Saya", "baseUrl": "...", "apiKey": "sk-...", "skipTest": false }
// 201
{ "id": "conn_1", "name": "Gateway Saya", "baseUrl": "...", "apiKeyMask": "sk-...abc1",
  "isActive": true, "status": "active", "lastTestStatus": "ok" }
```

**WAJIB** Respons tidak pernah memuat `apiKey` atau ciphertext (REQ-NT-07). `skipTest: true` membuat `status: "draft"` (REQ-NT-04).

**`GET /api/kawan/v1/connections`** — daftar; hanya mask.
**`PATCH /api/kawan/v1/connections/{id}`** — ubah nama/baseUrl/key/isActive. Mengubah key atau baseUrl mengembalikan status ke `draft` sampai diuji ulang.
**`DELETE /api/kawan/v1/connections/{id}`** — hapus; chat tidak terhapus (REQ-NT-09).
**`POST /api/kawan/v1/connections/{id}/activate`** — jadikan aktif; menonaktifkan koneksi aktif lain dalam satu transaksi (REQ-NT-10).

### SDD-3.3 Model

**`GET /api/kawan/v1/models?refresh=1`** — daftar model dari koneksi aktif. Respons:

```json
{ "connectionId": "conn_1", "fetchedAt": "2026-10-14T10:00:00Z",
  "models": [ { "id": "gpt-4o-mini", "label": "GPT-4o mini",
                "capabilities": { "vision": true, "tools": true, "imageGen": false, "audio": false } } ] }
```

**WAJIB** `capabilities` hanya berisi nilai yang diketahui; field yang tidak diketahui di-omit, bukan diisi `false` palsu (REQ-NT-21/69). **PERLU-BUKTI** bentuk metadata model pada baseline (`backend/open_webui/routers/openai.py`, endpoint `/models`) untuk memastikan pemetaan kapabilitas tidak menebak.

### SDD-3.4 Chat dan streaming

**`POST /api/kawan/v1/chat/{chatId}/messages`** — kirim pesan.

```json
{ "content": "Halo", "parentId": "msg_5", "model": "gpt-4o-mini",
  "attachments": ["doc_1"], "webSearch": false }
// 202
{ "userMessageId": "msg_6", "assistantMessageId": "msg_7", "generationId": "gen_1" }
```

Klien kemudian membuka `GET /api/kawan/v1/chat/{chatId}/stream?generationId=gen_1` (SSE). Lihat SDD-4.

**`POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/edit`** — edit pesan.

```json
{ "content": "Teks baru", "mode": "branch" }   // mode: branch | inplace
// 200
{ "newMessageId": "msg_8", "siblings": ["msg_6","msg_8"], "currentMessageId": "msg_8" }
```

**WAJIB** `mode: "branch"` membuat sibling (REQ-NT-25). `mode: "inplace"` hanya mengubah isi node yang sama dan tidak membuat cabang baru. Node yang sedang streaming ditolak 409 (REQ-NT-26).

**`POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/regenerate`** — buat jawaban alternatif.
**`POST /api/kawan/v1/chat/{chatId}/messages/{messageId}/continue`** — lanjutkan jawaban.
**`POST /api/kawan/v1/chat/{chatId}/generations/{generationId}/stop`** — hentikan; menyimpan partial (REQ-NT-23).
**`POST /api/kawan/v1/chat/{chatId}/branch`** — pindah leaf aktif: `{ "messageId": "msg_8" }`.

### SDD-3.5 Riwayat, folder, berbagi

- `GET /api/kawan/v1/chats?q=&folderId=&archived=&cursor=` — daftar berpaginasi berbasis kursor.
- `PATCH /api/kawan/v1/chats/{id}` — ubah judul, pinned, archived, folderId.
- `DELETE /api/kawan/v1/chats/{id}`.
- `POST /api/kawan/v1/folders`, `PATCH /api/kawan/v1/folders/{id}`, `DELETE /api/kawan/v1/folders/{id}`.
- `POST /api/kawan/v1/chats/{id}/share` → `{ "url": ".../share/tok_1", "expiresAt": null }`.
- `DELETE /api/kawan/v1/chats/{id}/share` — cabut; tautan lama 404 (REQ-NT-37).
- `GET /share/{token}` — halaman publik; tanpa login; hanya snapshot.
- `GET /api/kawan/v1/export/chats/{id}?format=md|json`.
- `POST /api/kawan/v1/import/chats` — impor JSON.
- `GET /api/kawan/v1/export/all` — arsip semua data pengguna (tanpa kredensial).

**WAJIB** `GET /share/{token}` tidak memuat kredensial, pesan sistem privat, atau metadata internal (REQ-NT-41). Uji canary wajib.

### SDD-3.6 Dokumen dan RAG

- `POST /api/kawan/v1/documents` — multipart; membuat `Document` status `queued` dan `Job` ekstraksi.
- `GET /api/kawan/v1/documents` — daftar dengan status.
- `GET /api/kawan/v1/documents/{id}` — detail termasuk `errorCode` bila gagal.
- `DELETE /api/kawan/v1/documents/{id}` — hapus dokumen + chunk + embedding.
- `GET /api/kawan/v1/documents/{id}/chunks/{chunkId}` — tampilkan potongan sumber untuk sitasi.

### SDD-3.7 Pemakaian, pengaturan, admin

- `GET /api/kawan/v1/usage?from=&to=&groupBy=day|model` → `{ "reported": true, "rows": [...] }`; `reported:false` bila gateway tidak melaporkan (REQ-NT-71/72).
- `GET /api/kawan/v1/usage/export.csv`.
- `GET|PATCH /api/kawan/v1/settings` — preferensi pribadi.
- `GET /api/kawan/v1/admin/users`, `PATCH .../users/{id}` (aktif/nonaktif), `DELETE .../users/{id}`.
- `GET /api/kawan/v1/admin/status` — versi, status DB, status worker, hitungan.
- `GET|PATCH /api/kawan/v1/admin/config` — registrasi konfigurasi.

### SDD-3.8 Aturan lintas endpoint

- **WAJIB** Header `X-Request-Id` dibuat/divalidasi; dipakai untuk korelasi log.
- **WAJIB** `Cache-Control: private, no-store` pada respons kredensial, chat, pengaturan, pemakaian.
- **WAJIB** Endpoint mutasi yang menyentuh resource persisten memakai pemeriksaan revisi (`If-Match`) atau idempotency key untuk mencegah tulis ganda.
- **USULAN** Paginasi berbasis kursor (`cursor` opaque), bukan offset, agar daftar besar stabil.
- **WAJIB** Tidak ada `Access-Control-Allow-Origin: *` pada permintaan berkredensial.

---

## SDD-4. Lifecycle generasi, SSE, resume, cancel, idempotensi

### SDD-4.1 Mengapa job durable

Permintaan HTTP bisa terputus. Model nonteknis membiarkan tab terbuka dan berharap jawaban tetap ada. Karena itu generasi bukan milik koneksi HTTP; ia milik record `Job`/`Generation` di database. SSE hanya cara mengirim kemajuan ke klien.

### SDD-4.2 State machine generasi

```text
queued --> preparing --> streaming --> complete
                    |            |--> stopped        (pengguna menekan Stop)
                    |            |--> error          (provider gagal)
                    |            `--> waiting_tool   (bila tool dipakai; ditunda di v1)
                    `--> indeterminate               (worker mati; hasil tak diketahui)
```

**WAJIB** `indeterminate` tidak otomatis diulang. UI menampilkan "Hasil tidak dapat dipastikan" dengan tombol Coba lagi manual, agar tidak menggandakan permintaan berbayar.

### SDD-4.3 Alur

1. `POST .../messages` menyisipkan pesan pengguna dan pesan assistant placeholder, lalu `Job(kind=chat.generate)` dalam satu transaksi. Mengembalikan `generationId`.
2. Worker mengklaim job: `UPDATE Job SET state='leased', leaseOwner=?, leaseToken=?, leaseExpiresAt=? WHERE id=? AND state='queued'` — klaim atomik dengan `WHERE` pada state.
3. Worker membuka stream ke gateway, menulis potongan ke `ChatMessagePart` dan memperbarui `ChatMessage.status='streaming'`.
4. Setiap potongan juga dipublikasikan sebagai event SSE bernomor (`seq`).
5. Selesai → `complete`; stop → `stopped` dengan partial tersimpan; galat → `error` dengan `errorCode`.
6. Heartbeat worker memperpanjang lease; lease kedaluwarsa → job kembali `queued` untuk worker lain, hanya untuk pekerjaan lokal yang idempoten. Chat/embedding tidak diulang otomatis: tidak adanya output bukan bukti provider belum menerima request; hasil ambigu → `indeterminate`.

**WAJIB** Klaim job menggunakan `WHERE state='queued'` dan token lease, bukan hanya `UPDATE ... SET leaseOwner` (race condition klasik).

### SDD-4.4 Kontrak SSE

Endpoint: `GET /api/kawan/v1/chat/{chatId}/stream?generationId=gen_1&afterSeq=0`.

Header: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `X-Accel-Buffering: no` (agar proxy tidak menahan).

Event:

```text
event: meta
data: {"generationId":"gen_1","assistantMessageId":"msg_7","model":"gpt-4o-mini","seq":0}

event: part
data: {"seq":1,"kind":"text","text":"Halo"}

event: usage
data: {"seq":14,"promptTokens":12,"completionTokens":8,"totalTokens":20,"reported":true}

event: done
data: {"seq":15,"status":"complete","finishReason":"stop"}

event: error
data: {"seq":15,"code":"UPSTREAM_TIMEOUT","message":"Gateway tidak merespons.","retryable":true}
```

**WAJIB** Setiap event punya `seq` monoton. Klien menyimpan `lastSeq` dan menyambung ulang dengan `afterSeq=lastSeq`, sehingga tidak kehilangan potongan saat koneksi putus (REQ-NT-22, REQ-NT-27).

**WAJIB** Setelah stream selesai, klien melakukan satu `GET /api/kawan/v1/chat/{chatId}` untuk rekonsiliasi keadaan akhir, sehingga tidak bergantung pada kelengkapan SSE.

**WAJIB** Server tidak menulis apa pun ke koneksi setelah `done`/`error`.

### SDD-4.5 Resume

1. Koneksi SSE putus → klien menunggu 1 detik, 2 detik, 4 detik (backoff, maksimum 3 percobaan).
2. Klien membuka ulang dengan `afterSeq=lastSeq`.
3. Server memutar event dari buffer/DB mulai `seq > afterSeq`.
4. Bila generasi sudah terminal, server langsung mengirim `done`/`error` lalu menutup.

**USULAN** Buffer event disimpan di `ChatMessagePart` + tabel ringkas `GenerationEvent` (seq, kind, payload) untuk pemutaran ulang. Bila job sudah lama selesai, cukup kirim keadaan akhir.

### SDD-4.6 Cancel

`POST .../generations/{id}/stop`:

1. Set `cancelRequestedAt`.
2. Worker melihat flag pada iterasi berikutnya (maksimum 1 chunk), menutup koneksi ke gateway, menyimpan partial, set status `stopped`.
3. SSE mengirim `done` dengan `status:"stopped"`.

**WAJIB** Stop tidak menjanjikan pembatalan efek samping di sisi gateway (mis. tool eksternal). Pesan UI tidak boleh mengklaim hal itu.

### SDD-4.7 Idempotensi

- **WAJIB** `POST .../messages` menerima header `Idempotency-Key`. Kunci sama + digest permintaan sama → kembalikan hasil yang sama (bukan generasi baru). Kunci sama + digest berbeda → 409.
- **WAJIB** Kunci idempotensi disimpan unik per pengguna.
- **WAJIB** Pengiriman ulang setelah tombol Coba lagi memakai kunci baru secara sadar, karena pengguna memang meminta percobaan baru.

### SDD-4.8 Multi-model (P2, dicatat)

v1 mengirim ke satu model per pesan. Struktur `Generation`/`ChatMessagePart` dirancang agar beberapa `ChatMessage` assistant sibling dari satu pesan pengguna dapat ditambahkan kemudian tanpa migrasi besar. Tidak dibangun di v1 (lihat `coverage.md`).

---

## SDD-5. Auth, secret, dan SSRF

### SDD-5.1 Autentikasi

**USULAN (WAJIB untuk v1):** Auth.js Credentials provider dengan strategi sesi JWT + tabel `Session` untuk pencabutan.

- **WAJIB** Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` bila HTTPS.
- **WAJIB** Muat ulang status pengguna (aktif/nonaktif) pada setiap permintaan; jangan bergantung pada klaim role di token yang bisa basi.
- **WAJIB** Pembuatan admin pertama atomik (transaksi dengan penguncian), agar dua registrasi bersamaan tidak keduanya menjadi admin (REQ-NT-12).
- **WAJIB** Pesan galat login bersifat generik.
- **WAJIB** Rate limit login berbasis tabel (bukan hanya memori) agar bertahan setelah restart (REQ-NT-15).
- **WAJIB** Argon2id dengan parameter yang dicatat di kontrak keamanan.

### SDD-5.2 Envelope enkripsi kredensial

```text
v1:<keyId>:<nonce-b64url>:<ciphertext-b64url>:<tag-b64url>
```

- **WAJIB** AES-256-GCM; nonce acak 12 byte per enkripsi; tag 16 byte.
- **WAJIB** AAD memuat versi, id baris, userId, dan tujuan (`connection.apiKey`) dalam encoding kanonik, sehingga ciphertext tidak dapat dipindahkan antar baris.
- **WAJIB** Kunci berasal dari `ENCRYPTION_SECRET` (32 byte ter-decode). Panjang salah → gagal start.
- **WAJIB** Mask hanya dibuat dari key asli saat key tersedia; **jangan** mendekripsi hanya untuk membuat mask pada operasi daftar.
- **WAJIB** Ciphertext tidak pernah masuk ke respons API, event SSE, log, ekspor, atau snapshot berbagi.

**Rotasi kunci (WAJIB terdokumentasi, boleh dijalankan nanti):** tambah keyId baru → deploy pembaca yang menerima lama+baru → re-enkripsi bertahap dengan checkpoint → verifikasi sampel → backup → pensiunkan kunci lama setelah periode retensi. Rotasi `AUTH_SECRET` dan `ENCRYPTION_SECRET` adalah dua operasi terpisah.

### SDD-5.3 Kebijakan keluar (SSRF)

**WAJIB** Semua panggilan ke baseUrl pengguna melewati satu modul kebijakan:

1. Skema hanya `https` (dan `http` hanya bila operator mengizinkan eksplisit untuk pengembangan).
2. Resolusi DNS sebelum koneksi; tolak alamat loopback, link-local, dan rentang metadata cloud (`169.254.0.0/16`, `::1`, `127.0.0.0/8`) kecuali diizinkan operator lewat allowlist presisi.
3. Klien gateway JSON dan streaming menolak seluruh redirect (`redirect: "error"`). Operator mengisi URL endpoint akhir. Dukungan redirect kelak wajib memvalidasi tiap target sebelum koneksi.
4. Batas waktu koneksi dan total; batas ukuran respons.
5. Tolak URL dengan kredensial tertanam (`user:pass@`).

**USULAN** Allowlist operator untuk gateway privat on-premise (mis. `10.x`) diatur lewat variabel konfigurasi, bukan dengan melonggarkan aturan global.

**WAJIB** Uji: endpoint metadata cloud tidak dapat dihubungi lewat baseUrl pengguna.

### SDD-5.4 Penanganan galat provider

| Keadaan | Pesan pengguna | Tindakan |
|---|---|---|
| 401 dari gateway | "Key ditolak oleh gateway." | Tawarkan edit koneksi |
| 403 | "Gateway menolak permintaan ini." | Tampilkan detail aman |
| 429 | "Terlalu banyak permintaan. Coba lagi sebentar." | Tombol coba lagi |
| 5xx | "Gateway sedang bermasalah." | Tombol coba lagi |
| Timeout | "Gateway tidak merespons." | Tombol coba lagi |
| Koneksi putus di tengah | "Koneksi terputus." | Resume/regenerate |

**WAJIB** Galat provider **tidak** mengeluarkan pengguna dari sesi Kawan. 401 gateway bukan 401 akun.

---

## SDD-6. Upload, dokumen, RAG, dan keamanan konten

### SDD-6.1 Pipeline ingestion

```text
unggah --> validasi --> simpan berkas --> Job(extract) --> ekstraksi teks
        --> chunk --> embedding (opsional) --> status ready
```

1. **Validasi (WAJIB):** tipe MIME terhadap allowlist (`application/pdf`, `text/plain`, `text/markdown`), ukuran ≤ `MAX_UPLOAD_BYTES`, nama file disanitasi. Menolak menjelaskan sebab (REQ-NT-60).
2. **Simpan (WAJIB):** berkas di penyimpanan di luar webroot dengan nama acak; path asli tidak dipakai sebagai path penyimpanan.
3. **Job ekstraksi (WAJIB):** berjalan di worker, bukan di route handler, agar unggahan besar tidak menahan permintaan HTTP.
4. **Chunk (USULAN):** 800–1200 karakter dengan overlap 100–200; batas chunk per dokumen untuk mencegah dokumen raksasa menghabiskan memori.
5. **Embedding (USULAN):** bila `EMBEDDING_*` dikonfigurasi, hasil disimpan di `DocumentChunk.embedding` (tipe `vector` di Postgres, `BLOB` di SQLite). Bila tidak dikonfigurasi, retrieval memakai pencarian kata kunci (REQ-NT-61).
6. **Status (WAJIB):** setiap transisi status terlihat oleh pengguna (REQ-NT-54).

### SDD-6.2 Retrieval dan sitasi

**WAJIB** Retrieval selalu difilter `documentId`/`userId` milik pengguna aktif di level query, bukan hanya di level aplikasi (REQ-NT-58).

Alur: pertanyaan → ambil 5–8 potongan teratas → susun konteks dengan penanda `[1]`, `[2]` → kirim ke model → post-process jawaban untuk memetakan penanda ke metadata sumber → simpan sebagai `ChatMessagePart` kind `citation` (REQ-NT-57).

**WAJIB** Bila model tidak mengutip apa pun padahal konteks dikirim, UI tidak menampilkan sitasi palsu. Lebih baik tidak ada sitasi daripada sitasi yang salah.

### SDD-6.3 Keamanan konten

| Risiko | Kendali |
|---|---|
| XSS lewat markdown model | Sanitasi HTML; tolak `<script>`, atribut `on*`, `javascript:` URL (REQ-NT-44) |
| SSRF lewat URL di dalam dokumen | Tautan tidak diambil otomatis; hanya ditampilkan |
| Prompt injection dari dokumen | Dokumen diberi penanda sebagai data, bukan instruksi; UI menjelaskan bahwa jawaban bisa keliru |
| Berkas berbahaya | Tipe allowlist; tidak dieksekusi; disajikan dengan `Content-Disposition` aman |
| Kebocoran lintas pengguna | Filter `userId` di semua query dokumen (REQ-NT-58) |
| Isi berkas di log | Log hanya metadata (id, ukuran, status), bukan isi |

**WAJIB** CSP dasar: `default-src 'self'`; `script-src 'self'`; `img-src 'self' data: blob:`; `connect-src 'self'`. Penyesuaian bila mesin eksternal dikonfigurasi, tetapi tidak pernah `unsafe-eval` di produksi.

### SDD-6.4 Pembersihan

**WAJIB** Menghapus dokumen menghapus berkas, chunk, embedding, dan referensi di pesan. Sediakan job pembersih untuk yatim (berkas tanpa baris `Document`) yang berjalan berkala.

---

## SDD-7. Frontend, aksesibilitas, dan mobile

### SDD-7.1 Kepemilikan state

| State | Otoritas | Klien |
|---|---|---|
| Sesi/pengguna | Server | Proyeksi aman; muat ulang saat status berubah |
| Pohon pesan | Database | Reducer ternormalisasi; operasi optimistis dengan rollback pada 409 |
| Status generasi | Job + event | Reducer dengan dedup berdasarkan `seq` |
| Draf composer | Tab/perangkat | Nama-ruang per chat; tidak menyimpan rahasia |
| Daftar model | Server (cache) | Cache dengan TTL dan tombol segarkan |
| Kredensial (mask) | Server | Hanya tampilan mask |

**WAJIB** Jangan menaruh riwayat penuh atau konfigurasi berkredensial di context global React. Gunakan hook/reducer lokal dan klien service bertipe.

**USULAN** Server component untuk shell dan keadaan awal; client component untuk chat, pengaturan, editor. Muat berat (editor, Mermaid, KaTeX) secara lazy per fitur, bukan di bundel awal chat.

### SDD-7.2 Layar

**Onboarding (NT1).** Kartu tengah, judul "Hubungkan Gateway", tiga isian, tombol Test koneksi, hasil uji, tombol Simpan. Bawah isian URL: tautan "Pakai gateway tokengateway.ai.id? Daftar di sini". Pada gagal/kosong: kartu CTA "Belum punya API key? Dapatkan di tokengateway.ai.id". Teks keamanan menjelaskan mode server apa adanya (REQ-NT-08). Tidak boleh ada kontrol mati.

**Chat.** Sidebar (chat baru, pencarian, riwayat berkelompok, arsip, folder, pengaturan, pemakaian, atribusi bawah `by tokengateway.ai.id`); header dengan pemilih model dan tombol berbagi; area pesan dengan tombol salin, edit, regenerate, rating ringan; composer dengan lampiran, tombol pencarian web (hanya bila tersedia), pemilih prompt.

**Pengaturan.** Tab: Umum (tema, bahasa, font), Koneksi (kelola gateway), Pemakaian, Akun, Privasi, Tentang (versi + repo + `by tokengateway.ai.id`).

**Admin.** Pengguna (daftar, aktif/nonaktif, hapus), Status sistem, Konfigurasi, Prompt bawaan.

### SDD-7.3 Aksesibilitas (WAJIB)

1. Semua kontrol dapat dijangkau keyboard; urutan fokus logis; fokus kembali ke pemicu setelah modal/drawer ditutup.
2. Setiap kontrol punya label aksesibel; ikon-saja punya `aria-label`.
3. Kontras teks memenuhi WCAG AA (4.5:1 untuk teks normal).
4. Status dinamis (streaming, unggah, galat) diumumkan lewat `aria-live="polite"`.
5. Tidak ada indikasi berbasis warna saja.
6. Modal/dialog memakai `role="dialog"`, memerangkap fokus, dan dapat ditutup dengan Escape.
7. `prefers-reduced-motion` dihormati.

### SDD-7.4 Mobile (WAJIB)

1. Layout berfungsi pada lebar 360 px.
2. Sidebar menjadi drawer; fokus kembali ke tombol menu.
3. Area aman (safe area) dihormati untuk perangkat berlekuk.
4. Tombol utama minimal 44×44 px.
5. Composer tetap terlihat saat keyboard virtual muncul.
6. Tidak ada gulir horizontal yang tidak diinginkan.

### SDD-7.5 Bahasa dan format

**WAJIB** Teks UI Indonesia yang jelas; istilah teknis dijelaskan saat pertama muncul. Format tanggal/angka mengikuti locale pengguna. Tidak ada teks Inggris yang tertinggal tanpa alasan.

### SDD-7.6 Branding (WAJIB)

- Nama produk: **Kawan**.
- Atribusi `by tokengateway.ai.id` pada sidebar (bawah), halaman masuk/daftar, onboarding, dan About.
- Semua tautan keluar memakai `target="_blank"` + `rel="noopener noreferrer"`.
- Metadata halaman: `Kawan — Chat AI by tokengateway.ai.id`.
- Aset (logo/ikon) dibuat sendiri. Sebelum menyalin aset apa pun dari baseline, wajib review lisensi/merek (lihat `coverage.md`).

---

## SDD-8. Job, worker, dan operasi

### SDD-8.1 Jenis job

| Kind | Pemilik | Idempoten | Catatan |
|---|---|---|---|
| `chat.generate` | `lib/chat` | Tidak untuk efek provider | Idempotency-Key hanya dedup request lokal; hasil ambigu → indeterminate |
| `document.extract` | `lib/rag` | Ya (per documentId) | Bisa dicoba ulang aman |
| `document.embed` | `lib/rag` | Tidak dijamin untuk efek provider | Tidak retry otomatis tanpa bukti aman |
| `usage.aggregate` | `lib/chat` | Ya | Harian |
| `storage.cleanup` | `lib/storage` | Ya | Berkas yatim |
| `email.send` | `lib/auth` | Tidak dijamin | Bila SMTP dikonfigurasi |

**WAJIB** Job yang memanggil layanan berbayar (`chat.generate`, `document.embed` bila berbayar) tidak boleh dicoba ulang otomatis tanpa memeriksa apakah percobaan sebelumnya menghasilkan efek. Ragu → `indeterminate`.

### SDD-8.2 Klaim dan lease

```sql
UPDATE "Job" SET state='leased', "leaseOwner"=:worker, "leaseToken"=:token,
  "leaseExpiresAt"=:now+interval, "heartbeatAt"=:now
WHERE id=:id AND state='queued';
```

Bila `rowsAffected = 0`, job sudah diklaim pihak lain. Heartbeat memperpanjang lease. Lease kedaluwarsa → job kembali `queued` hanya bila kind-nya idempoten; selain itu → `indeterminate`.

**WAJIB** Batas percobaan (`maxAttempts`) dan backoff eksponensial dengan jitter.

### SDD-8.3 Worker

**USULAN** Worker adalah proses terpisah dari image yang sama: `node dist/worker.js`. Menjalankan worker di dalam proses web dimungkinkan untuk pengembangan, tetapi tidak untuk produksi karena restart web akan mematikan generasi berjalan.

**WAJIB** Worker menangani shutdown dengan sopan: berhenti mengklaim, menyelesaikan job berjalan atau menandainya `indeterminate`, melepas lease dengan aman.

### SDD-8.4 Deployment

| Profil | Proses | Klaim kemampuan |
|---|---|---|
| dev | Next dev + SQLite + worker in-process | Onboarding, chat, RAG kata kunci |
| self-host | Next (produksi) + worker + Postgres opsional + penyimpanan disk | Semua P0 |
| self-host + objek | Tambah adapter S3 | Semua P0 dengan penyimpanan eksternal |

**WAJIB** Urutan start: migrasi → verifikasi schema → start web → start worker → readiness. Provider opsional yang mati tidak membuat healthcheck gagal.

**WAJIB** `.env.example` mencantumkan semua variabel wajib dengan deskripsi. Startup gagal dengan pesan jelas bila variabel wajib hilang.

### SDD-8.5 Observabilitas

- **WAJIB** Log terstruktur (JSON) dengan `requestId`, `userId` (hash/id, bukan email), `route`, `latencyMs`, `result`.
- **WAJIB** Redaksi terpusat: kunci yang mengandung `key`, `secret`, `password`, `token`, `authorization` diganti `[REDACTED]` sebelum ditulis.
- **USULAN** Metrik: jumlah generasi per status, latensi stream, panjang antrean job, tingkat galat provider.
- **WAJIB** Endpoint `/api/kawan/v1/admin/status` untuk pemeriksaan operator.

### SDD-8.6 Backup dan restore

**WAJIB** Backup mencakup: database (dump), penyimpanan berkas, dan **kunci enkripsi**. Tanpa `ENCRYPTION_SECRET`, ciphertext tidak dapat dipulihkan — ini harus dinyatakan jelas di dokumen operator.

**WAJIB** Restore diuji di CI atau prosedur terjadwal: pulihkan ke instance bersih, verifikasi hitungan baris dan sampel dokumen, verifikasi dekripsi koneksi.

**WAJIB** Prosedur upgrade: backup → jalankan migrasi → start → verifikasi → rollback dengan restore bila gagal. Rollback aplikasi hanya ke versi yang schema-compatible.

---

## SDD-9. Testing, kualitas, dan gate

### SDD-9.1 Piramida test

| Lapis | Isi | Alat |
|---|---|---|
| Unit | Normalisasi URL, envelope enkripsi, reducer pohon, mapping galat, chunking | Runner test Node (dipilih saat bootstrap) |
| Integrasi | Route handler + DB nyata (SQLite/Postgres uji) | Sama + klien HTTP |
| E2E | Alur A–E di `prd.md` 7.3 | Playwright |
| Conformance | Capability matrix, canary secret, matriks izin | Skrip Node |

**WAJIB** Fixture provider: server tiruan yang mengirim potongan Unicode terbelah, tool call, usage ada/tidak ada, timeout, 401, 429, respons rusak, dan koneksi putus di tengah. Tanpa fixture ini, uji streaming tidak bermakna.

### SDD-9.2 Gate kualitas per work package

1. Typecheck lulus.
2. Lint lulus.
3. Test fokus untuk perubahan lulus.
4. Build produksi lulus.
5. Tidak ada `TODO` kosong, tidak ada kode mati, tidak ada kontrol inert.
6. Tidak ada kredensial di diff (pemeriksaan pola + canary).

### SDD-9.3 Uji keamanan wajib

- Canary secret: string rahasia yang disuntikkan tidak muncul di log, ekspor, snapshot berbagi, atau respons publik.
- SSRF: endpoint metadata ditolak.
- XSS: `<script>` dan `onerror` tidak dieksekusi.
- Lintas pengguna: A tidak dapat membaca chat/dokumen/koneksi B (uji id langsung).
- Izin: kontrol tersembunyi bukan pengganti penolakan server (uji endpoint langsung).

### SDD-9.4 Bukti

Setiap work package menyertakan: perintah yang dijalankan, exit code, hasil ringkas, dan bukti sanitasi (diff schema/response/screenshot). Klaim tanpa bukti tidak dihitung selesai.

---

## SDD-10. Keputusan desain dan kondisi peninjauan

| Keputusan | Alternatif yang dipertimbangkan | Kondisi peninjauan |
|---|---|---|
| Modular monolith + worker proses terpisah | Microservice per domain; serverless penuh | Bila beban menuntut skala horizontal atau batas tim berubah |
| Job berbasis DB, tanpa Redis | Redis/BullMQ sejak awal | Bila panjang antrean atau latensi klaim menjadi masalah terukur |
| SQLite default dev, Postgres prod | Postgres saja | Bila SQLite menyulitkan uji paralel |
| Enkripsi server default, Direct ditunda | Direct default | Bila pengguna menuntut key tidak menyentuh server |
| RAG dengan fallback kata kunci | Wajib embedding | Bila kualitas retrieval kata kunci terbukti tidak cukup |
| Satu model per pesan di v1 | Multi-model sejak awal | Bila kebutuhan perbandingan model muncul |
| Kode/browser hanya di sandbox terisolasi; plugin server tetap dilarang | Eksekusi di worker terpercaya ditolak | Gate AG-P3 pada scope aktif wajib sebelum fitur diaktifkan |
