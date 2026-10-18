/**
 * Pembacaan `ChatMessage.contentJson` (SDD-2.2).
 *
 * Bentuk kanonik: `{ parts: [{ kind: "text", text }] }`. Nilai rusak tidak
 * boleh menjatuhkan pembacaan riwayat, jadi bagian yang tidak dikenali dilewati.
 */

export type ContentPart = { kind?: string; text?: string };

export function parseParts(contentJson: string): ContentPart[] {
  try {
    const data = JSON.parse(contentJson);
    if (Array.isArray(data?.parts)) return data.parts as ContentPart[];
  } catch {
    // fall through
  }
  return [];
}

/** Gabungan teks semua bagian `text`; bagian lain (tool, image, citation) diabaikan. */
export function messageText(contentJson: string): string {
  return parseParts(contentJson)
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("");
}
