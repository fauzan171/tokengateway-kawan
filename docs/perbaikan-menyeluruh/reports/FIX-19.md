# FIX-19 — Tool aplikasi dan UI interaktif

Status: **verified_fixture**

## Masalah

Model tidak dapat menyentuh resource aplikasi sama sekali: "ubah judul chat ini"
hanya bisa dijawab dengan instruksi manual. Kalau jalur itu dibuka dengan cara
yang salah, tiga hal langsung rusak:

1. tool memanggil HTTP localhost dengan cookie — jalur otorisasi yang tidak
   diperiksa pemilik;
2. `userId` datang dari argumen model;
3. aksi destruktif (hapus, bagikan publik) berjalan diam-diam karena terlihat
   seperti "sekadar tool".

Selain itu riset dokumen menemukan **tiga cacat nyata** pada artefak yang harus
ditutup sebelum fitur dokumen ditambah (lihat bagian Regresi).

## Solusi

### `src/lib/tools/app.ts` — tool aplikasi lewat service

Delapan tool dengan daftar tertutup (`APP_TOOLS`) dan
`additionalProperties: false`:

| Tool | Efek | Catatan |
|---|---|---|
| `app.list_chats` | baca | maks 20 baris, field terbatas |
| `app.list_folders` | baca | hanya folder milik pemanggil |
| `app.rename_chat` | tulis | opsional `expectedRevision` (tolak stale) |
| `app.pin_chat` / `app.archive_chat` | tulis | boolean wajib |
| `app.move_chat` | tulis | folder wajib milik pemanggil |
| `app.delete_chat` | destruktif | **hanya** `needs_approval` |
| `app.share_chat` | publik | **hanya** `needs_approval` |

Yang ditegakkan:

- **Memanggil service, bukan HTTP.** `updateChat`, `listFolders` dipanggil
  langsung dengan `db` dari konteks — tidak ada request internal yang membawa
  cookie.
- **`userId` selalu dari konteks**, tidak pernah dari argumen. Setiap query
  memuat `userId: context.userId`.
- **Hasil seragam** `{schemaVersion, status, data|message, summary}` dengan
  `status` membedakan `ok`/`not_found`/`invalid`/`conflict`/`needs_approval`.
  Chat milik orang lain → `not_found`, bukan `forbidden`: tidak membocorkan
  keberadaannya.
- **Revisi kadaluarsa** ditolak `conflict` — form tua tidak menimpa judul baru.
- **Aksi destruktif tidak dieksekusi.** `delete_chat`/`share_chat` mengembalikan
  `needs_approval` dengan target, dan **tidak ada baris DB yang berubah** —
  dibuktikan tes.
- **Flag 0/1 → boolean.** Skema menyimpan `pinned`/`archived` sebagai Int
  (portabel SQLite+PostgreSQL); model menerima boolean, bukan dua bahasa untuk
  satu nilai.

`appToolPromptLine()` memberi tahu model bahwa dua tool terakhir hanya
*mengajukan* persetujuan, supaya ia tidak mengaku sudah menghapus/membagikan.

## Regresi: tiga cacat dokumen yang ditemukan riset

Semuanya dibuktikan dengan menjalankan kode nyata, bukan membaca kode.

| # | Cacat | Akibat sebelum perbaikan | Perbaikan |
|---|---|---|---|
| T2 | `readZip` menolak entri direktori (nama berakhiran `/`) | DOCX/XLSX/PPTX hasil render Kawan sendiri tidak bisa dibaca balik; unggahan balik ditolak | entri direktori diterima; validasi `..`/`.`/kosong/kedalaman **tetap** dijalankan pada nama tanpa garis miring akhir |
| T1 | nama sheet XLSX = `title.slice(0,31)` | judul wajar "Laporan/2026: Q1" menggagalkan seluruh render (ExcelJS menolak `* ? : \ / [ ]`) | `safeSheetName()`: karakter terlarang → `-`, batas 31, fallback `Sheet1` |
| T3 | `convertArtifact` tidak memeriksa format **sumber** | sumber PDF "dikonversi" jadi `.md` berisi byte PDF — berkas terbuka, isinya sampah | sumber wajib salah satu format teks; selain itu `CONVERSION_UNSUPPORTED` |

