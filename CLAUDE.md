# Kawan: petunjuk Claude Code

Untuk implementasi agen, baca berurutan `tasks/ACTIVE-SCOPE.md`,
`tasks/agent-v1/README.md`, `tasks/agent-v1/CLAUDE-PROMPT.md`, dan `tasks/agent-v1/STATUS.md`.
Ikuti bab teknis yang ditautkan sebelum mengubah schema/API/execution/UI/security.
Paket full-parity Open WebUI dan prompt lama adalah referensi historis.

Pemilik produk meminta coordinator Claude memakai `/goal` native dan sub-agent
pengembangan. Kondisi goal tersedia di `tasks/agent-v1/CLAUDE-GOAL.txt`.
Jangan menandai selesai dari keberadaan dokumen, mock, skip, atau goal cleared.
Bukti per WO dan acceptance menentukan completion.

Gunakan sub-agent backend/frontend dengan file ownership dan integration SHA yang
jelas; reviewer independen untuk state/security/contract. Worktree penulis harus
berbasis commit integrasi yang diminta. Default maksimum3 sub-agent aktif.
Coordinator mengintegrasikan dan menjalankan gate terpusat; worker tidak push main.

Migrasi additive, init existing tetap. Pertahankan data pengguna dan perubahan manusia.
Kredensial tetap server-only; .env/DB/generated output bukan bahan commit.
Keluaran model/kode hanya berjalan di sandbox yang memenuhi gate isolasi, bukan host.
Gate live yang belum tersedia dicatat blocked_external, tidak dianggap pass.

Jalankan `npm run db:generate` pada checkout baru sebelum typecheck/build karena
kedua klien Prisma dibutuhkan. Sumber skrip lainnya ada di package.json.
Checker SDD: `python3 tasks/agent-v1/check_docs.py`.
Checker baseline: `python3 tasks/nontechnical-v1/tools/check_docs.py`.
