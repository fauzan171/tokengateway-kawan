/**
 * Gateway palsu untuk E2E (WP-NT-P10-05).
 *
 * Meniru dua endpoint yang benar-benar dipanggil Kawan — `GET /models` dan
 * `POST /chat/completions` — tanpa jaringan, biaya, atau kunci sungguhan.
 * Bentuk balasan mengikuti `src/lib/providers/gateway.ts` dan
 * `src/lib/chat/stream-parse.ts`, bukan tebakan.
 *
 * Determinitas lewat penanda di pesan user terakhir:
 *   - memuat `GAGAL`  → 500
 *   - memuat `SITASI` → jawaban memuat `[1]` (memicu chip sitasi)
 * Penanda lain → jawaban biasa yang memuat nomor urut permintaan, sehingga
 * dua generasi untuk pesan yang sama tetap dapat dibedakan di UI.
 *
 * Kunci `kunci-ditolak` (atau header Authorization kosong) → 401.
 * Path berawalan `/v1-lambat` tidak pernah dijawab, untuk menguji TIMEOUT.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const FAKE_GATEWAY_PORT = Number(process.env["FAKE_GATEWAY_PORT"] ?? 3199);
export const FAKE_GATEWAY_BASE = `http://127.0.0.1:${FAKE_GATEWAY_PORT}/v1`;

/** Nilai E2E tetap: server uji dan seed memakai kunci yang sama persis. */
export const E2E_ENCRYPTION_SECRET = Buffer.alloc(32, 7).toString("base64");
export const E2E_AUTH_SECRET = "e2e-auth-secret-bukan-untuk-produksi";

export const MODELS = [
  { id: "palsu-kecil", name: "Palsu Kecil" },
  { id: "palsu-besar", name: "Palsu Besar" },
];

export type RecordedRequest = {
  method: string;
  path: string;
  body: unknown;
};

const requests: RecordedRequest[] = [];
let counter = 0;
let server: Server | null = null;

type ChatBody = {
  model?: unknown;
  stream?: unknown;
  messages?: { role?: unknown; content?: unknown }[];
};

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text"
          ? String((part as { text?: unknown }).text ?? "")
          : "",
      )
      .join(" ");
  }
  return "";
}

/** Seluruh teks pesan (system + user); dipakai fase riset yang menaruh penanda di system. */
function allText(body: ChatBody): string {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages.map((message) => textOf(message?.content)).join("\n");
}

function lastUserText(body: ChatBody): string {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return textOf(messages[i]?.content);
  }
  return "";
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function frame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function answer(text: string): string {
  counter += 1;
  const base = `Balasan palsu #${counter} untuk: ${text}`;
  return text.includes("SITASI") ? `${base} Rujukan [1].` : base;
}

/**
 * WO-9: fase loop riset meminta JSON, bukan prosa. Penanda ada di SELURUH prompt
 * (bukan hanya pesan user terakhir) karena instruksi fase dikirim sebagai pesan
 * sistem/user terpisah dan pesan user terakhir adalah instruksi framing itu
 * sendiri. Urutan cek penting: framing sebelum validation, karena validasi juga
 * menyebut "queries".
 *
 * Halaman bukti menunjuk ke gateway palsu sendiri (`/halaman`), jadi provider
 * `direct` di chain pencarian bisa membaca "internet" lewat allowlist egress
 * yang sudah dibuka presisi untuk port ini.
 */
function researchReply(prompt: string): string | null {
  if (prompt.includes("Susun kerangka riset")) {
    counter += 1;
    return JSON.stringify({ question: `pertanyaan #${counter}`, queries: [EVIDENCE_URL] });
  }
  if (prompt.includes("Nilai kecukupan BUKTI")) {
    return JSON.stringify({ gap: "", sufficient: true, nextQueries: [] });
  }
  return null;
}

/**
 * WO-9: balasan berupa `tool_calls`, untuk menguji jalur artefak dari chat.
 * Argumen dikirim UTUH dalam satu delta — pemecahan antar-delta sudah diuji
 * unit (`stream-parse`), jadi tidak perlu diulang di e2e.
 */
function streamToolCall(res: ServerResponse, name: string, args: unknown): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  res.write(
    frame({
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, id: "call-palsu-1", function: { name, arguments: JSON.stringify(args) } },
            ],
          },
        },
      ],
    }),
  );
  res.write(frame({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }));
  res.write("data: [DONE]\n\n");
  res.end();
}

/** Argumen `generate_file` yang sah dan kecil; dibuka balik oleh exceljs. */
export const FILE_TOOL_ARGS = {
  format: "xlsx",
  displayName: "rekap-e2e.xlsx",
  sheets: [
    {
      name: "Rekap",
      rows: [
        ["Bulan", "Nilai"],
        ["Januari", "10"],
        ["Februari", "20"],
      ],
    },
  ],
};

