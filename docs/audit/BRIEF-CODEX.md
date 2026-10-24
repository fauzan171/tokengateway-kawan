# Mandat: Audit menyeluruh + dokumen fix plan Kawan

Kamu adalah **mandor** (lead auditor) untuk proyek Kawan. Tugasmu **BUKAN** memperbaiki kode. Tugasmu: audit menyeluruh, bukti nyata, dokumen terpisah, dan fix plan terurut yang nanti dieksekusi agen lain.

Root proyek: `/home/hermes/workspace/projects/tokengateway-kawan`

## Aturan keras

1. **Jangan ubah kode aplikasi.** Satu-satunya yang boleh kamu tulis: berkas di bawah `docs/audit/`. Perintah yang mengubah state (deploy, `pm2 restart`, `git commit`, `git push`, migrasi DB, DELETE/UPDATE pada DB) DILARANG.
2. **Jangan cetak rahasia.** API key, token, connection string, OAuth secret, isi `.env` → tulis `[REDACTED]` bila perlu menunjuk keberadaannya.
3. **Setiap temuan wajib punya bukti.** Sertakan perintah persis yang kamu jalankan + keluaran ringkasnya (potong, jangan tempel ratusan baris). Temuan tanpa bukti tulis sebagai `Belum diverifikasi`.
4. **Bedakan tegas:** `Terbukti` (ada keluaran perintah), `Terduga` (hasil baca kode, belum dijalankan), `Belum diverifikasi`.
5. Jangan mengklaim lulus untuk sesuatu yang belum kamu jalankan.
6. Bahasa Indonesia.

## Verifikasi yang WAJIB kamu jalankan (catat keluaran + jam)

```
npx tsc --noEmit -p tsconfig.json
npx eslint .
npx vitest run
npx playwright test
npm run check:docs
node scripts/check-licenses.mjs 2>/dev/null || true
npm run build
```

Catat durasi dan jumlah lulus/gagal masing-masing. `playwright test` makan ~2,5 menit; jalankan sungguhan, jangan diskip.

Sumber data untuk audit perilaku (baca saja, jangan tulis):
- `dev.db` (SQLite di root proyek) — tabel `Generation`, `GenerationEvent`, `Chat`, `ChatMessage`, `Connection`, `ShareLink`, `Session`.
- `~/.pm2/logs/kawan-out.log`, `kawan-error.log`, `kawan-worker-out.log`.
- `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3010/` dan beberapa endpoint lain.
- `git status --short`, `git log --oneline -15`, `git diff --stat`.

## Konteks yang sudah diketahui (verifikasi ulang, jangan asal percaya)

- **Sudah diperbaiki hari ini**: `src/lib/net/policy.ts` + `src/lib/chat/generate.ts` — timeout stream diubah dari total 15 detik menjadi idle 90 detik. Test lulus 65/65, build sukses.
- **MASIH GAGAL dan belum diperbaiki**: jalur `runGeneration` end-to-end menghasilkan `UPSTREAM_ERROR` dalam ~1 detik dengan balasan 0 karakter. Padahal probe mentah ke gateway dengan prompt yang sama balas HTTP 200. Dugaan: body/messages yang disusun kode ditolak gateway, tapi status + body respons gateway tidak pernah dicatat. **Telusuri ini sampai akar penyebab.**
- **2 E2E gagal**: `e2e/flow-d.spec.ts:52` (strict mode violation `getByText("Pesan untuk dibagikan")` cocok 2 elemen) dan `e2e/flow-e.spec.ts:51` (`GET /s/e2e-token-b` balas 200 padahal user sudah dihapus).
- Working tree punya 6 berkas termodifikasi.
- `src/app/s/[token]/page.tsx` dengan token palsu balas 200 (dugaan stream body Next 15.5.27, `notFound()` tidak mengubah status).
- `locale` di preferensi belum mengubah bahasa UI.

## Deliverable — tiga berkas, tulis persis di path ini

### 1. `docs/audit/AUDIT-2026-10-19.md`

Laporan audit menyeluruh. Wajib memuat:

