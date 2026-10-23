/**
 * Tema dokumen bersama (D2): satu sumber angka untuk semua jalur PDF.
 *
 * Sebelum modul ini ada, `renderPdfBytes` memakai default PDFKit (US Letter
 * 612x792) sementara `exportChatPdfBytes` menulis MediaBox 612x842 — dua jalur
 * PDF dengan ukuran halaman berbeda. Semua angka tampilan sekarang hanya boleh
 * berasal dari sini.
 *
 * Catatan kompatibilitas: ukuran halaman disatukan ke A4, tetapi geometri tata
 * letak tiap jalur sengaja TIDAK diubah (`margin` 72 adalah default PDFKit,
 * `pdf.*` adalah geometri jalur transkrip 50/780). Menyatukan margin akan
 * menggeser teks yang sudah ada, dan itu di luar lingkup D2.
 *
 * Semua objek dibekukan: tema adalah konstanta, bukan konfigurasi runtime.
 */

export type Tema = {
  /** Ukuran halaman A4 dalam poin (72 dpi). */
  page: { width: number; height: number };
  /** Margin halaman jalur dokumen terstruktur (72 = default PDFKit). */
  margin: number;
  /** Jarak antar baris (leading) jalur transkrip percakapan. */
  lineGap: number;
  /** Ukuran font per peran. */
  font: {
    title: number;
    heading: { 1: number; 2: number; 3: number };
    body: number;
    code: number;
    chat: number;
  };
  /** Warna teks utama dan baris tabel bergantian (hex, untuk DOCX/PPTX). */
  color: { text: string; tableAlt: string };
  /** Geometri jalur transkrip percakapan; dipertahankan apa adanya. */
  pdf: { marginX: number; firstBaselineOffset: number };
};

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

export const TEMA: Tema = deepFreeze({
  page: { width: 595, height: 842 },
  margin: 72,
  lineGap: 14,
  font: {
    title: 16,
    heading: { 1: 16, 2: 14, 3: 12 },
    body: 11,
    code: 10,
    chat: 12,
  },
  color: { text: "#111827", tableAlt: "#f3f4f6" },
  pdf: { marginX: 50, firstBaselineOffset: 62 },
});
