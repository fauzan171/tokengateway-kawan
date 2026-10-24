# Laporan Eksekusi FIX-PLAN — 2026-10-19

Eksekutor: Hermes ([CC]). Sumber perintah: `docs/audit/FIX-PLAN.md`.
Branch: `feat/nt-p1-auth`. Tidak ada `git push`, deploy, `pm2 restart`, `wrangler`,
migrasi skema, atau perubahan `dev.db`.

## Ringkasan WO

| WO | Judul | Status | Commit | Verifikasi |
|----|-------|--------|--------|-----------|
| WO-01 | Validasi redirect keluar | Selesai | `e6a5456` | tsc, eslint, `src/security/ssrf.test.ts` hijau |
| WO-02 | Tolak ancestry generasi kosong | Selesai | `2183c86` | `src/lib/chat/generate.test.ts` hijau |
| WO-03 | Catat metadata kegagalan upstream yang aman | Selesai | `1836719` | `generate.test.ts` hijau; log memuat status + kode, tanpa body/kanari |
| WO-04 | Status 404 halaman share | Selesai | `cea9b85` | `flow-e` + `flow-d` hijau; probe `next start` → 404 |
| WO-05 | Spesifikkan locator share E2E | Selesai | `954571a` | `npx playwright test e2e/flow-d.spec.ts` hijau |
| WO-06 | Hapus berkas pengguna yang dapat dipulihkan | Selesai | `06c6bc3` | `users.test.ts` + `remove.test.ts` 18 lulus, tsc hijau |
| WO-07 | Paginasi riwayat + ekspor batch | Selesai | `32a5324` | `chats.test.ts` + `library.test.ts` 27 lulus, `flow-c` hijau |
| WO-08 | Target sentuh + aksi keyboard | Selesai | `b2b27e6` | 3 suite komponen 14 lulus, `render.spec.ts` hijau |
| WO-09 | Bahasa UI sesuai preferensi | **Sebagian** | `8d1c87d` | `settings.test.ts` hijau, `render` + `auth` hijau |
| WO-10 | Paginasi admin + pengumuman galat prompt | Selesai | `0935df6` | `prompt-picker.test.tsx` 5 lulus, `flow-e` hijau |
| WO-11 | Hormati tombol kirim + umpan balik clipboard | Selesai | `1c967da` | 3 suite 17 lulus |
| — | Perbaikan mock `fetchOutbound` | Selesai | `c5dd32b` | 4 suite yang gagal kembali hijau |

## Catatan per WO

### WO-04 — akar penyebab sebenarnya
`notFound()` di `page.tsx` tidak pernah bisa menghasilkan 404 karena
`src/app/loading.tsx` (batas Suspense root) membuat Next mem-flush shell lebih
dulu. Perbaikan: `notFound()` dipindah ke `generateMetadata` (selesai sebelum
header dikirim) **dan** `src/app/loading.tsx` dihapus. Probe produksi
`npx next start -p 3111` + `fetch('/s/definitely-invalid-audit-token')` →
`status 404`. Flow E tetap menguji HTTP 404, bukan teks.

### WO-09 — mengapa Sebagian
FIX-PLAN mengizinkan dua opsi: memetakan seluruh string UI ke kamus `id/en`,
atau menghapus opsi English sampai implementasi siap. Cakupan opsi pertama
melebihi satu WO (chat, auth, sidebar, admin, panel dokumen). Dipilih opsi
kedua: `<option value="en">` dihapus, dan nilai tersimpan `"en"` ditampilkan
sebagai Indonesia agar pemilih tidak kosong. `html.lang` tetap `id` karena
tidak ada UI berbahasa Inggris. Kontrak API, data chat, tema, dan font tidak
disentuh.

### WO-06 — desain
Transaksi DB jadi sumber kebenaran; berkas dihapus setelah commit. Kegagalan
unlink dihitung dan dicatat sebagai `logger.warn` dengan jumlah berkas saja
(tanpa `storageKey`/path), lalu `cleanupOrphans` yang sudah ada menyapunya.
Dua uji baru: transaksi gagal → berkas + baris utuh; unlink gagal → baris
hilang, tidak melempar.

## Temuan di luar rencana (hanya dilaporkan)

1. **Mock `@/lib/net` usang setelah WO-01.** Empat suite (`embed`, `audio`,
   `images`, `web`) meng-mock modul itu tanpa mengekspor `fetchOutbound`,
   sehingga seluruh panggilan keluar gagal sebelum stub `fetch` dipakai — 17
   uji merah. Diperbaiki di commit terpisah `c5dd32b` dengan meneruskan ke
   `fetch`.
2. **`src/app/loading.tsx` dihapus** — hilangnya indikator "Memuat Kawan…"
   untuk seluruh aplikasi. Tidak ada test yang bergantung padanya, tetapi
   navigasi lambat kini tanpa umpan balik. Bila diinginkan, batas loading
   dapat ditambahkan per segmen yang tidak memengaruhi status share.
3. **`chat-sidebar.tsx` mengandalkan bentuk respons `{ share: { token } }`** —
   sudah diperbaiki di commit WO-04 karena tanpa itu flow D tidak bisa
   mendapat token. Ini perubahan working tree yang sudah ada sebelum sesi.
4. **`src/lib/api/route.ts`** menerima POST tanpa body (perbaikan
   pre-existing) — ikut ter-commit di `cea9b85`.
5. **`README`/`CLAUDE.md` tidak menyebut** bahwa root `loading.tsx` memengaruhi
   status HTTP halaman publik; risiko regresi bila seseorang menambahkannya
   kembali.

## Gerbang penuh (akhir sesi)

| Perintah | Hasil |
|----------|-------|
| `npx tsc --noEmit -p tsconfig.json` | exit 0, tanpa keluaran |
| `npx eslint .` | exit 0, tanpa keluaran |
| `npx vitest run` | 72 berkas, **744 uji lulus**, 0 gagal, ~102 dtk |
| `npx playwright test` | **20 uji lulus**, 0 gagal, ~2,6 mnt |
| `npm run build` | sukses |
| `npm run check:docs` | LULUS (79 requirement, 94 WP, 0 pelanggaran) |
| `node scripts/check-licenses.mjs` | 1216 paket, 0 ditolak, 0 tanpa lisensi |

## WO gagal / dilewati

Tidak ada WO yang gagal. WO-09 selesai sebagian sesuai opsi yang diizinkan
FIX-PLAN (lihat di atas).
