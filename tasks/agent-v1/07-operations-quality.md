# SDD-AG-7: Konfigurasi, operasi, kualitas dan rilis

Status: target operasional. Config baru ditambahkan bersama fitur pemakainya;
`.env.example` tidak boleh memberi kesan semua setting sudah didukung hari ini.

## Konfigurasi dan profil

Env existing DATABASE_URL, AUTH_SECRET, ENCRYPTION_SECRET, MODEL_CACHE_TTL_SECONDS,
OUTBOUND_ALLOWLIST dan ALLOW_INSECURE_HTTP tetap berlaku sesuai kode saat ini.
Jangan mencetak `.env` untuk diagnosis. Kunci enkripsi harus dibackup terpisah.

| Target setting | Default desain / validasi | Scope |
|---|---|---|
| KAWAN_APP_URL | Origin HTTPS produksi kanonik, tanpa path/credential | Reset/share/Origin check; dev localhost eksplisit |
| AGENT_ENABLED | false sampai gate core terkait siap | Admission task; read/export tetap tersedia saat off |
| AGENT_MAX_RUN_SECONDS / MAX_STEPS / MAX_TOKENS | 900 /40 /50000; bounded sesuai SDD-AG-4 | Snapshot per run |
| AGENT_CONCURRENCY / PER_USER | 4 /1; integer positif bounded | Dispatcher/DB slot reservation |
| AGENT_EVENT_RETENTION_DAYS | 30; minimum1 | Pruning + snapshot/410 |
| STORAGE_LOCAL_DIR | Volume private di luar public/webroot | Staging/input/output; permission operator |
| MAX_UPLOAD_BYTES | 26214400 | Streaming byte enforcement server |
| WEBSEARCH_BASE_URL / API_KEY | Kosong→web.search tidak tersedia | Provider operator, bukan user URL arbitrary |
| SANDBOX_PROVIDER | none sampai konfigurasi+probe; nilai e2b untuk adapter awal | Capability server, tanpa host fallback |
| E2B_API_KEY / SANDBOX_TEMPLATE_CODE / SANDBOX_TEMPLATE_BROWSER | Rahasia server / template immutable yang lulus gate | Worker/control plane saja |
| SANDBOX_EGRESS_PROXY_URL / credentials | Proxy terpercaya dengan allowlist ketat | Browser runtime; tidak diwariskan ke code network-off |
| SMTP atau reset operator | Satu delivery yang berfungsi dipilih operator | Tidak ada token reset di log umum |

Jangan mengasumsikan env flag saja membuktikan capability: health probe runtime,
izin provider, template/policy dan hasil smoke harus valid. Config parser menolak
format/limit invalid saat startup fitur diaktifkan. Server sehat untuk chat meski
fitur opsional disabled; readiness agen melaporkan alasan aman.

## Menjalankan dan membangun

Saat ini Node22+, npm lockfile, dua generated Prisma clients, Next web dan worker
terpisah. `npm run db:generate` wajib pada clean checkout sebelum typecheck/build.
Worker existing memakai tsx; jangan mendokumentasikan `node dist/worker.js` sebagai
perintah produksi sebelum bundler/hasil dist itu benar-benar ditambahkan dan diuji.

Profil dev: web+worker+SQLite dan fixture services di loopback yang di-allowlist
presisi hanya dalam env test. Profil produksi inti: web+worker+PostgreSQL+volume
file, HTTPS reverse proxy, sandbox/search operator bila diaktifkan. Container web
bukan sandbox eksekusi. Satu worker orchestrator serial belum memenuhi concurrency4:
implementer menambah dispatch concurrency bounded atau mendokumentasikan efektif1
sampai benchmark; tidak diam-diam mengklaim4.

Build image dengan lockfile dan kedua Prisma clients; runtime mempertahankan
dependensi worker. Grace shutdown≤30detik, hard timer hanya saat sinyal shutdown.
Restart web tidak menghentikan run worker. Deploy tidak menjalankan migrasi pada
setiap request web: lakukan migrasi sekali, verifikasi schema, lalu start proses.

## Health, logging dan pemantauan

