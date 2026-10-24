# FIX-10 — Sumber web: pembacaan nyata, provenance, dan verifikasi DOI

Status: **verified**

## Masalah

Sebelum ini satu-satunya jalur ke dunia luar adalah `webSearch` (SearXNG): model hanya
menerima **judul + URL + snippet** dari mesin pencari. Akibatnya:

- sitasi menunjuk halaman yang bisa jadi sudah mati/paywall, tanpa cara membuktikannya;
- isi nyata halaman tidak pernah masuk konteks — jawaban bersandar pada ringkasan pihak ketiga;
- tidak ada waktu pengambilan, jadi fakta yang berubah (berita, harga, angka) muncul tanpa umur;
- DOI pada klaim bibliografi bisa dikarang dan tidak ada yang memeriksanya.

## Solusi

### 1. `src/lib/sources/record.ts` — bentuk catatan sumber

`SourceRecord` memisahkan empat hal yang sering keliru disatukan:

| Keadaan | Arti |
|---|---|
| `reach` | URL merespons: `reachable` / `dead` / `blocked` / `unchecked` |
| `metadata` | DOI/judul/tahun cocok dengan Crossref: `verified` / `mismatch` / `unreachable` / `unknown` |
| kutipan | ada-tidaknya teks kutipan di isi halaman (`locateQuote`) |
| dukungan klaim | apakah kutipan mendukung klaim — **tidak** diputuskan di modul ini |

`sourceVerdict` hanya menyebut "verified" bila `reachable` **dan** `metadata: verified`;
`dead` selalu menang. `canonicalUrl` membuang fragment + parameter pelacak (`utm_*`, `fbclid`,
`gclid`, `ref`), menormalkan host, menstabilkan urutan query → hash isi bisa dibandingkan antar
pengambilan. `sha256Hex` untuk hash isi.

### 2. `src/lib/sources/read.ts` — `web.read`

Membaca satu URL lewat kebijakan egress FIX-07 (`assertOutboundAllowed` + `fetchOutbound`),
tanpa cookie, tanpa referer, tanpa menjalankan script.

| Keadaan | Perilaku |
|---|---|
| 401/402/403 | `ReadError("BLOCKED")` — bukan halaman kosong |
| paywall/login terdeteksi | `ReadError("PAYWALL")` |
| tipe bukan HTML/PDF/teks | `ReadError("UNSUPPORTED_TYPE")` |
| > 2 MiB | `ReadError("TOO_LARGE")` |
| jaringan gagal / bukan 2xx | `ReadError("UNREACHABLE")` |
| PDF tanpa lapisan teks | `ReadError("NO_TEXT")` |
| teks kosong setelah ekstraksi | `ReadError("NO_TEXT")` |

Hasil sukses: judul (`og:title` → `<title>`), teks bersih (script/style/comment dibuang), URL
**final** setelah redirect, `fetchedAt` ISO-8601, `contentHash` sha256 **byte mentah** yang benar-benar
dibaca. Teks dipotong 200k char, bukan digagalkan.

`enrichSources` membaca maksimum 2 URL teratas per jawaban (`ENRICH_LIMIT`), sisanya `unchecked`
tanpa permintaan jaringan. Satu URL gagal → ditandai `dead`/`blocked` dengan `reason`, **tidak**
menggagalkan URL lain maupun generasi.

### 3. `src/lib/sources/crossref.ts` — verifikasi DOI

`canonicalDoi` menormalkan `https://doi.org/10.x/y` dan `doi: 10.x/y` → `10.x/y` huruf kecil,
menolak yang tidak berpola registrant DOI. `verifyDoi` mengambil metadata Crossref lalu mencocokkan
judul (≥60% kata bermakna muncul) dan tahun (toleransi ±1):

| Hasil | Kondisi |
|---|---|
| `verified` | judul cocok, tahun cocok/absen |
| `mismatch` / `DOI_NOT_FOUND` | Crossref 404 — **DOI fiktif**, kasus yang wajib ditandai |
| `mismatch` / `TITLE_MISMATCH` | DOI hidup tapi menunjuk karya lain |
| `mismatch` / `YEAR_MISMATCH` | tahun klaim meleset > 1 |
| `unreachable` | Crossref tidak menjawab / JSON rusak |
| `unknown` | DOI tidak kanonik atau metadata kosong — tidak pernah dilebihkan jadi "verified" |

