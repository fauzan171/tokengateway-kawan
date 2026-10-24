# Kawan

Chat AI yang bisa di-self-host, ditujukan untuk pengguna nonteknis, memakai gateway
[tokengateway.ai.id](https://tokengateway.ai.id). Kunci API milik pengguna sendiri
(BYOK): default server mode menerima dan menyimpan key terenkripsi lalu meneruskan
request; Mode Direct (key hanya di browser) belum diimplementasikan. Kawan tidak menambahkan billing
token.

Arah produk aktif: **pengalaman agen seperti Manus**, dengan gateway BYOK dan
antarmuka untuk pengguna nonteknis. Baca [scope aktif](tasks/ACTIVE-SCOPE.md) sebelum
menjalankan prompt atau plan lama. [SDD agen lengkap](tasks/agent-v1/README.md) dan
[prompt Hermes → Claude Code](tasks/agent-v1/HERMES-PROMPT.md) menjadi panduan kelanjutan. Kemampuan agen belum diimplementasikan; belum ada
klaim kesetaraan 100% dengan Manus.

Perluasan perbaikan A–J: [audit dan rencana menyeluruh](docs/perbaikan-menyeluruh/README.md)
memuat 24 paket kerja, pilihan teknologi, dependency dan kriteria penerimaan.
Untuk eksekusi seluruh perluasan ini, gunakan [prompt Hermes terbaru](docs/perbaikan-menyeluruh/04-prompt-hermes.md)
dan [brief Claude Code dengan sub-agent](docs/perbaikan-menyeluruh/05-brief-claude-code.md);
prompt agent-v1 di atas hanya mencakup scope core lama.

Status kode: fondasi/auth dan backend koneksi/chat tersedia. Backend menyediakan
streaming SSE, edit, regenerate, continue, pesan sistem dan judul; UI chat masih
parsial dan belum menghubungkan seluruh kemampuan tersebut. Implementasi riwayat UI,
Markdown, lampiran, retrieval dokumen, pencarian web kondisional dan ekspor tersedia;
task agent, browser, sandbox dan artefak buatan asisten belum tersedia. Keberadaan
implementasi bukan bukti seluruh alur end-to-end lulus; lihat audit terbaru di atas.

Paket [`tasks/nontechnical-v1/`](tasks/nontechnical-v1/README.md) adalah baseline
chat yang direvisi oleh scope aktif. Paket full-parity Open WebUI lainnya bersifat
historis. Temuan dan batas verifikasi ada di [laporan audit](tasks/nontechnical-v1/reports/scope-audit-2026-10-17.md).

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
