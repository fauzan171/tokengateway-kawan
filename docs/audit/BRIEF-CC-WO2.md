# WO-2 — Sambungkan pipeline embedding dokumen

Kerjakan **hanya WO ini**. Jangan menyentuh yang lain.

## Latar

Audit menemukan RAG tidak pernah aktif:

- `embedChunks` hanya dipanggil dari `src/lib/documents/retrieve.ts:112` untuk query, tidak pernah saat ingest.
- Handler worker (`src/worker.ts:31`) hanya berisi `chat.generate`, `document.extract`, `storage.cleanup`. Tidak ada `document.embed`.
- `run-extract.ts` membuat chunk lalu langsung `status: "ready"` tanpa vektor.
- Akibatnya, begitu `EMBEDDING_BASE_URL`/`EMBEDDING_MODEL` diisi, `retrieve.ts:119` hanya memilih chunk bervektor → **hasil kosong, dokumen tidak terlihat**.

## Yang harus dikerjakan

### 1. Isi embedding saat ekstraksi

Di `src/lib/documents/run-extract.ts`, setelah chunk dibuat dan sebelum dokumen ditandai `ready`: panggil `embedChunks` (dari `src/lib/documents/embed.ts`) untuk seluruh chunk, lalu simpan vektor per chunk.

Aturan:
- Idempoten: jalankan ulang job untuk dokumen yang sama tidak boleh menggandakan atau merusak vektor. Tulis vektor dengan update per `ordinal`, bukan insert baru.
- Jika konfigurasi embedding tidak tersedia (`embedChunks` mengembalikan `undefined`), lewati tahap ini dan tetap tandai `ready` — mode kata kunci masih berfungsi.
- Jika embedding gagal (provider mati/timeout), **jangan gagalkan ekstraksi**. Tandai dokumen `ready` dengan catatan bahwa vektor belum ada, supaya retrieval jatuh ke kata kunci.

### 2. Fallback kata kunci saat retrieval

Di `src/lib/documents/retrieve.ts`: jika mode vektor menghasilkan nol hasil (bukan hanya saat konfigurasi kosong), jalankan retrieval kata kunci sebagai cadangan. Jangan mengubah skor atau urutan mode vektor yang berhasil.

### 3. Beri tahu saat degradasi

Di `src/lib/chat/generate.ts` sekitar baris 619-624: `catch {}` kosong saat ini menelan kegagalan retrieval. Ganti dengan penanganan yang mencatat degradasi (mis. variabel `retrievalDegraded`) dan teruskan ke `buildContext` atau ke catatan yang bisa ditampilkan. Jangan sampai chat gagal — degradasi harus tetap menghasilkan jawaban.

## Batas berkas

Boleh diubah: `src/lib/documents/run-extract.ts`, `src/lib/documents/retrieve.ts`, `src/lib/documents/embed.ts` (hanya jika perlu ekspor tipe), `src/lib/chat/generate.ts` (hanya blok retrieval), dan berkas test terkait.

**Jangan sentuh:** `prisma/schema.prisma` (kolom vektor sudah ada — periksa dulu, jangan tambah), `src/lib/i18n/*`, `src/lib/chat/tree.ts`, `src/lib/chat/system-prompt.ts`, `e2e/*`, `.env`.

Jika ternyata skema Prisma **belum** punya kolom vektor, **berhenti** dan laporkan — jangan buat migrasi sendiri.

## Larangan

- Jangan menambah dependency.
- Jangan commit, push, restart, deploy.
- Jangan mengubah `EMBEDDING_*` di `.env`.
- Jangan mengerjakan WO lain.
- Jangan menambal tipe dengan `as any` atau `@ts-ignore`.

## Verifikasi wajib

```sh
npx tsc --noEmit
npx eslint src/lib/documents src/lib/chat/generate.ts
npx vitest run
npm run build
```

Semua harus lulus. `vitest` sebelumnya 748/748 — jumlah tidak boleh turun.

Tambah satu test yang membuktikan: (a) ekstraksi tanpa konfigurasi embedding tetap `ready` dan tidak melempar, (b) retrieval mode vektor yang kosong jatuh ke kata kunci.

## Laporan

Tulis `docs/audit/WO-2-REPORT.md`: berkas diubah, keluaran mentah keempat perintah, hasil test baru, dan **keputusan yang Anda ambil** soal dokumen lama (apakah perlu re-embed manual).

Baris terakhir: `WO2_DONE`