### 4. Wiring

- `SearchResult` (`src/lib/search/web.ts`) kini wajib membawa `fetchedAt` ISO-8601.
- `buildSearchSystem` (`src/lib/search/prompt.ts`) menerima `PromptSource` — hasil pencarian polos
  **dan** `EnrichedSource` memenuhinya secara struktural — dan menyertakan **teks halaman nyata**
  (maks 2.000 char/sumber), `diambil <fetchedAt>`, `hash <12 char>`, serta penanda tegas
  `TAUTAN MATI — jangan dikutip` / `TERBLOKIR/PAYWALL — jangan dikutip` / `belum dibaca`.
- `generate.ts`: setelah `webSearch`, panggil `enrichSources` (limit 2); `searchSystem` memakai
  `enriched` bila ada, jika tidak jatuh ke `sources` polos. `sourceParts` membawa `fetchedAt`,
  `reach`, `contentHash`, dan `reason` sehingga UI bisa menampilkan status nyata tiap sitasi.

## Tes (26 baru)

`src/lib/sources/sources.test.ts` (23):
- `canonicalUrl`: buang fragment/pelacak, tolak `file://`; `locateQuote`: paragraf + rentang, null
  bila kutipan hilang; `sourceVerdict` 4 kombinasi; `sha256Hex` stabil vs berbeda.
- `readSource`: positif (judul, teks tanpa script/style, hash 64 char, `fetchedAt`); 403 → `BLOCKED`;
  paywall → `PAYWALL`; `application/zip` → `UNSUPPORTED_TYPE`; jaringan gagal → `UNREACHABLE`;
  halaman tanpa teks → `NO_TEXT`.
- `enrichSources`: hanya 2 URL teratas di-request (`fetch` dipanggil 2× untuk 4 hasil), sisanya
  `unchecked` tanpa request; `dead` vs `blocked` vs `unchecked`; hash + `fetchedAt` diambil dari
  hasil baca; kegagalan satu URL tidak menular; `limit` tidak melebihi jumlah hasil.
- `verifyDoi`: kanonikalisasi; cocok → `verified`; 404 → `mismatch/DOI_NOT_FOUND`; karya lain →
  `TITLE_MISMATCH`; tahun meleset → `YEAR_MISMATCH`; Crossref mati → `unreachable`; tanpa DOI →
  `unknown` dan **tidak ada** panggilan jaringan.

`src/lib/search/prompt.test.ts` (+3): teks nyata + `diambil` + `hash` masuk prompt; sumber
mati/terblokir ditandai terang; teks dipotong 2.000 char dan jatuh ke snippet bila `text: null`.

`src/lib/search/web.test.ts` disesuaikan agar `fetchedAt` ikut diverifikasi.

## Verifikasi

```
npx tsc --noEmit -p tsconfig.json   → 0 error
npm run lint                        → 0 error, 0 warning
npm test                            → 926 passed (91 file)   [baseline 900 + 26]
```

Tidak ada perubahan skema → tidak ada migrasi.

## Batas yang disengaja

- **Hanya 2 URL dibaca per jawaban.** Menambahnya berarti menambah latensi tanpa batas atas;
  angka ini satu konstanta (`ENRICH_LIMIT`) bila produk ingin menaikkannya.
- **Ekstraksi HTML berbasis regex, bukan parser DOM penuh.** Sadar: atribut aneh bisa lolos ke
  teks. Cukup untuk memasukkan isi halaman ke konteks; ganti ke parser sungguhan bila ada kasus
  nyata yang salah ekstrak.
- **Paywall dideteksi lewat frasa**, bukan status HTTP. Deteksi meleset → halaman tetap ditandai
  `reachable`; `reason` tidak dikarang.
- **`verifyDoi` mencocokkan judul + tahun saja**, bukan penulis. Penulis Crossref sering tidak
  konsisten formatnya; klaim penulis palsu belum tertangkap.
- **`readSource`/`verifyDoi` belum dipanggil dari route atau tool model mana pun** — keduanya
  dipakai oleh `enrichSources` di jalur generasi. Mengekspos `web.read` sebagai tool model adalah
  keputusan produk (menambah tool = mengubah kontrak tool), bukan bagian tiket ini.