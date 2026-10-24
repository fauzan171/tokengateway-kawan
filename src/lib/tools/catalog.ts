/**
 * Katalog ToolDoc (P8 / D5, riset-standar-dokumen §5): SATU sumber data untuk
 * tiga pembaca — blok capability model, panel UI read-only, dan
 * docs/tools/<id>.md. Tiga salinan manual akan berbeda dalam sebulan; satu
 * array + satu tes kesesuaian jauh lebih murah.
 *
 * Aturan isi (riset §5.3):
 *   - hanya tool yang benar-benar terpasang di registry yang didokumentasikan;
 *   - kapanDipakai 2..5 butir; kapanJangan minimal 2 — ini yang mencegah
 *     salah pilih tool;
 *   - setiap kode galat wajib punya tindakanModel (apa yang model lakukan).
 */

import { requiresApproval, type ToolEffect } from "./registry";

export type ToolDocArgumen = {
  nama: string;
  tipe: string;
  wajib: boolean | "bersyarat";
  batas?: string;
  keterangan: string;
};

export type ToolDocKegagalan = {
  kode: string;
  arti: string;
  tindakanModel: string;
};

export type ToolDoc = {
  id: string;
  version: number;
  ringkas: string;
  kapanDipakai: string[];
  kapanJangan: string[];
  argumen: ToolDocArgumen[];
  contoh: { valid: string; tidakValid: string };
  efek: ToolEffect;
  approval: boolean;
  batas: { bytes?: string; jumlah?: string; waktu?: string };
  kegagalan: ToolDocKegagalan[];
  hasil: string;
};

