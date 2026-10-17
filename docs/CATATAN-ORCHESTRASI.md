# Catatan Orkestrasi — Kawan

Dokumen ini merangkum struktur proyek, isi modul auth, dan alasan keputusan
strategi sesi. Sumbernya `README.md` dan `tasks/nontechnical-v1/README.md`.

## 1. Ringkasan struktur proyek

Kawan adalah chat AI yang bisa di-self-host, ditujukan untuk pengguna nonteknis,
memakai gateway [tokengateway.ai.id](https://tokengateway.ai.id). Model BYOK:
mode server default menerima dan menyimpan kunci API pengguna dalam bentuk
terenkripsi lalu meneruskan request, sedangkan mode Direct (key hanya di browser) belum tersedia. Kawan tidak menambahkan billing token.

Status: fondasi dan backend auth/koneksi/chat tersedia; UI chat masih parsial.
Arah agen seperti Manus dan prioritas implementasi kini mengikuti
[scope aktif](../tasks/ACTIVE-SCOPE.md). Browser, sandbox dan lifecycle task belum ada.

Struktur direktori utama:

- `src/app/` — antarmuka Next.js App Router.
- `src/lib/config/` — registry dan validasi konfigurasi runtime.
- `src/lib/jobs/` — antrean job berbasis tabel dan logika worker. Tidak ada Redis di v1.
- `src/worker.ts` — entry point worker, proses terpisah dari image yang sama.
- `prisma/` — schema dan migrasi dengan dua provider: SQLite dan PostgreSQL.
- `tasks/nontechnical-v1/` — PRD, SDD, plan, coverage, execution prompt.

Scope aktif ada di `tasks/ACTIVE-SCOPE.md`, yang mendahului baseline
`tasks/nontechnical-v1/`. Urutan baca baseline: `prd.md` (produk) → `sdd.md` (desain teknis) → `plan.md` (milestone
dan work package) → `coverage.md` (matriks include/defer/exclude) →
`execution-prompt.md` (instruksi worker dan quality gate). Bila terjadi konflik
antar dokumen, requirement produk menang atas detail teknis, `sdd.md` menang atas
`plan.md`, dan `plan.md` menang atas `execution-prompt.md`. Paket full-parity lama
di `tasks/prd.md`, `tasks/sdd/`, `tasks/plan.md`, `tasks/todo.md` adalah referensi
alternatif, bukan scope aktif. Klaim cakupan 100% hanya berlaku untuk scope
terpilih yang dipetakan di `coverage.md`; Kawan bukan klon identik ChatGPT dan
tidak menjanjikan perilaku yang identik dengannya.

Aturan kerja ringkas: satu basis kode, satu image; worker dijalankan sebagai entry
point berbeda dari image yang sama. Commit memakai daftar path eksplisit, bukan
`git add .`; push hanya dilakukan setelah gate fase lulus.

## 2. Berkas di `src/lib/auth/`

| Berkas | Isi |
| --- | --- |
| `index.ts` | Titik masuk Auth.js: merakit satu instance `NextAuth` dan mengekspor `handlers` serta `auth()`. |
| `session.ts` | Konfigurasi Auth.js: provider Credentials, callback `jwt` dan `session`, `loadAuthConfig()`. |
| `session-store.ts` | Buku besar sesi untuk pencabutan: `hashToken`, `hashUserAgent`, `createSession`, `isSessionValid`, `revokeSession`, `pruneSessions`. |
| `password.ts` | Verifikasi hash password (Argon2id). |
| `users.ts` | Utilitas pengguna: `normalizeEmail`, `findUserById`, dan sejenisnya. |
| `password.test.ts` | Unit test untuk `password.ts`. |
| `session-store.test.ts` | Unit test untuk `session-store.ts`. |
| `users.test.ts` | Unit test untuk `users.ts`. |

## 3. Mengapa JWT plus tabel `Session`

Auth.js di sini memakai `strategy: "jwt"` sekaligus tetap menyimpan tabel
`Session`, karena keduanya memikul tanggung jawab yang berbeda dan tidak saling
menggantikan: JWT adalah pembawa klaim supaya setiap permintaan tidak perlu
query sesi ke database lebih dari yang diperlukan, sedangkan tabel `Session`
adalah pemegang *izin* yang bisa dicabut — inilah yang membuat logout atau
penonaktifan akun benar-benar berlaku. Pada login baru, callback `jwt` membuat
id sesi acak (`sid`), menaruh `sid` mentah di dalam token, dan menuliskan hanya
SHA-256 dari `sid` itu ke kolom `tokenHash` sehingga token mentah tidak pernah
tersimpan di database; pada permintaan berikutnya `isSessionValid()` memastikan
baris sesi masih ada, belum dicabut (`revokedAt` masih `null`), belum kedaluwarsa,
dan memang milik pengguna yang sama. Bila pemeriksaan itu gagal, callback
mengembalikan `null` sehingga Auth.js membuang cookie sesi — token yang dicabut
atau nonaktif gagal secara tertutup (fail closed). Selain itu, identitas pada
setiap permintaan selalu dimuat ulang dari database: role, nama, email, dan
status tidak pernah dipercaya dari klaim token lama karena klaim bisa basi
(SDD-5.1). Kombinasi ini memakai JWT sebagai pembawa identitas sekaligus lookup sesi dan pengguna pada setiap validasi berikutnya. Jadi jalur autentikasi ini tetap bergantung pada database; JWT tidak menghilangkan lookup server.
