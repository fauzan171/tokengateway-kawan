# FIX-15 — Kalkulator, statistik, chart, QR

Status: **verified**

## Masalah

Model bahasa menghitung dengan menebak. `0.1 + 0.2` dijawab `0.30000000000000004`
atau `0.3` tanpa dasar; statistik dilaporkan tanpa menyebut apakah pembaginya
`n` atau `n-1`; "jumlah kata" dipakai bergantian untuk empat ukuran berbeda
(unit UTF-16, code point, grapheme, byte). Grafik dan QR, kalau dibuat model,
adalah gambar yang tidak bisa diverifikasi.

## Solusi

### `src/lib/tools/compute.ts` — aritmetika desimal

`calculate({op, operands, precision?, rounding?})` menerima operand **string
desimal**, menghitung dengan `decimal.js`, mengembalikan **string**. Tidak ada
`eval`, `Function`, shell, atau SQL.

| Op | Aritas | Catatan |
|---|---|---|
| `add` `sub` `mul` `div` `mod` | 2 | `div`/`mod` oleh nol → `DIVISION_BY_ZERO` |
| `pow` | 2 | eksponen wajib bilangan bulat, `|e| ≤ 1000` |
| `sqrt` | 1 | negatif → `INVALID_OPERAND` |
| `abs` `round` | 1 | `round` wajib `precision` 0–20 + `rounding` |
| `compare` | 2 | `-1`/`0`/`1`, bukan boolean yang bisa disalahbaca |

Batas: 40 char/operand, 30 digit signifikan, eksponen ≤ 1000, 200 operasi.
Regex menerima **hanya** bentuk desimal/ilmiah — `1+1`, `0x10`, `1_000`,
`process.exit()` ditolak sebagai `INVALID_OPERAND`.

Pembulatan mengembalikan `rule` (`"round(2, half-up)"`) dan `rounded`, jadi
pembaca tahu aturannya, bukan menebak. `plain()` memakai `toFixed()` sehingga
`0.1+0.2` → `"0.3"`, bukan notasi eksponen.

### `describe()` — statistik yang mengaku metodenya

`{n, missing, kind, unit, mean, median, stdDev, min, max, method}`. `null`/`NaN`
dihitung sebagai **data hilang** dan dilaporkan di `missing` — tidak dibuang
diam-diam, tidak diimputasi. `kind: "sample"` → pembagi `n-1`, `"population"` →
`n`. Sampel `n=1` → `stdDev: null`, bukan `0` yang menyesatkan.

### `countText()` — empat angka yang berbeda

`words` (`Intl.Segmenter` word-like, locale eksplisit), `characters` (unit
UTF-16), `codePoints`, `graphemes` (yang dilihat pembaca), `bytes` (UTF-8), plus
`method`. Contoh nyata: `"Halo dunia 👨‍👩‍👧"` → 2 kata, 19 karakter, 16 code
point, 12 grapheme, 29 byte.

### `src/lib/tools/chart.ts` — SVG deklaratif

`renderChart({kind, points, title, unit, xLabel, yLabel})` → `{svg, table}`.
Bar dan line, satu seri. Setiap label di-escape (`& < > " '`), tidak ada
`<script>`, `on*`, atau `xlink:href`. `role="img"` + `aria-label` + `<title>`,
dan **tabel alternatif** dengan `<caption>`/`<th scope>` supaya pembaca layar
mendapat angka yang sama. Nilai non-finite ditolak, bukan dicetak `NaN` di SVG.

### `src/lib/tools/qr.ts` — QR yang dibuktikan terbaca

`makeQr(payload)` membuat matriks dengan `qrcode`, merasterisasi sendiri
(skala 4, quiet zone 4 modul), lalu **membacanya kembali dengan `jsqr`** —
decoder independen. Hasil decode ≠ payload → `DECODE_MISMATCH`, gambar tidak
dikeluarkan. SVG memakai satu `<path>`, tanpa script.

