/**
 * Penanda permintaan pencarian web + system prompt sumber (WP-NT-P7-02, REQ-NT-52).
 *
 * Penanda disimpan sebagai bagian `web-search` pada `contentJson` pesan user,
 * bukan kolom baru: satu-satunya pembaca adalah generasi, dan skema tidak perlu
 * berubah. Awalan `[S1]` dipakai untuk sumber web supaya tidak bertabrakan
 * dengan penanda dokumen `[1]` dari `context.ts`.
 */

const SNIPPET_MAX = 300;
/** Batas teks halaman yang masuk prompt per sumber; sisanya dipotong. */
const TEXT_MAX = 2_000;

/**
 * Bentuk minimal yang dibutuhkan prompt: hasil pencarian polos maupun sumber
 * yang sudah diperkaya (`EnrichedSource`) sama-sama memenuhinya secara struktural.
 */
export type PromptSource = {
  title: string;
  url: string;
  snippet: string;
  fetchedAt?: string;
  reach?: string;
  contentHash?: string | null;
  text?: string | null;
  reason?: string;
};

/** Apakah pesan user meminta pencarian web. Input rusak → `false`. */
export function webSearchRequested(contentJson: string | null | undefined): boolean {
  if (typeof contentJson !== "string" || contentJson === "") return false;
  let data: unknown;
  try {
    data = JSON.parse(contentJson);
  } catch {
    return false;
  }
  if (data === null || typeof data !== "object") return false;
  const parts = (data as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return false;
  return parts.some(
    (part) => part !== null && typeof part === "object" && (part as { kind?: unknown }).kind === "web-search",
  );
}

/** System prompt berisi hasil pencarian. `undefined` bila tidak ada hasil. */
export function buildSearchSystem(results: readonly PromptSource[]): string | undefined {
  if (results.length === 0) return undefined;

  const lines = results.map((result, index) => {
    const snippet = result.snippet.slice(0, SNIPPET_MAX).trim();
    const head = `[S${index + 1}] ${result.title} — ${result.url}`;

    // Provenance: tanpa waktu ambil, isi berita/harga tidak boleh dipakai
    // seolah masih berlaku. `dead`/`blocked` dinyatakan terang supaya model
    // tidak mengutip halaman yang tidak terbaca.
    const meta: string[] = [];
    if (result.fetchedAt) meta.push(`diambil ${result.fetchedAt}`);
    if (result.contentHash) meta.push(`hash ${result.contentHash.slice(0, 12)}`);
    if (result.reach === "dead") meta.push("TAUTAN MATI — jangan dikutip");
    else if (result.reach === "blocked") meta.push("TERBLOKIR/PAYWALL — jangan dikutip");
    else if (result.reach === "unchecked") meta.push("belum dibaca");

    const body = result.text?.trim()
      ? `Isi halaman:\n${result.text.slice(0, TEXT_MAX).trim()}`
      : snippet;

    return [head, meta.length > 0 ? meta.join(" · ") : "", body]
      .filter((line) => line !== "")
      .join("\n");
  });

  return [
    "Hasil pencarian web berikut disediakan untuk menjawab pertanyaan pengguna.",
    "",
    ...lines,
    "",
    "Kutip penanda sumber, misalnya [S1], bila memakai isi salah satu sumber di atas.",
    "Sebutkan waktu pengambilan untuk fakta yang bisa berubah (berita, harga, angka).",
    "Jangan mengarang URL atau sumber yang tidak ada di daftar ini.",
  ].join("\n");
}
