# SDD-AG-2: Data, invariants dan migrasi

Status: schema target, belum menjadi model Prisma. Semua waktu UTC; DTO ISO-8601.
ID string acak dari server; angka token/ukuran adalah integer nonnegatif.
SQLite memakai kolom portabel; PostgreSQL dapat memakai indeks tambahan melalui
migrasi provider-specific bila kedua hasil schema dan perilakunya diuji.

## Entitas dan field wajib

Notasi `?` nullable, `json` berarti JSON tervalidasi yang disimpan sebagai String
untuk portabilitas. Status adalah union tervalidasi, bukan teks bebas dari klien.
FK dan cascade didefinisikan secara eksplisit saat menerjemahkan ke Prisma.

| Entitas | Field | Indeks / relasi |
|---|---|---|
| Task | id, userId, title, status(active/archived), activeRunId?, revision:Int=1, deletedAt?, createdAt, updatedAt | FK user cascade; indeks(userId,status,updatedAt,id); activeRunId adalah pointer tervalidasi ke run milik task |
| TaskRun | id, taskId, inputMessageId, assistantMessageId, inputArtifactIdsJson, currentJobId?, segment:Int=1, status, revision:Int=1, connectionId?, modelId, capabilitiesJson, toolsJson, limitsJson, policyRevision, lastEventSeq:Int=0, stepCount:Int=0, reportedTokens:Int=0, reservedEstimatedTokens:Int=0, usageComplete:Int=1, cancelRequestedAt?, deadlineAt, waitingExpiresAt?, errorCode?, startedAt?, finishedAt?, createdAt | FK task cascade; inputMessageId dan assistantMessageId masing-masing unik; currentJobId unik bila ada; indeks(taskId,createdAt,id), (status,deadlineAt); connection FK SetNull atau resolusi tombstone aman |
| TaskMessage | id, taskId, runId?, role(user/assistant), text, requestKey?, createdAt | FK task cascade, run SetNull; unik(runId,role); indeks(taskId,createdAt,id); pesan user/final immutable, assistant aktif hanya diappend oleh lease holder |
| TaskStep | id, runId, ordinal:Int, kind(model/tool), toolName?, toolCallId?, argsJson?, argsDigest?, effect(read/write/local), invocationState(prepared/dispatched/confirmed/unknown), status(pending/running/succeeded/failed/cancelled/indeterminate), resultJson?, errorCode?, startedAt?, finishedAt?, executorJobId | FK run cascade; unik(runId,ordinal); unik(runId,toolCallId) bila terisi; indeks(runId,status) |
| TaskEvent | id, runId, seq:Int, kind, payloadJson, createdAt | FK run cascade; unik(runId,seq), indeks(runId,createdAt); payload DTO tersaring |
| TaskInteraction | id, runId, stepId?, kind(input/approval/handover), status(pending/accepted/rejected/expired/cancelled), revision:Int, promptJson, argsDigest?, policyRevision, expiresAt, answerJson?, consumedAt?, createdAt | FK run cascade, step Restrict sampai run dihapus; indeks(runId,status), (expiresAt,status); satu pending interaction per run, CAS server |
| Artifact | id, userId, producingRunId?, direction(input/output), storageKey, displayName, mime, sizeBytes:Int, sha256, status(staging/processing/ready/failed/deleting), extractedTextKey?, extractionMetaJson?, retentionUntil?, deletedAt?, createdAt | FK user cascade, run SetNull; storageKey unik dan acak; indeks(userId,createdAt,id), (status,createdAt) |
| TaskArtifact | taskId, artifactId, addedAt | PK(taskId,artifactId), kedua FK cascade; ownership task dan artifact harus sama saat tambah |
| RuntimeSession | id, runId, provider, externalIdEncrypted, kind(code/browser), status(starting/running/paused/stopping/stopped/indeterminate), templateVersion, networkPolicyJson, expiresAt, createdAt, stoppedAt? | FK run cascade setelah cleanup remote dijadwalkan; indeks(status,expiresAt); external ID/token runtime tidak keluar lewat DTO |

