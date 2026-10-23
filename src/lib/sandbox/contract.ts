/**
 * Kontrak adapter sandbox (FIX-17, SDD-AG-5).
 *
 * Modul ini HANYA berisi tipe, batas, dan fungsi murni. Tidak ada kode yang
 * menjalankan apa pun: implementasi nyata ada di adapter (`e2b.ts`).
 *
 * Dua aturan yang dijaga di sini:
 *   1. Limit adalah angka desain yang harus ditegakkan provider. Bila provider
 *      tidak dapat menegakkannya, capability harus `unavailable` — bukan
 *      "jalan tapi tanpa batas".
 *   2. Aksi browser diklasifikasikan `read`/`write` secara konservatif. HTTP GET
 *      TIDAK otomatis read: form submit, upload, login, klik yang mengirim, dan
 *      GET berpola perubahan semuanya `write`. Yang tidak dapat diklasifikasi
 *      aman menjadi `write` — butuh approval, bukan lolos diam-diam.
 */

import { createHash } from "node:crypto";

/** Batas profil awal (SDD-AG-5). Nilai desain, bukan hasil benchmark. */
export const SANDBOX_LIMITS = {
  cpu: 1,
  memoryMiB: 1024,
  /** Workdir sementara di guest. */
  workdirMiB: 256,
  /** Satu perintah. */
  commandTimeoutMs: 60_000,
  /** Satu run. */
  runTimeoutMs: 15 * 60_000,
  stdoutBytes: 256 * 1024,
  stderrBytes: 256 * 1024,
  /** Output yang boleh dikumpulkan per run. */
  outputFiles: 10,
  outputBytes: 25 * 1024 * 1024,
} as const;

export type SandboxKind = "code" | "browser";
export type SandboxNetworkPolicy = "none" | "browser-proxy";

export type SandboxCreateInput = {
  runId: string;
  kind: SandboxKind;
  templateVersion: string;
  expiresAt: Date;
  networkPolicy: SandboxNetworkPolicy;
  memoryMiB: number;
  cpu: number;
};

export type SandboxExecInput = {
  sessionId: string;
  stepId: string;
  language: "python" | "javascript";
  code: string;
  timeoutMs: number;
};

export type SandboxExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  outputFiles: string[];
};

export type SandboxState = "running" | "paused" | "stopped" | "unknown";

/** Kontrak yang harus dipenuhi setiap adapter (SDD-AG-5). */
export interface SandboxRuntime {
  create(input: SandboxCreateInput, signal: AbortSignal): Promise<{ sessionId: string }>;
  execute(input: SandboxExecInput, signal: AbortSignal): Promise<SandboxExecResult>;
  putInput(sessionId: string, artifactId: string, bytes: Uint8Array): Promise<void>;
  collectOutput(sessionId: string, relativePath: string): Promise<Uint8Array>;
  stop(sessionId: string): Promise<{ confirmed: boolean }>;
  inspect(sessionId: string): Promise<{ state: SandboxState }>;
}

/** Kenapa sandbox tidak dapat dipakai; dipetakan ke `reasonCode` capability. */
export type SandboxUnavailableReason =
  | "SANDBOX_NOT_CONFIGURED"
  | "SANDBOX_TEMPLATE_MISSING"
  | "SANDBOX_PROVIDER_UNREACHABLE";

export class SandboxUnavailable extends Error {
  readonly reason: SandboxUnavailableReason;

  constructor(reason: SandboxUnavailableReason, message: string) {
    super(message);
    this.name = "SandboxUnavailable";
    this.reason = reason;
  }
}

/**
 * Pemangkasan keluaran proses ke batas byte. Memotong di tengah karakter UTF-8
 * akan menghasilkan teks rusak, jadi potongan diakhiri pada batas karakter.
 */
