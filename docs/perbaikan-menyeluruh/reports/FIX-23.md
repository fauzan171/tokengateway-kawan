# FIX-23 — Kontrol data, lupakan, ekspor, dan retensi

Status: **verified_fixture**

## Masalah

`exportAll` yang ada hanya mengekspor **chat**: memori, artefak, prompt, tugas,
jadwal, dan notifikasi tidak ikut. Penghapusan data tidak punya peta dependensi,
jadi mudah meninggalkan artefak (byte di storage), token konektor aktif, atau
jadwal yang masih menyala setelah pengguna meminta datanya dihapus.

Tidak ada aturan retensi, dan tidak ada pernyataan privasi yang cocok dengan
alur data sebenarnya.

## Solusi

### `src/lib/data-control/data-control.ts`

**Peta dependensi** (`USER_DATA_MAP`) menyebut 13 tabel data pengguna, supaya
"hapus akun" tidak berhenti di `User`.

**Ekspor lengkap** (`exportUserData`) — chats, messages, folders, artifacts,
memories, prompts, tasks, schedules, notifications, settings; setiap query
memuat `userId`.

Dua lapis merahasiakan:

1. `EXPORT_SELECT` — allowlist kolom per model. Kolom yang ditambahkan skema
   nanti **tidak** otomatis ikut.
2. `redactRow` — membuang `tokenEncrypted`, `refreshEncrypted`,
   `apiKeyEncrypted`, `passwordHash`, `storageKey`, dan sejenisnya.

`projectAllowlist()` menjalankan keduanya berurutan. Byte artefak tidak ditanam
di JSON; hanya metadata + `sha256`, dengan `bytesIncluded: false` dan catatan di
manifest. Manifest memuat versi, `exportedAt`, jumlah per jenis, daftar yang
**tidak** ikut beserta alasannya, dan SHA-256 isi.

**Validasi impor** (`validateImportArchive`): versi harus dikenal, `data` harus
objek berisi array, dan arsip yang membawa kolom terlarang **ditolak** — itu
tanda arsip dimodifikasi.

**Tombstone dua tahap** (`tombstoneUserData`): tahap 1 menandai
`Artifact.deletedAt` + `expiresAt` (endpoint privat langsung 404), mencabut
konektor, mematikan jadwal, dan mengarsipkan chat; mengembalikan langkah
pembersihan. Byte storage dan penghapusan pihak ketiga adalah langkah terpisah
dan idempoten — kegagalan storage tidak membuat baris menunjuk berkas yang sudah
hilang. Tombstone kedua melaporkan 0, bukan mengulang pekerjaan.

**Ledger penghapusan** hanya menyimpan id opaque (`del_<24 hex>`), `userId`,
jenis, target, waktu, status — **bukan** isi yang dihapus. Menyimpan isinya
berarti data itu belum benar-benar hilang.

**Retensi** (`RETENTION`) dan **pernyataan privasi** (`PRIVACY_STATEMENT`) yang
cocok dengan alur data: server mendekripsi isi untuk memanggil model (bukan E2E),
backup operator bisa menyimpan lebih lama, kredensial tidak diekspor.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/data-control/data-control.ts` | **baru** — peta, ekspor, validasi impor, tombstone, ledger, retensi |
| `src/lib/data-control/data-control.test.ts` | **baru** — 16 tes |

Tidak ada perubahan skema → tidak ada migrasi. Tidak ada dependensi baru.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json            → 0 error
npx eslint src/lib/data-control              → 0 error, 0 warning
npx vitest run src/lib/data-control          → 16 passed
```

## Tes (16)

**Redaksi**: kolom terlarang hilang, kolom aman tetap.

**Ekspor**: hanya chat milik sendiri (judul "Punya orang lain" tidak muncul di
JSON); artefak diekspor sebagai metadata tanpa byte dengan hash SHA-256; manifest
memuat versi/jumlah/`credentials` di `omitted`/hash; **envelope token konektor
tidak muncul di ekspor**.

**Validasi impor**: arsip sah + jumlah benar; versi asing ditolak; `data` bukan
objek atau berisi non-array ditolak; **arsip dengan `tokenEncrypted` ditolak**.

**Tombstone**: artefak `deletedAt`+`expiresAt` lewat (404), konektor
`revokedAt`, jadwal `enabled=0`, langkah dilaporkan berurutan; **idempoten**
(kedua kali melaporkan 0 artefak); **data pengguna lain tidak tersentuh**.

**Ledger**: hanya 6 field, id cocok pola, isi tidak disimpan, id stabil.

**Peta/retensi**: memuat tabel utama; semua nilai > 0; retensi event > artefak.

## Batas yang sengaja dilewati

- **Penghapusan byte storage dan akun sebenarnya belum dieksekusi.** Modul ini
  menandai + melaporkan langkah; worker pembersihan (dengan retry) belum ada.
  Sengaja dipisah supaya kegagalan storage bisa diulang tanpa kehilangan baris.
- **Tidak ada route HTTP/UI.** `exportUserData`/`tombstoneUserData` belum
  diekspos; itu perlu keputusan produk tentang konfirmasi dan format unduhan.
- **Impor belum menulis apa pun.** Yang ada baru validasi; menulis arsip butuh
  pemetaan id baru dan batas transaksi yang belum dirancang.
- **Backup/restore tidak diuji.** Tidak ada salinan PostgreSQL di mesin ini;
  klaim "restore menerapkan deletion ledger" belum dapat dibuktikan.
- **Deteksi PII tidak ada.** Spesifikasi menyebut preview/redaksi sebelum kirim
  "bila diminta"; tidak ada detektor, jadi tidak ada klaim menangkap semua PII.
- **Retensi hanya konstanta.** Belum ada sweeper yang benar-benar memangkas
  event/idempotency/cache sesuai angka itu (FIX-24).