Job existing tetap sumber lease. Payload `agent.run` adalah `{runId,segment}` saja;
file bytes, key atau transcript tidak masuk payload. Tambahkan kind sebagai
non-idempotent. `agent.cleanup` berisi ID runtime/storage untuk cleanup yang aman
diulang; idempotence tidak diasumsikan untuk model, kode atau browser.

TaskMessage memisahkan percakapan linear tugas dari pohon Chat existing. Riwayat
Chat tidak dimigrasikan diam-diam menjadi Task. UI dapat menawarkan “Jadikan tugas”
yang membuat Task baru dengan input yang ditinjau pengguna dan salinan attachment
berotorisasi; pesan sistem/secret tidak ikut. Ini bukan gate inti.

## Snapshot input dan keluaran durable

TaskRun.inputArtifactIdsJson adalah manifest immutable ID+sha256+nama+locator dari
input yang ready saat admission, maksimum100MiB. TaskArtifact adalah pengelompokan,
bukan wewenang menambahkan file ke run yang sudah dimulai. File baru hanya masuk
run berikutnya melalui manifest baru. Artifact.producingRunId merekam provenance
output; input user tidak berpura-pura dibuat oleh run.

TaskRun.assistantMessageId menunjuk satu placeholder TaskMessage yang dibuat saat
admission. Setiap batch message.delta memperbarui teks durable assistant dan event
beserta seq dalam transaksi yang sama. Finalisasi menetapkan teks final/status run;
snapshot detail membaca teks durable, sehingga pruning event/reload/410 tidak
menghilangkan jawaban parsial. Message dari run lain tidak dapat digunakan.

## Invariants transaksi

1. Semua resource dimiliki lewat Task.userId atau Artifact.userId, termasuk run,
   interaction, event, step, runtime dan file. Child ID tanpa owner check tidak cukup.
2. Maksimum satu run nonterminal per task dan satu run aktif per pengguna (default).
   Gunakan lock/CAS pada User atau Task yang deterministik, bukan count-then-insert
   tanpa lock. Jika perlu tambah kolom revision pengunci di User secara additive.
3. Create Task + pesan input + run + job + activeRunId + event queued + idempotency
   response harus commit bersama. Salinan response key menyimpan DTO aman saja.
4. Mutasi worker memegang runId, segment, jobId, leaseToken. Di transaksi, lakukan
   conditional update pada Job dengan token yang sama, state leased/running,
   leaseExpiresAt > now; kunci row itu sampai commit. Nol baris berarti LOST_LEASE.
   Lanjutkan mutasi run/step/event hanya bila lolos. Sweep memakai lock/CAS row sama.
5. lastEventSeq bertambah tepat satu di transaksi yang juga menyimpan event/state.
   Gunakan atomic increment returning atau conditional revision; jangan `max(seq)+1`
   di luar transaksi. Unique(runId,seq) adalah guard, bukan allocator utama.
6. Selesaikan hasil/partial, state run, clear Task.activeRunId bila masih menunjuk run
   ini, terminal event dan pembukuan job dalam transaksi berotorisasi lease.
7. Konsumsi interaction memakai CAS `status=pending`, expiresAt > now, revision,
   policyRevision, argsDigest dan owner. Answer, state queued, segment+1, job baru
   dan event commit bersama. Browser/model belum dipanggil dalam transaksi ini.
8. Runtime/file adalah efek di luar DB. Intent, provider handle dan cleanup state
   dicatat; reconciler menyelesaikan orphan. DB rollback tidak dianggap membatalkan
   operasi provider. Tidak mengklaim exactly-once untuk layanan eksternal.
9. currentJobId menunjuk job segment terbaru; job lama tidak berwenang menulis.
   Waiting states tidak mempertahankan lease worker. Segment dilanjutkan melalui
   job baru setelah input/approval; step effect yang confirmed tidak dieksekusi ulang.
10. Admission, dispatch baru dan write hasil/progres memeriksa Task.deletedAt IS NULL
    serta akun aktif. Delete menulis tombstone sebelum menghentikan job; response
    private menjadi404, daftar mengabaikannya. Cancel/terminalization/reconciler/cleanup
    tetap boleh menulis metadata penghentian setelah tombstone dengan owner/job fencing
    dan izin service internal sempit; tidak boleh dispatch atau memublikasikan hasil baru.
