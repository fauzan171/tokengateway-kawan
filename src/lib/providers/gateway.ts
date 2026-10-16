/**
 * Klien gateway provider: discovery daftar model (REQ-NT-02, REQ-NT-18,
 * SDD-3.3).
 *
 * Yang dilakukan modul ini hanya satu hal: memanggil `GET {baseUrl}/models`
 * lewat `fetchJson` yang sudah ada — TIDAK menulis klien HTTP baru — lalu
 * menerjemahkan balasannya menjadi `{ ok, models, reason, message }`.
 *
 * Dua aturan yang mudah dilanggar dan ditegakkan di sini:
 *
 * 1. **URL tidak pernah `.../v1/v1/models`.** Penyusunan URL memakai
 *    `buildModelsUrl` dari `src/lib/connections/url.ts`; `v1` tidak pernah
 *    ditambahkan maupun digandakan.
 * 2. **Tidak melempar pada balasan tak terduga.** Semua kegagalan — HTTP
 *    non-2xx, timeout, koneksi putus, body bukan JSON, bentuk tak dikenal —
 *    dikembalikan sebagai hasil `ok: false` dengan `reason` SDD-3.2, bukan
 *    exception. Hanya galat programmer (mis. `baseUrl` kosong) yang dilempar,
 *    dan itu pun lewat `ApiError` yang bentuknya sudah kontrak.
 *
 * Kapabilitas model (SDD-3.3, REQ-NT-21/69): modul ini **hanya** meneruskan
 * kapabilitas yang benar-benar diumumkan gateway. Tidak ada tebakan dari nama
 * model, dan field yang tidak diketahui DI-OMIT — bukan diisi `false` palsu.
 * Bila gateway tidak mengumumkan apa pun, `capabilities` tidak ada sama sekali
 * pada model itu.
 */

import { fetchJson } from "@/lib/api/http";
import { ApiError, STATUS } from "@/lib/api/errors";
import type { OutboundPolicyOptions } from "@/lib/net";
import { buildModelsUrl } from "@/lib/connections/url";
import {
  PROVIDER_MESSAGES,
  UNRECOGNIZED_BODY_MESSAGE,
  fromApiError,
  fromUpstreamStatus,
  type ProviderFailure,
  type ProviderReason,
} from "./errors";

/**
 * Kunci kapabilitas yang dikenali (SDD-3.3). Hanya kunci di daftar ini yang
 * diteruskan, dan hanya bila gateway benar-benar mengirim boolean `true`.
 * Kunci di luar daftar diabaikan supaya bentuk balasan gateway tidak bocor
 * mentah ke klien Kawan.
 */
const KNOWN_CAPABILITIES = ["vision", "tools", "imageGen", "audio"] as const;

export type ModelCapabilities = Partial<Record<(typeof KNOWN_CAPABILITIES)[number], boolean>>;

/** Satu model yang dikenali. Field opsional di-omit, bukan diisi nilai palsu. */
export type GatewayModel = {
  id: string;
  /** Nama tampilan bila gateway mengumumkannya. */
  label?: string;
  /** Hanya bila gateway mengumumkan setidaknya satu kapabilitas. */
  capabilities?: ModelCapabilities;
};

export type ListModelsInput = {
  baseUrl: string;
  apiKey: string;
  /**
   * Kebijakan keluar (SDD-5.3). Pemanggil yang punya akses `Config` mengisinya
   * dengan `allowInsecureHttp` dan `outboundAllowlist`; tanpa itu, `fetchJson`
   * memakai kebijakan paling ketat (hanya `https`, tanpa allowlist).
   */
  outbound?: OutboundPolicyOptions;
  /** Override batas waktu; bawaan `fetchJson` (15 detik, = `OUTBOUND_LIMITS`). */
  timeoutMs?: number;
  /** Sinyal pembatalan dari pemanggil (opsional). */
  signal?: AbortSignal;
};

export type ListModelsResult =
  | { ok: true; models: GatewayModel[]; reason: null; message: null }
  | {
      ok: false;
      models: [];
      reason: ProviderReason;
      message: string;
      /** Diteruskan dari pemetaan galat supaya route tidak menghitung ulang. */
      retryable: boolean;
    };

