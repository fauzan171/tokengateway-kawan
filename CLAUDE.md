# Kawan: petunjuk Claude Code

Chat AI BYOK milik tokengateway.ai.id. Next.js 15 App Router + React 19 + Prisma 7
(SQLite dev / PostgreSQL prod) + vitest + Playwright.

Untuk implementasi agen, baca berurutan `tasks/ACTIVE-SCOPE.md`,
`tasks/agent-v1/README.md`, `tasks/agent-v1/CLAUDE-PROMPT.md`, dan `tasks/agent-v1/STATUS.md`.
Referensi nonteknis lama ada di `tasks/nontechnical-v1/prd.md`, `sdd.md`, `plan.md`.
Paket full-parity Open WebUI dan prompt lama adalah referensi historis.
Ikuti bab teknis yang ditautkan sebelum mengubah schema/API/execution/UI/security.

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
- Jangan menandai selesai dari keberadaan dokumen, mock, skip, atau goal cleared.
  Bukti per WO dan acceptance menentukan completion.
- Migrasi additive, init existing tetap. Pertahankan data pengguna dan perubahan manusia.
- Kredensial tetap server-only; .env/DB/generated output bukan bahan commit.
- Keluaran model/kode hanya berjalan di sandbox yang memenuhi gate isolasi, bukan host.
  Gate live yang belum tersedia dicatat blocked_external, tidak dianggap pass.
- Jalankan `npm run db:generate` pada checkout baru sebelum typecheck/build karena
  kedua klien Prisma dibutuhkan. Sumber skrip lainnya ada di package.json.

Checker SDD: `python3 tasks/agent-v1/check_docs.py`.
Checker baseline: `python3 tasks/nontechnical-v1/tools/check_docs.py`.