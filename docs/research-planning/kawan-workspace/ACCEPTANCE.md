# ACCEPTANCE — Kawan Workspace v1 (WO-10)

Basis `feat/kawan-workspace` setelah `f980b6b1` (WO-9). Setiap baris acceptance
`IMPLEMENTATION-PLAN.md` §"Acceptance utama (WO-10)" dipetakan ke bukti yang
**mudah dijalankan ulang**. Tidak ada baris yang ditandai lulus karena dokumen,
mock, atau goal tertulis — bukti = perintah + keluaran, atau kode yang jelas
membuktikan plus tesnya.

Gate penuh terakhir (branch integrasi, `f980b6b1`):

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit 0, tanpa output |
| `npx eslint <11 berkas WO-9>` | exit 0, tanpa output |
| `npm test` | 130 file / **1419 lulus**, nol gagal |
| `npm run build` | exit 0 |
| `npx playwright test` (4 spec WO-9, desktop) | **5/5 lulus** |
| `npx playwright test … --project=mobile --project=tablet` | **8/8 lulus** |
| `flow-e` + `flow-onboarding` berdampingan (`--workers=2`) | **2/2 lulus** |
| `node scripts/check-migrations.mjs` | OK (2 provider, urutan sama) |

---

## 1. Task riset pertama dari UI kosong → siklus ≤3, jawaban ter-sitasi, sumber, metering

**Bukti e2e** — `e2e/research-loop.spec.ts:39`
```
✓ WO-9: agent riset menyelesaikan run, menampilkan sumber dan metering
```
Alur: login → `/tugas` → pilih agent `research` → submit. Asersi: label agent
"Riset Kawan" tampil, `task-metering` muncul (bukti run terminal + metering
terkirim), `task-sources` memuat tepat 1 tautan, artikel jawaban memuat teks
model dan **tidak** memuat JSON mentah fase ("queries") — jadi jawaban yang
dirender adalah sintesis, bukan kebocoran keluaran internal.

**Siklus ≤3** — `src/lib/tasks/research.ts:61` `RESEARCH_LIMITS.maxCycles: 3`,
ditegakkan di loop `runResearchRun`. Uji loop: `src/lib/tasks/research.test.ts`
(12/12 lulus, termasuk `resume idempotent`).

**Sumber** — WO-B2d `gates/GATE-WO-B2d.md`: `run.sources` hanya `page_read`,
dedupe per `finalUrl`, `orderBy accessedAt`, judul dibatasi 300 char.

**Metering** — WO-B5 `gates/GATE-WO-B5.md`, DTO `{usage:{reported,…}, consumed,
sourcesRead}`; run lama (kolom null) → `null`, bukan nol palsu
(`src/lib/tasks/budget.test.ts:167`).

**Sisa:** e2e berjalan di gateway palsu yang deterministik; jumlah siklus nyata
bergantung model sungguhan. Batas 3 adalah kontrak kode, bukan hasil observasi
terhadap model asli.

## 2. File XLSX/DOCX dari `generate_file` terbuka balik, hash cocok, kuota ditegakkan

**Bukti e2e (XLSX, jalur UI → byte)** — `e2e/file-gen.spec.ts:28`
```
✓ WO-9: generate_file membuat artefak yang benar-benar dapat diunduh
```
Entri artefak tampil dengan format `XLSX`; unduhan lewat route mengembalikan
**200**, byte diawali `PK` (ZIP/OOXML — bukan HTML galat), panjang > 200.

**Terbuka balik + hashing (XLSX & DOCX)** — `src/lib/tools/file-gen.test.ts`
- `:51` "hasil render terbuka balik via exceljs, nilai sheet cocok" — byte
  di-*load* ulang oleh ExcelJS, nilai sel dibandingkan.
- `:102` "DocSchema minimal valid: `word/document.xml` ada, `sha256` = hash byte
  storage" — `artifact.sha256` dibandingkan dengan `createHash("sha256")` atas
  byte yang benar-benar tersimpan.

**Kuota** — `src/lib/tools/file-gen.test.ts:163` "kuota habis: `QUOTA_EXCEEDED`,
tidak ada baris Artifact ready" (tidak meninggalkan baris yatim);
`src/lib/artifacts/create.ts:17,116` `DAILY_QUOTA = 100` ditegakkan sebelum
tulis; `artifacts.test.ts:99` "melebihi batas ukuran ditolak tanpa baris dan tanpa
berkas".

**Nama berkas** — regresi `[..]+` dibuang; `artifacts.test.ts` "titik tunggal
pada ekstensi dipertahankan" (3 asersi).

**Sisa:** DOCX hanya dibuktikan di level unit (byte + `word/document.xml`), tidak
ada spec e2e DOCX. Tidak ada pembaca DOCX pihak ketiga di suite — asersi
memeriksa struktur OOXML langsung, bukan hasil buka di Word.

