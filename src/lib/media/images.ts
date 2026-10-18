/**
 * Pembuatan gambar (WP-NT-P8-01, REQ-NT-65).
 *
 * Tanpa `MEDIA_IMAGE_MODEL` fitur ini tidak pernah dipanggil: tombolnya tidak
 * dirender (lihat `GET /capabilities`). Pemeriksaan konfigurasi di sini hanya
 * lapis kedua supaya pemanggil yang salah tidak menembak endpoint kosong.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import { assertOutboundAllowed, DEFAULT_OUTBOUND_OPTIONS, type OutboundPolicyOptions } from "@/lib/net";
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

export type GeneratedImage = { mime: string; dataUrl: string };

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

async function postGeneration(input: ImageRequest, model: string, prompt: string): Promise<ImageResponse> {
  const url = `${input.baseUrl.replace(/\/+$/, "")}/images/generations`;
  const target = await assertOutboundAllowed(url, input.outbound ?? DEFAULT_OUTBOUND_OPTIONS);

  let response: Response;
  try {
    response = await fetch(target, {
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
    });
  } catch {
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

async function downloadImage(
  rawUrl: string,
  outbound: OutboundPolicyOptions,
): Promise<GeneratedImage> {
  const target = await assertOutboundAllowed(rawUrl, outbound);
  let response: Response;
  try {
    response = await fetch(target, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
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

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "IMAGE_TOO_LARGE",
      message: "Gambar hasil melebihi 8 MB.",
    });
  }
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  return { mime, dataUrl: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
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
    return { mime: "image/png", dataUrl: `data:image/png;base64,${first.b64_json}` };
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
