/**
 * Mask kunci rahasia untuk ditampilkan (SDD-5.2, REQ-NT-07).
 *
 * Aturan SDD-5.2: mask HANYA dibuat dari kunci asli saat kunci tersedia.
 * Operasi daftar tidak boleh mendekripsi hanya untuk membuat mask — itulah
 * sebabnya `Connection.apiKeyMask` disimpan saat key ditulis, bukan dihitung
 * saat dibaca.
 *
 * Bentuk normal: awalan skema terlihat + `...` + 4 karakter terakhir, mis.
 * `sk-...abc1`. Kunci pendek (mis. 4 karakter) tidak boleh membocorkan
 * sebagian besar isinya; untuk itu dipakai bentuk aman tanpa isi asli.
 */

/** Panjang ekor yang boleh terlihat pada bentuk normal. */
const TAIL_LENGTH = 4;

/** Batas panjang awalan yang boleh terlihat (termasuk tanda hubung skema). */
const MAX_HEAD_LENGTH = 4;

/**
 * Di bawah panjang ini, mask dibuat sepenuhnya: awalan + ekor akan
 * membocorkan terlalu besar porsi kunci.
 */
const MIN_LENGTH_FOR_PARTIAL = 12;

/** Bentuk aman untuk kunci pendek/kosong: tidak ada karakter asli. */
export const FULLY_MASKED = "••••";

/**
 * Ambil awalan yang aman untuk ditampilkan.
 *
 * Bila kunci memakai skema berpemisah (mis. `sk-`, `gsk-`), tanda hubung
 * pertama dipakai sebagai batas awalan. Bila tidak, ambil beberapa karakter
 * pertama saja.
 */
function visibleHead(plaintext: string): string {
  const dash = plaintext.indexOf("-");
  if (dash > 0 && dash + 1 <= MAX_HEAD_LENGTH) return plaintext.slice(0, dash + 1);
  return plaintext.slice(0, Math.min(MAX_HEAD_LENGTH, plaintext.length));
}

/**
 * Bentuk tampilan aman dari `plaintext`.
 *
 * Bentuk normal hanya dipakai bila bagian yang terlihat tetap merupakan
 * minoritas kunci (awalan + ekor kurang dari separuh panjang). Selain itu
 * dikembalikan {@link FULLY_MASKED}.
 */
export function maskSecret(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length < MIN_LENGTH_FOR_PARTIAL) {
    return FULLY_MASKED;
  }

  const head = visibleHead(plaintext);
  const tail = plaintext.slice(-TAIL_LENGTH);

  // Jangan pernah menampilkan separuh kunci atau lebih.
  if (head.length + TAIL_LENGTH >= plaintext.length / 2) return FULLY_MASKED;

  return `${head}...${tail}`;
}
