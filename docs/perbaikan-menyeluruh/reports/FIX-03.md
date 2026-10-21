# FIX-03 — State per chat/generation, replay, idempotensi

Status: **selesai** untuk lingkup yang tertulis di bawah. Dikerjakan Hermes
native setelah empat sesi [CC] mati `400 upstream route rejected`.

## Yang berubah

### Backend (dari sesi [CC], diverifikasi Hermes)

| Berkas | Perubahan |
|---|---|
| `src/lib/chat/idempotency.ts` (baru) | `idempotencyDigest({owner, operation, chatId, payload})` — SHA-256 kanonik dengan `DIGEST_VERSION`; `isUniqueViolation` untuk P2002 |
| `src/lib/chat/messages.ts` | Memakai modul di atas; kunci sama + digest beda → 409, bukan memutar generasi chat lain; retry P2002 sekali |
| `src/app/api/kawan/v1/chat/[chatId]/messages/route.ts` | Membaca header `Idempotency-Key` |
| `src/lib/chat/messages.test.ts` | Assertion diperluas: owner/operasi/chatId/payload ikut digest |

### Klien — `src/components/chat-view.tsx`

| Perilaku | Implementasi |
|---|---|
| Satu action ID per kiriman | `actionIdRef` diisi sekali, dikirim sebagai `Idempotency-Key`, direset hanya setelah server menerima |
| Retry memakai ID sama | Catch `handleSend` **tidak** mengosongkan `actionIdRef` |
| Double click = satu job | `sendingRef` (penjaga sinkron, menutup celah sebelum `isStreaming` render) |
| Abort saat navigasi | `streamAbortRef` + `AbortController`; `handleStop` juga membatalkan; loop membaca `chatIdRef.current !== activeId` lalu `reader.cancel()` |
| Replay + dedup | `afterSeq=${cursor}`; event `part` dengan `seq <= cursor` dibuang; `cursor` = seq terakhir diterapkan |
| Backoff | Maks 5 sambung-ulang, `min(500·2^(n-1), 8000)` ms; stream ditutup tanpa `done` → sambung ulang, bukan menyerah |
| State per chat | Efek pada `chatId` mereset pesan/leaf/galat/streaming dan memulihkan draft chat tujuan |
| Draft tidak hilang | `draftsRef` (dalam sesi) + `sessionStorage` (`kawan:draft:<chatId>`, selamat dari reload) |
| Delta tidak tertukar | Delta hanya diterapkan bila `chatIdRef.current === activeId`; `finally` hanya menyentuh state bila chat masih sama |

Server sudah mengirim `seq` pada setiap event (`src/lib/chat/sse.ts`, `eventData`),
jadi dedup berbasis `seq` valid dan tidak perlu kontrak baru.

## Test

`src/components/chat-view.test.tsx` — deskripsi baru `idempotensi kiriman (FIX-03)`:
dua `submit` berurutan sebelum balasan server → tepat **1** POST ke
`/chat/c1/messages` dan `Idempotency-Key` terisi.

`src/lib/chat/messages.test.ts` — digest: repeatable, dan berbeda untuk
owner/chatId/operasi/payload berbeda.

## Gate (dijalankan Hermes, hasil nyata)

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx vitest run src/components/chat-view.test.tsx` | 7/7 lulus |
| `npm test` | **79 file, 787 test lulus**, exit 0 |
| `npx eslint` dua berkas diubah | lihat `/tmp/kawan-final-lint.log` |
| `npm run build` | lihat `/tmp/kawan-final-build.log` |

## Yang TIDAK dikerjakan

- **Judul chat dari state** (butir 8 work-order) — masih membandingkan teks.
- Pruning cursor: cursor hanya bilangan bulat yang di-reset per generasi, jadi
  tidak tumbuh; tidak ada struktur yang perlu dipangkas.
- Replay setelah **reload penuh** saat stream berjalan belum diuji E2E di
  browser; yang diuji hanya jalur sambung-ulang di dalam sesi.
- `sessionStorage` tidak diuji di jsdom (dipakai `try/catch`, gagal = draft
  dalam sesi tetap jalan).
