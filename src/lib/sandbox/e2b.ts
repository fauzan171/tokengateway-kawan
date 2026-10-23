/**
 * Adapter sandbox E2B (FIX-17, SDD-AG-5).
 *
 * Kehadiran `E2B_API_KEY` TIDAK membuat sandbox dianggap tersedia. Yang
 * menentukan adalah probe: kunci ada, template terpasang, dan provider dapat
 * dihubungi. Selama salah satu belum terbukti, `getSandboxRuntime()`
 * mengembalikan `SandboxUnavailable` — bukan adapter yang "mungkin jalan".
 *
 * Semua panggilan HTTP lewat kebijakan egress FIX-07 (`fetchOutbound`), jadi
 * redirect ke alamat privat dan DNS rebinding tetap ditolak.
 *
 * Status stop yang tidak pasti TIDAK pernah dilaporkan `confirmed: true`:
 * itu yang membedakan "sudah dimatikan" dari "mungkin sudah dimatikan".
 */

import { ApiError } from "@/lib/api/errors";
import { assertOutboundAllowed, fetchOutbound, DEFAULT_OUTBOUND_OPTIONS } from "@/lib/net";
import {
  SANDBOX_LIMITS,
  SandboxUnavailable,
  truncateOutput,
  type SandboxCreateInput,
  type SandboxExecInput,
  type SandboxExecResult,
  type SandboxRuntime,
  type SandboxState,
} from "./contract";

const E2B_API = "https://api.e2b.dev";
const TIMEOUT_MS = 30_000;

export type SandboxConfig = {
  apiKey: string;
  templateCode: string;
  templateBrowser: string;
};

/** Konfigurasi dari env; `null` bila belum lengkap (bukan galat start). */
export function readSandboxConfig(
  env: Record<string, string | undefined> = process.env,
): SandboxConfig | null {
  const apiKey = env["E2B_API_KEY"]?.trim();
  if (!apiKey) return null;
  const templateCode = env["E2B_TEMPLATE_CODE"]?.trim();
  const templateBrowser = env["E2B_TEMPLATE_BROWSER"]?.trim();
  if (!templateCode || !templateBrowser) return null;
  return { apiKey, templateCode, templateBrowser };
}

function unavailable(reason: "SANDBOX_NOT_CONFIGURED" | "SANDBOX_TEMPLATE_MISSING", message: string) {
  return new SandboxUnavailable(reason, message);
}

async function call(
  config: SandboxConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const url = `${E2B_API}${path}`;
  const target = await assertOutboundAllowed(url, DEFAULT_OUTBOUND_OPTIONS);
  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      DEFAULT_OUTBOUND_OPTIONS,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new SandboxUnavailable(
      "SANDBOX_PROVIDER_UNREACHABLE",
      "Penyedia sandbox tidak dapat dihubungi.",
    );
  }
  if (!response.ok) {
    throw new SandboxUnavailable(
      "SANDBOX_PROVIDER_UNREACHABLE",
      `Penyedia sandbox menolak permintaan (${response.status}).`,
    );
  }
  return response.json().catch(() => ({}));
}

/** Adapter E2B. Hanya dibuat lewat `createSandboxRuntime` setelah config lengkap. */
class E2bSandboxRuntime implements SandboxRuntime {
  readonly #config: SandboxConfig;

  constructor(config: SandboxConfig) {
    this.#config = config;
  }