Perbaikan T2 punya jebakan yang ditemukan tes sendiri: mengizinkan entri
direktori **sebelum** memeriksa komponen membuat `"../"` lolos. Tes regresi
memaksa urutan yang benar.

## Perubahan

| Berkas | Perubahan |
|---|---|
| `src/lib/tools/app.ts` | **baru** — 8 tool aplikasi, approval, isolasi owner |
| `src/lib/tools/app.test.ts` | **baru** — 15 tes |
| `src/lib/artifacts/zip.ts` | entri direktori diterima setelah validasi traversal |
| `src/lib/artifacts/render-binary.ts` | `safeSheetName()` |
| `src/lib/artifacts/convert.ts` | tolak sumber non-teks |
| `src/lib/artifacts/regression-docs.test.ts` | **baru** — 9 tes regresi |

Tidak ada perubahan skema → tidak ada migrasi. Tidak ada dependensi baru.

## Tes (24 baru)

**Tool aplikasi (15):** tiap tool punya deskripsi dan `additionalProperties:
false`; hanya hapus/bagikan butuh approval; `list_chats` hanya mengembalikan
chat sendiri dan membatasi limit (10.000 → ≤20); argumen non-objek ditolak;
rename mengubah chat yang tepat dan `titleSource=manual`; **rename chat orang
lain → `not_found` dan judul tidak berubah**; revisi kadaluarsa → `conflict`
dengan judul tetap; judul kosong/300 karakter ditolak; pin/archive mengubah
field yang benar; nilai non-boolean ditolak; pindah ke folder sendiri berhasil,
**folder orang lain ditolak dan tidak mengubah apa pun**; `delete_chat` dan
`share_chat` → `needs_approval` dengan **chat masih ada dan 0 share link**;
tanpa chatId dan tanpa chat aktif → `invalid`; `list_folders` hanya folder
sendiri.

**Regresi dokumen (9):** entri direktori diterima; `../`, `/etc/`, `a//`
tetap ditolak; arsip sah tetap terbaca; sanitasi nama sheet (`Laporan/2026: Q1`
→ `Laporan-2026- Q1`), batas 31, fallback `Sheet1`; XLSX dengan judul
bermasalah tetap ter-render dan terdeteksi `xlsx`; DOCX terdeteksi `docx` saat
dibaca balik; sumber `pdf` → `CONVERSION_UNSUPPORTED`; konversi teks tetap
bekerja.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npx eslint <berkas berubah>         → 0 error, 0 warning
npx vitest run src/lib/artifacts src/lib/documents src/lib/tools src/lib/chat/file-tool.test.ts
                                    → 199 passed (18 file)
```

## Batas yang sengaja dilewati

- **UI kartu form belum ada.** `app.*` belum disambungkan ke `CHAT_TOOLS` atau
  loop tool di `generate.ts`; itu bagian P1 registry (lihat
  `reports/rencana-masa-depan.md`). Tanpa registry, menambah tool ke array
  `CHAT_TOOLS` berarti menambah dua tempat yang bisa menyimpang.
- **Approval belum nyata.** `needs_approval` hanya *menyatakan* kebutuhan;
  `TaskInteraction` yang benar-benar menghentikan aksi adalah FIX-20. Karena itu
  `delete_chat`/`share_chat` tidak melakukan apa pun — lebih baik tidak
  berfungsi daripada berfungsi tanpa izin.
- **PlantUML/editor interaktif, undo, dan ekspor tidak termasuk.** Spesifikasi
  menyebut "dapat undo"; undo nyata butuh riwayat revisi yang belum ada.
- **T4/T5/T6/T7 dari riset dokumen belum ditutup** (PPTX meluber, batas tabel,
  MediaBox PDF, `SearchError.retryable` ditelan): masuk jalur D1/D2/D6 di
  rencana, bukan FIX-19.
