/**
 * Engine bridge: kawanku-harness sebagai engine generasi di belakang UI Kawan.
 *
 * Harness dijalankan headless per generasi: `dsh --profile headless --json`
 * menulis event NDJSON (session/status/text/thinking/tool_call/tool_result/
 * final) ke stdout. Modul ini memetakan event itu ke callback `onDelta`
 * `streamGateway` sehingga seluruh pipeline lama (SSE UI, stop, usage, dan
 * persistensi) tetap berfungsi tanpa perubahan.
 *
 * Isolasi per pengguna: tiap user punya harness home sendiri
 * (`KAWANKU_ENGINE_HOME_ROOT/<userId>`), berisi session log, storage, dan
 * overlay pribadinya; tidak ada state lintas tenant.
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/** Lokasi checkout kawanku-harness (branch feature/kawanku-chat-agents). */
export const HARNESS_ROOT = process.env.KAWANKU_ENGINE_HARNESS_ROOT ?? "";

/** Root direktori home per tenant (di bawahnya: <userId>/). */
export const ENGINE_HOME_ROOT = process.env.KAWANKU_ENGINE_HOME_ROOT ?? "";

/** Direktori kerja per tenant: file customer hanya berada di sini. */
export const ENGINE_WORKSPACE_ROOT = process.env.KAWANKU_ENGINE_WORKSPACE_ROOT ?? "";

/** Model default engine (route pi-ai, mis. tg/glm-5.3). */
export const ENGINE_MODEL = process.env.KAWANKU_ENGINE_MODEL ?? "tg/glm-5.3";

/** Node 24 path; harness butuh >=24.9 sedangkan host Next.js bisa versi lain. */
const NODE_BIN = process.env.KAWANKU_ENGINE_NODE_BIN ?? "";

const CREDENTIALS_FILENAME = ".credentials.yaml";

/** Apakah engine aktif untuk deployment ini. */
export function engineEnabled(): boolean {
  return HARNESS_ROOT !== "" && ENGINE_HOME_ROOT !== "" && ENGINE_WORKSPACE_ROOT !== "";
}

/** Susun env child engine: home tenant, workspace tenant, dan kredensial gateway. */
function engineEnv(apiKey: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // pi-ai resolves `apiKeyEnv` through the launch environment, so the key
    // must be present here; the tenant credentials file is only a fallback
    // for interactive runs and is not consulted by this profile.
    KAWANKU_GATEWAY_KEY: apiKey,
    NINEROUTER_API_KEY: apiKey,
  };
}

/** Pastikan home tenant berisi overlay + kredensial; idempotent. Selalu refresh refs agar key terbaru dipakai.
 * @param baseUrl - base URL gateway milik koneksi aktif user.
 * @param model - model id yang diminta.
 */
export async function ensureTenantHome(userId: string, apiKey: string, baseUrl: string, model: string): Promise<string> {
  const home = join(ENGINE_HOME_ROOT, userId);
  await mkdir(home, { recursive: true, mode: 0o700 });
  await mkdir(join(ENGINE_WORKSPACE_ROOT, userId), { recursive: true, mode: 0o700 });
  const cred = join(home, CREDENTIALS_FILENAME);
  // Selalu tulis ulang refs agar key dari Connection DB (yang sudah didekripsi caller) yang dipakai.
  const { writeFile, chmod } = await import("node:fs/promises");
  await writeFile(cred, `refs:\n  NINEROUTER_API_KEY: ${apiKey}\n  KAWANKU_GATEWAY_KEY: ${apiKey}\nversion: 1\n`, { mode: 0o600 });
  await chmod(cred, 0o600);
  const overlay = join(home, "cordis.patch.yml");
  // Overlay selalu ditulis ulang agar baseUrl/model mengikuti koneksi aktif user.
  await writeFile(overlay, buildEngineOverlay(baseUrl, model), { mode: 0o600 });
  return home;
}

/** Susun overlay tenant: pi-ai provider memakai baseUrl + model dari koneksi aktif user. */
function buildEngineOverlay(baseUrl: string, model: string): string {
  // Model id di Kawan kadang memakai prefix route (`tg/glm-5.3`), sedangkan
  // gateway publik memakai id polos (`glm-5.3`): strip prefix `xx/` bila ada.
  const plainModel = model.includes("/") ? (model.split("/").pop() ?? model) : model;
  const thinking = plainModel.startsWith("glm") ? "zai" : "deepseek";
  return `# Kawanku engine tenant overlay: model via gateway koneksi aktif user.
- id: llm-pi-ai
  config:
    providers:
      kawanku:
        displayName: Kawanku
        apiKeyEnv: KAWANKU_GATEWAY_KEY
        api: openai-completions
        baseURL: ${baseUrl}
        compat:
          thinkingFormat: ${thinking}
        models:
          - id: '${plainModel}'
            name: ${plainModel}
            contextWindow: 1000000
            maxTokens: 128000
            compat:
              thinkingFormat: ${thinking}

- id: agent-default-model
  config:
    provider: kawanku
    model: ${plainModel}
`;
}


/** Satu event NDJSON harness. */
type EngineEvent =
  | { type: "session"; sessionId: string; cwd: string }
  | { type: "status"; phase: string; turn?: number; step?: number; usage?: EngineUsage; reason?: unknown }
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_call"; callId: string; tool: string; input: unknown }
  | { type: "tool_result"; callId: string; status: string; result: string; error?: unknown }
  | { type: "final"; sessionId: string; reason: { kind: string }; text: string };

type EngineUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