/** Entri katalog — HANYA tool terpasang; tes memverifikasi 1:1 dengan registry. */
export const TOOL_CATALOG: readonly ToolDoc[] = [
  {
    id: "generate_file",
    version: 1,
    ringkas: "Membuat berkas teks yang dapat diunduh pengguna (markdown, teks, JSON, CSV).",
    kapanDipakai: [
      "Pengguna meminta berkas unduhan berisi teks/data.",
      "Hasil kerja lebih cocok disimpan sebagai lampiran daripada bagian chat.",
      "Data tabular kecil diminta sebagai CSV.",
    ],
    kapanJangan: [
      "Pengguna minta dokumen rapi berjudul/bab/tabel — pakai generate_document.",
      "Konten masih diskusi; belum diminta menjadi berkas.",
      "Data tabular besar — CSV generate_file tetap tepat, bukan dokumen berformat.",
    ],
    argumen: [
      { nama: "format", tipe: "string", wajib: true, batas: "md | txt | json | csv", keterangan: "Format berkas keluaran." },
      { nama: "displayName", tipe: "string", wajib: true, batas: "maks 120 char", keterangan: "Nama berkas yang ditampilkan." },
      { nama: "content", tipe: "string", wajib: "bersyarat", batas: "wajib utk md/txt/json", keterangan: "Isi berkas." },
      { nama: "rows", tipe: "array", wajib: "bersyarat", batas: "wajib utk csv", keterangan: "Baris data CSV." },
    ],
    contoh: {
      valid: '{"format":"md","displayName":"catatan.md","content":"# Catatan Isi."}',
      tidakValid: '{"format":"pdf","displayName":"x"}',
    },
    efek: "local",
    approval: false,
    batas: { jumlah: "100 artefak/24 jam per pengguna", bytes: "25 MiB per artefak", waktu: "15 detik" },
    kegagalan: [
      { kode: "INVALID_TOOL_ARGS", arti: "Argumen tidak sesuai skema.", tindakanModel: "Perbaiki argumen sesuai batas lalu ulangi; jangan mengulang tanpa perubahan." },
      { kode: "QUOTA_EXCEEDED", arti: "Kuota artefak harian tercapai.", tindakanModel: "Sampaikan ke pengguna bahwa batas harian tercapai dan tawarkan lanjut besok." },
      { kode: "TOO_LARGE", arti: "Hasil render melebihi 25 MiB.", tindakanModel: "Kecilkan isi atau pecah menjadi beberapa berkas." },
    ],
    hasil: "Kartu artefak yang dapat diunduh pada pesan.",
  },
  {
    id: "generate_document",
    version: 2,
    ringkas: "Membuat dokumen terstruktur (PDF/DOCX/XLSX) dengan judul, bab, tabel, dan gambar.",
    kapanDipakai: [
      "Pengguna meminta dokumen rapi: laporan, surat, rekap, proposal.",
      "Konten butuh struktur: heading, daftar, tabel.",
      "Pengguna menyebut format eksplisit (PDF/Word/Excel).",
      "Bentuk baku laporan/surat/rekap dipakai lewat template.",
    ],
    kapanJangan: [
      "Cukup teks biasa di chat tanpa struktur.",
      "Pengguna hanya minta data tabular cepat — CSV generate_file lebih ringan.",
      "Butuh presentasi (PPTX) — jalur tool PPTX belum terpasang.",
    ],
    argumen: [
      { nama: "format", tipe: "string", wajib: true, batas: "pdf | docx | xlsx", keterangan: "Format dokumen." },
      { nama: "displayName", tipe: "string", wajib: true, batas: "maks 120 char", keterangan: "Nama dokumen." },
      { nama: "doc", tipe: "object", wajib: "bersyarat", batas: "wajib bila tanpa template", keterangan: "Skema {title, blocks[]}." },
      { nama: "template", tipe: "string", wajib: "bersyarat", batas: "laporan | surat | rekap", keterangan: "Template baku; menang atas doc bila keduanya dikirim." },
      { nama: "data", tipe: "object", wajib: "bersyarat", keterangan: "Isi sesuai template." },
    ],
    contoh: {
      valid: '{"format":"pdf","displayName":"l.pdf","doc":{"title":"L","blocks":[{"type":"paragraph","text":"Isi."}]}}',
      tidakValid: '{"format":"pdf","displayName":"l","doc":{"title":"","blocks":[]}}',
    },
    efek: "local",
    approval: false,
    batas: { jumlah: "500 blok, 20 gambar, 100 bullet, 12 kolom; 100 artefak/24 jam", bytes: "25 MiB per artefak; gambar 4 MiB", waktu: "15 detik" },
    kegagalan: [
      { kode: "INVALID_TOOL_ARGS", arti: "Struktur doc/data tidak sesuai skema.", tindakanModel: "Baca pesan galat, perbaiki field yang disebut, ulangi sekali." },
      { kode: "QUOTA_EXCEEDED", arti: "Kuota artefak harian tercapai.", tindakanModel: "Beri tahu pengguna dan tawarkan melanjutkan besok." },
      { kode: "TOO_LARGE", arti: "Dokumen melebihi 25 MiB setelah render.", tindakanModel: "Pangkas konten atau pecah dokumen." },
    ],
    hasil: "Kartu artefak dokumen pada pesan; pemotongan dilaporkan lewat note doc-truncated.",
  },
  {
    id: "compute.calculate",
    version: 1,
    ringkas: "Kalkulasi desimal presisi tinggi tanpa eval: hitung dan statistik dasar.",
    kapanDipakai: [
      "Pengguna minta perhitungan eksak (bukan taksiran).",
      "Statistik deskriptif dari daftar angka.",
      "Butuh angka yang konsisten antar-jawaban.",
    ],
    kapanJangan: [
      "Pengguna minta taksiran kasar saja — hitung manual di teks.",
      "Operasi di luar himpunan yang didukung.",
      "Operan bukan string desimal.",
    ],
    argumen: [
      { nama: "op", tipe: "string", wajib: true, batas: "hitung | statistik", keterangan: "Jenis operasi." },
      { nama: "operand", tipe: "string", wajib: "bersyarat", batas: "utk op=hitung", keterangan: "Ekspresi desimal." },
      { nama: "items", tipe: "array", wajib: "bersyarat", batas: "utk op=statistik", keterangan: "Daftar angka." },
    ],
    contoh: {
      valid: '{"op":"hitung","operand":"12.5*8"}',
      tidakValid: '{"op":"hitung","operand":"eval(process)"}',
    },
    efek: "read",
    approval: false,
    batas: { bytes: "8 KiB masuk", jumlah: "digit/eksponen dibatasi", waktu: "2 detik" },
    kegagalan: [
      { kode: "CALC_INVALID", arti: "Ekspresi/operan tidak sah.", tindakanModel: "Tulis ulang operan sebagai ekspresi desimal yang didukung." },
      { kode: "CALC_DIV_ZERO", arti: "Pembagian nol.", tindakanModel: "Periksa penyebut sebelum mengulang." },
    ],
    hasil: "Angka/hasil statistik sebagai teks terstruktur.",
  },
  {
    id: "compute.stats",
    version: 1,
    ringkas: "Statistik deskriptif (n, hilang, jenis, satuan, metode) untuk data kecil.",
    kapanDipakai: [
      "Pengguna minta ringkasan kualitatif kolom data.",
      "Perlu tahu jumlah nilai hilang sebelum olah lanjutan.",
    ],
    kapanJangan: [
      "Butuh angka agregat (mean/median) — pakai calculate statistik.",
      "Data belum berbentuk daftar nilai.",
    ],
    argumen: [
      { nama: "items", tipe: "array", wajib: true, keterangan: "Daftar nilai." },
      { nama: "unit", tipe: "string", wajib: false, keterangan: "Satuan bila ada." },
    ],
    contoh: { valid: '{"items":["1","2","x"]}', tidakValid: '{"items":"bukan-array"}' },
    efek: "read",
    approval: false,
    batas: { jumlah: "maks 1.000 butir", waktu: "2 detik" },
    kegagalan: [
      { kode: "CALC_INVALID", arti: "Masukan bukan daftar nilai.", tindakanModel: "Kirim ulang sebagai array nilai." },
    ],
    hasil: "Ringkasan deskriptif terstruktur.",
  },
  {
    id: "compute.count",
    version: 1,
    ringkas: "Menghitung kata/UTF-16/code point/grapheme/byte dari teks.",
    kapanDipakai: [
      "Pengguna minta jumlah kata/karakter yang akurat.",
      "Teks mengandung emoji/CJK dan hitungan naif menyesatkan.",
    ],
    kapanJangan: [
      "Cukup taksiran panjang — jangan panggil tool.",
      "Butuh frekuensi kata — belum didukung.",
    ],
    argumen: [{ nama: "text", tipe: "string", wajib: true, keterangan: "Teks yang dihitung." }],
    contoh: { valid: '{"text":"halo dunia"}', tidakValid: '{"text":""}' },
    efek: "read",
    approval: false,
    batas: { jumlah: "maks 200.000 char", waktu: "2 detik" },
    kegagalan: [
      { kode: "CALC_INVALID", arti: "Teks kosong/tidak sah.", tindakanModel: "Kirim teks tidak kosong." },
    ],
    hasil: "Tabel hitungan lima metrik.",
  },
  {
    id: "chart.render",
    version: 1,
    ringkas: "Diagram SVG deklaratif (batang/lini) dengan label ter-escape.",
    kapanDipakai: [
      "Pengguna minta visualisasi data kecil.",
      "Perlu alternatif tabel dari diagram.",
    ],
    kapanJangan: [
      "Data belum berbentuk deret angka berlabel.",
      "Butuh diagram interaktif/peta — tidak didukung.",
    ],
    argumen: [
      { nama: "kind", tipe: "string", wajib: true, batas: "bar | line", keterangan: "Jenis diagram." },
      { nama: "series", tipe: "array", wajib: true, batas: "maks 30 titik", keterangan: "Data berlabel." },
    ],
    contoh: { valid: '{"kind":"bar","series":[{"label":"a","value":1}]}', tidakValid: '{"kind":"pie"}' },
    efek: "local",
    approval: false,
    batas: { bytes: "64 KiB keluaran", jumlah: "30 titik, label 60 char", waktu: "5 detik" },
    kegagalan: [
      { kode: "CHART_INVALID", arti: "Bentuk series/kind tidak sah.", tindakanModel: "Kirim ulang dengan kind bar/line dan series berlabel." },
    ],
    hasil: "SVG + tabel alternatif.",
  },
  {
    id: "qr.make",
    version: 1,
    ringkas: "Membuat kode QR dan memverifikasinya lewat decode balik.",
    kapanDipakai: [
      "Pengguna minta kode QR untuk tautan/teks pendek.",
      "Perlu QR yang terverifikasi bisa dibaca balik sebelum dikirim ke pengguna.",
    ],
    kapanJangan: [
      "Teks panjang lebih dari 1.000 char — QR menjadi tak terbaca.",
      "Butuh QR dengan logo/error-correction tingkat tinggi.",
    ],
    argumen: [{ nama: "text", tipe: "string", wajib: true, batas: "maks 1.000 char", keterangan: "Isi QR." }],
    contoh: { valid: '{"text":"https://contoh.id"}', tidakValid: '{"text":""}' },
    efek: "local",
    approval: false,
    batas: { bytes: "64 KiB keluaran", jumlah: "1.000 char", waktu: "5 detik" },
    kegagalan: [
      { kode: "QR_INVALID", arti: "Teks kosong/terlalu panjang.", tindakanModel: "Pendekkan teks lalu ulangi." },
      { kode: "QR_VERIFY_FAILED", arti: "Decode balik tidak cocok.", tindakanModel: "Jangan kirim QR; laporkan kegagalan ke pengguna." },
    ],
    hasil: "SVG QR terverifikasi.",
  },
];

