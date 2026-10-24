# Laporan ENG-1 — Audit Jawaban URL ("Aku tidak bisa lihat link itu")

Tanggal: 2025-10-24 · Commit: 436b0c6 · Live: kawanku.tokengateway.ai.id

## Gejala

Pengguna menempel URL repo GitHub + minta jelaskan isi. Model menjawab
"Pencarian web tidak aktif, aku tidak punya kemampuan membuka URL" dan
meminta isi repo ditempel manual — padahal web search dikonfigurasi.

## Rantai penyebab (semua direproduksi, bukan dugaan)

| # | Temuan | Bukti |
|---|---|---|
| 1 | Auto-search UX-1 hanya picu pada kata waktu (hari ini/harga/...). Kalimat jelaskan isi repo ini tanpa kata itu TIDAK mencari. | DB: generationEvent tanpa phase searching |
| 2 | Saat search picu (kata terbaru), SearXNG menemukan repo (S1 benar). | events: sources:5, URL repo posisi 1 |
| 3 | readSource membaca halaman OK (7441 char) TAPI ekstraksi didominasi menu navigasi GitHub; README mulai di char 3373. | audit: readmeStartsAt=3373 |
| 4 | buildSearchSystem memotong teks pada TEXT_MAX=2000, README TIDAK PERNAH masuk prompt; model hanya melihat menu. | audit: readmeVisibleInFirst2000=false |
| 5 | Engine upstream SearXNG tidak stabil: brave Suspended, duckduckgo CAPTCHA, google cse suspended; query valid pun balas 0 konsisten. | curl langsung unresponsive_engines; restart pm2 searxng memulihkan sementara |

## Perbaikan (commit 436b0c6)

1. sources/read.ts - pickMainContent: bila ada article/main, ekstrak konten
   utamanya, buang nav/footer. README GitHub kini jadi inti teks.
2. search/prompt.ts - TEXT_MAX 2000 menjadi 6000 (README 3373..6000 kini ikut).
3. search/prompt.ts - heuristik wantsUrlInspection: URL + kata kerja
   cek/buka/baca/jelaskan/lihat/ringkas/review/periksa memicu pencarian.
4. chat/generate.ts - FALLBACK LANGSUNG: bila hasil pencarian 0 DAN pesan
   memuat URL, baca halamannya langsung via readSource (fase Membaca tautan
   langsung tampil di UI). Gagal baca = model jujur tanpa sumber.

## Verifikasi live (Playwright, sesi login nyata)

Pertanyaan persis pelapor: jelaskan isi repo ini https://github.com/fauzan171/tokengateway-kawan

SEBELUM: tidak punya alat untuk membuka URL... kirimkan README.
SESUDAH: jawaban 3842 char mengutip [S1]: self-host, BYOK, mode server key
terenkripsi, Next.js/React/Prisma, tanpa billing token, arah produk agen.
noRefusal true, mentionsSelfHost/BYOK/NextJs true.

## Batas jujur

- Engine SearXNG upstream tetap rawan (suspend/captcha di luar kendali
  aplikasi); fallback readSource menutup jalur URL, tapi query pengetahuan
  umum tanpa URL tetap tergantung kesehatan engine.
- Loop tool-call model-driven (model memanggil web.read sendiri) tetap
  hutang UX-2/ENG-2 - tidak dikerjakan di gelombang ini.

## Gate

tsc 0, eslint 0/0, vitest 1306/119 (+2), build 0, health ready