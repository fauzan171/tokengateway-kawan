# Feature Request: Output File Generation (DOC / PDF / MD / dll)

> Status: 🔴 DRAFT — BELUM DIIMPLEMENTASI (sebagai kapabilitas asisten)
> Jenis: Kapabilitas Produk Baru
> Prioritas: Sedang–Tinggi
> Pengaju: [nama kamu]
> Tanggal: [tanggal]
> Versi dokumen: 1.0

---

## 0. Batasan Saat Ini (GAP UTAMA) 🔴

> Bagian ini ditekan supaya jelas: sampai hari ini fitur ini belum ada sama sekali.

### Koreksi status (per 2026-10-21, verifikasi kode)

Bagian ini **tidak lagi 0%**. Kawan 0.2.0 sudah punya **Render Layer** yang
berjalan: `src/lib/chat/document-export.ts` (11,6 KB, tanpa dependency baru)
meng-generate `.pdf` (penulis PDF sendiri: content stream + xref), `.docx`
(OOXML), `.xlsx` (SpreadsheetML), `.md`, `.json`, `.csv`, plus `zipBytes()`
untuk multi-berkas. Sudah diekspor lewat `GET /api/kawan/v1/chats/{chatId}/transfer?format=pdf|docx|xlsx|md`
dan dipakai tombol Ekspor di sidebar. 8 tes lolos (`document-export.test.ts`).

Yang **benar-benar belum ada** adalah sisi *delegasi ke asisten* + lifecycle
berkas: tool `generate_file`, kartu unduhan, object storage, kuota, retensi,
sanitasi, endpoint `/artifacts`. Itu inti gap-nya, bukan rendering.

| No | Kesenjangan | Kondisi Sekarang | Yang Seharusnya | Status | Prioritas |
|----|-------------|------------------|-----------------|--------|-----------|
| G-01 | **Asisten tidak bisa memutuskan membuat berkas** | Pengguna harus klik tombol Ekspor sendiri; model hanya membalas teks | Model bisa memicu pembuatan berkas dari dalam percakapan | 🔴 Belum ada | Tinggi |
| G-02 | Tidak ada lampiran / attachment | Tidak ada kartu unduhan di dalam aliran pesan | Muncul kartu berkas (nama, tipe, ukuran, tombol unduh) | 🔴 Belum ada | Tinggi |
| G-03 | ~~Tidak ada ekspor ke PDF/DOCX~~ | **Sudah ada**: `GET ?format=pdf\|docx\|xlsx\|md` + tombol sidebar | — | ✅ **Ada (0.2.0)** | — |
| G-04 | Format output terbatas untuk berkas ad-hoc | Ekspor hanya untuk isi chat; tidak ada berkas sembarang | `.md`, `.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx`, `.json`, `.html`, `.zip` untuk materi apa pun | 🟡 Sebagian | Tinggi |
| G-05 | Tidak ada penyimpanan berkas | Berkas di- stream sekali, tidak disimpan | Object storage / berkas sementara + tautan unik kedaluwarsa | 🔴 Belum ada | Tinggi |
| G-06 | Tidak ada tool `generate_file` | Model tidak punya fungsi untuk membuat berkas | Function/tool calling `generate_file(format, filename, content)` | 🔴 Belum ada | Tinggi |
| G-07 | Tidak ada sanitasi konten berkas | Renderer menulis teks apa adanya (aman selama output teks) | Sanitasi HTML/PDF, anti malware, sandbox render saat menerima konten pengguna | 🔴 Belum ada | Sedang |
| G-08 | Tidak ada kuota & rate limit | Tanpa batas — ekspor bisa dipanggil berulang | Batas ukuran (≤25 MB) & jumlah berkas/hari | 🔴 Belum ada | Sedang |
| G-09 | Tidak ada kebijakan retensi | Belum relevan (belum ada berkas tersimpan) | Auto-hapus (mis. 7 hari), bisa hapus manual | 🔴 Belum ada | Sedang |
| G-10 | Dukungan .zip | `zipBytes()` sudah ada sebagai util (belum dipakai untuk bundel) | Distribusi multi-berkas lewat .zip | 🟡 Utilitas ada | Rendah (fase 1.5) |
| G-11 | Tidak ada integrasi cloud | Belum relevan | Simpan ke Google Drive / Dropbox | ⚪ Belum ada | Rendah (fase 3) |
| G-12 | Tidak ada template dokumen | Belum relevan | Template kop surat, laporan, proposal | ⚪ Belum ada | Rendah (fase 3) |

Kesimpulan gap: **Render Layer sudah ada dan teruji; Delegation + Lifecycle Layer belum ada sama sekali.** Jadi gap sebenarnya ada di G-01, G-02, G-05, G-06, G-07, G-08, G-09 — bukan di rendering.

---

## 1. Ringkasan

