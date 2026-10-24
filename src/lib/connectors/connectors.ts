/**
 * Konektor kecil per-host (FIX-20): informasi yang boleh dikirim, dan yang tidak.
 *
 * Data di sini adalah KEPUTUSAN PRODUK, bukan hasil baca kode:
 *
 *   - token disimpan terenkripsi dengan AAD barisnya sendiri (`secretRowId`);
 *     mencuri ciphertext baris A tidak bisa dipakai di baris B;
 *   - token TIDAK PERNAH masuk model, sandbox, tool result, log, ekspor, atau
 *     snapshot; fungsi `send` hanya mengembalikan ringkasan;
 *   - hanya host + endpoint allowlist yang boleh dihubungi; URL lain ditolak
 *     SEBELUM ada request keluar.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import { FULLY_MASKED, decryptSecret, encryptSecret } from "@/lib/secrets";
import type { Db } from "@/lib/db";

/** Provider yang didukung pada tahap ini. */
export const CONNECTOR_PROVIDERS = ["google-drive", "notion"] as const;
export type ConnectorProvider = (typeof CONNECTOR_PROVIDERS)[number];

export function isConnectorProvider(value: unknown): value is ConnectorProvider {
  return (CONNECTOR_PROVIDERS as readonly string[]).includes(value as string);
}

/** Endpoint yang boleh dihubungi per provider (path, tanpa query). */
const ENDPOINT_ALLOWLIST: Record<ConnectorProvider, readonly string[]> = {
  "google-drive": ["/drive/v3/files"],
  notion: ["/v1/search", "/v1/pages"],
};

const API_BASE: Record<ConnectorProvider, string> = {
  "google-drive": "https://www.googleapis.com",
  notion: "https://api.notion.com",
};

/** Batas per operasi konektor. */
export const CONNECTOR_LIMITS = {
  timeoutMs: 30_000,
  maxResponseBytes: 1 * 1024 * 1024,
} as const;

/** Status konektor yang dikembalikan ke pemilik: token TIDAK ikut. */
export type ConnectorSummary = {
  id: string;
  provider: string;
  label: string;
  scopes: string[];
  /** Token hanya ditampilkan tersamar. */
  tokenHint: string;
  revokedAt: Date | null;
  updatedAt: Date;
};

function badRequest(code: string, message: string): ApiError {
  return new ApiError({ status: STATUS.BAD_REQUEST, code, message });
}

/** Kredensial dari baris DB; token dibuka hanya di memori proses ini. */
async function openToken(
  db: Db,
  input: { connectorId: string; userId: string; key: Buffer },
): Promise<{ rowId: string; provider: ConnectorProvider; token: string }> {
  const row = await db.connectorCredential.findFirst({
    where: { id: input.connectorId, userId: input.userId, revokedAt: null },
    select: { id: true, provider: true, tokenEncrypted: true },
  });
  if (!row || !isConnectorProvider(row.provider)) throw badRequest("CONNECTOR_NOT_FOUND", "Konektor tidak ditemukan.");
  let token: string;
  try {
    token = decryptSecret({
      envelope: row.tokenEncrypted,
      key: input.key,
      aad: { rowId: row.id, userId: input.userId, purpose: "connector.token" },
    });
  } catch {
    throw new ApiError({
      status: STATUS.INTERNAL,
      code: "CONNECTOR_KEY_UNREADABLE",
      message: "Kredensial konektor tidak dapat dibuka. Hubungkan ulang konektor ini.",
    });
  }
  return { rowId: row.id, provider: row.provider, token };
}

/** Simpan token baru (dipakai saat menghubungkan dan saat refresh). */
export async function saveConnectorToken(
  db: Db,
  input: {
    connectorId: string;
    userId: string;
    token: string;
    key: Buffer;
    keyId: string;
  },
): Promise<void> {
  const envelope = encryptSecret({
    plaintext: input.token,
    key: input.key,
    keyId: input.keyId,
    aad: { rowId: input.connectorId, userId: input.userId, purpose: "connector.token" },
  });
  await db.connectorCredential.updateMany({
    where: { id: input.connectorId, userId: input.userId },
    data: { tokenEncrypted: envelope },
  });
}

/** Cabut konektor: token tidak bisa dipakai lagi, dan penarikan dihentikan. */
export async function revokeConnector(
  db: Db,
  input: { connectorId: string; userId: string },
): Promise<void> {
  await db.connectorCredential.updateMany({
    where: { id: input.connectorId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Panggil endpoint konektor yang ada di allowlist. Mengembalikan ringkasan,
 * bukan respons mentah: data sensitif tidak mengalir ke log/tool result.
 */
export async function callConnector(
  db: Db,
  input: {
    connectorId: string;
    userId: string;
    key: Buffer;
    path: string;
    method?: "GET" | "POST";
    body?: unknown;
    outbound?: OutboundPolicyOptions;
  },
): Promise<{ status: number; summary: string; requestId: string | null }> {
  const { provider, token } = await openToken(db, input);

  const allowed = ENDPOINT_ALLOWLIST[provider];
  const pathOnly = input.path.split("?")[0] ?? "";
  if (!allowed.some((prefix) => pathOnly === prefix || pathOnly.startsWith(prefix + "/"))) {
    throw badRequest("CONNECTOR_ENDPOINT_FORBIDDEN", "Endpoint ini tidak diizinkan untuk konektor.");
  }

  const outbound = input.outbound ?? DEFAULT_OUTBOUND_OPTIONS;
  const url = `${API_BASE[provider]}${input.path}`;
  const target = await assertOutboundAllowed(url, outbound);

  let response: Response;
  try {
    response = await fetchOutbound(target, {
      method: input.method ?? "GET",
      headers: { authorization: `Bearer ${token}` },
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
      signal: AbortSignal.timeout(CONNECTOR_LIMITS.timeoutMs),
    }, outbound);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "CONNECTOR_UPSTREAM",
      message: "Penyedia konektor tidak dapat dihubungi.",
      retryable: true,
    });
  }

  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "CONNECTOR_FAILED",
      message: `Konektor gagal (${response.status}).`,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  // Batas respons supaya satu konektor tidak membanjiri memori.
  const text = await response.text();
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > CONNECTOR_LIMITS.maxResponseBytes) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "CONNECTOR_RESPONSE_TOO_LARGE",
      message: "Respons konektor melebihi 1 MB.",
    });
  }
  return {
    status: response.status,
    summary: `ok (${provider} ${pathOnly}, ${bytes} byte)`,
    requestId,
  };
}

/** Status konektor milik pengguna; token hanya tampil tersamar. */
export function toConnectorSummary(input: {
  id: string;
  provider: string;
  label: string;
  scopes: string[];
  token: string;
  revokedAt: Date | null;
  updatedAt: Date;
}): ConnectorSummary {
  return {
    id: input.id,
    provider: input.provider,
    label: input.label,
    scopes: input.scopes,
    // Token TIDAK diberi hint sebagian: potongan 4 karakter pertama/terakhir
    // tetap membocorkan informasi dan tidak berguna untuk pengguna.
    tokenHint: FULLY_MASKED,
    revokedAt: input.revokedAt,
    updatedAt: input.updatedAt,
  };
}
