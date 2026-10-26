# SDD-FRONTEND — Kawan Workspace (delta D4-D6)

**Dokumen spesifikasi, bukan implementasi.** Basis: [PRD](<PRD.md>) delta D4-D6,
[SDD kawan-next](<../kawan-next/SDD.md>) D04/D10 untuk kontrak API/SSE. Bahasa UI dan
komentar: Indonesia. Batas keras: renderer Markdown existing (`src/components/markdown.tsx`),
tanpa dependensi UI baru, tanpa identitas visual baru (DESIGN.md belum ada — hanya struktur
fungsional, warna/ikon mengikuti token Tailwind existing).

## Konteks frontend existing yang dipakai ulang

- `src/components/task-view.tsx` — daftar task + detail + SSE `afterSeq` + dedup
  `(runId, seq)` lewat `snapshotSeqRef`/`seenSeqRef`. SSE stream adalah fetch reader
  manual (bukan EventSource), parser frame `\n\n` + `id:`/`event:`/`data:` line.
- `src/components/thinking-indicator.tsx` — `ThinkingDots` (label aktif) dan
  `PhaseTimeline` (3 fase terakhir, riwayat redup). Dipakai chat-view untuk event
  `phase` dari SSE chat; dipakai ulang apa adanya untuk D5.
- `src/components/file-preview-drawer.tsx` — drawer pratinjau artefak (D6: tombol
  unduh/lihat artefak hasil run, jika backend mengirim artifactIds).
- `src/lib/i18n/messages.ts` — kamus `id` sumber kebenaran, `en` bertipe
  `Record<MessageKey, string>`; `t("kunci")`, placeholder `{nama}`.
- State SSE: `snapshotSeqRef` (cursor konsisten), `seenSeqRef` (dedup), `stalled`
  (banner reconnect). Pola T02 tetap; D5 menambah pemrosesan kind baru tanpa mengubah
  aturan dedup.

---

## D4 — Onboarding fokus

### Kontrak yang diandalkan frontend (dari SDD-BACKEND, usulan)

- `UserSetting.onboarding` kolom baru `String @default("")` — nilai kosong = belum
  menjawab; nilai salah satu `riset|data|tulis|campur|custom:<teks>` (custom dibatasi
  200 karakter, server memvalidasi).
- `GET /api/kawan/v1/settings` mengembalikan `settings.onboarding` (string).
- `PATCH /api/kawan/v1/settings` menerima `{ onboarding: string }`; validasi sama
  seperti `theme`/`locale` (value tidak sah → 400, bukan diabaikan).
- Injeksi ke prompt murni pekerjaan backend saat admission run; frontend tidak
  menyuntik apa pun.

### (1) Komponen

| Komponen | Path | Baru/ubah | Props |
|---|---|---|---|
| `OnboardingFocusCard` | `src/components/onboarding-focus-card.tsx` | baru | `{ value: string; onChange(value: string): void; compact?: boolean }` |
| `TaskView` | `src/components/task-view.tsx` | ubah | — (menambah blok kartu onboarding saat task pertama) |
| `SettingsForm` | `src/components/settings-form.tsx` | ubah | — (menambah satu field `onboarding`) |

`OnboardingFocusCard` satu-satunya komponen baru. Isinya: 4 tombol radio
(riset / data / tulis / campur) + 1 input teks "lainnya". Memakai pattern `<label>` +
`<input type="radio">`/`<input type="text">` native seperti `settings-form.tsx`, tanpa
library UI. State internal tidak ada — kontrol penuh lewat props (controlled), supaya
kartu yang sama dipakai di halaman task dan di pengaturan.

Penentuan "user baru / task pertama": frontend membaca `settings.onboarding` dari
`GET /settings` saat mount `TaskView`. Kosong (`""`) → tampilkan kartu di atas form input
task pertama. Sudah terisi → tidak tampil. Tidak ada flag terpisah "sudah ditampilkan":
menjawab atau mengubah nilai = selesai onboarding. User bisa mengabaikan kartu; kartu
tidak memblokir submit.

### (2) State/hook + sumber data

- `TaskView` menambah state `onboarding: string` + `onboardingLoaded: boolean`,
  diisi dari `GET /api/kawan/v1/settings` (satu fetch, cache di state komponen; tidak
  ada hook global baru — settings-form sudah punya pola fetch yang sama).
