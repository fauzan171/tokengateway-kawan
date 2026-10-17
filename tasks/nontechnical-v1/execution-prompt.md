# Execution prompt — Kawan (scope nontechnical-v1)

> Arah produk diperbarui 17 Oktober 2026: baca [scope aktif](../ACTIVE-SCOPE.md) terlebih dahulu. Keputusan agen, prioritas, dan pengurangan scope di sana mengesampingkan bagian lama yang bertentangan.

Status: instruksi kerja untuk baseline chat. Bootstrap selesai dan perintah `npm run dev`, `npm run build`, `npm start` tersedia di package.json (start memerlukan build). UI chat masih parsial; urutan berikutnya mengikuti scope aktif.

Dokumen ini mengatur cara kerja mandor dan worker. Requirement ada di `prd.md`; desain di `sdd.md`; urutan kerja dan ID paket di `plan.md`; keputusan cakupan di `coverage.md`.

---

## 1. Precedence dan batas awal

Urutan otoritas: instruksi terbaru pemilik produk → `prd.md` → `sdd.md` → `plan.md` → dokumen ini.

- Paket full-parity lama (`tasks/prd.md`, `tasks/plan.md`, `tasks/sdd/`, `tasks/todo.md`, `tasks/coverage.*`) adalah **referensi alternatif**, bukan task aktif. Jangan mengerjakan isinya.
- `tasks/archive/` hanya riwayat.
- **Fondasi NT-P0 sudah tersedia.** Tugas berikutnya adalah AG-P0 pada scope aktif, bukan bootstrap ulang.
- Pemilik produk dapat memerintahkan "lanjut semua fase" dengan checkpoint; tanpa perintah itu, setiap fase dibuka terpisah.

---

## 2. Peran

**Mandor (orchestrator).** Satu orang/agen. Tanggung jawab:

1. Memilih work package yang **ready**: dependency lulus, DoR terpenuhi, kontrak tidak sedang berubah.
2. Memecah paket menjadi child work package bila menyentuh lebih dari 5 file inti atau lebih dari satu subsistem.
3. Menugaskan worker dengan batas yang jelas: file yang boleh disentuh, kontrak yang dipakai, perintah verifikasi.
4. Memastikan **tidak ada dua worker menyentuh file yang sama** pada waktu bersamaan.
5. Mengintegrasikan hasil, menjalankan gate, dan memutuskan lulus/tidak.
6. Melakukan commit dan push (lihat bagian 6). Worker tidak melakukan push.
7. Memperbarui status di `plan.md` dan bukti di laporan.

**Worker.** Mengerjakan satu child work package:

1. Membaca dokumen yang relevan **sebelum** menulis kode: `prd.md` bagian terkait, bagian `sdd.md` terkait, baris `coverage.md` terkait.
2. Memverifikasi perilaku baseline dari sumber lokal bila paket menandai `PERLU-BUKTI`.
3. Mengimplementasikan hanya dalam batas file yang ditugaskan.
4. Menjalankan perintah verifikasi dan melaporkan hasil apa adanya.
5. Melaporkan ke mandor. **Tidak** commit ke branch utama, **tidak** push.

---

## 3. Format penugasan worker

```text
Child WP: WP-NT-Pn-mm-<a>
Parent: WP-NT-Pn-mm
Requirement: REQ-NT-nn
SDD: SDD-n
Batas file: <daftar file yang boleh disentuh>
Kontrak masuk: <DTO/tipe/endpoint yang sudah ada>
Kontrak keluar: <DTO/tipe/event/bentuk galat yang harus dihasilkan>
Perilaku baseline yang harus diverifikasi: <sumber + pertanyaan>
Perintah verifikasi: <perintah + hasil yang diharapkan>
Bukti yang harus dilaporkan: <perintah, exit code, hasil ringkas, bukti sanitasi>
Di luar batas: <apa yang tidak boleh disentuh>
```

Worker yang menemukan kebutuhannya melampaui batas file **berhenti dan melapor**, bukan memperluas sendiri.

---

## 4. Aturan paralel

- Paralel hanya untuk paket yang terdaftar pada gelombang paralel di `plan.md` bagian 4.
- Satu file, satu pemilik. Bila dua paket butuh file yang sama, keduanya diserialkan oleh mandor.
- Semua perubahan `prisma/schema.prisma` dan migrasi diserialkan oleh mandor. Tidak ada migrasi paralel.
- Integrasi dilakukan satu mandor. Worker tidak men-merge pekerjaan worker lain.

---

## 5. Gate kualitas

Sebuah child dinyatakan selesai hanya bila seluruh butir lulus:

1. Perilaku berjalan nyata (bukan stub, bukan mock produksi).
2. Test fokus lulus; test regresi terkait lulus.
3. `npm run typecheck` lulus.
4. `npm run lint` lulus.
5. `npm run build` lulus.
6. Tidak ada `TODO` kosong, kode mati, atau kontrol inert.
7. Tidak ada kredensial di diff.
8. Bukti disertakan dan disanitasi.

Setelah semua child sebuah parent lulus, mandor menjalankan gate fase (`plan.md`) sebelum membuka fase berikutnya.

