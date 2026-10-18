# Kawan

Chat AI yang bisa di-self-host, ditujukan untuk pengguna nonteknis, memakai gateway
[tokengateway.ai.id](https://tokengateway.ai.id). Kunci API milik pengguna sendiri
(BYOK): default server mode menerima dan menyimpan key terenkripsi lalu meneruskan
request; Direct key tetap tersimpan di browser saja. Kawan tidak menambahkan billing
token.

Versi saat ini: **fondasi (fase NT-P0)**. Antarmuka, konfigurasi runtime, skema database,
antrean job berbasis tabel, dan entry point worker sudah ada dan lulus gate NT-P0
(typecheck, lint, test, build). Fitur chat, koneksi gateway, dan pengiriman pesan belum
tersedia.

Dokumen produk dan desain ada di [`tasks/nontechnical-v1/`](tasks/nontechnical-v1/README.md)
(PRD, SDD, plan, coverage, execution prompt). Paket full-parity lama di `tasks/prd.md`,
`tasks/sdd/`, `tasks/plan.md`, `tasks/todo.md` adalah referensi alternatif, bukan scope
aktif.

## Menjalankan

Prasyarat: Node.js 22 atau lebih baru, dan npm.

```bash
git clone https://github.com/fauzan171/tokengateway-kawan.git
cd tokengateway-kawan
npm ci
```

Siapkan berkas `.env` dari template, lalu isi dua rahasia:

```bash
cp .env.example .env
openssl rand -base64 32   # salin hasilnya ke ENCRYPTION_SECRET
openssl rand -base64 32   # salin hasilnya ke AUTH_SECRET
```

`DATABASE_URL` di template sudah menunjuk SQLite (`file:./dev.db`), cocok untuk
pengembangan lokal. Untuk produksi, pakai PostgreSQL dan aktifkan baris
`postgresql://...` yang sudah dikomentari.

Siapkan skema database:

```bash
npm run db:generate   # klien Prisma SQLite DAN PostgreSQL — keduanya dibutuhkan typecheck
npx prisma migrate deploy
```

`db:generate` menghasilkan dua klien: `src/generated/prisma-sqlite` (dev) dan
`src/generated/prisma` (produksi). `src/lib/db.ts` meng-import keduanya secara
dinamis, jadi melewatkan salah satu membuat `npm run typecheck` dan `npm run build`
gagal. Jangan panggil `prisma generate` tanpa `--schema prisma/schema.prisma` di
langkah terakhir.

Jalankan:

```bash
npm run dev      # server aplikasi (Next.js) di http://localhost:3000
npm run worker   # entry point worker, proses terpisah dari image yang sama
```

Aplikasi gagal start bila `ENCRYPTION_SECRET` atau `AUTH_SECRET` kosong atau tidak
valid — itu perilaku yang diinginkan (SDD-1.5), bukan bug.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Jalankan hasil build |
| `npm run worker` | Worker antrean job |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit test (Vitest) |
| `npm run test:e2e` | End-to-end (Playwright) |
| `node scripts/check-migrations.mjs` | Pastikan migrasi SQLite dan PostgreSQL identik |
| `npm run check:docs` | Konsistensi dokumen requirement ↔ work package |
| `npm run check:licenses` | Lisensi dependensi (nol GPL/AGPL) |
| `./scripts/backup.sh` / `./scripts/restore.sh` | Backup & restore — lihat `docs/operator.md` |

## Struktur singkat

- `src/app/` — antarmuka Next.js App Router.
- `src/lib/config/` — registry dan validasi konfigurasi runtime.
- `src/lib/jobs/` — antrean job berbasis tabel dan logika worker. Tidak ada Redis di v1.
- `src/worker.ts` — entry point worker.
- `prisma/` — schema dan migrasi (dua provider: SQLite dan PostgreSQL).
- `tasks/nontechnical-v1/` — PRD, SDD, plan, coverage, execution prompt.

## Kontribusi

Aturan kerja ringkas: satu basis kode, satu image; worker dijalankan sebagai entry point
berbeda dari image yang sama. Commit memakai daftar path eksplisit, bukan `git add .`.
Push hanya dilakukan setelah gate fase lulus. Detail peran dan alur ada di
[`tasks/nontechnical-v1/execution-prompt.md`](tasks/nontechnical-v1/execution-prompt.md).

## Lisensi

Belum ditetapkan. Hubungi pemilik repo sebelum memakai ulang.
