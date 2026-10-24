/**
 * Parser stream SSE dari gateway (SDD-4.3, WP-NT-P3-04).
 *
 * Gateway OpenAI-compatible mengirim satu event per bingkai `data: {...}`,
 * dipisah baris kosong (`\n\n`), diakhiri `data: [DONE]`. Parser ini hanya
 * memahami bentuk itu.
 *
 * Dua sifat yang penting dan mudah salah:
 *
 * 1. **Unicode yang terbelah antar chunk tetap utuh.** Potongan jaringan bisa
 *    memotong satu karakter UTF-8 di tengah. Karena itu byte mentah disangga
 *    lalu didekode dengan `TextDecoder({ stream: true })` — TIDAK ada
 *    `toString()` per chunk, yang akan menghasilkan U+FFFD.
 * 2. **Satu baris rusak tidak membunuh jawaban.** JSON yang gagal di-parse
 *    dilewati, bukan dilempar; sisa stream tetap diproses.
 */

export type StreamUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

/** Satu potongan tool call dari delta. Field bisa datang di delta berbeda. */
export type ToolCallDelta = {
  index: number;
  id?: string;
  name?: string;
  /** Potongan `arguments` — MENYAMBUNG antar delta, bukan JSON utuh. */
  argumentsDelta?: string;
};

export type Delta = {
  kind: "text" | "usage" | "done" | "tool_call";
  text?: string;
  usage?: StreamUsage;
  /** Alasan berhenti dari gateway, bila dikirim. Terisi pada delta `done`. */
  finishReason?: string | null;
  toolCall?: ToolCallDelta;
};

export type StreamParser = {
  push(chunk: Uint8Array): Delta[];
  flush(): Delta[];
};

const EVENT_SEPARATOR = "\n\n";
const DATA_PREFIX = "data:";
const DONE_MARKER = "[DONE]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Teks delta dari `choices[0].delta.content`, atau `null` bila tidak ada. */
function readText(payload: Record<string, unknown>): string | null {
  const choices = payload["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!isRecord(first)) return null;
  const delta = first["delta"];
  if (!isRecord(delta)) return null;
  const content = delta["content"];
  return typeof content === "string" ? content : null;
}

/**
 * Potongan `tool_calls` dari `choices[0].delta.tool_calls`. Satu delta bisa
 * memuat beberapa entri sekaligus, dan entri tanpa `index` angka dibuang —
 * tanpa index, potongan tidak bisa disatukan oleh pemanggil.
 */
function readToolCalls(payload: Record<string, unknown>): ToolCallDelta[] {
  const choices = payload["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return [];
  const first = choices[0];
  if (!isRecord(first)) return [];
  const delta = first["delta"];
  if (!isRecord(delta)) return [];
  const raw = delta["tool_calls"];
  if (!Array.isArray(raw)) return [];

  const out: ToolCallDelta[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const index = entry["index"];
    if (typeof index !== "number" || !Number.isInteger(index)) continue;

    const call: ToolCallDelta = { index };
    if (typeof entry["id"] === "string" && entry["id"] !== "") call.id = entry["id"];

    const fn = entry["function"];
    if (isRecord(fn)) {
      if (typeof fn["name"] === "string" && fn["name"] !== "") call.name = fn["name"];
      // `arguments` datang terpotong; string kosong tetap dikirim supaya
      // pemanggil tahu delta ini milik call tersebut.
      if (typeof fn["arguments"] === "string") call.argumentsDelta = fn["arguments"];
    }
    out.push(call);
  }
  return out;
}

/** Usage dari `payload.usage`, atau `null` bila gateway tidak melaporkannya. */
function readUsage(payload: Record<string, unknown>): StreamUsage | null {
  const raw = payload["usage"];
  if (!isRecord(raw)) return null;
  return {
    promptTokens: toNumberOrNull(raw["prompt_tokens"]),
    completionTokens: toNumberOrNull(raw["completion_tokens"]),
    totalTokens: toNumberOrNull(raw["total_tokens"]),
  };
}

/**
 * `finish_reason` dari pilihan pertama, atau `undefined` bila belum ada.
 *
 * `undefined` berarti "belum berhenti" (delta tengah), `null` berarti gateway
 * menyatakan berhenti tanpa alasan. Keduanya berbeda, jadi jangan disamakan.
 */
function readFinishReason(payload: Record<string, unknown>): string | null | undefined {
  const choices = payload["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (!isRecord(first) || !("finish_reason" in first)) return undefined;
  const reason = first["finish_reason"];
  return typeof reason === "string" ? reason : null;
}

export function createStreamParser(): StreamParser {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let done = false;
  /** Diisi saat gateway menyatakan alasan berhenti; dibawa ke delta `done`. */
  let finishReason: string | null = null;

  function handleFrame(frame: string, out: Delta[]): void {
    // Satu bingkai bisa memuat beberapa baris `data:`; masing-masing diproses
    // sendiri. Baris yang bukan `data:` (komentar `:`, field lain) diabaikan.
    for (const line of frame.split("\n")) {
      if (!line.startsWith(DATA_PREFIX)) continue;
      let data = line.slice(DATA_PREFIX.length);
      if (data.startsWith(" ")) data = data.slice(1);

      if (data === DONE_MARKER) {
        out.push({ kind: "done", finishReason });
        done = true;
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(data);
      } catch {
        continue; // baris rusak dilewati; jangan menjatuhkan seluruh jawaban
      }
      if (!isRecord(payload)) continue;

      const text = readText(payload);
      if (text !== null && text !== "") out.push({ kind: "text", text });

      for (const toolCall of readToolCalls(payload)) {
        out.push({ kind: "tool_call", toolCall });
      }

      const usage = readUsage(payload);
      if (usage) out.push({ kind: "usage", usage });

      // `finish_reason` datang di delta terakhir, SEBELUM penanda `[DONE]`.
      // Disimpan dulu, bukan langsung menutup: menutup di sini akan melewatkan
      // sisa bingkai dan membuat penanganan `[DONE]` tidak pernah terpakai.
      const reason = readFinishReason(payload);
      if (reason !== undefined) finishReason = reason;
    }
  }

  function drain(final: boolean): Delta[] {
    const out: Delta[] = [];
    if (done) return out;

    // Normalisasi CRLF supaya bingkai `\r\n\r\n` tetap terpisah; bingkai yang
    // berakhir di batas chunk akan utuh setelah push berikutnya.
    buffer = buffer.replace(/\r\n/g, "\n");

    for (;;) {
      const index = buffer.indexOf(EVENT_SEPARATOR);
      if (index === -1) break;
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + EVENT_SEPARATOR.length);
      handleFrame(frame, out);
      if (done) return out;
    }

    // Saat stream habis, sisa buffer tanpa penutup `\n\n` tetap diproses: ada
    // gateway yang menutup koneksi tanpa baris kosong terakhir.
    if (final && buffer !== "") {
      const frame = buffer;
      buffer = "";
      handleFrame(frame, out);
    }

    // Stream berakhir tanpa penanda `[DONE]` tetapi gateway sempat menyatakan
    // alasan berhenti: tetap laporkan supaya klien tahu kenapa berhenti.
    if (final && !done && finishReason !== null) {
      out.push({ kind: "done", finishReason });
      done = true;
    }
    return out;
  }

  return {
    push(chunk) {
      if (done) return [];
      buffer += decoder.decode(chunk, { stream: true });
      return drain(false);
    },
    flush() {
      // `decode()` tanpa argumen membuang byte UTF-8 yang masih tertahan.
      buffer += decoder.decode();
      return drain(true);
    },
  };
}