/** Opsi satu run engine. */
export type EngineRunInput = {
  userId: string;
  /** Session harness untuk resume; kosong = session baru. */
  sessionId: string | null;
  /** Prompt user final (sudah termasuk konteks dari caller bila perlu). */
  task: string;
  /** Kredensial gateway yang aktif (didekripsi dari koneksi user). */
  apiKey: string;
  /** Base URL gateway yang aktif (milik koneksi user: 9Router lokal atau publik). */
  baseUrl: string;
  /** Model id yang diminta (mis. tg/glm-5.3). */
  model: string;
  signal: AbortSignal;
  shouldStop: () => Promise<boolean>;
  onDelta: (delta: { kind: string; text?: string; usage?: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null }; finishReason?: string | null }) => Promise<void>;
};

/** Hasil satu run engine. */
export type EngineRunResult = {
  sessionId: string;
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null;
  finishReason: string | null;
};

/**
 * Jalankan satu turn engine harness dan stream potongan teksnya.
 * Meniru kontrak `streamGateway`: onDelta text/usage/done, galat dibungkus
 * Error biasa agar pemanggil memetakannya seperti kegagalan transport.
 */
export async function runEngine(input: EngineRunInput): Promise<EngineRunResult> {
  const home = await ensureTenantHome(input.userId, input.apiKey, input.baseUrl, input.model);
  const args = [
    "--import", "tsx/esm",
    resolve(HARNESS_ROOT, "apps/cli/src/bin.ts"),
    "--profile", "headless",
    "--json",
  ];
  if (input.sessionId) args.push("--session-id", input.sessionId);
  args.push(input.task);

  const node = NODE_BIN || process.execPath;
  const child = spawn(node, args, {
    cwd: HARNESS_ROOT,
    env: {
      ...engineEnv(input.apiKey),
      DSH_HOME: home,
      KAWANKU_WORKSPACE: join(ENGINE_WORKSPACE_ROOT, input.userId),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let sessionId = input.sessionId ?? "";
  let usage: EngineRunResult["usage"] = null;
  let finishReason: string | null = null;
  let sawFinal = false;

  const kill = () => { child.kill("SIGTERM"); };
  input.signal.addEventListener("abort", kill, { once: true });

  const onLine = async (line: string) => {
    if (line.trim() === "") return;
    let event: EngineEvent;
    try {
      event = JSON.parse(line) as EngineEvent;
    } catch {
      return; // baris non-JSON diabaikan, sama seperti parser SSE lama.
    }
    switch (event.type) {
      case "session":
        sessionId = event.sessionId;
        return;
      case "text":
        await input.onDelta({ kind: "text", text: event.text });
        return;
      case "status":
        if (event.phase === "step_end" && event.usage) {
          usage = {
            promptTokens: event.usage.inputTokens ?? null,
            completionTokens: event.usage.outputTokens ?? null,
            totalTokens: event.usage.totalTokens ?? null,
          };
        }
        return;
      case "final":
        sawFinal = true;
        finishReason = event.reason?.kind === "completed" ? "stop" : (event.reason?.kind ?? "stop");
        if (usage === null) usage = { promptTokens: null, completionTokens: null, totalTokens: null };
        await input.onDelta({ kind: "done", usage: usage ?? undefined, finishReason });
        return;
      default:
        return;
    }
  };

  let buffer = "";
  let stderrTail = "";
  const stdoutClosed = new Promise<void>((resolve) => {
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        void onLine(line).catch(() => {});
      }
    });
    child.stdout.on("end", resolve);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString("utf8")).slice(-4000);
  });

  const exit = new Promise<number>((resolve) => {
    child.on("exit", (code) => { resolve(code ?? 0); });
    child.on("error", () => { resolve(1); });
  });

  // Stop pengguna: putus engine segera, bukan menunggu turn selesai.
  const stopPoll = setInterval(() => {
    void input.shouldStop().then((stop) => { if (stop) kill(); }, () => {});
  }, 1000);

  const code = await exit;
  clearInterval(stopPoll);
  await stdoutClosed;
  input.signal.removeEventListener("abort", kill);

  if (code !== 0 && !sawFinal) {
    const detail = stderrTail.split("\n").filter((l) => l.startsWith("dsh:")).slice(-1)[0] ?? stderrTail.slice(-200);
    throw new Error(`ENGINE_EXIT_${String(code)}: ${detail}`);
  }
  if (!sawFinal) {
    // Proses selesai tanpa final (mis. dibunuh stop): tutup stream dengan done.
    await input.onDelta({ kind: "done", usage: usage ?? undefined, finishReason: "stop" });
  }
  return { sessionId, usage, finishReason };
}

/** ID run unik untuk logging. */
export function newRunId(): string {
  return randomUUID();
}

/** Bentuk ringkas pesan OpenAI untuk render task. */
type TaskMessage = { role: string; content: unknown };

/**
 * Render pesan chat (format OpenAI) menjadi satu task teks untuk engine.
 * System prompt di depan; history diberi label pembicara; pesan terakhir user
 * dibiarkan telanjang agar jawaban langsung menanggapinya.
 */
export function renderEngineTask(messages: readonly TaskMessage[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    const text = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content
            .map((block) => (block && typeof block === "object" && "text" in block && typeof (block as { text?: unknown }).text === "string"
              ? (block as { text: string }).text
              : ""))
            .filter((s) => s !== "")
            .join("\n")
        : "";
    if (message.role === "system") {
      parts.push(`# Instruksi sistem\n${text}`);
    } else if (message.role === "user") {
      parts.push(`# Pengguna\n${text}`);
    } else if (message.role === "assistant") {
      parts.push(`# Jawaban sebelumnya\n${text}`);
    } else if (message.role === "tool") {
      parts.push(`# Hasil alat\n${text}`);
    }
  }
  return parts.join("\n\n");
}