11. Batas per-user/global dihitung dan dicadangkan atomik di dispatch transaksi.
    Melepas slot pada waiting/terminal tidak menggandakan slot setelah crash.

## Snapshot dan versi

limitsJson/capabilitiesJson/toolsJson menggunakan `schemaVersion:1`. Run menyimpan
model dan connection tetap; snapshot tidak berisi kredensial. Model/capability
runtime diverifikasi sebelum run pertama dan setelah konfigurasi berubah. Worker
menolak versi snapshot yang tidak dikenali dengan CONFIG_UNSUPPORTED.

argsDigest = SHA-256 JSON kanonik dari `{tool,arguments,target,runId,stepId,
policyRevision}`; object key diurutkan rekursif, array tetap urut, nilai non-JSON
atau angka tidak finite ditolak. Digest tidak dipakai sebagai bukti consent sendiri.
Hanya interaction accepted yang dapat memberikan hak untuk effect tersebut.

Result model/tool maksimum sesuai batas; payload besar disimpan sebagai Artifact,
DB menyimpan referensi dan kutipan terbatas. Event tidak menyimpan cookie, header
Authorization, raw key, internal sandbox URL atau chain-of-thought.

## Migrasi yang aman

Riwayat init existing dibiarkan byte-for-byte. Checker migrasi lama membandingkan
semua SQL dengan satu init; perbaiki menjadi pasangan nama migrasi berurutan per
provider: nama cocok, SQL masing-masing valid, init checksum tidak berubah, migrate
fresh dan upgrade populated dibuktikan pada SQLite serta PostgreSQL.

`_schema.sql` adalah snapshot bootstrap historis, bukan isi setiap migrasi baru.
Helper test fresh DB harus menjalankan seluruh migrasi berurutan, bukan init saja.
Schema SQLite tetap diturunkan dari schema sumber. Hindari constraint yang hanya
ada di satu provider tanpa padanan test/invariant service pada provider lainnya.

Urutan: backup dan catat checksum init → perbaiki checker/helper → tambah tabel baru
nullable/terpisah → generate kedua klien → migrate DB fixture populated → verifikasi
row chat/auth lama, dekripsi key dan index → aktifkan endpoint task melalui flag.
Tidak ada backfill chat ke task. Perubahan destructive hanya setelah data selesai
dipindah, rilis kompatibilitas berlalu, dan persetujuan pemilik produk.

Rollback flag menonaktifkan create task/run; read/export tetap tersedia. Tabel baru
tidak di-drop saat rollback aplikasi. Restore diuji ke database lain, bukan menimpa
DB operator yang sedang berjalan. SQLite backup memakai API backup atau snapshot
konsisten termasuk WAL; menyalin file aktif secara sembarang bukan prosedur backup.

## Retensi dan penghapusan

Default lokal: staging/orphan 24 jam, event delta 30 hari, artefak mengikuti task
sampai pemilik menghapus. Metadata terminal dan pesan final bertahan; SSE cursor
lama mendapat 410 dengan petunjuk mengambil snapshot. Operator dapat memendekkan
retensi lewat konfigurasi; tampilkan dampaknya pada pengguna.

Delete task: tandai deleting/masukkan cleanup, batalkan run/approval/runtime,
verifikasi penghentian, unlink TaskArtifact, hapus artefak yang tidak direferensikan
task lain, lalu cascade DB. Task dihapus dari daftar segera, worker lama tidak
boleh membuatnya hidup lagi. Hapus akun juga menangani UsageRecord, IdempotencyKey,
Job dan remote runtime yang tidak dilindungi FK existing; uji tabel satu per satu.
Ekspor tidak memuat rahasia, runtime handle, step args sensitif atau prompt sistem privat.

Penghapusan satu Artifact oleh pemilik melepas semua binding TaskArtifact miliknya,
menghapus bytes/extracted text dan menandai deletedAt. Manifest run historis tetap
merekam provenance/metadata “file dihapus” sampai task dihapus, tanpa mempertahankan
bytes yang diminta dihapus. File yang masih digunakan run aktif memerlukan cancel
dahulu. Task deletion biasa tidak menghapus bytes file yang masih direferensikan
task lain; account deletion menghapus seluruh metadata dan bytes pengguna.
