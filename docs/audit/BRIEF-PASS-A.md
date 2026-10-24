# PASS A — Audit jalur generasi & konteks

Kamu auditor engine chat. Project: `/home/hermes/workspace/projects/tokengateway-kawan`.

**ATURAN KERAS: tulis temuan ke berkas SEGERA setelah tiap bagian selesai. Jangan menunda sampai akhir. Jangan mengubah kode aplikasi.**

## Cara kerja (ikuti urutan ini)

1. Baca 5 berkas ini sampai habis, jangan menebak:
   - `src/lib/chat/generate.ts`
   - `src/lib/chat/messages.ts`
   - `src/lib/chat/system-prompt.ts`
   - `src/lib/chat/sse.ts`
   - `src/lib/chat/stream-parse.ts`

2. Setelah baca, **langsung tulis** `docs/audit/ENGINE-A-PASS.md` dengan temuan bagian A+B+C di bawah. Tulis berkas itu walau belum yakin — bisa diperbaiki nanti. Yang penting berkas ada isinya.

3. Baru setelah berkas tertulis, baca ulang bagian yang ragu dan perbaiki dengan `apply_patch` kecil.

## Bagian A — perakitan konteks

- Bagaimana `generate.ts` menyusun array `messages` yang dikirim ke model? Tunjukkan baris.
- Apakah system prompt ikut setiap request atau hanya sekali?
- Apakah riwayat dipotong? Aturan apa (jumlah pesan / token / tanpa batas)? Barisnya mana.
- Apakah ada ringkasan atau kompresi riwayat panjang?
- Apakah pemotongan bisa memutus pasangan `tool_call`/`tool_result`? Itu merusak request di banyak provider.

## Bagian B — kualitas prompt & parameter

- Isi `system-prompt.ts`: ada instruksi format, panjang jawaban, bahasa, larangan mengarang?
- Apakah system prompt mengikuti bahasa UI pengguna?
- Apakah `temperature`, `top_p`, `max_tokens`, `reasoning_effort` dikirim eksplisit atau dibiarkan default provider? Default provider sering bikin jawaban pendek.

## Bagian C — streaming

- Token dikirim segera atau ditunggu sampai buffer penuh?
- `stop`: benar-benar memutus upstream, atau hanya berhenti membaca? Kalau hanya berhenti membaca, biaya jalan terus.
- Ada retry otomatis saat upstream 429/5xx? Berapa kali, backoff apa?
- Pesan parsial disimpan saat gagal? Kalau tidak, satu timeout menghapus jawaban panjang.
- Apakah `finish_reason: "length"` ditangani?
- Apakah EOF tanpa penanda selesai tetap dicatat `complete`?

## Format berkas keluaran

```
# Pass A — jalur generasi & konteks

## E-A01 <judul>
- Bukti: `berkas:baris`
  ```ts
  <kutipan 1-3 baris>
  ```
- Dampak: <konkret ke kualitas jawaban>
- Status: Terbukti | Terduga | Belum diverifikasi
- Perbaikan: <langkah, perkiraan baris>

## Ringkasan pass A (maks 6 baris)
```

Setiap temuan **wajib** `berkas:baris`. Baca berkasnya, jangan mengarang nomor baris. Kalau tidak yakin, tulis `Belum diverifikasi`.

## Larangan

Tidak mengubah `src/**`, tidak commit, tidak push, tidak restart, tidak migrasi DB, tidak menambah dependency.

Baris terakhir berkas: `PASS_A_DONE`
