# SDD-EXECUTION — Model eksekusi otomatis: worktree, swarm, QA, auto-push per WO

26 Oktober 2026. Melengkapi [IMPLEMENTATION-PLAN](<IMPLEMENTATION-PLAN.md>). Dokumen
ini menutup pertanyaan **bagaimana WO dijalankan sampai selesai tanpa intervensi
per langkah**: setiap WO berjalan di worktree terisolasi, oleh swarm agent
(kawan-backend / kawan-frontend), diverifikasi agent QA/test terpisah, lalu
auto-commit + merge ke branch integrasi. Push remote **gated flag** (lihat §Auto-push).

## 1. Topologi swarm

```
coordinator (CC main session)
  └─ per WO (satu per sesi, urutan DAG):
       ├── worker agent (kawan-backend ATAU kawan-frontend)  → worktree terpisah
       ├── qa agent (kawan-reviewer, read-only)              → review diff di worktree
       └── test agent (jalankan gate + e2e)                  → eksekusi di worktree
```

- **Satu WO = satu worktree** (`worktrees/wo-bN-<slug>`), branch `wo/<id>` dari
  branch integrasi `feat/kawan-workspace`. Isolasi penuh: WO paralel (B2∥B4∥B2b∥B2c,
  F1∥F3∥F4) tidak saling tabrak file.
- **Worker agent** menulis kode sesuai SDD-BACKEND/SDD-FRONTEND. Tidak boleh keluar
  scope WO (aturan CLAUDE.md: satu WP per sesi).
- **QA agent** (kawan-reviewer) review diff read-only SEBELUM gate: kontrak sesuai
  SDD, keamanan (key leak, SSRF, taint, idempotency), severity S1/S2 = blocking.
- **Test agent** menjalankan 4 gate di worktree: `npx tsc --noEmit -p tsconfig.json`,
  `npx eslint <file berubah>`, `npm test`, `npm run build` (+ `check-migrations.mjs`
  dan `npm run db:generate` untuk WO migrasi). Migrasi dua provider wajib.

## 2. Pipeline per WO (state machine)

```
[draft] → worker: implement di worktree
       → test agent: 4 gate + tes WO
         ├─ gagal → kembali ke worker (maks 3 iterasi; gagal ke-3 → WO diblok,
         │           koordinator catat di lapora + lanjut WO lain yang tidak depend)
       → qa agent: review diff
         ├─ S1/S2 → kembali ke worker (maks 3 iterasi, sama)
       → [ready] auto-commit (pesan: "feat(wo): <id> <ringkas>" + bukti gate di body)
       → merge ke feat/kawan-workspace (fast-forward/squash, konflik → koordinator manual)
       → [done] worktree dibersihkan, status WO di tabel di bawah di-update
```

Definisi "selesai" TIDAK dari dokumen/mock/goal — hanya dari bukti gate + tes WO +
QA lulus (aturan CLAUDE.md: bukti per WO menentukan completion).

## 3. Auto-push (gated)

Aturan repo: *"jangan commit atau push kecuali diminta eksplisit"* — tetap dihormati
secara default. Auto-push per WO hanya aktif bila pemilik menjalankan sesi dengan
**`AUTO_PUSH=1`**:

- `AUTO_PUSH=1` → tiap WO yang [done] di-push ke `origin/feat/kawan-workspace`
  (branch fitur, **bukan main**; PR ke main tetap manual, butuh keputusan pemilik).
- Tanpa flag → hanya auto-commit lokal + merge lokal.
- Commit message diakhiri attribution Claude Code (standar sesi ini).

## 4. Role agent (pemetaan harness tersedia)

| Role | Agent | Tools | Catatan |
|---|---|---|---|
| Koordinator | CC sesi utama | semua, tanpa menulis kode fitur | memilih WO, memutus konflik merge, mencatat status |
| Worker backend | `kawan-backend` | semua | scope sesuai SDD-BACKEND bagian WO |
| Worker frontend | `kawan-frontend` | semua | scope sesuai SDD-FRONTEND bagian WO |
| QA | `kawan-reviewer` | Read/Glob/Grep (read-only) | severity S1-S4; S1/S2 blocking sebelum merge |
| Test | `coder` atau test agent koordinator | Bash | hanya menjalankan gate; tidak menulis kode fitur |
| E2E/visual | `observer` | Read/Bash | Playwright untuk WO-9/WO-F integrasi, screenshot |

Swarm size per WO: 1 worker + 1 QA + 1 test. WO paralel maks 2 worktree aktif
(VPS 3 vCPU/5.8GB — `npm test` 122 worker spawn sudah berat; lebih dari 2 sekaligus
berisiko OOM). Antrean DAG di IMPLEMENTATION-PLAN tetap jadi sumber urutan.

## 5. Progress tracking

Tabel status hidup di file ini (koordinator update tiap perubahan state):

| WO | Status | Worktree | Bukti (gate+QA) | Iterasi |
|---|---|---|---|---|
| WO-0 | belum | — | — | 0 |

(Satu baris per WO saat eksekusi dimulai; status: belum/draft/testing/qa/ready/done/blocked.)

## 6. Batas & fail-safe

- WO diblok (3 iterasi gagal) TIDAK menghentikan swarm: WO dependan ditandai
  blocked-dependency, WO independen lanjut.
- Semua kegagalan gate dicatat verbatim (bukan diringkas "lulus") di laporan WO.
- Sandbox/code execution tetap non-goal; worker tidak menjalankan kode model di host.
- Kredensial/key tidak pernah masuk worktree commit (env admin di luar repo).
- Man-in-the-loop tetap tersedia: pemilik bisa kirim instruksi mid-run; keputusan
  konflik merge/scope tetap koordinator.