- Saat user memilih/mengisi fokus di kartu task-view: `PATCH /settings` dengan
  `{ onboarding }`, lalu sembunyikan kartu. Gagal PATCH → pesan error inline
  (`t("onboarding.saveFailed")`), nilai tetap di draft lokal agar tidak hilang.
- `SettingsForm` memperluas `UserSettings` dengan `onboarding: string` dan memasukkan
  field ke PATCH yang sudah ada (satu panggilan, tanpa endpoint baru).

### (3) i18n key (Indonesia)

```
"onboarding.title": "Supaya Kawan lebih tepat, apa fokus pekerjaanmu?",
"onboarding.subtitle": "Bisa diubah kapan saja di Pengaturan.",
"onboarding.opt.research": "Riset dan rangkuman dari web",
"onboarding.opt.data": "Analisis data dan berkas",
"onboarding.opt.writing": "Menulis dan menyunting",
"onboarding.opt.mixed": "Campuran",
"onboarding.opt.custom": "Lainnya",
"onboarding.opt.customPlaceholder": "Tulis fokusmu…",
"onboarding.save": "Simpan",
"onboarding.saveFailed": "Gagal menyimpan pilihan. Coba lagi.",
"onboarding.skipped": "Lewati dulu",
"settings.onboarding": "Fokus pekerjaan",
"settings.onboarding.help": "Dipakai Kawan sebagai konteks tambahan tiap tugas.",
```

Terjemahan `en` wajib diisi (kunci lupa terjemahan = galat kompilasi).

### (4) Interaksi & aksesibilitas

- Radio group native: panah atas/bawah pindah pilihan, Tab pindah ke input custom/tombol
  Simpan. Fieldset + `legend` untuk grup.
- "Lewati dulu" menutup kartu untuk sesi itu saja (state lokal, TIDAK menulis settings —
  onboarding yang diabaikan tampil lagi di task berikutnya sampai dijawab; sesuai PRD,
  injeksi hanya bila jawaban ada).
- Mobile 360px: kartu satu kolom penuh, tombol radio min-height 44px, gap 8px, tanpa
  layout dua kolom. Tidak menggeser fokus input task saat kartu muncul (bukan modal).
- `aria-live="polite"` tidak perlu — kartu statis; error inline memakai `role="alert"`
  seperti pattern existing.
- Input custom: `maxLength={200}`, keyboard Enter TIDAK submit (textarea tidak dipakai;
  satu input teks + tombol Simpan eksplisit).

### (5) Tes komponen

`src/components/onboarding-focus-card.test.tsx` (vitest + testing-library, pola
`settings-form` existing):

1. memilih "Riset" lalu Simpan → `onChange("riset")` terpanggil sekali.
2. memilih "Lainnya" → input teks muncul; ketik "ojek online" → Simpan →
   `onChange("custom:ojek online")`.
3. custom kosong → Simpan tidak memanggil `onChange`.
4. `compact` → wrapper memakai class mobile (smoke render).

Test integrasi `task-view.test.tsx` ditambah kasus: `GET /settings` kosong → kartu tampil
di atas form; sudah terisi → kartu tidak tampil.

### (6) Urutan WO + dependency

- **WO-F1** `OnboardingFocusCard` + i18n + tes komponen. Independent — bisa jalan sebelum
  backend, dengan contract fetch dimock.
- **WO-F2** integrasi TaskView + SettingsForm + PATCH. Bergantung WO-F1 dan field
  `onboarding` live di GET/PATCH settings (WO-2 backend).

### (7) Risiko & unknowns

- Backend memutuskan tabel baru vs kolom `UserSetting` (unknown IMPLEMENTATION-PLAN).
  Kontrak frontend hanya butuh: GET membaca, PATCH menulis satu string. Jika backend
  memilih endpoint onboarding terpisah, hanya dua fetch yang diganti — komponen tetap.
- Nilai custom bisa jadi prompt-injection lewat PATCH jika backend tidak membatasi
  panjang/karakter. Frontend membatasi 200 char di UI, tapi server harus tetap
  memvalidasi (trust boundary di server, bukan UI).