## 3. Search habis semua provider → `SEARCH_UNAVAILABLE`, tanpa hasil fiktif

**Bukti unit** — `src/lib/search/chain.test.ts` (10 kasus):
```
:113 semua provider gagal → SEARCH_UNAVAILABLE, tanpa hasil, retryable:false
:102 direct gagal / query non-URL → tetap SEARCH_UNAVAILABLE, bukan sukses kosong
:188 timeout provider (AbortSignal 8s) memicu failover
```
Kode galat tunggal: `src/lib/search/chain.ts`, dipetakan ke model lewat
`src/lib/tools/catalog.ts` (`SEARCH_UNAVAILABLE`).

**Sisa:** tidak ada e2e untuk jalur ini — sabuk pengaman gagal-tertutup diuji di
level chain, bukan lewat UI. Bila dianggap wajib, tambahkan spec dengan gateway
palsu yang menolak ketiga provider.

## 4. Query keluar selalu lewat egress gate (B2c); tanpa PII dari prompt

**Bukti unit** — `src/lib/net/policy.test.ts` (23 kasus) + `src/security/ssrf.test.ts`
(17 kasus), keduanya lulus. Inti:
- metadata cloud, loopback, privat, IPv4-mapped IPv6, trailing dot, redirect
  lintas host → ditolak;
- `ALLOW_INSECURE_HTTP=1` hanya membuka http polos ke host **publik**;
- jalur nyata `fetchOutbound` diuji, bukan helper terisolasi.

**Tanpa PII** — `src/lib/search/chain.test.ts:154` "query murni-PII → fail-closed,
**TIDAK ada request keluar sama sekali**"; `:164` "PII di antara kata lain
dibuang sebelum dikirim ke provider". `:138` "key tidak bocor ke pesan galat
maupun attempts".

**Wiring** — setiap adapter pencarian dan `web_read` memanggil `assertOutboundAllowed`
(9 direktori memakai gate; lihat `src/lib/search/web.ts`, `src/lib/sources/read.ts`,
`src/lib/net/policy.ts`).

**Sisa:** egress e2e memakai host `127.0.0.1` yang dibuka presisi oleh allowlist
uji — pembukaan itu ada di konfigurasi tes, bukan di produksi. Nilai kebijakan
allowlist produksi tidak diuji dari sini (tidak ada jaringan keluar).

## 5. Reconnect SSE (`afterSeq`) tidak menggandakan aktivitas/teks

**Bukti e2e** — `e2e/research-reconnect.spec.ts:34`
```
✓ WO-9: putus SSE di tengah run tidak menggandakan teks atau aktivitas
```
Abort request `.../runs/*/events` saat run **masih berjalan** (satu kali), lalu
tekan "Sambung ulang" di `sse-stalled-banner`. Asersi: `occurrences("Balasan
palsu") === 1`, label sintesis tepat **sekali**. (Assertion jumlah `listitem`
≤ 3 dibuang — `PhaseTimeline` memotong ke 3 secara struktural, jadi tidak bisa
gagal; lihat QA S4-1.)

**Bukti unit** — dedup key `${runId}:${seq}` + kursor `afterSeq` di jalur replay
snapshot; tes komponen `task-view.test.tsx` (WO-F3/F5).

**Sisa:** putus koneksi disimulasikan dengan `route.abort`, bukan pemutusan
jaringan sungguhan. UI **tidak** menyambung sendiri — perilaku yang dijanjikan
adalah banner + tombol; spec menegaskan itu, bukan auto-reconnect. Yang
dibuktikan adalah dedup `(runId, seq)` sisi klien; sambung-ulang memuat ulang
snapshot lalu menyambung dari cursor, jadi ini bukan replay delta murni.

## 6. Onboarding: jawaban tersimpan, memengaruhi prompt run berikutnya, bisa diubah

**Bukti e2e** — `e2e/flow-onboarding.spec.ts:27`
```
✓ WO-9: onboarding tersimpan, bertahan setelah reload, dan bisa diubah
```
Pilih "Riset dan rangkuman" → `/api/kawan/v1/settings` mengembalikan
`onboarding === "riset"` → reload, kartu onboarding hilang → ubah ke "data" di
`/preferensi` dan nilai tersimpan.

**Memengaruhi prompt** — D4 di `src/lib/tasks/research.ts`:
`FOCUS_PRESETS` + `focusLine(configJson)`; `modelTurn` menyisipkan satu pesan
`system`. Bukti `src/lib/tasks/research.test.ts:356` ("Fokus pengguna saat ini:
riset mendalam"), `:374,379` (tanpa fokus → kalimat tidak ada, JSON rusak /
nilai tak dikenal → `null`), dan tes regresi prototype chain (`constructor` /
`toString` tidak menyisipkan `native code` — QA S3-1).