- **Ringkasan eksekutif** — 5–10 baris: kondisi sistem sekarang, apa yang sehat, apa yang tidak.
- **Tabel hasil gerbang verifikasi** — perintah, hasil (`LULUS`/`GAGAL`), jumlah test lulus/gagal, durasi, waktu jalan.
- **Inventori permukaan** — daftar halaman (`src/app/**/page.tsx`), route API (`src/app/api/**/route.ts`), komponen (`src/components/**`), alur worker. Beri status per item.
- **Temuan** — satu bagian per temuan, dengan: ID (`AUD-01`, `AUD-02`, …), judul, tingkat (`Kritis`/`Tinggi`/`Sedang`/`Rendah`), status bukti, lokasi berkas:baris, bukti perintah + keluaran, dampak ke pengguna, dugaan akar penyebab.
- **Yang sudah benar** — daftar singkat hal yang diaudit dan memang sehat. Jangan hanya menulis kejelekan.
- **Batasan audit** — apa yang tidak bisa kamu pastikan dan mengapa.

Prioritaskan area ini:

- **Keamanan**: validasi input di batas kepercayaan, IDOR/kepemilikan resource (apakah `chatId` selalu dicek milik `userId`), pencabutan sesi, kebocoran data lintas pengguna, enkripsi kredensial, tautan berbagi publik, rate limit, SSRF di jalur keluar.
- **Kebenaran data**: relasi Prisma, transaksi, penghapusan data pengguna (apakah benar-benar tuntas — `flow-e` gagal, jadi ada kebocoran), integritas event generasi, idempotensi.
- **Ketahanan**: penanganan galat, retry, cancel/stop, jalur worker, pemulihan setelah crash, timeout.
- **Performa**: N+1 query, ukuran payload, paginasi.

### 2. `docs/audit/UIUX-GAPS.md`

Khusus UI/UX. Bukan daftar selera — gap yang bisa dibuktikan. Untuk setiap temuan:

- ID (`UX-01`, …), judul, tingkat, lokasi (`berkas:baris` atau nama halaman/route).
- **Kondisi sekarang** vs **seharusnya**.
- **Cara membuktikan**: aksesibilitas (label, `aria-*`, fokus, kontras, `min-h-11` target sentuh, `role="status"`/`aria-live` untuk status dinamis), responsif (lebar kecil, target sentuh), status kosong/loading/galat, konsistensi bahasa dan istilah, alur yang buntu atau membingungkan, umpan balik yang hilang setelah aksi, navigasi keyboard, dan paritas dengan Open WebUI bila relevan.
- **Bukti** dari pembacaan komponen; sebutkan berkasnya.

Bahas minimal: `chat-view.tsx`, `chat-sidebar.tsx`, `documents-panel.tsx`, `media-controls.tsx`, `prompt-picker.tsx`, `settings-form.tsx`, `admin-panel.tsx`, `markdown.tsx`, `source-list.tsx`, `usage-report.tsx`, semua form auth, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, dan halaman `/s/[token]`.

### 3. `docs/audit/FIX-PLAN.md`

Fix plan terurut yang bisa dieksekusi agen lain **tanpa bertanya**. Wajib memuat:

- **Urutan gelombang** (Wave 1, 2, 3…). Gelombang 1 = hal yang memblokir atau berisiko data/keamanan. Tiap gelombang punya alasan urutannya.
- **Satu work order per perbaikan**, dengan format persis:

```
### WO-01 — <judul singkat>
- Temuan: AUD-03
- Tingkat: Kritis
- Berkas target: <path:line>
- Akar penyebab: <satu-dua baris, konkret>
- Perubahan: <langkah konkret, bukan "perbaiki X">
- JANGAN diubah: <berkas/perilaku yang harus tetap utuh>
- Kriteria lulus: <kondisi terukur>
- Perintah verifikasi: <perintah persis yang harus hijau>
- Risiko: <apa yang bisa rusak + cara balik>
- Perkiraan: <S/M/L>
```

- **Kriteria lulus global** untuk seluruh plan.
- **Urutan commit yang disarankan** (satu WO = satu commit, pesan commit disarankan).
- **Hal yang TIDAK boleh dilakukan eksekutor** — daftar larangan eksplisit (jangan sentuh `.env`, jangan deploy, jangan push, jangan ubah skema tanpa migrasi terpisah, jangan hapus test yang gagal untuk meloloskannya, dst).

## Cara bekerja

Telusuri dulu, jangan menebak. Baca kodenya. Jalankan perintahnya. Untuk bug yang gagal, cari akar penyebab sampai kamu bisa menjelaskan mekanismenya dalam satu-dua baris — bukan "tampaknya ada masalah".

Bila menemukan sesuatu yang mengubah gambaran (mis. kebocoran keamanan), catat dan lanjutkan; jangan berhenti di tengah.

Tulis ketiga berkas itu, lalu cetak ringkasan akhir: jumlah temuan per tingkat, temuan kritis mana saja, dan jumlah work order di tiap gelombang.