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

  it("meneruskan finish_reason dari gateway pada delta done", () => {
    const p = createStreamParser();
    const frame =
      "data: " +
      JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) +
      "\n\ndata: [DONE]\n\n";
    const deltas = p.push(new TextEncoder().encode(frame));
    const done = deltas.find((d) => d.kind === "done");
    expect(done?.finishReason).toBe("stop");
  });

  it("finish_reason tanpa [DONE] tetap dilaporkan saat flush", () => {
    const p = createStreamParser();
    const frame =
      "data: " +
      JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "length" }] }) +
      "\n\n";
    p.push(new TextEncoder().encode(frame));
    const done = p.flush().find((d) => d.kind === "done");
    expect(done?.finishReason).toBe("length");
  });
});

describe("tool_calls", () => {
  function toolDelta(delta: Record<string, unknown>): string {
    return `data: ${JSON.stringify({
      choices: [{ index: 0, delta, finish_reason: null }],
    })}\n\n`;
  }

  it("arguments terbelah antar delta, id/name hanya di delta pertama", () => {
    const p = createStreamParser();
    const stream =
      toolDelta({ tool_calls: [{ index: 0, id: "call_1", function: { name: "cari", arguments: '{"q":' } }] }) +
      toolDelta({ tool_calls: [{ index: 0, function: { arguments: '"halo"}' } }] }) +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] })}\n\n` +
      DONE;

    const out = p.push(bytes(stream));
    const calls = out.filter((d) => d.kind === "tool_call");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.toolCall).toEqual({ index: 0, id: "call_1", name: "cari", argumentsDelta: '{"q":' });
    expect(calls[1]?.toolCall).toEqual({ index: 0, argumentsDelta: '"halo"}' });
    expect(out.find((d) => d.kind === "done")?.finishReason).toBe("tool_calls");
  });

  it("beberapa call sekaligus dalam satu delta keluar berurutan", () => {
    const p = createStreamParser();
    const out = p.push(
      bytes(
        toolDelta({
          tool_calls: [
            { index: 1, id: "b", function: { name: "dua", arguments: "{}" } },
            { index: 0, id: "a", function: { name: "satu", arguments: "{}" } },
          ],
        }) + DONE,
      ),
    );
    const calls = out.filter((d) => d.kind === "tool_call");
    expect(calls.map((d) => d.toolCall?.index)).toEqual([1, 0]);
  });

  it("entri tanpa index angka dilewati tanpa lemparan", () => {
    const p = createStreamParser();
    const out = p.push(
      bytes(
        toolDelta({
          tool_calls: [
            { index: "nol", id: "x", function: { name: "rusak", arguments: "{}" } },
            { index: 0, id: "ok", function: { name: "valid", arguments: "{}" } },
          ],
        }) + DONE,
      ),
    );
    const calls = out.filter((d) => d.kind === "tool_call");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.toolCall?.id).toBe("ok");
  });

  it("arguments unicode terbelah di tengah byte tersambung tanpa U+FFFD", () => {
    const p = createStreamParser();
    const args = '{"q":"👋🏽"}';
    const encoded = bytes(toolDelta({ tool_calls: [{ index: 0, id: "c", function: { name: "cari", arguments: args } }] }) + DONE);
    // Potong di tengah byte emoji (kutip JSON di-escape, jadi cari emoji langsung).
    const emojiAt = indexOfBytes(encoded, bytes("👋🏽"));
    expect(emojiAt).toBeGreaterThanOrEqual(0);
    const cut = emojiAt + 2;

    // Sisa byte dikirim sebagai chunk KEDUA — itu yang diuji: karakter terbelah
    // antar chunk. `flush()` hanya untuk stream yang benar-benar habis.
    const out = [
      ...p.push(encoded.subarray(0, cut)),
      ...p.push(encoded.subarray(cut)),
      ...p.flush(),
    ];
    const joined = out
      .filter((d) => d.kind === "tool_call")
      .map((d) => d.toolCall?.argumentsDelta ?? "")
      .join("");
    expect(joined).toBe(args);
    expect(joined).not.toContain("\u{FFFD}");
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
