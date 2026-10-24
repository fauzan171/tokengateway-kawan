# PASS B — Audit RAG, batas jaringan, dan akuntansi token

Kamu auditor engine chat. Project: `/home/hermes/workspace/projects/tokengateway-kawan`.

**ATURAN KERAS: tulis temuan ke berkas SEGERA setelah tiap bagian selesai. Jangan menunda sampai akhir. Jangan mengubah kode aplikasi.**

## Cara kerja

1. Baca berkas ini sampai habis, jangan menebak:
   - `src/lib/documents/embed.ts`
   - `src/lib/chat/usage.ts`
   - `src/lib/net/policy.ts`
   - `src/app/api/kawan/v1/chat/[chatId]/stream/route.ts`
   - Cari juga berkas retrieval/chunking: `ls src/lib/documents/`

2. Setelah baca, **langsung tulis** `docs/audit/ENGINE-B-PASS.md` dengan temuan bagian D+E+F. Tulis walau belum yakin — perbaiki nanti dengan `apply_patch` kecil.

3. Baru setelah berkas tertulis, baca ulang bagian yang ragu.

## Bagian D — RAG / dokumen

- Model embedding apa? Ukuran chunk berapa? Overlap berapa?
- Berapa chunk yang diambil (top-k)? Ada rerank?
- Chunk disisipkan ke system prompt atau user message? Ada penanda sumber/kutipan?
- Ada deduplikasi chunk? Ada batas ukuran konteks dokumen? Tanpa itu RAG menggeser kualitas turun.
- Kalau embedding gagal, apa yang terjadi — gagal total atau fallback pencarian kata kunci?

## Bagian E — batas jaringan

- `policy.ts`: nilai timeout dan batas byte. Apakah timeout total 15 detik cukup untuk jawaban panjang?
- `streamIdleTimeoutMs` 90 detik: apa yang terjadi kalau model diam lebih lama?
- Apakah batas byte memotong jawaban panjang tanpa peringatan?

## Bagian F — akuntansi token

- `usage.ts`: hitung token dari `usage` provider atau estimasi karakter? Estimasi menyimpang jauh untuk bahasa Indonesia.
- Kalau provider tidak melaporkan usage, apa yang dicatat?
- Apakah `reasoning_tokens` ikut dihitung?

## Format berkas keluaran

```
# Pass B — RAG, jaringan, token

## E-B01 <judul>
- Bukti: `berkas:baris`
  ```ts
  <kutipan 1-3 baris>
  ```
- Dampak: <konkret>
- Status: Terbukti | Terduga | Belum diverifikasi
- Perbaikan: <langkah, perkiraan baris>

## Ringkasan pass B (maks 6 baris)
```

Setiap temuan **wajib** `berkas:baris`. Jangan mengarang nomor baris.

## Larangan

Tidak mengubah `src/**`, tidak commit, tidak push, tidak restart, tidak migrasi DB, tidak menambah dependency.

Baris terakhir berkas: `PASS_B_DONE`
