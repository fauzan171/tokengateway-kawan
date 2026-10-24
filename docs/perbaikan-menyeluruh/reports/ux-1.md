# Laporan Gelombang UX-1 — Kenyamanan Antarmuka + Auto-Search + Maskot

Tanggal: 2026-10-24 · Cabang: merge/main-into-feat-nt-p1

## Ringkas per perbaikan

| # | Perbaikan | File | Bukti |
|---|---|---|---|
| 1 | Composer 2 baris di mobile (tombol wrap di atas, teks+kirim di bawah) | chat-view.tsx | flex flex-col sm:flex-row + sm:contents |
| 2 | Skeleton pemuatan saat pindah chat (bukan tampak kosong) | chat-view.tsx | state loadingChat + data-testid=chat-loading-skeleton + tes |
| 3 | Fase streaming persist di bawah pesan — "Mencari di web" dll. tetap terlihat setelah teks mulai mengalir | chat-view.tsx | data-testid=stream-phase di footer pesan streaming |
| 4 | Textarea tetap aktif saat streaming (kirim dijaga isStreaming) | chat-view.tsx | disabled dihapus; guard handleSend tidak berubah |
| 5 | Tombol kirim aktif untuk pesan gambar-saja (konsisten jalur Enter) | chat-view.tsx | disabled={!input.trim() && attachments.length===0} |
| 6 | Maskot Kawan (blob SVG inline, 3 mood: idle/thinking/sad) — karakter lucu di empty-state + indikator berpikir | kawan-mascot.tsx (baru) + 4 tes |
| 7 | Auto-search: pertanyaan menyebut waktu/harga/berita/cuaca → pencarian web otomatis walau tombol Globe mati; hanya bila WEBSEARCH_BASE_URL terpasang | search/prompt.ts wantsFreshData + generate.ts | 8 tes heuristik |
| 8 | PromptPicker: clamp lebar mobile + max-h + klik-luar menutup + aria-haspopup | prompt-picker.tsx | max-w-[calc(100vw-2.5rem)] |
| 9 | Task-view: banner "Sambung ulang" saat SSE putus + daftar task max-h-56 scroll di mobile | task-view.tsx | data-testid=sse-stalled-banner + tes |
| 10 | Tap target ≥44px: chevron cabang, tombol hapus lampiran; panel sitasi max-h-64 + tombol tutup | chat-view.tsx | min-h-11 min-w-11 |
| 11 | Header h-14, pill preview tersembunyi di mobile, padding ganda mobile dihapus, transisi drawer | page.tsx + chat-view root | data-[starting/ending-style] |

## Batas jujur
- Visual belum diverifikasi di browser nyata (375px/1280px) — hanya inspeksi kode + tes jsdom.
- Auto-search heuristik kata-kata Indonesia tertentu; false positive/negative mungkin; tidak menyentuh pertanyaan biasa.
- Loop tool-call model-driven (model memanggil search sendiri sebagai tool) TIDAK dikerjakan — butuh rework 2-pass generate; dicatat sebagai hutang UX-2.
- Maskot mood sad tersedia tetapi belum dipakai pada galat (galat masih pola teks lama).

## Gate
tsc 0 · eslint 0/0 (file berubah) · vitest 1304/119 (baseline 1291/118, +13) · build exit 0 · doc checkers LULUS×2