- Tidak ada keputusan apakah kartu juga tampil di halaman chat. Rilis ini: hanya
  task-view (PRD D4 menyebut "saat task pertama").

---

## D5 — Aktivitas per langkah di task-view

### Kontrak yang diandalkan frontend (dari SDD kawan-next D04)

Backend menambah kind TaskEvent additive; payload berlabel aman (bukan raw args/CoT):

```
event: step.started   data: {schemaVersion:1, stepId, kind:"search"|"read"|"tool"|"synthesize", label, ordinal, cycle?, count?, total?}
event: step.completed data: {schemaVersion:1, stepId, label, status:"ok"|"failed"|"denied"}
```

- Label sudah final dalam bahasa Indonesia dari server ("mencari…", "membaca sumber 2/3",
  "menyusun jawaban") — frontend TIDAK menyusun kalimat dari field terpisah; ini
  meniadakan duplikasi grammar di klien. Frontend hanya memilih key i18n fallback bila
  `label` absen.
- `count`/`total` opsional untuk "membaca sumber 2/3".
- Unknown kind diabaikan, `seq` tetap maju (aturan existing, SDD D04).

### (1) Komponen

| Komponen | Path | Baru/ubah |
|---|---|---|
| `ThinkingDots` / `PhaseTimeline` | `src/components/thinking-indicator.tsx` | ulang apa adanya (tidak diubah) |
| `TaskView` | `src/components/task-view.tsx` | ubah — menambah state `activity` + render timeline saat run aktif |

Tidak ada komponen baru. Blok aktivitas dirender di atas blok `live`, memakai
`PhaseTimeline` dengan `PhaseView` yang dipetakan dari event step: `{phase: stepId,
label}`. `ThinkingDots` tampil saat run berjalan dan belum ada step final synthesis
("fase berpikir"); labelnya `activity` terakhir.

### (2) State/hook + sumber data

Ditambahkan di `TaskView` (tetap satu komponen, sesuai desain FIX-08):

```
const [activity, setActivity] = useState<PhaseView[]>([]);
```

- Pemrosesan di loop SSE existing, setelah handler `message.delta`:

```
if (kind === "step.started" || kind === "step.completed") {
  const key = `${run.id}:${seq}`;
  if (seq > snapshotSeqRef.current && !seenSeqRef.current.has(key)) {
    seenSeqRef.current.add(key);
    setActivity((prev) => appendActivity(prev, kind, data));
  }
}
```

- `appendActivity` (fungsi murni di file yang sama): `step.started` mem-push fase baru;
  `step.completed` dengan `status:"ok"` menandai fase itu settled (timestamp visual
  berhenti); `failed`/`denied` menandai gagal. Dedup replay otomatis dari aturan
  `(runId, seq)` existing — event yang di-replay setelah reconnect tidak digandakan.
- Reset `setActivity([])` di `loadSnapshot` (bersama `setLive("")`) supaya snapshot
  baru tidak menampilkan timeline run lama. Setelah reconnect, snapshot tidak membawa
  history step (message-only snapshot existing) → timeline mulai kosong dan terisi dari
  event baru; ini perilaku yang diterima (banner "sambung ulang" sudah menjelaskan
  keadaan). Unknown: apakah snapshot nanti memuat step history — lihat risiko.
- Run terminal → `TERMINAL.has(run.status)` menghentikan stream; timeline terakhir
  dibiarkan tampil sampai `loadSnapshot` mengganti snapshot (aturan penutup existing
  `run.*` event tetap).

### (3) i18n key (Indonesia)

```
"tasks.activity": "Aktivitas",
"tasks.activity.searching": "Mencari…",
"tasks.activity.reading": "Membaca sumber",
"tasks.activity.tool": "Memproses berkas",
"tasks.activity.synthesize": "Menyusun jawaban",
"tasks.activity.thinking": "Kawan sedang bekerja…",
"tasks.activity.failed": "Langkah gagal",
```

Fallback saja — label utama dari server (payload `label`).

### (4) Interaksi & aksesibilitas

- Timeline berada dalam container `aria-live="polite"` yang sudah ada di task-view;
  item baru terbaca otomatis. `aria-atomic="false"` tetap — jangan ulang seluruh
  timeline tiap langkah.