Endpoint target `/api/kawan/v1/health/live` hanya liveness minimal tanpa data sensitif;
readiness/admin status terautentikasi memuat DB/schema, heartbeat worker, queue backlog,
storage, provider capability enabled/disabled. Worker heartbeat harus persisten;
proses idle yang mati tidak boleh terlihat sehat karena tidak ada job.

Log JSON memuat requestId/runId/stepId, jenis/status/duration/bytes, safe error code.
Tidak memuat prompt, file content, tool args sensitif, screenshot login, token/session,
raw upstream body atau reset link. Durable Job.lastError juga disanitasi karena
bukan semua rahasia hanya lewat logger. Metrik: run status, queue age, lost lease,
unknown effects, runtime orphan, request timeout, storage usage dan reported/unknown usage.

Alarm operator pada runtime gagal dihentikan, worker heartbeat hilang, cleanup
backlog meningkat dan DB penuh. Notifikasi tidak memuat isi privat. Browser/task
hasil tidak dipublikasikan otomatis ke akun lain atau tautan publik.

## Backup, restore, retensi dan upgrade

Backup konsisten DB + volume file + konfigurasi nonsecret + enkripsi key melalui
secret store terpisah. PostgreSQL dump dari transaksi konsisten; SQLite API backup
atau prosedur WAL-safe. Provider runtime ephemeral tidak dianggap backup artefak.
Simpan manifest checksum dan versi schema/template aplikasi tanpa key mentah.

Restore ke instance bersih: migrasi kompatibel, cocokkan row counts, sample chat/task,
artifact SHA-256, dekripsi satu koneksi, auth/session policy, serta orphan cleanup.
Sebelum menghubungkan ke provider, tandai run aktif hasil restore indeterminate dan
rekonsiliasi runtime lama, agar restore tidak mengulang aksi eksternal.

Upgrade: snapshot → dry-run migrate salinan DB populated → kompatibilitas deploy →
drain run atau shutdown → migrate additive → start/health/smoke → monitor.
Rollback memakai flag admission off dan versi app compatible; tidak mengubah init
checksum, drop tabel task atau menghapus dev.db. Restore yang menimpa data produksi
memerlukan keputusan operator terpisah. Efek eksternal yang sudah terjadi tidak
dapat dibatalkan oleh rollback DB; tulis pada laporan insiden.

## Gate implementasi dan CI

Perintah yang sudah ada dan harus dijalankan dengan env test terisolasi:

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
npm run build
node scripts/check-migrations.mjs
python3 tasks/nontechnical-v1/tools/check_docs.py
python3 tasks/agent-v1/check_docs.py
```

`npm run test:e2e` sudah ada, tetapi suite smoke lama masih mengharapkan heading
“Ide besar” dan snapshot darwin. AG-P0 memperbaikinya dengan acceptance aktual,
provider fixture, web+worker test, data terisolasi, dan assertion lintas OS. E2E
wajib setelah perubahan UI/API, bukan di-skip permanen sebagai baseline issue.

CI target: Linux Node22 clean install; generate dua clients; typecheck/lint/test/build;
checker dokumen/migrasi; migrate fresh+populated SQLite/PostgreSQL; Playwright Chromium
web+worker+fixture; security regressions; backup/restore fixture. Suite menulis DB/temp
unik, tidak berbagi .env/DB pengembang. Jangan menjalankan build/E2E bersamaan pada
.next atau database yang sama; coordinator menjalankan gate integrasi terpusat.

Provider live sandbox/gateway adalah suite terpisah dengan credential environment
terkontrol. Tidak mencetak secret atau menjalankan artefak tak tepercaya di CI host.
Fixture pass tidak menjadi live pass; jika cred/lingkungan tidak tersedia, tandai
blocked-external pada gate live dan jangan rilis kemampuan tersebut sebagai selesai.

## Checklist rilis inti

R-AG-01..13 serta skenario wajib lulus; semua AG-P0..4 done dengan evidence. Tidak
ada high/critical temuan terbuka pada kemampuan yang diaktifkan. UI desktop/mobile,
SSRF nyata, fencing, approval replay, isolated code/browser, download dan restore
terbukti. Release notes mencantumkan batas capability dan backlog; tidak menyebut
100% Manus. Tag/version mengikuti perubahan yang benar-benar dirilis. Deployment
publik dan pembelian/akun cloud baru bukan bagian izin prompt implementasi.