  async create(input: SandboxCreateInput, signal: AbortSignal): Promise<{ sessionId: string }> {
    if (signal.aborted) throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Dibatalkan.");
    // Kode selalu network-off; browser lewat proxy terkontrol.
    const payload = {
      templateID: input.kind === "code" ? this.#config.templateCode : this.#config.templateBrowser,
      metadata: { runId: input.runId, kind: input.kind },
      envVars: {},
      timeout: Math.min(
        Math.max(0, input.expiresAt.getTime() - Date.now()),
        SANDBOX_LIMITS.runTimeoutMs,
      ) / 1000,
    };
    const body = (await call(this.#config, "/sandboxes", {
      method: "POST",
      body: JSON.stringify(payload),
    })) as { sandboxID?: unknown };
    if (typeof body.sandboxID !== "string" || !body.sandboxID) {
      throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Penyedia tidak memberi id sandbox.");
    }
    return { sessionId: body.sandboxID };
  }

  async execute(input: SandboxExecInput, signal: AbortSignal): Promise<SandboxExecResult> {
    if (signal.aborted) throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Dibatalkan.");
    const timeoutMs = Math.min(input.timeoutMs, SANDBOX_LIMITS.commandTimeoutMs);
    const body = (await call(
      this.#config,
      `/sandboxes/${encodeURIComponent(input.sessionId)}/commands`,
      {
        method: "POST",
        body: JSON.stringify({
          cmd: input.language === "python" ? "python3" : "node",
          args: ["-c", input.code],
          timeout: Math.ceil(timeoutMs / 1000),
          // Tidak ada env tambahan: guest tidak menerima kunci apa pun.
          envs: {},
        }),
      },
    )) as { exitCode?: unknown; stdout?: unknown; stderr?: unknown };

    const stdout = truncateOutput(
      typeof body.stdout === "string" ? body.stdout : "",
      SANDBOX_LIMITS.stdoutBytes,
    );
    const stderr = truncateOutput(
      typeof body.stderr === "string" ? body.stderr : "",
      SANDBOX_LIMITS.stderrBytes,
    );
    return {
      exitCode: typeof body.exitCode === "number" ? body.exitCode : null,
      stdout: stdout.text,
      stderr: stderr.text,
      outputFiles: [],
    };
  }

  async putInput(sessionId: string, artifactId: string, bytes: Uint8Array): Promise<void> {
    // Id opaque: nama berkas di guest tidak berasal dari input pengguna.
    await call(this.#config, `/sandboxes/${encodeURIComponent(sessionId)}/files`, {
      method: "POST",
      body: JSON.stringify({
        path: `/workspace/input/${artifactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
        content: Buffer.from(bytes).toString("base64"),
      }),
    });
  }

  async collectOutput(sessionId: string, relativePath: string): Promise<Uint8Array> {
    const body = (await call(
      this.#config,
      `/sandboxes/${encodeURIComponent(sessionId)}/files?path=${encodeURIComponent(relativePath)}`,
      { method: "GET" },
    )) as { content?: unknown };
    if (typeof body.content !== "string") {
      throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Berkas keluaran tidak tersedia.");
    }
    return new Uint8Array(Buffer.from(body.content, "base64"));
  }

  async stop(sessionId: string): Promise<{ confirmed: boolean }> {
    try {
      await call(this.#config, `/sandboxes/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    } catch {
      // Gagal menghubungi provider saat stop = status TIDAK pasti.
      return { confirmed: false };
    }
    // Provider menerima permintaan belum berarti seluruh proses mati; periksa.
    try {
      const state = await this.inspect(sessionId);
      return { confirmed: state.state === "stopped" };
    } catch {
      return { confirmed: false };
    }
  }

  async inspect(sessionId: string): Promise<{ state: SandboxState }> {
    const body = (await call(
      this.#config,
      `/sandboxes/${encodeURIComponent(sessionId)}`,
      { method: "GET" },
    )) as { state?: unknown };
    const state = body.state;
    if (state === "running" || state === "paused" || state === "stopped") return { state };
    return { state: "unknown" };
  }
}

/**
 * Runtime siap pakai, atau `SandboxUnavailable` yang menjelaskan alasannya.
 * Tidak ada fallback diam-diam ke eksekusi di proses web.
 */
export function createSandboxRuntime(config: SandboxConfig | null = readSandboxConfig()): SandboxRuntime {
  if (!config) {
    throw unavailable(
      "SANDBOX_NOT_CONFIGURED",
      "Sandbox belum dikonfigurasi (E2B_API_KEY dan template belum diisi).",
    );
  }
  return new E2bSandboxRuntime(config);
}