- Tidak autoscroll paksa (aturan SDD D10). Timeline tampil di atas area pesan; user
  scroll sendiri.
- Mobile 360px: label truncate satu baris, maksimal 3 fase terakhir tampil
  (`PhaseTimeline` sudah slice(-3)).
- Reduced motion: `kawan-fade-in` + `kawan-dots` menghormati
  `prefers-reduced-motion` di CSS existing (thinking-indicator tidak diubah; cek
  `globals.css` saat implementasi — jika belum, tambah satu media query, tanpa JS).
- Reconnect: banner `sse-stalled-banner` existing menandai keadaan; timeline tidak
  menampilkan indikator bergerak saat `stalled` ( ThinkingDots hanya saat `!stalled`).

### (5) Tes komponen

`src/components/task-view.test.tsx` — tambah kasus:

1. Frame `step.started` (label "mencari…") → timeline menampilkan label.
2. `step.started` seq 5 lalu replay `afterSeq` sama seq 5 → label tampil sekali (dedup).
3. `step.completed status:"failed"` → item timeline ditandai gagal.
4. Kind tak dikenal `"step.hohoho"` → diabaikan, tidak crash.
5. Reconnect: snapshot baru → timeline kosong kembali (tidak menumpuk run lama).
6. Run terminal → ThinkingDots hilang, timeline terakhir tetap.

Pola fetch/SSE mock mengikuti test existing task-view.

### (6) Urutan WO + dependency

- **WO-F3** render aktivitas + appendActivity + tes. Bergantung kontrak event
  `step.started`/`step.completed` live di backend (WO-4) — frontend bisa mulai dengan
  fixture mock event, merge setelah backend live.
- Unit test `appendActivity` murni: bisa WO-F3 sebelum backend (fixture).

### (7) Risiko & unknowns

- Label dari server berarti i18n tidak penuh di klien (en user tetap melihat label
  Indonesia). Unknown: apakah backend ingin label enum + frontend menerjemahkan.
  Usulan kontrak sekarang mengambil label server demi kesederhanaan; kalau ternyata
  perlu en, ganti payload `label` jadi `labelKey` + args — perubahan terbatas di
  `appendActivity`.