export function truncateOutput(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const total = Buffer.byteLength(text, "utf8");
  if (total <= maxBytes) return { text, truncated: false };
  const buffer = Buffer.from(text, "utf8");
  let end = maxBytes;
  // Mundur sampai awal karakter UTF-8 yang utuh: byte lanjutan berpola 10xxxxxx.
  while (end > 0 && (((buffer[end] as number) ?? 0) & 0xc0) === 0x80) end -= 1;
  // Byte terakhir yang muat bisa jadi awal karakter multi-byte yang terpotong.
  const lead = (buffer[end - 1] as number) ?? 0;
  const needed = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
  if (end - 1 + needed > maxBytes) end -= 1;
  return { text: buffer.subarray(0, end).toString("utf8"), truncated: true };
}

/** Path keluaran yang boleh diambil: relatif, di bawah `output/`, tanpa traversal. */
export function assertSafeOutputPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized.startsWith("output/")) {
    throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Hanya berkas di output/ yang dapat diambil.");
  }
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new SandboxUnavailable("SANDBOX_PROVIDER_UNREACHABLE", "Path keluaran tidak sah.");
  }
  return normalized;
}

export type BrowserActionClass = "read" | "write";

export type BrowserAction = {
  method: string;
  url: string;
  /** Body yang akan dikirim; keberadaannya sendiri menandakan tulis. */
  body?: string | null;
  /** Aksi UI yang memicu request (mis. `click`, `fill`, `submit`). */
  gesture?: string | null;
};

/** Pola URL yang lazim mengubah state meski memakai GET. */
// Tanpa garis miring di depan: harus cocok di path (`/delete`) maupun query
// (`?delete=1`). Keduanya sama-sama mengubah state.
const WRITE_URL_HINTS = [
  "delete", "remove", "create", "update", "edit", "save", "send",
  "publish", "share", "pay", "checkout", "purchase", "order",
  "logout", "signout", "revoke", "approve", "upload", "submit",
] as const;

/** Gesture yang pasti dapat memicu perubahan. */
const WRITE_GESTURES = new Set([
  "click", "submit", "fill", "type", "press", "select", "upload", "drag", "drop",
]);

/**
 * Klasifikasi konservatif: apa pun yang tidak jelas `read` dianggap `write`.
 * Dipakai untuk memutuskan apakah aksi perlu approval (FIX-20).
 */
export function classifyBrowserAction(action: BrowserAction): BrowserActionClass {
  const method = action.method.trim().toUpperCase();
  if (method !== "GET" && method !== "HEAD") return "write";
  if (action.body !== undefined && action.body !== null && action.body !== "") return "write";
  if (action.gesture && WRITE_GESTURES.has(action.gesture)) return "write";

  // Path DAN query diperiksa: `?delete=1` mengubah state meski pathname-nya biasa.
  let path = action.url;
  try {
    const parsed = new URL(action.url);
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    // URL relatif/tak lengkap: tetap diperiksa sebagai string.
  }
  if (WRITE_URL_HINTS.some((hint) => path.toLowerCase().includes(hint))) return "write";
  return "read";
}

/**
 * Digest approval: mengikat method + URL kanonik + body + origin + run/step.
 * Perubahan salah satu komponen menghasilkan digest berbeda, sehingga approval
 * lama tidak dapat dipakai untuk request yang sudah diubah.
 */
export function approvalDigest(input: {
  runId: string;
  stepId: string;
  method: string;
  url: string;
  body?: string | null;
  policyRevision: number;
}): string {
  let canonical = input.url;
  try {
    const parsed = new URL(input.url);
    parsed.hash = "";
    // Query diurutkan supaya urutan parameter tidak mengubah digest.
    parsed.searchParams.sort();
    canonical = parsed.toString();
  } catch {
    // URL relatif dipakai apa adanya; tetap terikat ke string yang dikirim.
  }
  const bodyHash = createHash("sha256")
    .update(input.body ?? "")
    .digest("hex");
  return createHash("sha256")
    .update(
      [
        input.runId,
        input.stepId,
        input.method.toUpperCase(),
        canonical,
        bodyHash,
        String(input.policyRevision),
      ].join("\n"),
    )
    .digest("hex");
}
