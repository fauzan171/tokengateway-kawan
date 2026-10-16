/**
 * Uji parser SSE (WP-NT-P3-04, SDD-4.3).
 *
 * Bukti inti gate NT-P3 ada di sini: satu karakter 4-byte yang terbelah antar
 * dua chunk tetap keluar utuh. Tidak ada jaringan nyata — semua chunk adalah
 * byte fixture yang diiris tangan.
 */

import { describe, expect, it } from "vitest";
import { createStreamParser, type Delta } from "./stream-parse";

const UNICODE_TEXT = "Halo 👋🏽 café \u{1F600} naïve — 你好 🎉";

function textDelta(text: string): string {
  return `data: ${JSON.stringify({
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  })}\n\n`;
}

const DONE = "data: [DONE]\n\n";

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function texts(deltas: readonly Delta[]): string {
  return deltas
    .filter((d) => d.kind === "text")
    .map((d) => d.text ?? "")
    .join("");
}

describe("createStreamParser", () => {
  it("emoji 4-byte yang terbelah di tengah tetap utuh", () => {
    const parser = createStreamParser();
    const stream = bytes(textDelta(UNICODE_TEXT) + DONE);

    // Iris jadi potongan 3-byte: emoji 4-byte PASTI jatuh di batas chunk.
    const out: Delta[] = [];
    for (let i = 0; i < stream.length; i += 3) {
      out.push(...parser.push(stream.subarray(i, i + 3)));
    }
    out.push(...parser.flush());

    expect(texts(out)).toBe(UNICODE_TEXT);
    expect(texts(out)).not.toContain("�");
  });

  it("satu emoji yang persis dibelah dua antar chunk keluar utuh", () => {
    const parser = createStreamParser();
    const emoji = "\u{1F600}"; // 4 byte
    const whole = bytes(textDelta(`a${emoji}b`) + DONE);
    // Cari posisi emoji di byte stream, lalu potong tepat di tengahnya.
    const emojiBytes = bytes(emoji);
    const at = indexOfBytes(whole, emojiBytes);
    expect(at).toBeGreaterThanOrEqual(0);

    const first = parser.push(whole.subarray(0, at + 2));
    const second = parser.push(whole.subarray(at + 2));
    const rest = parser.flush();

    expect(texts([...first, ...second, ...rest])).toBe(`a${emoji}b`);
  });

  it("dua chunk yang membelah \\n\\n tetap terparse", () => {
    const parser = createStreamParser();
    const stream = textDelta("satu") + textDelta("dua") + DONE;
    const cut = stream.indexOf("\n\n") + 1; // tepat di tengah pemisah event

    const first = parser.push(bytes(stream.slice(0, cut)));
    const second = parser.push(bytes(stream.slice(cut)));
    const rest = parser.flush();

    expect(texts([...first, ...second, ...rest])).toBe("satudua");
  });

  it("JSON rusak di tengah stream dilewati, sisa stream tetap jalan", () => {
    const parser = createStreamParser();
    const stream = textDelta("awal ") + "data: {rusak\n\n" + textDelta("akhir") + DONE;

    const out = parser.push(bytes(stream));

    expect(texts(out)).toBe("awal akhir");
    expect(out.at(-1)?.kind).toBe("done");
  });

  it("[DONE] mengakhiri dengan kind done dan menghentikan pemrosesan", () => {
    const parser = createStreamParser();
    const out = parser.push(bytes(textDelta("x") + DONE + textDelta("setelah-done")));

    expect(out.map((d) => d.kind)).toEqual(["text", "done"]);
    expect(texts(out)).toBe("x");
    // Setelah done, chunk berikutnya tidak menghasilkan apa pun (SDD-4.4).
    expect(parser.push(bytes(textDelta("lagi")))).toEqual([]);
  });

  it("usage terbaca, tanpa usage tidak ada delta usage", () => {
    const parser = createStreamParser();
    const withUsage =
      `data: ${JSON.stringify({
        choices: [{ delta: {} }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      })}\n\n` + DONE;

    const out = parser.push(bytes(withUsage));
    const usage = out.find((d) => d.kind === "usage");
    expect(usage?.usage).toEqual({ promptTokens: 11, completionTokens: 7, totalTokens: 18 });

    const parser2 = createStreamParser();
    const without = parser2.push(bytes(textDelta("tanpa usage") + DONE));
    expect(without.some((d) => d.kind === "usage")).toBe(false);
  });

  it("baris yang bukan data: diabaikan", () => {
    const parser = createStreamParser();
    const stream = `: komentar\n\nevent: ping\ndata: ${JSON.stringify({
      choices: [{ delta: { content: "hi" } }],
    })}\n\n` + DONE;

    expect(texts(parser.push(bytes(stream)))).toBe("hi");
  });

  it("bingkai terakhir tanpa penutup \\n\\n tetap diproses saat flush", () => {
    const parser = createStreamParser();
    const stream = textDelta("akhir tanpa pemisah").replace(/\n\n$/, "");

    expect(texts(parser.push(bytes(stream)))).toBe("");
    expect(texts(parser.flush())).toBe("akhir tanpa pemisah");
  });
});

/** Indeks byte pertama `needle` di `haystack`; -1 bila tidak ada. */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