function failure(f: ProviderFailure): ListModelsResult {
  return { ok: false, models: [], reason: f.reason, message: f.message, retryable: f.retryable };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Mengambil daftar model mentah dari bentuk balasan yang umum.
 *
 * Baseline (OpenAI-compatible) memakai `{ data: [...] }`; sebagian gateway
 * memakai array langsung atau `{ models: [...] }`. Ketiganya diterima. Bentuk
 * lain TIDAK ditebak: `null` dikembalikan, dan pemanggil melaporkannya sebagai
 * `UPSTREAM_ERROR` dengan pesan jelas — bukan melempar.
 */
function extractModelEntries(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return null;
  if (Array.isArray(data["data"])) return data["data"];
  if (Array.isArray(data["models"])) return data["models"];
  return null;
}

/**
 * Memetakan satu entri model. Entri tanpa `id` string tidak dianggap model
 * (dilewati) — lebih baik jumlah model sedikit tetapi benar daripada memaksa
 * entri rusak masuk.
 */
function toModel(entry: unknown): GatewayModel | null {
  if (!isRecord(entry)) return null;

  const rawId = entry["id"] ?? entry["name"] ?? entry["model"];
  if (typeof rawId !== "string" || rawId.trim() === "") return null;
  const id = rawId.trim();

  const model: GatewayModel = { id };

  const rawLabel = entry["label"] ?? entry["display_name"] ?? entry["displayName"];
  if (typeof rawLabel === "string" && rawLabel.trim() !== "") {
    model.label = rawLabel.trim();
  }

  const capabilities = readCapabilities(entry);
  if (capabilities) model.capabilities = capabilities;

  return model;
}

/**
 * Membaca kapabilitas dari field yang mungkin dipakai gateway.
 *
 * Hanya nilai `true` yang diteruskan; `false` dan nilai tak dikenal di-omit
 * (SDD-3.3: "field yang tidak diketahui di-omit, bukan diisi `false` palsu").
 * Bila tak ada satu pun kunci dikenal, `undefined` dikembalikan supaya
 * `capabilities` hilang sepenuhnya dari model.
 */
function readCapabilities(entry: Record<string, unknown>): ModelCapabilities | undefined {
  const source = entry["capabilities"] ?? entry["capability"] ?? entry["metadata"];
  if (!isRecord(source)) return undefined;

  const capabilities: ModelCapabilities = {};
  let found = false;
  for (const key of KNOWN_CAPABILITIES) {
    if (source[key] === true) {
      capabilities[key] = true;
      found = true;
    }
  }
  return found ? capabilities : undefined;
}

/**
 * Mengambil daftar model dari gateway.
 *
 * Mengembalikan hasil alih-alih melempar; pemanggil (route handler) memutuskan
 * bentuk HTTP-nya lewat `toApiError`.
 */
export async function listModels(input: ListModelsInput): Promise<ListModelsResult> {
  const baseUrl = typeof input.baseUrl === "string" ? input.baseUrl.trim() : "";
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";

  // Galat programmer: baseUrl kosong tidak bisa disusun jadi URL. Ini bukan
  // keadaan gateway, jadi tetap dilempar (bukan `reason`).
  if (baseUrl === "") {
    throw new ApiError({
      status: STATUS.UNPROCESSABLE,
      code: "BAD_URL",
      message: "Base URL koneksi kosong.",
    });
  }

  const url = buildModelsUrl(baseUrl);
  const headers: Record<string, string> = { accept: "application/json" };
  // Kunci kosong tidak dikirim sebagai header kosong; sebagian gateway menolak
  // `Authorization` kosong dengan galat yang membingungkan.
  if (apiKey !== "") headers["authorization"] = `Bearer ${apiKey}`;

  let status: number;
  let data: unknown;
  try {
    const result = await fetchJson<unknown>(url, {
      method: "GET",
      headers,
      timeoutMs: input.timeoutMs,
      signal: input.signal,
      outbound: input.outbound,
    });
    status = result.status;
    data = result.data;
  } catch (err) {
    if (err instanceof ApiError) return failure(fromApiError(err));
    throw err;
  }

  if (status < 200 || status >= 300) return failure(fromUpstreamStatus(status));

  const entries = extractModelEntries(data);
  if (entries === null) {
    return failure({
      reason: "UPSTREAM_ERROR",
      message: UNRECOGNIZED_BODY_MESSAGE,
      retryable: false,
    });
  }

  const models: GatewayModel[] = [];
  for (const entry of entries) {
    const model = toModel(entry);
    if (model) models.push(model);
  }

  // Daftar kosong BUKAN sukses (SDD-3.2, REQ-NT-02): pengguna perlu tahu
  // gatewaynya tidak mengumumkan model, bukan melihat daftar kosong tanpa sebab.
  if (models.length === 0) {
    return failure({
      reason: "EMPTY_MODELS",
      message: PROVIDER_MESSAGES.EMPTY_MODELS,
      retryable: false,
    });
  }

  return { ok: true, models, reason: null, message: null };
}