/**
 * Ringkasan capability untuk blok system prompt (riset §5.2): nama, kapan
 * dipakai, batas, dan larangan — persis yang dibutuhkan model memilih tool.
 */
export function buildToolCatalogBlock(): string {
  const docs = TOOL_CATALOG.map((tool) => {
    const batas = Object.values(tool.batas).filter(Boolean).join("; ");
    const dipakai = tool.kapanDipakai.map((k) => "- " + k).join("\n");
    const jangan = tool.kapanJangan.map((k) => "- " + k).join("\n");
    return [
      "### " + tool.id + " (efek: " + tool.efek + ")",
      tool.ringkas,
      "Dipakai bila:\n" + dipakai,
      "JANGAN dipakai bila:\n" + jangan,
      "Batas: " + batas,
      "Contoh valid: " + tool.contoh.valid,
    ].join("\n");
  });
  return ["# Tool yang tersedia", ...docs].join("\n\n");
}

/** Ambil satu ToolDoc; null bila tidak ada. */
export function getToolDoc(id: string): ToolDoc | null {
  return TOOL_CATALOG.find((tool) => tool.id === id) ?? null;
}

/** Approval katalog HARUS cocok dengan registry — dicegah tes kesesuaian. */
export function docApprovalOf(id: string): boolean {
  return requiresApproval(id);
}
