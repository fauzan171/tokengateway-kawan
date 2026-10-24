# FIX-21 — Jadwal, proaktif, dan notifikasi

Status: **verified_fixture**

## Masalah

Tidak ada penjadwalan sama sekali. Cara termudah membangunnya adalah cara yang
paling salah: `setInterval` di browser, atau `new Date() + 24 jam` di server.
Keduanya menciptakan tiga bug yang sulit terlihat:

1. dua worker/scheduler membuat **dua** run untuk jadwal yang sama;
2. restart atau pergantian DST **menggeser** jam eksekusi;
3. perangkat/worker mati beberapa jam, lalu **semua** occurrence terlewat
   dijalankan beruntun — termasuk aksi berbiaya.

Belum ada notifikasi, dan belum ada aturan bahwa teks sensitif tidak boleh
tampil di lockscreen.

## Solusi

### `src/lib/schedules/schedules.ts` — waktu, occurrence, misfire

**Waktu** dihitung dengan `Intl` sebagai sumber aturan zona (termasuk DST), bukan
tabel offset tulisan tangan:

- `timezoneOffsetMs()` membaca offset sebenarnya pada instant itu;
- `zonedTimeToUtc()` menyelesaikan WIB; untuk jam lokal yang **tidak ada**
  (spring-forward) ia **menggeser** sampai jam yang diminta benar-benar
  muncul — dipverifikasi dengan memformat balik instant tersebut;
- `nextOccurrence()` menambah **tanggal lokal**, bukan 24 jam UTC. Bug ini
  ditemukan tes sendiri: menambah 24 jam UTC membuat jadwal 09:00 New York
  menjadi 10:00 keesokan harinya setelah DST.

**Occurrence** punya kunci unik `(scheduleId, scheduledFor)`.
`claimOccurrence()` mengembalikan `null` — bukan galat — bila kalah balapan,
jadi dua scheduler tidak menghasilkan dua run.

**Misfire**: kebijakan bawaan `skip`. Occurrence yang terlambat lebih dari 15
menit dilewati dan `nextRunAt` dilompatkan ke waktu berikutnya; tidak ada
penumpukan run beruntun untuk aksi berbiaya. `run` tersedia untuk aksi yang
memang ingin selalu dijalankan.

`nextRunAt` disimpan UTC dan **selalu dihitung ulang** dari
`localTime`+`timezone`: restart proses tidak menggeser jadwal.

### Notifikasi

`notificationPreview()` mengganti isi notifikasi yang ditandai sensitif dengan
ringkasan umum ("Buka Kawan untuk melihat hasilnya."), sehingga teks sensitif
tidak muncul di lockscreen/notifikasi sistem. Isi asli tetap ada di aplikasi.

### Skema

Tiga model, migrasi manual dua provider:

| Model | Isi |
|---|---|
| `Schedule` | owner, judul, prompt, `localTime`, `timezone` IANA, recurrence, misfirePolicy, effect, enabled, nextRunAt, lastRunAt, policyRevision |
| `ScheduleOccurrence` | `@@unique([scheduleId, scheduledFor])`, status, jobId |
| `Notification` | owner, kind, judul, isi, `sensitive`, readAt |

Flag memakai Int 0/1 (portabel SQLite+PostgreSQL) — `check-migrations.mjs`
menolak kata `BOOLEAN` secara sengaja, dan itu benar: itu yang menjaga DDL tetap
jalan di kedua provider.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/schedules/schedules.ts` | **baru** — waktu zona, occurrence, misfire, preview notifikasi |
| `src/lib/schedules/schedules.test.ts` | **baru** — 21 tes |
| `prisma/schema.prisma` | `Schedule`, `ScheduleOccurrence`, `Notification` + relasi `User` |
| `prisma/migrations/{sqlite,postgresql}/20261030000000_schedule_notification` | **baru** |

## Verifikasi

```
node scripts/check-migrations.mjs                              → OK (2 provider)
npx prisma migrate deploy --schema prisma/schema.sqlite.prisma → All migrations applied
npm run db:generate                                            → exit 0
npx tsc --noEmit -p tsconfig.json                              → 0 error
npx eslint src/lib/schedules                                   → 0 error, 0 warning
npx vitest run src/lib/schedules                               → 21 passed
```

## Tes (21)

- **Zona**: Jakarta 00:00 lokal = 17:00 UTC hari sebelumnya; round-trip
  format→parse untuk New York (3 waktu berbeda); **jam yang tidak ada saat DST
  digeser**, tidak menghasilkan instant salah; format tak sah ditolak.
- **Offset**: +7 jam Jakarta, −4 jam New York (musim panas), 0 UTC.
- **nextOccurrence**: sekali jalan → `null`; harian melewati waktu lewat;
  mingguan +7 hari; **DST: 09:00 New York tetap 09:00 keesokan harinya**.
- **Validasi**: input sah lolos; judul/prompt kosong, format waktu salah, zona
  asing ditolak dengan pesan spesifik.
- **Occurrence**: yang kedua untuk waktu sama → `null`, dan hanya **1 baris**
  di DB.
- **Sweep**: jatuh tempo → 1 occurrence + `nextRunAt` maju + `lastRunAt` terisi;
  **dua sweep beruntun tetap 1 occurrence**; misfire 4 jam dengan policy `skip`
  → 0 occurrence dan `nextRunAt` maju; policy `run` → tetap dijalankan;
  nonaktif diabaikan; belum jatuh tempo tidak disentuh.
- **Notifikasi**: isi sensitif tidak memuat angka aslinya; tidak sensitif
  diteruskan apa adanya.

## Batas yang sengaja dilewati

- **Sweeper belum tersambung ke worker.** `sweepDueSchedules()` siap dipakai dan
  teruji, tetapi handler job + interval worker belum ditambahkan; itu bagian
  FIX-24 (registry handler) agar tidak ada job kind tanpa penangan.
- **Occurrence tidak membuat job.** `jobId` ada di skema tetapi belum diisi;
  dispatch butuh FIX-22/24 dan policy approval per occurrence untuk aksi
  `write`.
- **Web Push/service worker tidak ada.** Spesifikasi menundanya sampai
  kebutuhan tab-tertutup terbukti; notifikasi di sini adalah inbox/badge dalam
  aplikasi dengan outbox durable.
- **Email belum dikirim** — `emailConfigured` masih penanda, bukan pengirim
  (FIX-07 mencatatnya sebagai `blocked_external`).
- **Tidak ada janji alarm tepat detik.** Sweeper berkala; perangkat mati tidak
  membangunkan apa pun, dan itu disebut apa adanya di UI nanti.
- **Idle detection tidak ada.** Aturan opt-in + otoritas yang masih sah belum
  dirancang; menambahkannya tanpa itu berarti aksi eksternal tanpa izin.
