# Panduan operator Kawan

Dokumen ini untuk orang yang memasang dan merawat Kawan di server sendiri.
Setiap perintah di sini sudah ada di `package.json` atau di `scripts/`; tidak ada
perintah karangan. Semua contoh memakai placeholder — jangan menyalin nilai
rahasia dari dokumen mana pun.

## 1. Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Node.js | 22 atau lebih baru | `npm run build` dan `npm run worker` memakai Node 22 |
| npm | 10 atau lebih baru | dipakai `npm ci` |
| SQLite | 3.x | hanya untuk dev/uji; produksi memakai PostgreSQL |
| PostgreSQL | 14 atau lebih baru | produksi (SDD-8.4) |
| `pg_dump` / `pg_restore` | ikut paket klien PostgreSQL | hanya dibutuhkan untuk backup/restore PostgreSQL |
| pm2 | opsional | contoh di bawah; systemd sama baiknya |

## 2. Variabel lingkungan

`src/lib/config/env.ts` adalah sumber kebenaran: variabel yang tidak ada di sana
tidak dibaca aplikasi. Nilai contoh di kolom terakhir bukan rahasia nyata.

### Wajib

| Nama | Arti | Contoh |
|---|---|---|
| `DATABASE_URL` | Koneksi database. `file:` berarti SQLite, selain itu PostgreSQL | `file:./dev.db` · `postgresql://kawan:***@localhost:5432/kawan` |
| `ENCRYPTION_SECRET` | Kunci AES-256-GCM untuk kunci API koneksi, base64 dari **32 byte acak** | `openssl rand -base64 32` |
| `AUTH_SECRET` | Kunci penandatanganan cookie sesi Auth.js; panjang bebas, tidak boleh kosong | `openssl rand -base64 32` |

**Peringatan.** `ENCRYPTION_SECRET` tidak bisa diganti setelah ada koneksi
tersimpan: ciphertext lama hanya bisa dibuka dengan kunci itu. Backup menyimpan
sidik jarinya, bukan kuncinya — simpan kunci di tempat terpisah (pengelola sandi
atau secret manager). Tanpa kunci yang sama, data koneksi tidak dapat dipulihkan
(SDD-8.6).

### Opsional (punya bawaan aman)

| Nama | Bawaan | Arti |
|---|---|---|
| `ENCRYPTION_KEY_ID` | `v1` | Label kunci pada envelope; dipakai saat rotasi |
| `LOGIN_RATE_LIMIT_MAX` | `5` | Percobaan login gagal per jendela |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | `900` | Panjang jendela rate limit login |
| `PASSWORD_RESET_TTL_SECONDS` | `3600` | Masa berlaku tautan reset kata sandi |
| `MODEL_CACHE_TTL_SECONDS` | `600` | Umur cache daftar model |
| `MAX_UPLOAD_BYTES` | `10485760` | Batas ukuran unggahan dokumen (10 MB) |
| `STORAGE_LOCAL_DIR` | `<proyek>/.data/documents` | Akar penyimpanan berkas dokumen, wajib di luar `public/` |
| `OUTBOUND_ALLOWLIST` | kosong | Daftar `host` atau `host:port` yang boleh dituju di luar aturan SSRF bawaan, dipisah koma |
| `ALLOW_INSECURE_HTTP` | `false` | Izinkan `http://` sebagai baseUrl gateway; hanya untuk jaringan lokal |

### Opsional (fitur menyala bila diisi)

| Nama | Arti |
|---|---|
| `KAWAN_SMTP_URL` / `SMTP_HOST` | Menandai email sudah dikonfigurasi; **v1 belum mengirim email apa pun** |
| `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL`, `EMBEDDING_API_KEY`, `EMBEDDING_DIMENSIONS` | Retrieval vektor; tanpa baseUrl+model, pencarian jatuh ke kata kunci |
| `WEBSEARCH_BASE_URL`, `WEBSEARCH_API_KEY`, `WEBSEARCH_LIMIT` | Pencarian web (SearXNG); tanpa baseUrl fitur disembunyikan |
| `MEDIA_IMAGE_MODEL`, `MEDIA_STT_MODEL`, `MEDIA_TTS_MODEL`, `MEDIA_TTS_VOICE` | Model media yang ditawarkan |

Variabel yang hilang atau rusak **menggagalkan start**, bukan diam-diam memakai
nilai default (SDD-1.5): pesan galatnya menyebut nama variabel, tidak pernah
nilainya.

## 3. Instalasi

```bash
git clone https://github.com/fauzan171/tokengateway-kawan.git
cd tokengateway-kawan
npm ci

cp .env.example .env
# isi DATABASE_URL, ENCRYPTION_SECRET, AUTH_SECRET
openssl rand -base64 32   # ENCRYPTION_SECRET
openssl rand -base64 32   # AUTH_SECRET

npm run db:generate       # dua klien Prisma: SQLite dan PostgreSQL
npx prisma migrate deploy # terapkan DDL ke database
node scripts/check-migrations.mjs
npm run build
```

Migrasi proyek ini **bukan** `prisma migrate dev` bertahap: `prisma/migrations/_schema.sql`
adalah satu-satunya sumber DDL, dan kedua salinan `migration.sql` (sqlite,
postgresql) wajib identik dengannya. `scripts/check-migrations.mjs` menegakkannya
dan gagal bila ada yang menyimpang. Provider dipilih `prisma7.config.ts` dari
bentuk `DATABASE_URL`, jadi tidak ada variabel tambahan yang perlu diatur.

`npm run db:generate` harus dijalankan ulang setiap kali `prisma/schema.prisma`
berubah; keduanya dibutuhkan typecheck dan build.

