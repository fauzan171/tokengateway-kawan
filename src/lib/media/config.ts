/**
 * Gerbang tunggal fitur media (WP-NT-P8-01/03/04, REQ-NT-65/67/68).
 *
 * Kehadiran env = fitur tersedia. Tidak ada kunci wajib baru dan fungsi ini
 * tidak pernah melempar: env yang kosong berarti fitur disembunyikan, bukan
 * galat saat start (SDD-8.5).
 *
 * Server-only. Nama model tidak pernah dikirim ke klien — route kapabilitas
 * hanya memetakannya jadi boolean.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import { loadConfig } from "@/lib/config/env";
import { getActiveConnection } from "@/lib/connections/connections";
import type { Db } from "@/lib/db";
import type { OutboundPolicyOptions } from "@/lib/net";
import { CONNECTION_API_KEY_PURPOSE, decryptSecret } from "@/lib/secrets";

export type MediaConfig = {
  image?: { model: string };
  stt?: { model: string };
  tts?: { model: string; voice?: string };
};

function readKey(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function readMediaConfig(
  env: Record<string, string | undefined> = process.env,
): MediaConfig {
  const image = readKey(env, "MEDIA_IMAGE_MODEL");
  const stt = readKey(env, "MEDIA_STT_MODEL");
  const tts = readKey(env, "MEDIA_TTS_MODEL");
  const voice = readKey(env, "MEDIA_TTS_VOICE");
  return {
    ...(image ? { image: { model: image } } : {}),
    ...(stt ? { stt: { model: stt } } : {}),
    ...(tts ? { tts: { model: tts, ...(voice ? { voice } : {}) } } : {}),
  };
}

/** Koneksi aktif pengguna, siap dipakai ketiga route media. Kunci hanya hidup
 *  di dalam proses ini; tidak ada bagian yang mengembalikannya ke klien. */
export type MediaTarget = {
  baseUrl: string;
  apiKey: string;
  outbound: OutboundPolicyOptions;
};

export async function resolveMediaTarget(db: Db, userId: string): Promise<MediaTarget> {
  const active = await getActiveConnection(db, userId);
  if (!active) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "NO_CONNECTION",
      message: "Belum ada koneksi aktif. Hubungkan gateway terlebih dahulu.",
    });
  }

  const config = loadConfig();
  const row = await db.connection.findFirst({
    where: { id: active.id, userId },
    select: { apiKeyEncrypted: true },
  });
  if (!row) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "NO_CONNECTION",
      message: "Belum ada koneksi aktif. Hubungkan gateway terlebih dahulu.",
    });
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret({
      envelope: row.apiKeyEncrypted,
      key: config.encryptionKey,
      aad: { rowId: active.id, userId, purpose: CONNECTION_API_KEY_PURPOSE },
    });
  } catch {
    // Pesan generik: tidak ada detail ciphertext yang boleh bocor (REQ-NT-07).
    throw new ApiError({
      status: STATUS.INTERNAL,
      code: "CONNECTION_KEY_UNREADABLE",
      message: "Kunci koneksi tidak dapat dibuka. Simpan ulang kunci API koneksi ini.",
    });
  }

  return {
    baseUrl: active.baseUrl,
    apiKey,
    outbound: { allowInsecureHttp: config.allowInsecureHttp, allowlist: config.outboundAllowlist },
  };
}
