# Kawan — konteks proyek untuk [CC]

Chat AI BYOK milik tokengateway.ai.id. Next.js 15 App Router + React 19 + Prisma 7
(SQLite dev / PostgreSQL prod) + vitest + Playwright.

Baca berurutan sebelum menyentuh kode: `tasks/nontechnical-v1/prd.md`,
`sdd.md`, `plan.md` (WP yang sedang dikerjakan), lalu kode di `src/lib/chat/`.

Aturan keras:

- Satu WP per sesi. Jangan mengerjakan WP yang tidak diminta.
- Migrasi wajib sinkron dua provider: ubah `prisma/schema.prisma`, jalankan
  `node scripts/check-migrations.mjs`, `npm run db:generate`.
- Bahasa komentar, docstring, pesan galat, dan UI: Indonesia.
- Verifikasi sebelum klaim selesai: `npx tsc --noEmit -p tsconfig.json`,
  `npx eslint <file berubah>`, `npm test`, `npm run build`.
- Jangan menyentuh `.env`, secret, config host, atau deployment. Jangan commit
  atau push kecuali diminta eksplisit.
- Jangan menambah dependensi kalau stdlib atau yang sudah terpasang cukup.