Saat ini asisten hanya dapat mengembalikan teks di dalam chat, dan pengguna bisa
mengekspor **isi percakapan** ke PDF/DOCX/XLSX/MD lewat tombol sidebar. Yang belum
ada: asisten sendiri bisa memutuskan menghasilkan berkas, dan berkas itu hidup di
percakapan — bisa diunduh, diganti format, disimpan sementara, lalu dihapus.

Usulan: tambahkan kapabilitas file generation — asisten dapat menghasilkan berkas
yang bisa diunduh dari dalam percakapan.

Catatan teknis penting: **renderer-nya tidak perlu dibangun dari nol.**
`document-export.ts` sudah menghasilkan byte PDF/DOCX/XLSX/ZIP sendiri tanpa
dependency baru. Kerja baru ada di: tool calling, penyimpanan berkas + tautan,
kartu unduhan di UI, kuota, dan retensi.

---

## 2. Masalah / Pain Point

- Pengguna harus menyusun ulang output secara manual (copy-paste ke Word/Docs) untuk mendapat PDF/DOCX.
- Format (heading, tabel, daftar, kode) sering rusak saat dipindah manual.
- Kebutuhan dokumen formal (laporan, proposal, panduan) jadi berbelit dan memakan waktu.
- Pengalaman pengguna tidak kompetitif dibanding asisten yang sudah mendukung artifact/file.

---

## 3. Tujuan (Goals)

1. Asisten dapat mengeluarkan berkas yang bisa diunduh langsung.
2. Format minimal didukung: `.md`, `.pdf`, `.docx`, `.txt`, `.csv`, `.xlsx`, `.json`, `.html`, `.zip`.
3. Isi berkas berasal dari output model (termasuk tabel, kode, gambar).
4. Berkas tampil rapi: heading, tabel, daftar, styling dasar, header/footer untuk PDF.
5. Berkas bisa diganti format setelah dibuat, tanpa generate ulang.

---

## 4. Non-Goals (Di luar cakupan fase awal)

- Kolaborasi real-time pada berkas.
- Sinkronisasi otomatis ke Google Drive/Dropbox (fase lanjutan).
- Editing berkas yang sudah diunggah pengguna (fase terpisah).
- Mengganti renderer yang sudah ada di `document-export.ts`.

---

## 5. Spesifikasi Fungsional

| ID | Kebutuhan | Keterangan | Status |
|----|-----------|------------|--------|
| F-01 | Deteksi permintaan "buatkan PDF/DOCX/MD" | intent detection | 🔴 Belum |
| F-02 | Hasilkan konten → konversi ke format diminta | sudah ada di render layer, belum tersambung ke model | 🟡 Sebagian |
| F-03 | Berkas muncul sebagai kartu unduhan di chat | nama, tipe, ukuran | 🔴 Belum |
| F-04 | Bisa pilih format alternatif dari berkas yang sama | "unduh sebagai PDF/DOCX" | 🔴 Belum |
| F-05 | Dukung .md, .pdf, .docx, .txt, .csv, .xlsx, .json, .html | fase 1 | 🟡 Sebagian (pdf/docx/xlsx/md/json/csv ada) |
| F-06 | Dukung .zip untuk banyak berkas | fase 1.5 | 🟡 `zipBytes()` ada, belum dipakai | 
| F-07 | Berkas disimpan sementara (mis. 7 hari), bisa dihapus pengguna | retensi & privasi | 🔴 Belum |

---

## 6. Spesifikasi Non-Fungsional

| Aspek | Ketentuan | Status |
|-------|-----------|--------|
| Keamanan | Sanitasi konten, cegah injeksi (HTML/PDF), pemindaian malware | 🔴 Belum |
| Privasi | Tidak dipakai training tanpa izin; tautan unik & kedaluwarsa | 🔴 Belum |
| Performa | Generate PDF < 5 detik untuk dokumen ≤ 20 halaman | 🟡 Renderer lokal & sincron, cepat (uji 381 ms untuk suite) |
| Kuota | Batas ukuran ≤ 25 MB & jumlah/hari per pengguna | 🔴 Belum |
| Aksesibilitas | Kartu unduhan dapat dibaca screen reader | 🔴 Belum |
| Dependency | Tidak menambah dependency baru | ✅ sudah dipenuhi pola repo |

---

## 7. Alur Pengguna (User Flow)

1. Pengguna : "buatkan PDF dari panduan ini"
2. Asisten  : menyusun konten → render PDF
3. Chat     : tampil kartu →  panduan.pdf  [Unduh] [Salin] [Ganti format ▾]
4. Pengguna : mengunduh → berkas tersimpan di perangkat

---

## 8. Arsitektur Teknis (usulan)

- **Render layer: sudah ada** — `src/lib/chat/document-export.ts`
  - Markdown → DOCX (OOXML) · Markdown → PDF (penulis sendiri) · baris → XLSX · objek → JSON · util ZIP
  - Nol dependency baru; jangan tambah `pandoc`/`weasyprint`/`puppeteer` selama jalur yang ada cukup.
