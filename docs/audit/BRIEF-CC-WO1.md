# WO-1 — Sambungkan system prompt ke model

Kerjakan **hanya WO ini**. Jangan menyentuh yang lain.

## Latar

Audit `docs/audit/ENGINE-AUDIT-ASTRA.md` menemukan: `setSystemPrompt()` menyimpan prompt pengguna ke `ChatMessage` dengan `parentId: null`. `buildAncestryPath()` berjalan mundur dari pesan assistant mengikuti `parentId`, jadi root system bukan leluhur dan tidak pernah masuk `messages`. `getSystemPrompt()` ada dan diuji tapi **tidak dipanggil dari jalur produksi**. Akibatnya fitur system prompt per chat tidak berfungsi sama sekali.

## Yang harus dikerjakan

### 1. Kirim system prompt pengguna

Di `src/lib/chat/generate.ts`, tepat setelah `const messages = buildMessages(...)`:

- Ambil prompt pengguna dengan `getSystemPrompt(db, generation.chatId)`.
- Sisipkan sebagai elemen **pertama** array `messages` di body request (baris ~677), sebelum `contextSystem` dan `searchSystem`.
- Lewati jika `ancestry` sudah memuat role `"system"` — jangan kirim dua kali.

### 2. Tambah prompt bawaan

Buat satu konstanta teks di `src/lib/chat/generate.ts` (bukan berkas baru) berisi instruksi dasar berbahasa Indonesia, maksimal 8 baris, mencakup:

- Jawab sesuai bahasa yang dipakai pengguna.
- Panjang jawaban mengikuti kebutuhan pertanyaan — jangan memotong jawaban yang butuh penjelasan.
- Jika tidak yakin, katakan tidak yakin. Jangan mengarang fakta, angka, atau sumber.
- Format dengan markdown bila membantu keterbacaan (daftar, tabel, blok kode).

Kirim konstanta ini sebagai system message **pertama**, sebelum prompt pengguna. Jadi urutan akhir:

```
prompt bawaan → prompt pengguna (jika ada) → konteks dokumen → sumber web → riwayat
```

### 3. Lepas pemaksaan bahasa Indonesia

Di `src/lib/search/prompt.ts` baris 48, hapus baris `"Jawab dalam bahasa Indonesia."`. Prompt bawaan di langkah 2 sudah mengatur bahasa mengikuti pengguna. Jangan hapus aturan sitasi `[S1]` atau larangan mengarang URL di berkas yang sama.

## Batas berkas

Boleh diubah: `src/lib/chat/generate.ts`, `src/lib/search/prompt.ts`, dan berkas test yang menyertainya.

**Jangan sentuh:** `src/lib/i18n/*`, `src/lib/documents/*`, `src/lib/chat/tree.ts`, `src/lib/chat/system-prompt.ts` (hanya dibaca), `prisma/*`, `e2e/*`, `playwright.config.ts`, `.env`.

## Larangan

- Jangan menambah dependency.
- Jangan commit, jangan push, jangan `pm2 restart`, jangan deploy.
- Jangan mengubah skema Prisma atau membuat migrasi.
- Jangan menambal error tipe dengan `as any` atau `@ts-ignore`.
- Jangan mengerjakan E-02, E-03, atau WO lain meskipun terlihat mudah.

## Verifikasi wajib

Jalankan dan tunjukkan keluaran mentahnya:

```sh
npx tsc --noEmit
npx eslint src/lib/chat/generate.ts src/lib/search/prompt.ts
npx vitest run
npm run build
```

Keempatnya harus lulus. `vitest` sebelumnya 748/748 — jumlah tidak boleh turun.

Tambahkan **satu test baru** di berkas test yang sudah ada untuk `generate.ts` (cari `src/lib/chat/*.test.ts`) yang membuktikan: prompt bawaan ada di `messages[0]`, prompt pengguna ada di `messages[1]` bila diset, dan tidak ada duplikasi system bila ancestry sudah memuat role system. Ikuti pola mock yang sudah dipakai berkas test itu — jangan bikin harness baru.

## Laporan

Tulis `docs/audit/WO-1-REPORT.md`: berkas yang diubah, diff ringkas, keluaran mentah keempat perintah gerbang, dan hasil test baru. Jangan tulis "semua lulus" tanpa keluaran.

Baris terakhir: `WO1_DONE`
