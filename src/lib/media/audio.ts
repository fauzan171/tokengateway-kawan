/**
 * STT dan TTS (WP-NT-P8-03/04, REQ-NT-67/68).
 *
 * Keduanya hanya berjalan bila modelnya ada di env; route kapabilitas yang
 * memutuskan tombolnya dirender. Tidak ada cache atau penyimpanan audio:
 * berkas masuk diteruskan, hasil dikembalikan, selesai.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import { assertOutboundAllowed, DEFAULT_OUTBOUND_OPTIONS, type OutboundPolicyOptions } from "@/lib/net";
import { readMediaConfig } from "./config";

const TIMEOUT_MS = 120_000;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/** Batas satu permintaan TTS. */
const MAX_SPEECH_CHARS = 4000;

function upstreamError(retryable = false): ApiError {
  return new ApiError({
    status: STATUS.BAD_GATEWAY,
    code: "MEDIA_UPSTREAM",
    message: "Gateway media tidak dapat dihubungi.",
    retryable,
  });
}

function notConfigured(): ApiError {
  return new ApiError({
    status: STATUS.CONFLICT,
    code: "MEDIA_NOT_CONFIGURED",
    message: "Fitur media belum dikonfigurasi.",
  });
}

export async function transcribeAudio(input: {
  baseUrl: string;
  apiKey: string;
  model?: string;
  file: Blob;
  filename: string;
  outbound?: OutboundPolicyOptions;
}): Promise<{ text: string }> {
  if (input.file.size > MAX_AUDIO_BYTES) {
    throw new ApiError({
      status: STATUS.PAYLOAD_TOO_LARGE,
      code: "AUDIO_TOO_LARGE",
      message: "Berkas audio melebihi 25 MB.",
    });
  }

  const model = input.model?.trim() || readMediaConfig().stt?.model;
  if (!model) throw notConfigured();

  const url = `${input.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`;
  const target = await assertOutboundAllowed(url, input.outbound ?? DEFAULT_OUTBOUND_OPTIONS);

  const form = new FormData();
  form.append("file", input.file, input.filename);
  form.append("model", model);

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { authorization: `Bearer ${input.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw upstreamError(true);
  }

  if (!response.ok) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "TRANSCRIBE_FAILED",
      message: `Transkripsi gagal (${response.status}).`,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "TRANSCRIBE_EMPTY",
      message: "Tidak ada ucapan yang terdeteksi.",
    });
  }
  return { text };
}

export async function synthesizeSpeech(input: {
  baseUrl: string;
  apiKey: string;
  model?: string;
  voice?: string;
  text: string;
  outbound?: OutboundPolicyOptions;
}): Promise<{ mime: string; bytes: Uint8Array<ArrayBuffer> }> {
  const config = readMediaConfig().tts;
  const model = input.model?.trim() || config?.model;
  if (!model) throw notConfigured();

  const text = input.text.trim();
  if (!text) {
    throw new ApiError({
      status: STATUS.BAD_REQUEST,
      code: "INVALID_TEXT",
      message: "Teks yang dibacakan tidak boleh kosong.",
    });
  }
  // shortcut: potong 4000 karakter, pecah per kalimat bila perlu
  const clipped = text.slice(0, MAX_SPEECH_CHARS);

  const url = `${input.baseUrl.replace(/\/+$/, "")}/audio/speech`;
  const target = await assertOutboundAllowed(url, input.outbound ?? DEFAULT_OUTBOUND_OPTIONS);

  let response: Response;
  try {
    response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify({
        model,
        input: clipped,
        voice: input.voice?.trim() || config?.voice || "alloy",
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw upstreamError(true);
  }

  if (!response.ok) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "SPEECH_FAILED",
      message: `Pembacaan gagal (${response.status}).`,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  return { mime, bytes: new Uint8Array(await response.arrayBuffer()) };
}