- Snapshot tidak memuat step history → setelah reload di tengah run, timeline mulai
  kosong. Acceptable untuk rilis (PRD D5 hanya mensyaratkan "tampil ≤2 detik dari
  event" dan "replay afterSeq benar"); jika review menuntut persisten, tambah
  `steps` summary additive di GET snapshot — perubahan backend.
- Bentuk pasti payload step (`count/total`) belum final (unknown SDD-BACKEND).
  Frontend hanya membaca `label`, jadi perubahan angka tidak menyentuh klien.

---

## D6 — Metering tampilan di summary run

### Kontrak yang diandalkan frontend (dari SDD kawan-next D04/D05)

`GET /api/kawan/v1/tasks/[taskId]` snapshot run DTO ditambah additive:

```
run: { ..., metering?: {
  schemaVersion: 1,
  inputTokens?: number,      // estimasi, tercatat di budgetJson
  outputTokens?: number,
  estimatedCostUsd?: number, // hanya bila tarif tepercaya ada; absen = tidak tampil
  sourcesRead?: number,      // jumlah sumber unik dibaca
  stopReason?: string
} }
```

Field absen/nullable = run lama atau metering belum tersedia → blok tidak dirender
(additive, klien lama aman). Frontend tidak menghitung token sendiri.

### (1) Komponen

| Komponen | Path | Baru/ubah |
|---|---|---|
| `RunMeteringSummary` | `src/components/run-metering-summary.tsx` | baru |
| `TaskView` | `src/components/task-view.tsx` | ubah — render di bawah pesan saat run terminal |

`RunMeteringSummary({ metering })` — satu baris teks ringkas, format:

> Token ±1,2k masuk / 340 keluar · 5 sumber · est. Rp— (bila tarif ada)

Satu komponen, tanpa state, tanpa fetch: murni fungsi tampil dari props. Format angka
`Intl.NumberFormat("id-ID")`. Estimasi biaya hanya tampil bila `estimatedCostUsd`
ada (angka dari server; frontend tidak menerjemahkan USD→Rp — label i18n netral
"est. biaya").

### (2) State/hook + sumber data

- Tidak ada state baru. `Snapshot.run` type diperluas dengan field optional
  `metering?`; `loadSnapshot` existing sudah mengambil payload itu.
- Run terminal → render summary. Run aktif → tidak render (metering final hanya
  setelah terminal; avoid angka berubah-ubah).

### (3) i18n key (Indonesia)

```
"tasks.metering.tokensIn": "{count} token masuk",
"tasks.metering.tokensOut": "{count} token keluar",
"tasks.metering.sources": "{count} sumber dibaca",
"tasks.metering.cost": "est. biaya {cost}",
"tasks.metering.estimateNote": "Angka estimasi, bukan tagihan.",
```

### (4) Interaksi & aksesibilitas

- Bukan kontrol: teks `text-xs text-muted-foreground`, tidak fokuskan, tidak
  interaktif. Ukuran kecil di bawah blok jawaban.
- Mobile 360px: satu baris boleh wrap; tanpa tabel; tanpa scroll horizontal.
- Angka estimasi diberi catatan `tasks.metering.estimateNote` sebagai `title` +
  teks kecil — jujur bahwa ini estimasi (SDD D05: "missing usage memakai estimator
  konservatif berlabel").
- Tidak ada grafik/gauge (identitas visual baru dilarang).

### (5) Tes komponen

`src/components/run-metering-summary.test.tsx`:

1. `metering` lengkap → tampil token, sumber, biaya.
2. `estimatedCostUsd` absen → biaya tidak tampil, sisa tetap tampil.
3. `metering` undefined → komponen return null.
4. Angka 1200 → "1.200" (format id-ID).

Test integrasi `task-view.test.tsx`: snapshot dengan `run.metering` + status
`completed` → summary tampil; `running` → tidak tampil.

### (6) Urutan WO + dependency

- **WO-F4** `RunMeteringSummary` + i18n + tes. Independent dari backend untuk shape
  (dimock), merge setelah WO-6 backend menyertakan `metering` di snapshot.
- **WO-F5** (opsional kecil) integrasi TaskView render — bisa digabung WO-F4.

### (7) Risiko & unknowns

- Bentuk pasti `metering` belum final (unknown SDD-BACKEND di IMPLEMENTATION-PLAN:
  "bentuk field metering di TaskRun"). Kontrak di atas adalah usulan minimal;
  jika backend memakai nama beda, hanya type + satu destrukturisasi yang berubah.
- Tarif model tepercaya mungkin tidak pernah tersedia (BYOK, harga provider berubah)
  → `estimatedCostUsd` bisa absen selamanya; UI sudah aman terhadap itu.
- Token "estimasi" vs "reported" bisa beda; label "est." + catatan menjaga kejujuran.

---

## Urutan WO frontend keseluruhan

```
WO-F1  OnboardingFocusCard + i18n + tes        (independent, backend-free via mock)
WO-F3  Aktivitas per langkah: appendActivity + render + tes  (fixture; live → WO-4 backend)
WO-F4  RunMeteringSummary + i18n + tes         (fixture; live → WO-6 backend)
WO-F2  Integrasi onboarding ke TaskView/SettingsForm  (butuh WO-2 backend live)
WO-F5  Integrasi metering ke TaskView (gabung ke WO-F4 bila sudah live)
```

WO-F1/F3/F4 paralel (semua bisa dengan mock). WO-F2/F5 merge terakhir. Tiap WO selesai
dengan gate: `npx tsc --noEmit -p tsconfig.json`, `npx eslint <file berubah>`,
`npm test`, `npm run build`.

## Catatan antislop / batas

- Tanpa komponen UI baru selain 2 (kartu onboarding, baris metering); keduanya
  elemen native + Tailwind token existing.
- Tanpa hook global baru (useOnboarding, useActivity dsb.) — state lokal TaskView
  sudah cukup; satu fetch settings dipakai dua konsumen tanpa cache global.
- Tanpa identitas visual baru: tidak ada ikon, warna, atau font baru.
- Delivery Gate antislop (browser, screenshot) tetap wajib saat implementasi —
  bukan bagian dokumen ini.