## 4. Menjalankan

Urutan start wajib (SDD-8.4): migrasi → verifikasi schema → web → worker →
readiness.

```bash
npx prisma migrate deploy              # 1. migrasi
node scripts/check-migrations.mjs      # 2. verifikasi schema
npm start                              # 3. web (hasil build)
npm run worker                         # 4. worker, proses terpisah
curl -fsS http://127.0.0.1:3000/api/kawan/v1/admin/status   # 5. readiness
```

Dengan pm2 (nama proses yang dipakai di VPS ini):

```bash
pm2 start npm --name kawan -- start
pm2 start npm --name kawan-worker -- run worker
pm2 save
```

Web dan worker **wajib** proses terpisah: restart web akan mematikan generasi
yang sedang berjalan bila worker menumpang di dalamnya (SDD-8.3). Worker harus
di-restart setiap kali `src/worker.ts` atau `src/lib/jobs/` berubah — pm2 tidak
memuat ulang kode sendiri.

## 5. Upgrade

```bash
./scripts/backup.sh /var/backups/kawan     # 1. backup dulu, selalu
git fetch && git checkout <tag-baru>
npm ci
npm run db:generate
npx prisma migrate deploy                  # 2. migrasi
node scripts/check-migrations.mjs
npm run build
pm2 restart kawan kawan-worker             # 3. start
curl -fsS http://127.0.0.1:3000/api/kawan/v1/admin/status
```

Verifikasi gagal → rollback. Jangan melewati langkah backup: skema baru tidak
selalu bisa dibalik dengan `git checkout`.

## 6. Rollback

```bash
git checkout <tag-lama>
npm ci && npm run db:generate && npm run build
pm2 restart kawan kawan-worker
```

Rollback aplikasi **hanya** ke versi yang schema-compatible dengan database saat
itu. Bila rilis baru mengubah skema, rollback kode saja tidak cukup: pulihkan
database dari arsip yang dibuat tepat sebelum upgrade (bagian 7). Periksa
`schemaVersion` di `manifest.json` — itu sha256 DDL, bukan nomor versi.

## 7. Backup dan restore

```bash
./scripts/backup.sh /var/backups/kawan     # menghasilkan <tujuan>/kawan-<stamp>.tar.gz
./scripts/restore.sh /var/backups/kawan/kawan-20260101-030000.tar.gz
```

Isi arsip: `db.sqlite` atau `db.dump` (custom format), `documents/`, dan
`manifest.json` (waktu, provider, `schemaVersion`, sidik jari kunci, hitungan
baris, jumlah berkas). **`ENCRYPTION_SECRET` tidak ikut** — hanya sidik jarinya.
Simpan kuncinya terpisah; tanpa itu arsip tidak berguna.

`restore.sh` menolak berjalan bila:

- sidik jari `ENCRYPTION_SECRET` sekarang berbeda dari saat backup;
- database tujuan sudah ada dan `--force` tidak diberikan.

Setelah memulihkan, skrip membandingkan hitungan baris dengan manifest dan
mendekripsi satu baris `Connection`. Keduanya gagal → exit non-zero.

Jadwal yang disarankan: harian 03:00 WIB untuk database, dan salinan
`documents/` pada jadwal yang sama. Simpan minimal 7 harian + 4 mingguan di
mesin lain; arsip di server yang sama tidak melindungi dari kehilangan server.

```cron
0 3 * * * cd /srv/kawan && ./scripts/backup.sh /var/backups/kawan >>/var/log/kawan-backup.log 2>&1
```

Uji restore berkala ke direktori kosong — arsip yang belum pernah dipulihkan
belum terbukti bisa dipulihkan. `scripts/test-backup-restore.sh` melakukan uji
lengkap (termasuk dua kasus yang harus gagal) tanpa menyentuh data produksi.

## 8. Pekerjaan terjadwal

Worker hanya memproses job yang masuk ke tabel `Job`; ia tidak punya jadwal
internal. `storage.cleanup` **belum punya pemicu terjadwal di v1** — tidak ada
skrip repo yang mengantrekannya, jadi jangan menjadwalkan perintah yang tidak
ada. Bila dibutuhkan, antrekan satu baris `Job` ber-`kind: "storage.cleanup"`
lewat `enqueue()` di `src/lib/jobs/queue.ts`, atau tambahkan skrip CLI kecil
lebih dulu.

Yang penting saat menambah worker kedua: klaim job sudah aman di level database
(`UPDATE ... WHERE state='queued'`, SDD-8.2), tetapi job berbayar tidak diulang
otomatis.

## 9. Pemecahan masalah

| Gejala | Penyebab | Tindakan |
|---|---|---|
| `AUTH_SECRET wajib diisi` saat start | variabel kosong | isi di `.env`, restart |
| `ENCRYPTION_SECRET harus 32 byte setelah decode` | bukan base64 dari 32 byte | buat ulang dengan `openssl rand -base64 32` — **jangan** ganti bila sudah ada koneksi tersimpan |
| `tidak ada handler untuk kind ...` di log worker | worker menjalankan kode lama | `npm ci && npm run build`, lalu restart worker |
| `P1001` / database tidak terjangkau | PostgreSQL mati, host/port salah, firewall | cek `pg_isready`, `DATABASE_URL` |
| `check-migrations` gagal | `migration.sql` menyimpang dari `_schema.sql` | samakan DDL, jangan edit salah satu salinan saja |

Log ditulis sebagai JSON dan nilai rahasia diredaksi sebelum ditulis; bila Anda
melihat `[REDACTED]` di tempat yang tidak terduga, itu disengaja.