---

## 6. Kebijakan Git dan push

Repo target: `https://github.com/fauzan171/tokengateway-kawan.git`.

### 6.1 Sebelum perubahan apa pun

1. Periksa apakah direktori kerja sudah merupakan repository Git (`git rev-parse --is-inside-work-tree`).
2. Bila **sudah**: periksa `git remote -v` dan `git status`. Jangan menimpa, `stash`, `reset`, `checkout`, atau `clean` pekerjaan pengguna yang belum di-commit. Bila ada perubahan yang tidak dikenal, **berhenti dan laporkan**.
3. Bila **belum** dan pengguna menginstruksikan inisialisasi saat eksekusi: pastikan path benar, `git init`, lalu tambahkan remote `origin` **hanya bila** `origin` belum ada.
4. Bila `origin` sudah ada tetapi menunjuk repo berbeda dari target: **berhenti, jangan timpa, minta konfirmasi pengguna.** Jangan menambahkan URL dengan kredensial tertanam.

### 6.2 Aturan commit dan push

- Satu **branch fitur per fase**, mis. `feat/nt-p0-fondasi`. Jangan bekerja langsung di `main`.
- Mandor melakukan commit **setiap child work package yang sudah verified**. Worker tidak commit ke branch bersama dan tidak push.
- Push dilakukan **setelah** gate paket/parent lulus, ke branch fitur: `git push -u origin feat/nt-p0-fondasi`.
- **Jangan** `push --force`. **Jangan** push ke `main`. **Jangan** merge ke `main` tanpa persetujuan eksplisit pengguna.
- Bila push gagal karena jaringan, autentikasi, atau izin: **commit tetap disimpan lokal**, laporkan sebagai **blocked**, dan **jangan mengklaim sudah ter-push**. Sertakan pesan galat apa adanya.

### 6.3 Larangan kebersihan repositori

- **Jangan** `git add .` secara membabi buta. Tambahkan file secara eksplisit atau tinjau `git status`/`git diff --staged` lebih dulu.
- **Selalu** periksa diff yang sudah di-stage sebelum commit. `.gitignore` **tidak** melindungi file yang sudah ter-track; file yang sudah pernah di-commit harus dihapus dari index secara sadar.
- **Jangan** commit: `.env*` (kecuali `.env.example` yang sudah disanitasi), `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `logs/`, database SQLite lokal (`*.db`, `*.db-wal`, `*.db-shm`), direktori uploads/storage, snapshot, backup, sertifikat, private key, kredensial cloud/service-account, token, dan data pribadi.
- Template contoh boleh ada tetapi **hanya berisi nilai palsu** yang jelas (mis. `sk-CONTOH-BUKAN-KUNCI`).
- **Jangan** menaruh kredensial di URL remote.

### 6.4 Isi `.gitignore` minimum

```gitignore
# Dependencies
node_modules/

# Build
.next/
dist/
build/
out/

# Test
coverage/

# Logs
logs/
*.log
npm-debug.log*

# Env
.env
.env.*
!.env.example

# Local database
*.db
*.db-journal
*.db-wal
*.db-shm

# Storage / uploads
storage/
uploads/
public/uploads/

# Snapshots & backups
snapshots/
backups/
*.dump
*.sql.gz

# Secrets & certs
*.pem
*.key
*.p12
*.pfx
certificates/
credentials/

# OS/editor
.DS_Store
.idea/
.vscode/*
!.vscode/extensions.json
```

### 6.5 Pemeriksaan sebelum commit

```bash
git status
git diff --staged
# tolak bila muncul pola seperti: BEGIN PRIVATE KEY, AKIA, sk-live, .env, *.db
```

Bila ragu, jangan commit; tanyakan mandor.

---

## 7. Menjalankan aplikasi (setelah bootstrap)

Perintah nyata bergantung pada apa yang benar-benar tertulis di `package.json` setelah `WP-NT-P0-01`. **Jangan mengarang perintah.** Baca `package.json` lebih dulu, lalu gunakan skrip yang ada. Target skrip yang harus disediakan bootstrap:

| Skrip | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run worker` | Menjalankan worker job |
| `npm run typecheck` | Pemeriksaan tipe |
| `npm run lint` | Lint |
| `npm test` | Test unit/integrasi |
| `npm run test:e2e` | Test end-to-end |

Bila nama skrip berbeda, **pakai nama yang ada** dan catat perbedaannya. Bila skrip belum ada, itu tanda bootstrap belum selesai — jangan menjalankan perintah yang tidak ada.

---

## 8. Format laporan mandor

```text
Fase: NT-Pn
Paket: WP-NT-Pn-mm (+ child)
Requirement: REQ-NT-nn
SDD: SDD-n
Status: verified | blocked | partial
File berubah: ...
Perintah: ... → exit code, hasil ringkas
Bukti: ... (sanitasi)
Perilaku baseline diverifikasi: sumber + temuan (bila ada)
Git: branch ..., commit <sha>, pushed | blocked (alasan)
Risiko / belum selesai: ...
Paket berikutnya yang dibuka: ...
```
