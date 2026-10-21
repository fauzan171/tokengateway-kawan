/**
 * Kemampuan server yang boleh diketahui klien (WP-NT-P7-01, REQ-NT-51).
 *
 * `GET /api/kawan/v1/capabilities`
 *
 * Bentuk respons ADDITIF (audit G01): boolean lama tetap ada, dan objek
 * `capabilities` memberi alasan per kemampuan. Tidak ada kemampuan yang
 * ditandai tersedia hanya karena env terisi. Bukti yang dipakai hanya dua:
 * koneksi aktif milik pengguna, dan kapabilitas yang DIUMUMKAN gateway pada
 * cache daftar model. Belum diprobe → `unknown`, bukan `false`.
 *
 * Base URL, kunci, nama model, dan IP tidak pernah ikut.
 */

import { requestId } from "@/lib/api/errors";
import { loadConfig } from "@/lib/config/env";
import { getActiveConnection } from "@/lib/connections/connections";
import { getCachedModels } from "@/lib/connections/model-cache";
import { readMediaConfig } from "@/lib/media/config";
import { handleRouteError, jsonOk, requireContext } from "@/lib/api/route";
import { readWebSearchConfig } from "@/lib/search/web";

export const runtime = "nodejs";

const ROUTE = "/api/kawan/v1/capabilities";

export type CapabilityState =
  | "available"
  | "unconfigured"
  | "unsupported"
  | "temporarily_unavailable"
  | "permission_required"
  | "unknown";

export type CapabilityEntry = {
  state: CapabilityState;
  reasonCode: string;
  checkedAt: string;
  requiresApproval: boolean;
};

type CapabilityName =
  | "chat"
  | "vision"
  | "tools"
  | "imageGen"
  | "stt"
  | "tts"
  | "webSearch";

const ENTRY_NAMES: readonly CapabilityName[] = [
  "chat",
  "vision",
  "tools",
  "imageGen",
  "stt",
  "tts",
  "webSearch",
];

/** `tools` menjalankan aksi atas nama pengguna, jadi butuh persetujuan dulu. */
const APPROVAL_REQUIRED: ReadonlySet<CapabilityName> = new Set<CapabilityName>(["tools"]);

function entry(
  name: CapabilityName,
  state: CapabilityState,
  reasonCode: string,
  checkedAt: string,
): CapabilityEntry {
  return { state, reasonCode, checkedAt, requiresApproval: APPROVAL_REQUIRED.has(name) };
}

/** State kapabilitas model dari bukti gateway; `null` = belum pernah diprobe. */
function modelCapability(
  name: CapabilityName,
  announced: boolean | null,
  hasConnection: boolean,
  checkedAt: string,
): CapabilityEntry {
  if (!hasConnection) return entry(name, "unconfigured", "NO_CONNECTION", checkedAt);
  if (announced === null) return entry(name, "unknown", "CAPABILITY_NOT_PROBED", checkedAt);
  if (announced) return entry(name, "available", "GATEWAY_ANNOUNCED", checkedAt);
  return entry(name, "unsupported", "GATEWAY_NOT_ANNOUNCED", checkedAt);
}

export async function GET(request: Request): Promise<Response> {
  const started = Date.now();
  const reqId = requestId(request);

  try {
    const { userId, db } = await requireContext();
    const config = loadConfig();
    const now = new Date();
    const checkedAt = now.toISOString();

    const active = await getActiveConnection(db, userId);
    const cached = active
      ? await getCachedModels(db, {
          connectionId: active.id,
          ttlSeconds: config.modelCacheTtlSeconds,
          now,
        })
      : null;

    const announced = (key: "vision" | "tools" | "imageGen" | "audio"): boolean | null => {
      if (!cached) return null;
      return cached.models.some((model) => model.capabilities?.[key] === true);
    };

    const media = readMediaConfig();
    const hasConnection = active !== null;

    const capabilities: Record<CapabilityName, CapabilityEntry> = {
      chat: modelCapability("chat", cached ? cached.models.length > 0 : null, hasConnection, checkedAt),
      vision: modelCapability("vision", announced("vision"), hasConnection, checkedAt),
      tools: modelCapability("tools", announced("tools"), hasConnection, checkedAt),
      imageGen: modelCapability("imageGen", announced("imageGen"), hasConnection, checkedAt),
      // STT/TTS butuh penyedia media yang dikonfigurasi DAN dukungan gateway.
      stt: media.stt
        ? modelCapability("stt", announced("audio"), hasConnection, checkedAt)
        : entry("stt", "unconfigured", "MEDIA_NOT_CONFIGURED", checkedAt),
      tts: media.tts
        ? modelCapability("tts", announced("audio"), hasConnection, checkedAt)
        : entry("tts", "unconfigured", "MEDIA_NOT_CONFIGURED", checkedAt),
      webSearch: readWebSearchConfig()
        ? entry("webSearch", "available", "SEARCH_CONFIGURED", checkedAt)
        : entry("webSearch", "unconfigured", "SEARCH_NOT_CONFIGURED", checkedAt),
    };

    // Boolean lama dipertahankan, diturunkan dari state — bukan ditebak ulang.
    const legacy = Object.fromEntries(
      ENTRY_NAMES.map((name) => [name, capabilities[name].state === "available"]),
    );

    return jsonOk({ ...legacy, schemaVersion: 1, capabilities }, reqId);
  } catch (err) {
    return handleRouteError(err, reqId, ROUTE, started);
  }
}
