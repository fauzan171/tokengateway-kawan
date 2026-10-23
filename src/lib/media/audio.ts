/**
 * STT dan TTS (WP-NT-P8-03/04, REQ-NT-67/68; FIX-16).
 *
 * STT mengembalikan transkrip BESERTA timestamp per segmen bila gateway
 * menyediakannya. Bila gateway hanya mengirim teks, `segments` kosong — bukan
 * timestamp karangan. Diarization hanya memberi label `A`/`B`; identitas
 * pembicara TIDAK ditebak dari suara.
 *
 * TTS: pemanggil (klien) bertanggung jawab mencabut object URL setelah selesai
 * atau dibatalkan; fungsi di sini hanya mengembalikan byte audio.
 */

import { ApiError, STATUS } from "@/lib/api/errors";
import {
  assertOutboundAllowed,
  fetchOutbound,
  DEFAULT_OUTBOUND_OPTIONS,
  type OutboundPolicyOptions,
} from "@/lib/net";
import { readMediaConfig } from "./config";

const TIMEOUT_MS = 120_000;
/** Batas satu berkas audio; sama dengan batas unggah media. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
/** Batas satu permintaan TTS. */
const MAX_SPEECH_CHARS = 4000;
/** Batas jumlah segmen yang dikembalikan; sisanya dipotong dan dilaporkan. */
const MAX_SEGMENTS = 2000;

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

/** Satu potongan transkrip. `speaker` hanya label A/B, bukan identitas. */
export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: "A" | "B";
};

export type Transcript = {
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  durationSeconds?: number;
  /** true bila segmen dipotong karena melewati MAX_SEGMENTS. */
  truncated: boolean;
};

/**
 * Label pembicara deterministik: id apa pun dari provider dipetakan ke A, B, …
 * sesuai kemunculan pertama. Tidak ada pencocokan nama/identitas.
 */
export function labelSpeakers(
  rawIds: readonly (string | number | undefined | null)[],
): (string | undefined)[] {
  const labels = new Map<string, string>();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return rawIds.map((id) => {
    if (id === undefined || id === null || id === "") return undefined;
    const key = String(id);
    let label = labels.get(key);
    if (!label) {
      const index = labels.size;
      label = index < alphabet.length ? alphabet[index]! : `S${index + 1}`;
      labels.set(key, label);
    }
    return label;
  });
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Parse respons transkripsi; bentuk tak dikenal → segmen kosong, bukan lempar. */
export function parseTranscript(payload: unknown): Transcript {
  const record = (payload ?? {}) as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const rawSegments = Array.isArray(record.segments) ? record.segments : [];
  const parsed: Omit<TranscriptSegment, "speaker">[] = [];
  const rawSpeakers: (string | number | undefined)[] = [];
  for (const entry of rawSegments) {
    const segment = entry as Record<string, unknown>;
    const start = numberOrNull(segment.start);
    const end = numberOrNull(segment.end);
    const segmentText = typeof segment.text === "string" ? segment.text.trim() : "";
    if (start === null || end === null || !segmentText) continue;
    parsed.push({ start, end, text: segmentText });
    rawSpeakers.push(
      typeof segment.speaker === "string" || typeof segment.speaker === "number"
        ? segment.speaker
        : undefined,
    );
  }
  const labels = labelSpeakers(rawSpeakers);
  const truncated = parsed.length > MAX_SEGMENTS;
  const segments = parsed.slice(0, MAX_SEGMENTS).map((segment, index) => {
    const speaker = labels[index];
    return speaker ? { ...segment, speaker: speaker as "A" | "B" } : segment;
  });

  const duration = numberOrNull(record.duration);
  const language = typeof record.language === "string" ? record.language : undefined;
  return {
    text,
    segments,
    ...(language ? { language } : {}),
    ...(duration !== null ? { durationSeconds: duration } : {}),
    truncated,
  };
}

export async function transcribeAudio(input: {
  baseUrl: string;
  apiKey: string;
  model?: string;
  file: Blob;
  filename: string;
  outbound?: OutboundPolicyOptions;
}): Promise<Transcript> {
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
  // Timestamp diminta secara eksplisit; gateway yang menolak akan mengabaikan
  // atau menjawab tanpa segmen, dan itu dilaporkan sebagai segmen kosong.
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  let response: Response;
  try {
    response = await fetchOutbound(
      target,
      {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      input.outbound ?? DEFAULT_OUTBOUND_OPTIONS,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
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

  const payload = await response.json().catch(() => ({}));
  const transcript = parseTranscript(payload);
  if (!transcript.text && transcript.segments.length === 0) {
    throw new ApiError({
      status: STATUS.BAD_GATEWAY,
      code: "TRANSCRIBE_EMPTY",
      message: "Tidak ada ucapan yang terdeteksi.",
    });
  }
  if (!transcript.text) {
    transcript.text = transcript.segments.map((segment) => segment.text).join(" ");
  }
  return transcript;
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
    response = await fetchOutbound(
      target,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${input.apiKey}` },
        body: JSON.stringify({
          model,
          input: clipped,
          voice: input.voice?.trim() || config?.voice || "alloy",
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      input.outbound ?? DEFAULT_OUTBOUND_OPTIONS,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
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
