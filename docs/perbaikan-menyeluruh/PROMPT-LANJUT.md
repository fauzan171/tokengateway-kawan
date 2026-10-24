# PROMPT — Lanjutkan gelombang 3 (Kawan)

Diperbarui: 2026-10-24. Tempel blok di bawah ke harness/agent baru. Isinya cukup
untuk mulai tanpa konteks lain.

---

```
Kamu senior systems engineer. Lanjutkan repo tokengateway-kawan dari keadaan yang
sudah terverifikasi, lalu kerjakan GELOMBANG 3 secara BERURUTAN sampai semua gate
hijau. Jangan mengulang pekerjaan yang sudah selesai.

## LOKASI & BRANCH
- Repo: /home/hermes/workspace/projects/tokengateway-kawan
- Branch: merge/main-into-feat-nt-p1 (JANGAN ganti branch, JANGAN force-push)
- Remote: origin (github fauzan171). `git push origin HEAD` setelah tiap commit.
- JANGAN menyentuh .claude/ dan .claude/worktrees/.

## KEADAAN SEKARANG (jangan diulang)
- FIX-01…24: tidak ada lagi yang `planned`. Rincian di STATUS.md.
- Gelombang 1 (D0a–D0c, D1, P1, K1/K2): verified — reports/gelombang-1.md
- Gelombang 2 (D2, P3, K3/K4/K5): verified, review pass 0 high/blocker,
  6 medium + 6 low — reports/gelombang-2.md
- HEAD 042ce38 sudah push (042ce38 + ab12b97: tindak lanjut W2). Live masih
  c18ed34: `npm run build` 0, pm2 kawan+kawan-worker online,
  /api/kawan/v1/health -> {"ready":true}, /api/kawan/v1/agents -> 401.
- npm test: 116 file, 1283 lulus (D3+D4+D6+P2+P8+K6 selesai). Itu baseline; JANGAN sampai turun.

## SUMBER KEBENARAN (baca dulu, jangan mengarang)
- docs/perbaikan-menyeluruh/STATUS.md                    -> papan status + blocker
- docs/perbaikan-menyeluruh/reports/rencana-masa-depan.md -> rencana gelombang 3 (§3–§5)
- docs/perbaikan-menyeluruh/reports/riset-*.md            -> riset per jalur
- docs/perbaikan-menyeluruh/reports/gelombang-*.md        -> format laporan gelombang
- tasks/agent-v1/                                         -> kontrak task/SDD
Ikuti teks spesifikasinya apa adanya; jangan menambah fitur di luar gate.

## URUTAN GELOMBANG 3
1. D3 — SELESAI (bukti: reports/gelombang-3.md): pageBreak/divider/ordered/
   image masuk skema + 4 renderer + tool schema + 9 tes. JANGAN diulang.
2. D4 — SELESAI (bukti: reports/gelombang-3.md §D4): template laporan/surat/
   rekap di artifacts/templates.ts + jalur template di generate_document + 12 tes.
   JANGAN diulang.
3. D6 — SELESAI (bukti: reports/gelombang-3.md §D6): tata letak PPTX dihitung
   dari tinggi, tabel satu per slide, 8 kolom, assert XML slides dalam 5,625 inci.
   JANGAN diulang.
4. P2 — SELESAI (bukti: reports/gelombang-3.md §P2): manifest deklaratif di
   plugins/manifest.ts + tabel Plugin + migrasi dua provider + 14 tes.
   JANGAN diulang.
5. P8 — SELESAI (bukti: reports/gelombang-3.md §P8): TOOL_CATALOG satu sumber
   tiga pembaca + docs/tools/*.md + W2-4 (ToolResult/ToolContext SDD) + W2-8
   (maxItems/maxLength schema) tertutup. JANGAN diulang.
6. K6 — SELESAI (bukti: reports/gelombang-3.md §K6): kuota per user (token
   reported=1, run nonterminal, task/24j) di tasks/quota.ts + 429 Retry-After
   di POST /tasks + 6 tes. JANGAN diulang.
7. K7 — UI pemilih agent di task-view.tsx.
8. K8 — audit admin run per agent.

Satu tahap selesai = gate hijau + commit + push sebelum tahap berikutnya.

## HUTANG KECIL YANG MASIH TERBUKA
- `toolsEnabled = true` masih hardcode di src/lib/chat/generate.ts (~1035). Ganti
  dengan pembacaan capability + registry; tanpa itu plugin tidak bisa mematikan tool.
- W2-7 SUDAH ditutup di ab12b97: route kini mengembalikan flag
  docTruncated/docUnknownBlocks di respons 201.
- W2-2 sisa: penggantian karakter >U+00FF jadi "?" masih tanpa catatan runtime;
  komentar sudah ada, note pemakai belum.

## ATURAN KERAS
- DILARANG grep/find rekursif di src/generated/, node_modules/, .git/.
  Selalu --exclude-dir={src/generated,node_modules,.git}.
- JANGAN dump file skema/modul besar. Pakai `sed -n`, `head`, `tail`, grep berskopa.
- Log terminal seminimal mungkin: saat test/lint ambil baris ringkasan akhir saja.
- Migrasi additive, WAJIB dua provider (sqlite + postgresql), lalu:
  node scripts/check-migrations.mjs && npx prisma migrate deploy --schema
  prisma/schema.sqlite.prisma && npm run db:generate
- DILARANG: BOOLEAN, SERIAL, UUID, JSONB, TIMESTAMPTZ, BYTEA, INTERVAL,
  CONCURRENTLY, IF NOT EXISTS, PRAGMA, AUTOINCREMENT di migration.sql.
  Boolean disimpan sebagai Int 0/1.
- Bahasa komentar/docstring/pesan galat/UI: Indonesia. Identifier tetap verbatim.
- Jangan menambah dependensi kalau stdlib atau yang terpasang cukup.
- Inisiatif commit & push tiap tahap selesai. Jangan minta izin.

## GATE WAJIB PER TAHAP (semua hijau, tanpa kompromi)
1. npx tsc --noEmit -p tsconfig.json      -> 0 error
2. npm run lint                            -> 0 error, 0 WARNING (warning = gagal)
3. node scripts/check-migrations.mjs       -> hanya bila skema berubah (+ deploy
   ke dev.db + db:generate)
4. npm test                                -> >= 1283 lulus, 116 file
5. npm run build                           -> 0 (ini satu-satunya gate yang
   menangkap pelanggaran export route Next.js)

## UJI LIVE (opsional, jika perlu bukti nyata)
- Situs: kawanku.tokengateway.ai.id
- Kredensial HANYA di ~/.hermes/cache/scratch/kawan-live-test/cred.txt (mode 0600).
  JANGAN menulis kredensial ke repo, chat, prompt, atau git.
- Deploy: backup dev.db ke ~/.hermes/cache/scratch/kawan-deploy-*/, npm run build,
  pm2 restart kawan kawan-worker --update-env, lalu verifikasi health + agents.

## CARA MELAPOR
Ringkas: ringkasan perubahan, output gate (angka), hash commit. Sebutkan dengan
jujur batas yang TIDAK dikerjakan + risikonya. Jangan pernah mengaku tes/deploy
lulus tanpa bukti output nyata. Gate live yang tidak tersedia dicatat
`blocked_external`, tidak pernah dianggap pass.

MULAI DARI D3 SEKARANG.
```