Barcode 1D: `makeBarcode()` melempar `UNSUPPORTED_SYMBOLOGY`. Tidak ada
encoder/decoder terpasang, dan menulis tabel pola Code128 dari ingatan berarti
mengarang gambar yang tidak bisa diverifikasi.

### `POST /api/kawan/v1/tools/compute`

`{action: "calculate"|"stats"|"count", ...}`. `CalcError` dipetakan ke 400 dengan
kode aslinya. Wajib sesi (`requireContext`), tanpa `userId` dari klien.

## Tes (36 baru)

`src/lib/tools/compute.test.ts` + fixture `src/lib/tools/fixtures/compute.jsonl`
(16 baris input→expected):

- **Fixture JSONL**: `0.1+0.2 → 0.3`, `19.99×3 → 59.97`, `10÷4 → 2.5`,
  `0.3÷0.1 → 3`, `10 mod 3 → 1`, `2^10 → 1024`, `√2`, `compare`, tiga kasus
  pembulatan. Expected dihitung dengan aritmetika desimal Python presisi 20–40
  digit, **bukan** oleh kode yang diuji.
- **Bukti masalahnya**: `expect(0.1 + 0.2).not.toBe(0.3)`.
- **Penolakan**: bagi/modulo nol, ekspresi (`1+1`, `process.exit()`, `0x10`,
  `1_000`), operand non-string, arity salah, op asing, `round` tanpa precision /
  precision 99 / mode `"nearest"`, `√(-4)`, pangkat pecahan.
- **Pembulatan**: `half-even` 2.5→2 dan 3.5→4; `half-up` 2.5→3; `floor` −2.5→−3;
  `rule` dan `rounded` diperiksa.
- **Statistik**: n/missing/unit/metode; `null`+`NaN` → `missing: 2`; populasi
  pembagi `n`; median genap; sampel `n=1` → `stdDev: null`; kind asing ditolak.
- **Hitung teks**: lima angka diperiksa persis; non-string ditolak.
- **Grafik**: SVG memuat data, tanpa `<script`, tanpa `on*`, `role="img"`; tabel
  punya caption + `th scope`; label `<img onerror>` ter-escape; data kosong/NaN/
  jenis asing ditolak.
- **QR**: decode ulang cocok; unicode + payload panjang tetap terbaca; kosong dan
  >1200 char ditolak; `makeBarcode` → `UNSUPPORTED_SYMBOLOGY`.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → 1012 passed (94 file)   [976 baseline + 36]
```

Tidak ada perubahan skema → tidak ada migrasi.

## Dependensi ditambah

`decimal.js@10`, `qrcode@1`, `jsqr@1`, `@types/qrcode` (dev). Ketiganya diminta
langsung oleh spesifikasi FIX-15 ("decimal.js untuk aritmetika presisi",
"QR/barcode dibuat library standar … lalu decode ulang untuk verifikasi").

## Batas yang disengaja

- **Barcode 1D belum ada.** Dijawab `UNSUPPORTED_SYMBOLOGY`; menambah
  `bwip-js`/`jsbarcode` adalah pekerjaan tersendiri dengan verifikasi decode
  sendiri.
- **Grafik: hanya bar dan line, satu seri.** Pie/scatter/stacked tidak diminta
  gate; tabel alternatif sudah menutup aksesibilitas.
- **Render PNG/PDF grafik belum ada.** Butuh runner (FIX-17) — SVG adalah
  keluaran akhir untuk sekarang.
- **Tool ini belum didaftarkan ke `CHAT_TOOLS`.** Model belum bisa memanggilnya
  otomatis; kontrak HTTP-nya sudah ada dan teruji. Pendaftaran ke daftar tool
  model mengubah perilaku generasi dan layak jadi perubahan terpisah.
- **`countText` memakai locale default `id`.** Tidak ada deteksi bahasa otomatis.
