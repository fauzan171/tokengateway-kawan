# Kawanku Harness: rebranding dan handoff tim

Branch `feature/kawanku-rebrand` menambahkan distribusi Harness yang memakai identitas Kawanku di `kawanku-harness/`. Aplikasi Next.js di root tetap menjadi aplikasi terpisah. Root TypeScript dan ESLint mengabaikan folder Harness agar dua dependency graph tidak tercampur.

## Yang tersedia

Identitas produk pada Web/Desktop, judul tab, loading screen, sidebar, wordmark, favicon, ikon instalasi PWA, menu Desktop, installer, dan dokumentasi aktif memakai Kawanku. Logo paus diganti monogram K. Struktur dan desain dasar aplikasi dipertahankan. Bundle ID desktop memakai `ai.kawanku.desktop`; nama package, ID model, API provider, dan atribusi lisensi upstream dipertahankan untuk kompatibilitas.

Direktori source credentials/storage dan snapshot tes disertakan. File rahasia, dependency, dan output build tidak disertakan. Installer Git hook melewati instalasi pada subproject sehingga tidak mengganti hook repository induk. `dsh://` tetap dipertahankan untuk kompatibilitas autentikasi upstream; beberapa distribusi Desktop yang terpasang dapat berbagi scheme itu.

## Menjalankan setelah clone

Gunakan Node.js 24.9+ dan pnpm 11.28.5.

```sh
git clone --branch feature/kawanku-rebrand https://github.com/fauzan171/tokengateway-kawan.git
cd tokengateway-kawan/kawanku-harness
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:check
pnpm dsh web --no-open --host 127.0.0.1 --port 3081
```

Buka URL autentikasi yang dicetak launcher. Setiap pengguna menyiapkan gateway/model dan kredensial runtime sendiri. Port 3081 menghindari tunnel VPS yang sudah menggunakan 3080.

## Bukti verifikasi pada 25 Oktober 2026

- `pnpm run build:artifacts`: 8 tahap lulus.
- `DSH_GATE_CONCURRENCY=1 pnpm run build:check`: Host dan Client aggregate lulus.
- Tes branding terarah: 516 tes lulus pada empat file untuk wordmark/ikon, brand slots, document title, dan boot page.
- Tes Desktop: locale, tray, ikon tray, dan packaging lulus; setelah ekspektasi branding diperbarui, seluruh 30 tes welcome renderer lulus. Total 58 kasus Desktop tersebut tercakup.
- Plugin inventory: 21 tes lulus ketika diulang terpisah setelah pengujian awal mengalami timeout saat kompilasi berat.
- Git-hook installer: dua kasus terarah lulus, meliputi nested install dan isolasi main/linked worktree; 40 kasus lain tidak dijalankan pada perintah terarah tersebut.
- `apps/web/tests/pwa-manifest.e2e.ts`: kelima tes lulus dengan Chromium di luar sandbox macOS. Meliputi metadata instalasi, raster ikon, favicon tema, antialiasing, dan safe zone maskable.
- `verify-client-ui-i18n`: 1.134 source UI lulus.
- `verify-installer-locales`: delapan bahasa lulus.
- Dokumen berpasangan yang diedit dicatat ulang; README Inggris/China lulus pemeriksaan pairing.
- Aplikasi lokal berjalan pada 3081: HTTP 200 setelah autentikasi; judul HTML `Kawanku`.
- Audit impor: seluruh 19.186 file source yang dimaksud disertakan, tidak ada nama file secret/private-key terdeteksi dalam staged source; contoh `.env`/`.pem` di area credentials/storage tetap diabaikan Git.
- Root Next TypeScript mengikutkan 130 file, tanpa file Harness; whitespace check staged lulus.

## Batas verifikasi

`apps/web/tests/built-boot.expected.e2e.ts` belum lulus penuh: satu kasus fixture sesi end-to-end timeout pada 180 detik, sementara satu kasus lain lulus. Run mencatat warning React terkait pembaruan `DocumentTitle` saat render dan pesan inspect provider tanpa Connection aktif setelah timeout. Penyebabnya belum diisolasi; keberhasilan build, unit test, dan HTTP bukan bukti semua alur percakapan sudah tervalidasi. Jangan menganggap seluruh suite Web lulus atau branch ini sebagai rilis produksi. Tim perlu menindaklanjuti fixture tersebut sebelum menetapkan gate rilis.

Suite `test:gui` penuh sempat dijalankan lalu dihentikan untuk mengurangi beban laptop. Kasus yang relevan dengan branding diverifikasi melalui tes terarah di atas. Tidak ada perubahan deployment VPS, autentikasi, billing, atau implementasi 23 work order agent core dari aplikasi Next.js yang diklaim selesai oleh branch ini.
