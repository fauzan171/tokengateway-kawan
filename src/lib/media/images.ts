/**
 * Pembuatan gambar (WP-NT-P8-01, REQ-NT-65; FIX-16).
 *
 * Tanpa `MEDIA_IMAGE_MODEL` fitur ini tidak pernah dipanggil: tombolnya tidak
 * dirender (lihat `GET /capabilities`). Pemeriksaan konfigurasi di sini hanya
 * lapis kedua supaya pemanggil yang salah tidak menembak endpoint kosong.
 *
 * FIX-16 mengubah bentuk hasil: byte mentah, BUKAN data URL. Pemanggil (route)
 * menyimpannya sebagai artefak, sehingga riwayat percakapan tidak menampung
 * base64 besar yang menetap selamanya.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import { readMediaConfig } from "./config";

export type ImageRequest = {
  baseUrl: string;
  apiKey: string;
  /** Kosong/absen → diambil dari `MEDIA_IMAGE_MODEL`. */
  model?: string;
  prompt: string;
  size?: string;
  outbound?: OutboundPolicyOptions;
};

/** Byte gambar apa adanya; jenisnya ditentukan dari magic bytes, bukan header. */
export type GeneratedImage = { mime: string; bytes: Uint8Array };

const TIMEOUT_MS = 120_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type ImageResponse = {
  data?: { b64_json?: unknown; url?: unknown }[];
  error?: { message?: unknown };
};

function upstreamMessage(payload: ImageResponse): string {
  const message = payload.error?.message;
  return typeof message === "string" && message.trim() ? message.trim() : "Gagal membuat gambar.";
}

/** Jenis gambar dari magic bytes. Header gateway tidak dipercaya (FIX-16). */
export function imageMimeFromBytes(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return "application/octet-stream";
}

async function postGeneration(input: ImageRequest, model: string, prompt: string): Promise<ImageResponse> {
  const url = `${input.baseUrl.replace(/\/+$/, "")}/images/generations`;
  const target = await assertOutboundAllowed(url, input.outbound ?? DEFAULT_OUTBOUND_OPTIONS);

  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
        body: JSON.stringify({
          model,
          prompt,
          size: input.size ?? "1024x1024",
          response_format: "b64_json",
          n: 1,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      input.outbound ?? DEFAULT_OUTBOUND_OPTIONS,
    );
  } catch (err) {
    // Redirect ditolak kebijakan: kode BAD_URL lebih tepat daripada gangguan.
    if (err instanceof ApiError) throw err;
    // Detail galat jaringan tidak diteruskan: bisa memuat alamat internal.
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "MEDIA_UPSTREAM",
      message: "Gateway media tidak dapat dihubungi.",
      retryable: true,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as ImageResponse;
  if (!response.ok) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_FAILED",
      message: upstreamMessage(payload),
      retryable: response.status === 429 || response.status >= 500,
    });
  }
  return payload;
}

/** Batas ukuran diperiksa SETELAH byte lengkap; gateway bisa berbohong di header. */
function checked(bytes: Uint8Array): GeneratedImage {
  if (bytes.length === 0) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_FAILED",
      message: "Gateway mengembalikan gambar kosong.",
    });
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_TOO_LARGE",
      message: "Gambar hasil melebihi 8 MB.",
    });
  }
  const mime = imageMimeFromBytes(bytes);
  if (mime === "application/octet-stream") {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_FORMAT_UNSUPPORTED",
      message: "Gateway mengembalikan format gambar yang tidak dikenal.",
    });
  }
  return { mime, bytes };
}

async function downloadImage(
  rawUrl: string,
  outbound: OutboundPolicyOptions,
): Promise<GeneratedImage> {
  const target = await assertOutboundAllowed(rawUrl, outbound);
  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
      outbound,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "MEDIA_UPSTREAM",
      message: "Gateway media tidak dapat dihubungi.",
      retryable: true,
    });
  }
  if (!response.ok) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_FAILED",
      message: "Gagal mengunduh gambar hasil.",
      retryable: response.status >= 500,
    });
  }
  return checked(new Uint8Array(await response.arrayBuffer()));
}

export async function generateImage(input: ImageRequest): Promise<GeneratedImage> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_PROMPT",
      message: "Prompt gambar tidak boleh kosong.",
    });
  }

  const model = input.model?.trim() || readMediaConfig().image?.model;
  if (!model) {
    throw new ApiError({
      status: STATUS.CONFLICT,
      code: "MEDIA_NOT_CONFIGURED",
      message: "Pembuatan gambar belum dikonfigurasi.",
    });
  }

  const payload = await postGeneration(input, model, prompt);
  const first = payload.data?.[0];

  if (typeof first?.b64_json === "string" && first.b64_json) {
    return checked(new Uint8Array(Buffer.from(first.b64_json, "base64")));
  }
  if (typeof first?.url === "string" && first.url) {
    return downloadImage(first.url, input.outbound ?? DEFAULT_OUTBOUND_OPTIONS);
  }
  throw new ApiError({
    status: STATUS.BAD_GATEWAY,
    code: "IMAGE_FAILED",
    message: "Gateway tidak mengembalikan gambar.",
  });
}
