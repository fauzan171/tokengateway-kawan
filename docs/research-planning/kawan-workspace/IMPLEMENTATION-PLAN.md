# IMPLEMENTATION-PLAN — Kawan Workspace

26 Oktober 2026. Final (rev. pasca-review). Basis: PRD v2 + SDD-BACKEND + SDD-FRONTEND.
Aturan kawan-next tetap berlaku (satu WP per sesi, migrasi additive dua provider,
4 gate sebelum klaim).

## Pra-syarat

1. WP01+WP02 di working tree (~887 baris, 4 gate lulus 26 Okt) — **commit dulu** (WO-0).
2. Sinkronisasi baseline: SDD ditulis terhadap `main` `9c2f5320`; implementer wajib
   kerja di branch integrasi yang memuat schema Task*/Artifact (bukan worktree lama).

## DAG WO

```
WO-0   Commit WP01/WP02 + paket dokumen riset/SDD          [blokir semua]
WO-B1  Migrasi schema additive (TaskRun fields, TaskStep, TaskSource,
       SearchUsageDaily, Artifact.taskId, UserSetting.onboarding)
       + check-migrations + db:generate
  ├─→ WO-B2   Search chain Tavily→Jina→direct (chain.ts, key resolver, tes;
  │           + @mozilla/readability utk ekstrak halaman)
  ├─→ WO-B4   File-gen tool (file-tool.ts, registry xlsx/docx, tes render balik)
  │           (B2 ∥ B4 paralel setelah B1)
  ├─→ WO-B2b  Onboarding backend: field `onboarding` UserSetting, validasi
  │           enum+custom, injeksi focus → configJson run di admission
  │           (spesifikasi: SDD-BACKEND §D4)
  └─→ WO-B2c  Egress consent utk search: sanitasi PII/minimisasi query sebelum
              keluar ke Tavily/Jina — prasyarat WO-B3 (REV-03 kawan-next:
              consent egress mencakup operator search)
WO-B3   Loop riset 3 siklus (research.ts, web_search/web_read registry,
        dispatch di run.ts) — butuh B1 + B2 + B2c + B4
  ├─→ WO-B5   Metering (budget.ts, settle, DTO snapshot `{usage, consumed,
  │           sourcesRead}` — backend sumber kebenaran) — butuh B1+B3
  └─→ WO-B2d  Provenance/sitasi minimal: TaskSource → sourceRefs jawaban
              (padanan WP10 kawan-next, scope minimal)
WO-F1   OnboardingFocusCard + i18n + tes        ∥ (mock, backend-free)
WO-F3   Aktivitas per langkah: baca step.started/completed payload kanonik
        SDD-BACKEND (label server, status enum TaskStep) + tes  ∥ (fixture)
WO-F4   RunMeteringSummary + i18n + tes (DTO backend, tanpa estimatedCostUsd) ∥
WO-F2   Integrasi onboarding → TaskView/SettingsForm     (butuh BO-B2b live)
WO-F5   Integrasi aktivitas+metering → TaskView          (butuh B3+B5 live)
WO-9    e2e: riset end-to-end + onboarding + file + reconnect SSE
        (butuh semua WO di atas + B2d)
WO-10   Acceptance & review independen (kawan-reviewer) + 4 gate penuh
```

## Keputusan pasca-review (atas delegasi penuh pemilik)

- **S1-1 kontrak step.\***: SDD-BACKEND jadi sumber kebenaran — payload + `label`
  server-side, status enum TaskStep (`succeeded|failed|cancelled|indeterminate`),
  tanpa `preview`. SDD-FRONTEND D5 mengikuti (WO-F3).
- **S1-2 egress**: query search dari prompt user = egress pihak ketiga → WO-B2c
  wajib sebelum WO-B3. Tanpa consent/gate, WO-B3 tidak boleh dieksekusi.
- **S1-3 D4**: penyimpanan = kolom `UserSetting.onboarding` (additive, bukan tabel);
  injeksi di admission transaksional (SDD-BACKEND §D4).
- **S2-2 metering DTO**: `{usage:{reported,promptTokens,completionTokens,totalTokens},
  consumed, sourcesRead}`; tanpa `estimatedCostUsd`; `stopReason` dari field run.
- **S2-4**: cap sel CSV/XLSX ≤100 kolom × ≤500 char; `preview` dihapus dari event.
- Nomor WO tunggal: WO-B* (backend), WO-F* (frontend), WO-9/10 (integrasi).
  Rujukan "WO-2/WO-4/WO-6 backend" di SDD-FRONTEND dimigrasi ke skema ini saat
  WO terkait dieksekusi (S2-1; tidak blocking, satu file yang sama diperbaiki).

## Keputusan dependensi

- **`@mozilla/readability`**: DISETUJUI (Apache-2.0, kecil, peer jsdom ada) — masuk
  WO-B2. Bila stripNoise terbukti cukup saat implementasi, boleh dibatalkan (ponytail).
- Key Tavily/Jina: env admin default (`TAVILY_API_KEY`, `JINA_API_KEY`); BYOK user
  via ConnectorCredential existing.
- Feature flag: chain riset off bila tidak ada key → tool web_search tidak
  terekspos ke model (fail-closed); task tetap jalan tanpa web.

## Gate per WO

`tsc --noEmit`, `eslint <file berubah>`, `npm test`, `npm run build` + bukti di
laporan WO. Migrasi: `node scripts/check-migrations.mjs` + `npm run db:generate`.

## Model eksekusi

Semua WO dieksekusi otomatis oleh swarm agent per [SDD-EXECUTION](<SDD-EXECUTION.md>):
satu WO = satu worktree terisolasi; worker agent implement → test agent 4 gate →
QA agent review (S1/S2 blocking) → auto-commit + merge ke `feat/kawan-workspace` →
push remote hanya bila `AUTO_PUSH=1` (branch fitur, bukan main). WO paralel maks 2
worktree aktif (RAM).

## Rollback

Migrasi additive → revert commit + migrasi down, data user aman. Provider gagal →
fail-closed (`SEARCH_UNAVAILABLE`), tidak ada jawaban tanpa sumber. Semua delta di
belakang capability gate; task existing tidak berubah perilaku bila flag off.

## Acceptance utama (WO-10)

- Task riset pertama dari UI kosong: submit → siklus ≤3 → jawaban ter-sitasi +
  sumber tercatat (B2d) + metering tampil.
- File XLSX/DOCX hasil generate_file terbuka balik, hash cocok, kuota ditegakkan.
- Search habis semua provider → pesan SEARCH_UNAVAILABLE, tanpa hasil fiktif.
- Query keluar ke provider selalu lewat egress gate (B2c); tanpa PII dari prompt.
- Reconnect SSE (afterSeq) tidak menggandakan aktivitas/teks.
- Onboarding: jawaban tersimpan, memengaruhi prompt run berikutnya, bisa diubah.
- Semua pelanggaran keamanan suite = nol; row lama (kolom null) tetap valid.
