/**
 * Provider tiruan untuk uji streaming (SDD-9.1, WP-NT-P0-06).
 *
 * Server `node:http` tanpa dependensi baru. Skenario dipilih dari header
 * `x-kawan-scenario`; bila tidak ada, dari field `model` di body. Model
 * dipakai sebagai pemilih karena klien provider nanti sudah mengirimnya,
 * jadi uji integrasi tidak perlu jalur khusus untuk memilih skenario.
 *
 * Skenario yang disediakan SDD-9.1: potongan Unicode terbelah, tool call,
 * usage ada/tidak ada, timeout, 401, 429, respons rusak, koneksi putus.
 *
 * Fixture ini mengikat loopback. Klien provider yang memakai penjaga SSRF
 * `lib/api/http.ts` tidak bisa menjangkaunya; uji yang memakai fixture ini
 * memanggil `fetch` langsung.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export const SCENARIOS = [
  "unicode-split",
  "tool-call",
  "usage-present",
  "usage-absent",
  "timeout",
  "unauthorized",
  "rate-limited",
  "rate-limited-once",
  "bad-request",
  "server-error",
  "corrupted",
  "drop",
"eof-no-done",
  "length-truncated",
  "no-done-marker",
  "redirect",
  "file-tool",
  "document-tool",
  // WO-B3: loop riset memakai SATU `modelId` yang sama untuk semua fase, jadi
  // balasan dipilih dari penanda fase di dalam pesan, bukan dari nama model.
  "research",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export type RecordedRequest = {
  method: string;
  path: string;
  scenario: string;
  headers: IncomingMessage["headers"];
  body: unknown;
};

export type ProviderFixture = {
  baseUrl: string;
  /** Permintaan yang diterima, urut kedatangan. */
  requests: RecordedRequest[];
  close: () => Promise<void>;
};

const MODEL_PREFIX = "fixture-";

function isScenario(value: string): value is Scenario {
  return (SCENARIOS as readonly string[]).includes(value);
}

function chooseScenario(req: IncomingMessage, body: unknown): Scenario {
  const header = req.headers["x-kawan-scenario"];
  if (typeof header === "string" && isScenario(header)) return header;

  const model = (body as { model?: unknown } | null)?.model;
  if (typeof model === "string" && model.startsWith(MODEL_PREFIX)) {
    const name = model.slice(MODEL_PREFIX.length);
    if (isScenario(name)) return name;
  }

  return "usage-present";
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw === "") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Menulis satu event SSE mentah, lalu menunggu callback flush. */
function writeEvent(res: ServerResponse, payload: string): Promise<void> {
  return new Promise((resolve) => res.write(payload, () => resolve()));
}

/** Menulis potongan byte mentah (bisa jatuh di tengah code point). */
function writeRaw(res: ServerResponse, payload: Buffer): Promise<void> {
  return new Promise((resolve) => res.write(payload, () => resolve()));
}

/** Mengiris buffer jadi potongan byte, tanpa menghormati batas code point. */
function splitBytes(buf: Buffer, size: number): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) out.push(buf.subarray(i, i + size));
  return out;
}

function sseHeaders(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-store",
    connection: "keep-alive",
  });
}

function chunkEvent(text: string, withUsage: boolean): string {
  const payload: Record<string, unknown> = {
    id: "chatcmpl_fixture",
    object: "chat.completion.chunk",
    model: "fixture",
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  };
  if (withUsage) payload.usage = { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const DONE = "data: [DONE]\n\n";

/**
 * WO-B3: siklus validasi ke berapa loop riset menyatakan bukti cukup. 1 =
 * berhenti di siklus pertama (`sufficient_evidence`); angka besar = selalu
 * belum cukup, supaya loop menabrak `cycle_limit`. Direset tiap fixture.
 */
let researchVerdictAfter = 1;
let researchValidationRound = 0;

/** Awalan pesan hasil tool di `research.ts` (`pushToolMessage`). */
const TOOL_RESULT_MARKER = "HASIL TOOL (data tak tepercaya";

/** Atur kapan verdict "cukup" diberikan; dipakai tes loop riset. */
export function setResearchVerdictAfter(cycles: number): void {
  researchVerdictAfter = cycles;
  // Penghitung per-tes: `beforeEach` yang memanggil ini memulai dari siklus 1,
  // jadi tes pertama/kedua dalam berkas yang sama tidak saling mewarisi.
  researchValidationRound = 0;
}

/**
 * Teks pesan `user` yang BUKAN hasil tool; penanda fase ada di salah satunya.
 * Hasil tool dibuang supaya halaman yang kebetulan memuat penanda fase tidak
 * menggeser pemilihan balasan fixture (tes jadi menguji isi halaman, bukan loop).
 */
function userText(body: unknown): string {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages)) return "";
  return messages
    .map((row) => row as { role?: unknown; content?: unknown })
    .filter((row) => row.role === "user" && typeof row.content === "string")
    .map((row) => row.content as string)
    .filter((content) => !content.startsWith(TOOL_RESULT_MARKER))
    .join("\n");
}