**Snapshot saat submit** — `src/lib/tasks/admission-onboarding.test.ts` (11
kasus): `:76` "perubahan setting setelah submit tidak mengubah `configJson` run
lama"; `:91` "follow-up membawa fokus saat itu, bukan nilai run lama"; `:63`
"user belum menjawab → `configJson.focus` null dan run tetap valid"; `:150`
"userId berbeda tidak saling bocor fokus".

**Validasi input** — `:119` 400 `INVALID_SETTING`, `:130` custom kosong /
kepanjangan ditolak, `:139` karakter kontrol dibuang. `custom:` dipotong 200
char juga di `focusLine` sebelum masuk prompt.

**Sisa:** nilai `focus` adalah input pengguna yang masuk ke prompt sebagai pesan
`system`. Itu disengaja (fitur), dan panjangnya dibatasi; namun isi bebas tetap
dapat memuat instruksi. Tidak ada sanitasi semantik — batasnya panjang, bukan
makna. Lihat temuan QA WO-10.

## 7. Semua pelanggaran keamanan suite = nol; baris lama (kolom null) tetap valid

**Suite keamanan** — `src/security/`: 4 berkas, lulus penuh.
```
canary.test.ts      10 kasus  redaksi kanari, ciphertext koneksi tidak bocor
cross-user.test.ts  16 kasus  lintas pengguna → 404 / tidak terhapus / tidak terlihat
ssrf.test.ts        17 kasus  metadata cloud, loopback, redirect, DNS privat
xss.test.ts         10 kasus  text/html & SVG ditolak, <script> jadi teks,
                              nama berkas bermarkup tidak bocor ke aria/title
```
Dijalankan ulang pada branch ini: **6 file / 69 tes lulus** (termasuk
`policy.test.ts` dan `chain.test.ts`).

**Baris lama** — `src/lib/tasks/budget.test.ts:167` "snapshot API mengekspos
metering; run lama (kolom null) tetap valid"; metering run lama → `null`, bukan
nol. `admission-onboarding.test.ts:63` run tanpa jawaban onboarding tetap valid.
Migrasi additive: `node scripts/check-migrations.mjs` OK (WO-B1 gate).

**Kredensial server-only** — `canary.test.ts:107-126`: ekspor chat, arsip data,
snapshot berbagi, dan DTO koneksi tidak memuat ciphertext maupun kunci mentah.

---

## Ringkasan status

| # | Acceptance | Status | Bukti utama |
|---|---|---|---|
| 1 | riset e2e + sitasi + sumber + metering | **lulus** | `research-loop.spec.ts:39` |
| 2 | file XLSX/DOCX buka balik, hash, kuota | **lulus** (e2e XLSX, unit DOCX) | `file-gen.spec.ts:28`, `file-gen.test.ts:51,102,163` |
| 3 | SEARCH_UNAVAILABLE tanpa hasil fiktif | **lulus (unit)**, tanpa e2e | `chain.test.ts:102,113` |
| 4 | egress gate + tanpa PII | **lulus** | `policy.test.ts`, `ssrf.test.ts`, `chain.test.ts:154` |
| 5 | reconnect tidak menggandakan | **lulus** | `research-reconnect.spec.ts:34` |
| 6 | onboarding tersimpan + memengaruhi prompt | **lulus** | `onboarding.spec.ts:27`, `research.test.ts:356` |
| 7 | nol pelanggaran keamanan; baris lama valid | **lulus** | `src/security/*` (53 kasus), `budget.test.ts:167` |

**Tidak ada baris yang di-`blocked_external`** — tidak ada gate yang menuntut
lingkungan yang tidak tersedia di mesin ini. Gate live (model sungguhan, jaringan
keluar nyata, pembaca DOCX pihak ketiga) hanya disebut sebagai *sisa*: semuanya
memperkuat bukti, tidak menggantikannya.

## Sisa terbuka (tidak memblokir v1)

1. **`flow-onboarding` hanya desktop.** Spec itu mengubah state pengguna E2E_B
   global; menjalankannya paralel lintas project membuat project berikutnya
   tidak melihat keadaan "belum dijawab". Tiga spec lain lulus di ketiga
   viewport (desktop 5, mobile 4, tablet 4 = 13).
2. **Poin 3 tanpa e2e.** Jalur `SEARCH_UNAVAILABLE` diuji di unit; UI tidak.
3. **DOCX tanpa pembaca pihak ketiga.** Asersi memeriksa `word/document.xml` dan
   magic bytes, bukan hasil buka di Word/LibreOffice.
4. **Reconnect disimulasikan** (`route.abort`), bukan putus jaringan nyata.
5. **`focus` pengguna masuk prompt tanpa sanitasi semantik** — hanya batas
   panjang. Diterima sebagai fitur; risikonya dicatat di review WO-10.