/**
 * Pemotongan teks hasil ekstraksi menjadi chunk (WP-NT-P6-04, REQ-NT-55).
 *
 * Aturan (SDD-6.1 butir 4): 800–1200 karakter, target ~1000, overlap
 * ~150 karakter, potong di batas kata. Chunk TIDAK menyeberangi batas
 * halaman supaya `page` selalu benar untuk sitasi (REQ-NT-57).
 */

import { ExtractError } from "./extract";

const TARGET = 1_000;
const MIN = 800;
const MAX = 1_200;
const OVERLAP = 150;
/** Batas aman jumlah chunk per dokumen (SDD-6.1 butir 4). */
const MAX_CHUNKS = 5_000;

export type ChunkDraft = {
  ordinal: number;
  text: string;
  page: number;
  section: string | null;
};

const isSpace = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);

/**
 * Potong satu halaman. Halaman lebih pendek dari target menjadi satu chunk.
 *
 * `shortcut: section selalu null — deteksi heading belum diminta gate P6-04;
 * isi saat metadata bagian dibutuhkan (P6-08).`
 */
function chunkPage(page: number, raw: string, out: ChunkDraft[]): void {
  const text = raw.trim();
  let start = 0;

  while (start < text.length) {
    // Sisa yang masih muat satu chunk: habiskan sekaligus, jangan sisakan
    // potongan pendek di ekor.
    let end = text.length - start <= MAX ? text.length : start + TARGET;

    if (end < text.length) {
      // Cari batas kata terdekat ke belakang, tidak lebih pendek dari MIN.
      let cut = end;
      for (let i = end; i > start + MIN; i -= 1) {
        if (isSpace(text[i])) {
          cut = i;
          break;
        }
      }
      end = cut;
    }

    const piece = text.slice(start, end).trim();
    if (piece !== "") {
      out.push({ ordinal: out.length, text: piece, page, section: null });
      if (out.length > MAX_CHUNKS) {
        throw new ExtractError(
          "EXTRACT_FAILED",
          `Dokumen menghasilkan lebih dari ${MAX_CHUNKS} chunk; ekstraksi dihentikan.`,
        );
      }
    }

    if (end >= text.length) return;

    // Overlap 150–200 karakter, dimulai di awal kata bila memungkinkan.
    let next = end - OVERLAP;
    for (let i = next; i > end - 2 * OVERLAP; i -= 1) {
      if (isSpace(text[i - 1])) {
        next = i;
        break;
      }
    }
    while (next < text.length && isSpace(text[next])) next += 1;
    start = next > start ? next : end;
  }
}

/**
 * Potong seluruh dokumen. `ordinal` berurutan 0..n-1 lintas halaman.
 * Halaman kosong tidak menghasilkan chunk.
 */
export function chunkPages(pages: { page: number; text: string }[]): ChunkDraft[] {
  const out: ChunkDraft[] = [];
  for (const page of pages) chunkPage(page.page, page.text, out);
  return out;
}

/** Batas atas yang diekspor untuk uji batas aman. */
export const MAX_CHUNKS_PER_DOCUMENT = MAX_CHUNKS;
