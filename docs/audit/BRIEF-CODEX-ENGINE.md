# BRIEF — Audit engine Kawan vs standar ChatGPT web

Kamu auditor. Tugas: temukan kenapa **kualitas output Kawan terasa kurang** dibanding ChatGPT web, lalu beri solusi konkret. Bukan menulis fitur baru — **diagnosis dulu, bukti dulu**.

## Konteks

Kawan = chat BYOK self-hosted (Next.js App Router + Prisma + SQLite). Sudah 10.375 baris di `src/lib/chat` + `src/lib/documents`. Arsitekturnya bukan mainan. Owner mengeluh **hasil jawaban AI-nya kurang**, bukan aplikasinya error.

Artinya: cari cacat di **jalur yang menentukan kualitas jawaban** — perakitan prompt, pemilihan konteks, riwayat pesan, grounding dokumen, dan parameter generasi. Bukan di CSS, bukan di i18n (itu sudah beres).

## Berkas yang WAJIB dibaca penuh

- `src/lib/chat/generate.ts` (774) — jantung generasi
- `src/lib/chat/sse.ts` (243), `src/lib/chat/stream-parse.ts` (176) — transport
- `src/lib/chat/messages.ts` (337) — riwayat & konteks
- `src/lib/chat/system-prompt.ts` — perakitan prompt
- `src/lib/documents/embed.ts` (263) — RAG
- `src/lib/net/policy.ts` (361) — timeout/batas
- `src/app/api/kawan/v1/chat/[chatId]/stream/route.ts` — pintu masuk
- `src/lib/chat/usage.ts` (339) — hitung token

## Referensi pembanding (pakai pengetahuanmu + ini)

Peta dokumentasi resmi — buka kalau perlu, jangan mengarang isinya:

- open-webui pipeline: https://deepwiki.com/open-webui/open-webui/6-backend-processing-pipeline
  Sub-halaman penting: `4.3-message-history-tree` (percabangan), `5.2-content-rendering-pipeline`, `4.2-message-input-system`
- LibreChat AI: https://deepwiki.com/danny-avila/LibreChat/5-ai-integration
  Sub-halaman penting: `5.1-baseclient-architecture`, `5.4-message-processing-pipeline`, `5.5-tool-integration`, `5.7-memory-system`, `5.11-human-in-the-loop-approvals-and-steering`

Kalau mengutip perilaku kompetitor, **sebutkan sumbernya**. Kalau tidak yakin, tulis `Terduga`.

## Pertanyaan audit (jawab satu per satu, dengan bukti)

### A. Perakitan konteks
1. Bagaimana `generate.ts` menyusun array `messages` yang dikirim ke model? Apakah system prompt ikut setiap request, atau hanya sekali?
2. Apakah riwayat dipotong? Dengan aturan apa — jumlah pesan, token, atau tanpa batas? Tunjukkan barisnya.
3. Apakah ada ringkasan/kompresi riwayat panjang? ChatGPT punya; kalau Kawan tidak, sebut dampaknya.
4. Apakah pesan lama yang terpotong memutus pasangan `tool_call`/`tool_result`? Itu merusak request di banyak provider.

### B. Kualitas prompt
5. Isi `system-prompt.ts`: apakah ada instruksi format, panjang jawaban, bahasa, larangan mengarang? Bandingkan dengan praktik ChatGPT web.
6. Apakah system prompt mengikuti bahasa UI pengguna? Kalau tidak, apakah itu sebab jawaban terasa kaku?
7. Apakah parameter generasi (`temperature`, `top_p`, `max_tokens`, `reasoning_effort`) dikirim eksplisit atau dibiarkan default provider? Default provider sering membuat jawaban pendek dan malas.

### C. RAG / dokumen
8. `embed.ts`: model embedding apa, ukuran chunk berapa, overlap berapa, berapa chunk yang diambil (top-k), ada rerank?
9. Apakah chunk yang diambil disisipkan ke system prompt atau user message? Apakah ada penanda sumber/kutipan?
10. Apakah ada deduplikasi chunk dan batas ukuran konteks dokumen? Tanpa itu, RAG justru menggeser kualitas turun.

### D. Streaming & UX yang memengaruhi persepsi kualitas
11. Apakah `generate.ts` mengirim token segera atau menunggu buffer penuh?
12. Bagaimana `stop` bekerja — benar-benar memutus upstream, atau hanya berhenti membaca? Kalau hanya berhenti membaca, biaya jalan terus.
13. Apakah ada retry otomatis saat upstream 429/5xx? Berapa kali, dengan backoff apa?
14. Apakah pesan parsial disimpan saat gagal? Kalau tidak, pengguna kehilangan jawaban panjang karena satu timeout.

### E. Kebenaran teknis
15. `usage.ts`: apakah hitungan token memakai `usage` dari provider atau estimasi karakter? Estimasi menyimpang jauh untuk bahasa Indonesia.
16. Apakah ada penanganan `finish_reason: "length"`? Kalau tidak, jawaban terpotong tanpa tanda.

## Format laporan

Tulis ke `docs/audit/ENGINE-AUDIT-ASTRA.md`:

```
# Audit engine Kawan
## Ringkasan eksekutif (maks 10 baris)
## Temuan
### E-01 <judul singkat>
- Bukti: <file:baris> + kutipan kode 1-3 baris
- Dampak ke kualitas jawaban: <konkret>
- Status: Terbukti | Terduga | Belum diverifikasi
- Perbaikan: <langkah, perkiraan baris kode>
## Tabel prioritas
| ID | Dampak | Usaha | Prioritas |
## Yang TIDAK perlu diubah
```

Aturan: setiap temuan **wajib** punya `file:baris`. Temuan tanpa bukti tulis `Belum diverifikasi` dan taruh di bagian akhir. Jangan mengarang nomor baris — baca berkasnya.

## Larangan

- Jangan mengubah kode aplikasi. Ini audit, bukan implementasi.
- Jangan `git commit`, `git push`, `pm2 restart`, deploy, atau migrasi DB.
- Jangan menyentuh `src/lib/i18n/*`, `e2e/*`, `playwright.config.ts`.
- Jangan menambah dependency.
- Jangan menulis "sudah optimal" tanpa bukti — kalau suatu bagian memang baik, sebutkan alasannya dengan baris kode.

Setelah selesai, cetak `EXIT=0` di baris terakhir.