/** Halaman bukti untuk provider `direct`; wadah `<article>` supaya teks bersih. */
export const EVIDENCE_PATH = "/halaman";
export const EVIDENCE_URL = `http://127.0.0.1:${FAKE_GATEWAY_PORT}${EVIDENCE_PATH}`;
const EVIDENCE_HTML = [
  "<!doctype html><html lang=\"id\"><head>",
  "<title>Halaman bukti</title>",
  "<meta property=\"og:title\" content=\"Halaman bukti\">",
  "</head><body>",
  "<nav>menu yang harus tersaring</nav>",
  "<article><h1>Halaman bukti</h1>",
  "<p>Margin membaik pada kuartal ini menurut laporan internal.</p>",
  "<p>Angka ini dipakai sebagai bukti sitasi pada uji e2e.</p>",
  "</article></body></html>",
].join("");

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

function streamAnswer(res: ServerResponse, text: string): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  // Tiga potongan supaya UI benar-benar menguji penambahan teks bertahap.
  const pieces = [text.slice(0, 12), text.slice(12, 28), text.slice(28)].filter(Boolean);
  for (const piece of pieces) {
    res.write(frame({ choices: [{ index: 0, delta: { content: piece } }] }));
  }
  res.write(frame({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }));
  res.write("data: [DONE]\n\n");
  res.end();
}

function unauthorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? "";
  if (header.trim() === "") return true;
  return header.replace(/^Bearer\s+/i, "").trim() === "kunci-ditolak";
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? "/").split("?")[0] ?? "/";

  if (path === "/_requests") {
    json(res, 200, requests);
    return;
  }
  if (path === "/_reset") {
    requests.length = 0;
    json(res, 200, { ok: true });
    return;
  }

  // Uji TIMEOUT: biarkan menggantung sampai klien membatalkan sendiri.
  if (path.startsWith("/v1-lambat")) return;

  // WO-9: halaman bukti untuk provider `direct` di chain riset. Diperiksa
  // sebelum `readBody` karena ini GET tanpa body.
  if (path === EVIDENCE_PATH) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(EVIDENCE_HTML);
    return;
  }

  const body = await readBody(req);
  requests.push({ method: req.method ?? "GET", path, body });

  if (path.endsWith("/models")) {
    if (unauthorized(req)) {
      json(res, 401, { error: { message: "invalid key" } });
      return;
    }
    json(res, 200, { object: "list", data: MODELS });
    return;
  }

  if (path.endsWith("/chat/completions")) {
    if (unauthorized(req)) {
      json(res, 401, { error: { message: "invalid key" } });
      return;
    }
    const chat = body as ChatBody;
    const prompt = lastUserText(chat);
    // Penanda berkas: minta model "membuat" xlsx lewat tool call.
    if (prompt.includes("BUATFILE")) {
      if (chat.stream === true) {
        streamToolCall(res, "generate_file", FILE_TOOL_ARGS);
        return;
      }
      json(res, 200, {
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-palsu-1",
                  type: "function",
                  function: { name: "generate_file", arguments: JSON.stringify(FILE_TOOL_ARGS) },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
      });
      return;
    }
    // Loop riset meminta JSON per fase; diperiksa sebelum penanda prosa supaya
    // "SITASI" di dalam halaman bukti tidak mengubah bentuk balasan.
    const research = researchReply(allText(chat));
    if (research !== null) {
      streamAnswer(res, research);
      return;
    }
    if (prompt.includes("GAGAL")) {
      json(res, 500, { error: { message: "gateway palsu gagal" } });
      return;
    }
    const text = answer(prompt);
    if (chat.stream === true) {
      streamAnswer(res, text);
      return;
    }
    json(res, 200, {
      choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 },
    });
    return;
  }

  json(res, 404, { error: { message: "tidak ada di gateway palsu" } });
}

export function startFakeGateway(): Promise<number> {
  if (server) return Promise.resolve(FAKE_GATEWAY_PORT);
  return new Promise((resolve, reject) => {
    const created = createServer((req, res) => {
      void handle(req, res).catch(() => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "galat gateway palsu" } }));
      });
    });
    created.once("error", reject);
    created.listen(FAKE_GATEWAY_PORT, "127.0.0.1", () => {
      server = created;
      resolve(FAKE_GATEWAY_PORT);
    });
  });
}

export function stopFakeGateway(): Promise<void> {
  const current = server;
  server = null;
  if (!current) return Promise.resolve();
  return new Promise((resolve) => current.close(() => resolve()));
}
