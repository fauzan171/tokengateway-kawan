/**
 * WO-B2c: egress consent untuk pencarian.
 *
 * Query keluar ke provider pihak ketiga (Tavily/Jina) TIDAK PERNAH membawa PII
 * atau rahasia dari prompt pengguna. Minimisasi = hapus (bukan ganti placeholder,
 * yang mengubah semantik query). Murni, tanpa I/O — mudah diuji dan tidak bisa
 * membocorkan nilai asli ke log/event/snapshot.
 */

/** Pola yang dibuang dari query beserta biangnya. Urutan penting: yang spesifik
 *  dulu (email/token berprefiks) sebelum heuristik panjang-alnum yang lebih luas. */
const SPAN_RULES: RegExp[] = [
  /\S+@\S+\.\S+/g, // email
  /\bsk-[A-Za-z0-9_-]{8,}\b/g, // token gaya OpenAI
  /\bghp_[A-Za-z0-9]{20,}\b/g, // GitHub PAT
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, // Slack token
  /\b(?:password|passwd|api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, // rahasia berlabel
  /\b[A-Za-z0-9_-]{32,}\b/g, // base64/hex panjang tanpa spasi
  /(?:\+62|62|0)8[\d\s-]{6,12}\d/g, // telepon Indonesia
  /\b\d{16}\b/g, // NIK
  /\b(?:\d[ -]?){12,18}\d\b/g, // nomor kartu 13–19 digit berkelompok
];

/**
 * Buang PII/rahasia dari query pencarian sebelum keluar ke provider pihak ketiga.
 * `redacted` = jumlah span yang dibuang (observability + tes); nilai asli tidak
 * disimpan di mana pun. URL dipertahankan (sumber sah) — hanya kredensial di
 * dalamnya (`://user:pass@`) yang dibuang.
 */
export function sanitizeSearchQuery(raw: string): { query: string; redacted: number } {
  let redacted = 0;
  let text = raw;

  // Kredensial di dalam URL: `scheme://user:pass@host` → `scheme://host`.
  text = text.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, (_m, scheme: string) => {
    redacted += 1;
    return scheme;
  });

  // Lindungi URL utuh dari pola token panjang (URL = sumber sah).
  const urls: string[] = [];
  text = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, (m) => {
    urls.push(m);
    return `\u0000${urls.length - 1}\u0000`;
  });

  for (const rule of SPAN_RULES) {
    text = text.replace(rule, () => {
      redacted += 1;
      return " ";
    });
  }

  text = text.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => urls[Number(i)] ?? "");
  return { query: text.replace(/\s+/g, " ").trim(), redacted };
}