/**
 * Teks dengan emoji, aksen gabung, dan aksara di luar BMP. Skenario
 * `unicode-split` mengiris byte mentah SSE, jadi potongan bisa jatuh di
 * tengah urutan UTF-8 multi-byte. Konsumen yang mendekode tiap potongan
 * sendiri akan kehilangan data (U+FFFD); konsumen yang benar menyangga byte
 * mentah dan mendekode dengan `TextDecoder({ stream: true })`.
 */
export const UNICODE_TEXT = "Halo 👋🏽 café \u{1F600} naïve — 你好 🎉";

export const TOOL_CALL_TEXT = "Saya cek dulu ya.";

export const TOOL_CALL_NAME = "lookup_weather";
export const TOOL_CALL_ID = "call_fixture_1";

export const CORRUPTED_BODY = '{"choices":[{"delta":{"content":"terpotong';

/** Sekali pakai untuk skenario `rate-limited-once`; direset tiap fixture. */
let retriedOnce = false;

async function handle(res: ServerResponse, scenario: Scenario, body: unknown): Promise<void> {
  switch (scenario) {
    case "redirect": {
      // Lintas host: kredensial tidak boleh ikut ke tujuan redirect.
      res.writeHead(307, { location: "http://127.0.0.1:1/models" });
      res.end();
      return;
    }
    case "unicode-split": {
      sseHeaders(res);
      // Bangun seluruh respons lebih dulu, lalu tulis sebagai potongan byte
      // 3-byte. Emoji 4-byte pasti terbelah antar potongan.
      const stream = Buffer.from(chunkEvent(UNICODE_TEXT, false) + DONE, "utf8");
      for (const piece of splitBytes(stream, 3)) {
        await writeRaw(res, piece);
      }
      res.end();
      return;
    }

    case "tool-call": {
      sseHeaders(res);
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [{ index: 0, delta: { content: TOOL_CALL_TEXT }, finish_reason: null }],
        })}\n\n`,
      );
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: TOOL_CALL_ID,
                    type: "function",
                    function: { name: TOOL_CALL_NAME, arguments: '{"kota":"' },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })}\n\n`,
      );
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [{ index: 0, function: { arguments: 'Jakarta"}' } }],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 },
        })}\n\n`,
      );
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "file-tool": {
      sseHeaders(res);
      const args = JSON.stringify({ format: "md", displayName: "laporan", content: "# Laporan\n\nIsi." });
      // Dua potongan: argumen tool memang datang terfragmentasi di dunia nyata.
      const cut = Math.floor(args.length / 2);
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: TOOL_CALL_ID,
                    type: "function",
                    function: { name: "generate_file", arguments: args.slice(0, cut) },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })}\n\n`,
      );
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(cut) } }] },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 30, total_tokens: 42 },
        })}\n\n`,
      );
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "document-tool": {
      sseHeaders(res);
      const args = JSON.stringify({
        format: "pdf",
        displayName: "laporan",
        doc: {
          title: "Laporan",
          blocks: [
            { type: "heading", text: "Bab 1" },
            { type: "paragraph", text: "Isi." },
          ],
        },
      });
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: TOOL_CALL_ID,
                    type: "function",
                    function: { name: "generate_document", arguments: args },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 30, total_tokens: 42 },
        })}\n\n`,
      );
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "usage-present":
    case "usage-absent": {
      sseHeaders(res);
      const withUsage = scenario === "usage-present";
      const pieces = ["Jawaban ", "yang ", "lengkap."];
      for (const [index, piece] of pieces.entries()) {
        const last = index === pieces.length - 1;
        await writeEvent(res, chunkEvent(piece, last && withUsage));
      }
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "timeout": {
      // Header dikirim, lalu tidak ada apa-apa lagi: menguji batas waktu
      // klien, bukan batas waktu koneksi.
      sseHeaders(res);
      await writeEvent(res, chunkEvent("mulai ", false));
      return;
    }

    case "unauthorized": {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Kunci API tidak sah.", type: "invalid_request_error" } }));
      return;
    }

    case "rate-limited": {
      res.writeHead(429, {
        "content-type": "application/json",
        "retry-after": "2",
      });
      res.end(JSON.stringify({ error: { message: "Terlalu banyak permintaan.", type: "rate_limit_error" } }));
      return;
    }

    case "rate-limited-once": {
      // 429 pada percobaan pertama, sukses pada percobaan berikutnya: menguji
      // retry benar-benar dijalankan, bukan hanya 429 berulang.
      if (!retriedOnce) {
        retriedOnce = true;
        res.writeHead(429, { "content-type": "application/json", "retry-after": "0" });
        res.end(JSON.stringify({ error: { message: "Terlalu banyak permintaan.", type: "rate_limit_error" } }));
        return;
      }
      sseHeaders(res);
      for (const piece of ["Setelah ", "retry."]) {
        await writeEvent(res, chunkEvent(piece, false));
      }
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "eof-no-done": {
      // Stream ditutup rapi TANPA `[DONE]` dan tanpa `finish_reason`: jawaban
      // terpotong yang tampak sukses (AUD-09).
      sseHeaders(res);
      await writeEvent(res, chunkEvent("Kalimat yang menggantung", false));
      res.end();
      return;
    }

    case "no-done-marker": {
      // Bentuk balasan 9Router yang TERBUKTI dari produksi: tidak pernah
      // mengirim `data: [DONE]`, hanya `finish_reason` di delta terakhir.
      // Parser harus tetap menutup stream sebagai `done` (stream-parse.ts:157).
      sseHeaders(res);
      for (const piece of ["Jawaban ", "tanpa DONE."]) {
        await writeEvent(res, chunkEvent(piece, false));
      }
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
        })}\n\n`,
      );
      res.end();
      return;
    }

    case "length-truncated": {
      sseHeaders(res);
      await writeEvent(
        res,
        `data: ${JSON.stringify({
          id: "chatcmpl_fixture",
          object: "chat.completion.chunk",
          model: "fixture",
          choices: [{ index: 0, delta: { content: "Jawaban panjang yang terpotong" }, finish_reason: "length" }],
        })}\n\n`,
      );
      await writeEvent(res, DONE);
      res.end();
      return;
    }

    case "bad-request": {
      // Body memuat penanda rahasia: uji memastikan ia tidak bocor ke log.
      res.writeHead(400, {
        "content-type": "application/json",
        "x-request-id": "req-uji-400",
      });
      res.end(
        JSON.stringify({
          error: { message: "messages kosong", type: "invalid_request_error", code: "invalid_messages" },
          canary: "sk-canary-" + "b".repeat(24),
        }),
      );
      return;
    }

    case "server-error": {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { type: "server_error" } }));
      return;
    }

    case "corrupted": {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(CORRUPTED_BODY);
      return;
    }

    case "drop": {
      sseHeaders(res);
      await writeEvent(res, chunkEvent("awal ", false));
      // Tutup soket di tengah stream: klien harus melihat galat jaringan,
      // bukan akhir stream yang bersih.
      res.socket?.destroy();
      return;
    }

    case "research": {
      // Balasan per fase: penanda diambil dari instruksi di `research.ts`
      // (framing/validation/synthesis). JSON internal dikirim sebagai teks
      // biasa — parser di sisi server yang mengurai objek di dalamnya.
      sseHeaders(res);
      const turn = userText(body);
      let text: string;
      if (turn.includes("Susun kerangka riset")) {
        text = JSON.stringify({
          question: "pertanyaan inti",
          queries: ["query awal satu", "query awal dua"],
        });
      } else if (turn.includes("Nilai kecukupan BUKTI")) {
        researchValidationRound += 1;
        const round = researchValidationRound;
        text =
          round >= researchVerdictAfter
            ? JSON.stringify({ gap: "", sufficient: true, nextQueries: [] })
            : JSON.stringify({
                gap: "bukti belum cukup",
                sufficient: false,
                nextQueries: [`query lanjutan ${round}`],
              });
      } else {
        text = "Jawaban akhir berdasarkan bukti yang dibaca.";
      }
      await writeEvent(res, chunkEvent(text, true));
      await writeEvent(res, DONE);
      res.end();
      return;
    }
  }
}

export async function startProviderFixture(): Promise<ProviderFixture> {
  const requests: RecordedRequest[] = [];
  retriedOnce = false;
  researchValidationRound = 0;
  researchVerdictAfter = 1;

  const server = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req);
      const scenario = chooseScenario(req, body);
      requests.push({
        method: req.method ?? "GET",
        path: req.url ?? "/",
        scenario,
        headers: req.headers,
        body,
      });
      try {
        await handle(res, scenario, body);
      } catch {
        if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
        if (!res.writableEnded) res.end(JSON.stringify({ error: { message: "fixture gagal" } }));
      }
    })();
  });

  // 0 = port apa pun yang bebas, supaya uji paralel tidak bertabrakan.
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));

  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Model yang memilih skenario tanpa perlu mengatur header. */
export function modelFor(scenario: Scenario): string {
  return `${MODEL_PREFIX}${scenario}`;
}
