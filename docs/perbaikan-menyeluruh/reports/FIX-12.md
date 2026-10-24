# FIX-12 — Artefak: lineage versi, konverter format, hardening ZIP

Status: **verified**

## 1. Versioning & lineage

| Berkas | Perubahan |
|---|---|
| `prisma/schema.prisma` | `Artifact.version Int @default(1)`; `parentArtifactId` (sudah ada) kini dipakai sebagai rantai versi |
| `prisma/migrations/{sqlite,postgresql}/20261027000000_artifact_version/` | `ALTER TABLE "Artifact" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1` — additive, init existing tetap |
| `src/lib/artifacts/create.ts` | `createArtifact` memvalidasi parent: wajib `userId` sama, `deletedAt: null`, `status: "ready"`; gagal → 404 (bukan bocor keberadaan). `version = parent.version + 1`. `version` ikut di `PublicArtifact`/`toPublic` |

Riwayat immutable: regenerasi/konversi selalu **membuat baris baru** yang menunjuk parent;
byte artefak sumber tidak pernah ditimpa.

## 2. Konverter format (`src/lib/artifacts/convert.ts`)

`convertArtifact(source, target)` — tipe kembalian `ConvertedContent = {format, content}`, ketat.

| Dari → ke | Perilaku |
|---|---|
| md → txt | buang penanda sintaks (`#`, `**`, backtick, link), isi dipertahankan |
| txt → md | normalisasi baris, tanpa markup tambahan |
| txt/md → html | seluruh isi di-escape (`& < > " '`), hanya paragraf + `<br>` |
| html → txt/md | buang `<script>`/`<style>`, decode entitas, blok jadi baris baru |
| csv → md | RFC 4180: quote ganda di-escape, newline dalam sel dipertahankan |
| json → json | `JSON.stringify(…, 2)`; nilai tak terserialisasi → `UNSERIALIZABLE_JSON` |
| target biner (`pdf`/`docx`/`xlsx`/`pptx`/`zip`) | ditolak eksplisit `CONVERSION_UNSUPPORTED` |

Error selalu `ArtifactError` dengan `code` stabil; route memetakannya ke 400, bukan 500.

Wiring: `POST /api/kawan/v1/artifacts` menerima `{ convertFrom, format }` → baca sumber via
`openArtifactBytes`, konversi, buat artefak baru dengan `parentArtifactId = sumber`.
`SyntaxError` dari JSON korup dipetakan ke `SOURCE_UNREADABLE`.

## 3. Hardening ZIP (`src/lib/artifacts/zip.ts`)

Penulis memakai `zipBytes` yang sudah ada (tidak ada penulis ZIP kedua); yang baru adalah
validasi dan pembaca berbatas.

| Ancaman | Pertahanan | Kode galat |
|---|---|---|
| Zip Slip / traversal | `assertSafeEntryName`: tolak `..`, `.`, segmen kosong, path absolut, drive `C:`, backslash, karakter kontrol, nama > 200 char, kedalaman > 8 | `ZIP_UNSAFE_PATH` / `ZIP_TOO_DEEP` |
| Zip bomb (ukuran) | `maxUncompressedBytes` 50 MiB total + `inflateRawSync({ maxOutputLength })` menahan alokasi | `ZIP_TOO_LARGE` |
| Zip bomb (rasio) | `maxRatio` 100, hanya untuk entri > 1 MiB (teks kecil wajar berasio tinggi) | `ZIP_BOMB_RATIO` |
| Symlink poisoning | bit mode Unix `0o120000` di 16 bit atas atribut eksternal | `ZIP_SYMLINK` |
| Entri ganda / jumlah entri | Set nama + `maxEntries` 256 | `ZIP_DUPLICATE_ENTRY` / `ZIP_TOO_MANY_ENTRIES` |
| Arsip terenkripsi, zip64, metode asing | flag bit 0, sentinel `0xffffffff`, hanya STORE/DEFLATE | `ZIP_ENCRYPTED` / `ZIP_UNSUPPORTED` / `ZIP_UNSUPPORTED_METHOD` |
| Struktur rusak | validasi signature local + central, panjang buffer | `ZIP_CORRUPT` |

Wiring: `render.ts` varian `{format:"zip", files}` → `writeZip`; route `POST` menerima
`files: [{name, content}]` dengan validasi tipe per entri.

## 4. Tes baru (18)

`src/lib/artifacts/convert-zip.test.ts` (15):
- konverter: md→txt, txt→html escape, csv→md quote/newline, json tetap json, target biner ditolak (4 format), html→txt/md
- ZIP positif: `writeZip` → `readZip` round-trip 2 entri
- ZIP negatif: `../../evil.sh` (tulis **dan** baca), `/etc/passwd`, `C:\Windows\evil`, `a//b`,
  > 50 MiB abort, batas longgar per pemanggil, rasio bom 4 MiB ditolak, symlink, `maxEntries: 0`,
  duplikat, buffer bukan zip → `ZIP_CORRUPT`

`src/lib/artifacts/artifacts.test.ts` (+3, lineage):
- v1 tanpa parent → v2 `parentArtifactId=v1.id` `version=2` → v3 `version=3`; byte v1 **tetap** `# v1`
- parent milik user lain → 404, daftar artefak tetap kosong
- parent yang sudah dihapus → 404

## 5. Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → 900 passed (90 file)   [baseline 882 + 18]
npx prisma migrate deploy           → ok
node scripts/check-migrations.mjs   → OK (sqlite + postgresql)
```

## 6. Batas yang disengaja

- **PDF/DOCX/XLSX/PPTX tidak dikonversi balik** ke teks: rekonstruksi best-effort butuh
  LibreOffice headless. `convertArtifact` menolaknya eksplisit, bukan mengembalikan byte mentah.
- **Paket ZIP produksi memakai STORE** (via `zipBytes`); pembaca menerima STORE + DEFLATE.
  Fixture serangan memakai DEFLATE agar batas rasio benar-benar teruji. Kalau paket produksi
  perlu dikompres, itu perubahan di `zipBytes` — di luar scope tiket ini.
- **Path tool model** (`file-tool.ts` `SUPPORTED_FORMATS`) belum memuat `zip`; ZIP hanya lewat
  route API. Menambahkannya berarti mengubah kontrak tool — keputusan produk, bukan bug.
