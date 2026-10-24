# FIX-13 — Memori bertingkat: butir eksplisit, lineage, pencabutan berantai

Status: **verified**

## Masalah

Tidak ada tempat menyimpan apa pun tentang pengguna. Setiap sesi mulai dari nol,
dan "ingat bahwa saya suka X" hanya bertahan selama jendela konteks chat itu.
Menambahkan tabel `memory` begitu saja akan salah pada tiga hal yang wajib
dibedakan:

1. **Kesepakatan.** Butir yang dikarang model tidak sama dengan butir yang
   diminta pengguna. Menyimpannya otomatis berarti menyimpan kesalahan tanpa
   persetujuan.
2. **Koreksi.** Menimpa teks lama menghapus bukti apa yang pernah dipercaya
   sistem dan dari mana asalnya.
3. **Lupa.** Mencabut satu fakta harus ikut menggugurkan ringkasan yang dibangun
   dari fakta itu — kalau tidak, "lupakan X" hanya kosmetik.

## Solusi

### Skema (`prisma/schema.prisma`)

`MemoryItem`:

| Kolom | Guna |
|---|---|
| `scope` (`global`\|`chat`) + `chatId` | butir lintas chat vs terikat satu percakapan |
| `category` (`preference`\|`fact`\|`instruction`) | jenis butir, dipakai saat menyusun konteks |
| `status` (`active`\|`proposed`\|`revoked`\|`superseded`) | satu-satunya penentu apakah butir dipakai |
| `consent` (`explicit`\|`proposed`) | butir diminta pengguna vs usulan inferensi |
| `version` + `parentId` | koreksi = baris baru; baris lama tidak dihapus |
| `sourceKind`/`sourceRef`/`sourceRevision` | provenance; revisi sumber berubah → butir tidak lagi terbukti |
| `expiresAt`, `revokedAt` | kedaluwarsa dan waktu pencabutan |

`MemoryDependency` (`memoryId` → `targetId`, unik per pasangan) mencatat bahwa
sebuah butir adalah turunan butir lain. Inilah yang membuat pencabutan berantai.

Migrasi ditulis untuk **kedua** provider: `prisma/migrations/sqlite/20261028000000_memory_item/`
dan `prisma/migrations/postgresql/20261028000000_memory_item/`. SQL dijaga pada
subset portabel (tanpa tipe khusus provider), sesuai aturan repo.

### Store (`src/lib/memory/store.ts`)

- `createMemory` — teks dipangkas; kosong / >500 char / kategori asing **ditolak**,
  bukan dipotong. `scope: "chat"` wajib `chatId` milik pengguna yang sama; chat
  orang lain → **404**, bukan 403 (keberadaan chat bukan informasi publik).
  Batas 200 butir aktif. `consent: "proposed"` menyimpan sebagai `proposed`,
  tidak pernah `active`.
- `listMemories` — query selalu ber-`userId`; tidak ada jalur membaca memori
  pengguna lain. Pencarian kata kunci pada teks/kategori (`contains`), bukan
  vector.
- `correctMemory` — transaksi: baris lama → `superseded`, baris baru `version+1`
  dengan `parentId`; provenance ikut tersalin. Butir `revoked` tidak bisa dikoreksi.
- `revokeMemory` — `revoked` + `revokedAt`, lalu BFS atas `MemoryDependency`
  sampai tidak ada turunan tersisa. Pencabutan kedua mengembalikan `[]`.
- `confirmProposal` — `proposed` → `active` + `consent: explicit`; butir yang
  bukan usulan ditolak.
- `buildMemoryContext` — hanya `status: "active"` dan belum kedaluwarsa;
  `ephemeral` mengembalikan `null` tanpa query. Anggaran 4.000 karakter, butir
  berikutnya dilewati begitu anggaran habis. Prompt menyatakan daftar ini
  **data**, bukan instruksi baru.

### API

| Route | Metode | Perilaku |
|---|---|---|
| `/api/kawan/v1/memory` | `GET` | daftar/cari (`q`, `chatId`, `status`) |
| `/api/kawan/v1/memory` | `POST` | simpan butir eksplisit → `201` |
| `/api/kawan/v1/memory/{id}` | `PATCH` | koreksi → versi baru |
| `/api/kawan/v1/memory/{id}` | `POST` | konfirmasi usulan |
| `/api/kawan/v1/memory/{id}` | `DELETE` | cabut + turunan (`revoked[]`) |

`userId` tidak pernah diterima dari body/query — selalu dari `requireContext()`.

### Wiring generasi (`src/lib/chat/generate.ts`)

`buildMemoryContext` dipanggil setelah system prompt pencarian, disuntik sebagai
system message sebelum konteks RAG. Gagal membaca memori → `null`; generasi tidak
digagalkan oleh subsistem memori.

## Tes (24 baru)

`src/lib/memory/store.test.ts`:

- **Kesepakatan**: butir eksplisit langsung `active`; usulan tidak muncul di daftar
  aktif sampai `confirmProposal`; konfirmasi butir non-usulan ditolak.
- **Validasi**: teks kosong / bukan string / >500 char / kategori asing / scope
  chat tanpa `chatId` — semuanya ditolak dengan kode masing-masing.
- **Isolasi**: memori & pencarian pengguna lain tidak terbaca; koreksi/pencabutan
  milik orang lain → 404 dan butir korban tetap `active`; chat orang lain tidak
  bisa dipakai sebagai scope.
- **Lineage**: koreksi → `version 2`, `parentId` terisi, provenance tersalin,
  baris lama `superseded` dan teksnya utuh.
- **Pencabutan**: butir hilang dari konteks run berikutnya; rantai
  fact → summary → summary ikut gugur (3 id); pencabutan kedua `{ revoked: [] }`.
- **Konteks**: `ephemeral` tidak membaca apa pun; `proposed`/`revoked`/`superseded`
  tidak masuk; butir kedaluwarsa diabaikan; anggaran karakter dipatuhi.

## Verifikasi

```
npm run db:generate                 → Prisma Client 7.10.0 (dua provider)
node scripts/check-migrations.mjs   → OK (2 provider, init dibekukan, urutan sama)
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → lihat commit FIX-13
```

## Batas yang disengaja

- **Tidak ada penyimpanan otomatis.** Model tidak menulis memori sendiri; hanya
  jalur eksplisit (`POST`) atau usulan yang harus dikonfirmasi. Ekstraksi otomatis
  dari percakapan = fitur lain, bukan tiket ini.
- **Pencarian memori = `contains`, bukan vector.** Belum ada evaluasi recall yang
  membuktikan embedding perlu; menambahkannya sekarang berarti menambah
  dependensi dan biaya tanpa bukti.
- **UI panel memori belum ada.** Kontrak API + store + konteks siap dipakai; UI
  adalah pekerjaan terpisah.
- **Permintaan yang sudah terkirim ke provider tidak bisa ditarik.** Pencabutan
  berlaku untuk run berikutnya; itu yang dijanjikan, bukan retraksi retroaktif.
- **`MemoryDependency` hanya diisi lewat `linkDependency`.** Belum ada pembuat
  ringkasan otomatis, jadi tabel ini kosong sampai fitur ringkasan ada.
