# WO-2…WO-5 Report

Satu commit: `e232824`. Dikerjakan langsung oleh Hermes, bukan [CC] —
[CC] menagih $4,47 untuk WO-1 yang diff-nya ~20 baris dan berhenti di batas turn.

## WO-2 — pipeline embedding (E-02, E-B14)

`run-extract.ts`
- Chunk ditulis dalam transaksi (hapus-lalu-buat, idempoten per `ordinal`), dokumen ditandai `ready`.
- Vektor diisi **setelah** transaksi: panggilan jaringan tidak menahan kunci tulis.
- `readEmbeddingConfig()` kosong → lewati, tetap `ready`.
- `embedChunks` melempar → ditelan, tetap `ready`. Retrieval jatuh ke kata kunci.

`retrieve.ts`
- Mode vektor yang menghasilkan nol baris kini lanjut ke `keywordSearch()`, bukan mengembalikan kosong.
- Fungsi kata kunci diekstrak jadi `keywordSearch()` supaya kedua jalur memakainya.

`generate.ts`
- `catch {}` kosong pada retrieval diganti: coba ulang tanpa vektor, tandai `keywordOnly`.

## WO-3 — anggaran konteks (E-03)

- `trimHistory()`: memangkas dua pesan sekaligus dari depan sampai muat 120k karakter. Pesan `user` terakhir tidak pernah dibuang.
- `buildContext()`: anggaran 24k karakter. Chunk yang lewat batas dibuang utuh — potongan separuh kalimat lebih menyesatkan model daripada tidak ada.

## WO-4 — status jujur (E-09, AUD-10)

- EOF tanpa `[DONE]` maupun `finish_reason` → `GenerationError("STREAM_INCOMPLETE", retryable)`. Sebelumnya tercatat `complete`.
- `finishReason === "length"` → note `truncated` + `chat.truncated` (id/en).

## WO-5 — ketahanan (E-04 lanjutan)

- Retry 429/5xx maks 3 percobaan, backoff eksponensial + jitter, `Retry-After` dihormati (maks 30 s).
- Retry **hanya sebelum potongan pertama** — mengulang setelah streaming mulai akan menduplikasi teks.
- Stop pengguna: polling `shouldStop()` tiap 1 detik → `stopSignal.abort()` → koneksi putus segera. Sebelumnya harus menunggu potongan berikutnya, jadi stream yang diam menggantung sampai idle timeout.

## Gerbang (mentah)

```
$ npx tsc --noEmit
TSC_EXIT=0

$ npx eslint src/lib/chat src/lib/documents src/components/chat-view.tsx src/lib/i18n
ESLINT=0

$ npx vitest run
 Test Files  73 passed (73)
      Tests  749 passed (749)

$ npm run build
ƒ  (Dynamic)  server-rendered on demand
```

## Catatan jujur

- **Tidak ada test baru** untuk WO-2…WO-5. Gerbang hijau hanya membuktikan tidak ada regresi, bukan bahwa perilaku baru benar. Test untuk `trimHistory`, fallback kata kunci, dan `STREAM_INCOMPLETE` masih utang.
- Belum diuji terhadap provider sungguhan. Retry dan deteksi EOF baru terbukti secara tipe, bukan secara jaringan.
- Belum deploy. 48 commit menumpuk.

WO2_DONE WO3_DONE WO4_DONE WO5_DONE