- Object storage / direktori berkas sementara untuk hasil generate.
- Antrian job untuk berkas besar (kalau nanti diperlukan).
- API:
  - POST /artifacts — buat berkas
  - GET /artifacts/{id} — unduh
  - DELETE /artifacts/{id} — hapus
- Tool/function calling di sisi model agar asisten bisa memanggil generate_file(...).

Skema tool untuk model:

```json
{
  "name": "generate_file",
  "description": "Buat berkas yang dapat diunduh pengguna",
  "parameters": {
    "type": "object",
    "properties": {
      "format": {
        "type": "string",
        "enum": ["md", "pdf", "docx", "txt", "csv", "xlsx", "json", "html", "zip"]
      },
      "filename": { "type": "string" },
      "content": {
        "type": "string",
        "description": "Isi berkas; markdown untuk dokumen"
      }
    },
    "required": ["format", "filename", "content"]
  }
}
```

---

## 9. Kriteria Penerimaan (Acceptance Criteria)

- [ ] Permintaan "buatkan PDF" menghasilkan .pdf yang bisa diunduh.
- [ ] PDF rapi: heading, tabel, daftar, kode, page break.
- [ ] Nama & tipe berkas benar.
- [ ] Bisa ganti format dari berkas yang sama.
- [ ] Ada batas ukuran & kuota harian.
- [ ] Tautan unduhan kedaluwarsa sesuai kebijakan retensi.
- [ ] Ada audit log pembuatan berkas.

> Semua kotak masih kosong = belum ada yang terpenuhi. 🔴
> (Renderer PDF/DOCX/XLSX sudah terbukti jalan lewat tes; yang kosong adalah
>  jalur asisten → berkas → kartu unduhan → retensi.)

---

## 10. Metrik Keberhasilan

- % sesi yang menggunakan fitur berkas.
- Tingkat unduhan (*artifact → download rate*).
- Penurunan copy-paste manual (indikator tak langsung).
- Skor kepuasan pengguna untuk fitur ini.

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Penyalahgunaan (spam berkas besar) | kuota + rate limit |
| Konten berbahaya di HTML/PDF | sanitasi + sandbox render |
| Biaya storage/komputasi | retensi pendek + kompresi |
| Kebocoran data | tautan unik, kedaluwarsa, izin akses |
| Berkas yatim menumpuk di disk | cron pembersih (pola `kawan-storage-cleanup` sudah ada) |

---

## 12. Fase Rilis (usulan)

| Fase | Cakupan | Status |
|------|---------|--------|
| Fase 0 | Render layer (pdf/docx/xlsx/md/json/csv + zipBytes) | ✅ **Selesai di 0.2.0** |
| Fase 1 | Tool `generate_file`, kartu unduhan, penyimpanan + tautan, .md/.txt/.pdf/.csv/.json | 🔴 Belum |
| Fase 2 | .docx, .xlsx, .html, .zip (bundel), kuota, retensi, audit log | 🔴 Belum |
| Fase 3 | Integrasi cloud (Drive, Dropbox), template dokumen | ⚪ Belum |

---

## 13. Ringkasan Yang Masih Kurang (Checklist Cepat) 🔴

- [x] ✅ Renderer PDF — ada (`document-export.ts`, teruji)
- [x] ✅ Renderer DOCX — ada (OOXML, teruji)
- [x] ✅ Ekspor CSV/XLSX/JSON/MD — ada (uji 8/8 lolos)
- [x] ✅ Util .zip — ada (`zipBytes()`)
- [ ] 🔴 Tool calling `generate_file` (paling inti sekarang)
- [ ] 🔴 Kartu unduhan di antarmuka chat
- [ ] 🔴 Object storage + tautan unduhan kedaluwarsa
- [ ] 🔴 API `POST` / `GET` / `DELETE /artifacts`
- [ ] 🔴 Kuota & rate limit
- [ ] 🔴 Kebijakan retensi & hapus otomatis
- [ ] 🔴 Sanitasi & audit log fitur

---

## 14. Perubahan dari draf awal (jejak revisi)

1. Blok G-03/G-04/G-10 diturunkan statusnya dari 🔴 ke ✅/🟡 — renderer PDF/DOCX/XLSX/ZIP **sudah ada di 0.2.0**, bukan nol.
2. Ditambahkan "Fase 0 — Selesai" di bagian Fase Rilis.
3. Bagian 8 diberi catatan tegas: **jangan tambah dependency renderer** selama `document-export.ts` cukup. Mengganti ke `pandoc`/`puppeteer` menambah proses eksternal, ukuran image, dan vektor serangan baru tanpa manfaat.
4. Bagian 13 dipecah: yang sudah ada dicentang, sisa gap tetap 🔴.
5. Risiko ke-5 ditambahkan: berkas yatim di disk → pakai cron pembersih yang sudah ada.

Selisihnya: 4 dari 12 item gap ternyata sudah terpenuhi. Inti pekerjaan bergeser dari "bangun renderer" ke "sambungkan ke model + lifecycle berkas" — jauh lebih kecil.