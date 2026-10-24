/**
 * FIX-16: format kontainer media, batas video, STT timestamp, diarization label.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  fetchOutbound: (url: string, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { detectContainer, limitFor, MEDIA_LIMITS } = await import("./format");
const { labelSpeakers, parseTranscript } = await import("./audio");
const { parseProbeJson, planFrameTimestamps, coverageText, VIDEO_LIMITS } = await import("./video");

// FTYP mp4: 4 byte size + "ftyp" + brand 4 byte.
function ftyp(brand: string): Uint8Array {
  const buf = new Uint8Array(16);
  buf.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
  buf.set([...brand].map((ch) => ch.charCodeAt(0)), 8);
  return buf;
}

describe("detectContainer", () => {
  it("mengenali mp4 dan m4a audio-only", () => {
    expect(detectContainer(ftyp("isom")).kind).toBe("video");
    const audio = detectContainer(ftyp("M4A "));
    expect(audio.kind).toBe("audio");
    expect(audio.mime).toBe("audio/mp4");
  });

  it("mengenali wav, mp3, ogg, amr, dan menolak sampah", () => {
    expect(detectContainer(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])).kind).toBe("audio");
    expect(detectContainer(new Uint8Array([0xff, 0xfb, 0xb0, 0x64])).kind).toBe("audio");
    expect(detectContainer(new Uint8Array([0x4f, 0x67, 0x67, 0x53])).kind).toBe("audio");
    expect(detectContainer(new Uint8Array([0x23, 0x21, 0x41, 0x4d, 0x52])).kind).toBe("audio");
    expect(detectContainer(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])).kind).toBe("unknown");
  });

  it("batas video lebih besar dari audio", () => {
    expect(MEDIA_LIMITS.maxVideoBytes).toBeGreaterThan(MEDIA_LIMITS.maxAudioBytes);
    expect(limitFor("video")).toBe(MEDIA_LIMITS.maxVideoBytes);
    expect(limitFor("unknown")).toBe(MEDIA_LIMITS.maxAudioBytes);
  });
});

describe("parseTranscript", () => {
  it("memberi timestamp dan melabel pembicara A/B", () => {
    const parsed = parseTranscript({
      text: "halo dunia",
      segments: [
        { start: 0.0, end: 1.2, text: "halo", speaker: "spk_pertama" },
        { start: 1.2, end: 2.5, text: "dunia", speaker: "spk_kedua" },
        { start: 2.5, end: 3.0, text: "lagi", speaker: "spk_pertama" },
      ],
    });
    expect(parsed.text).toBe("halo dunia");
    expect(parsed.segments).toHaveLength(3);
    expect(parsed.segments[0]?.speaker).toBe("A");
    expect(parsed.segments[1]?.speaker).toBe("B");
    // Pembicara yang sama → label yang sama, tanpa menebak identitas.
    expect(parsed.segments[2]?.speaker).toBe("A");
    expect(parsed.truncated).toBe(false);
  });

  it("entri cacat dibuang, bukan seluruh hasil gagal", () => {
    const parsed = parseTranscript({
      text: "",
      segments: [
        { start: -1, end: 2, text: "negatif" },
        { start: 0, end: Number.NaN, text: "nan" },
        { start: 0, end: 1, text: "" },
        { start: 5, end: 6, text: "sah" },
      ],
    });
    expect(parsed.segments).toHaveLength(1);
    expect(parsed.segments[0]?.text).toBe("sah");
    expect(parsed.text).toBe("");
  });

  it("payload asing → transkrip kosong yang jujur", () => {
    const parsed = parseTranscript({ tidak: "dikenal" });
    expect(parsed.text).toBe("");
    expect(parsed.segments).toEqual([]);
  });
});

describe("labelSpeakers", () => {
  it("nol dan kosong bukan identitas", () => {
    expect(
      labelSpeakers([null, undefined, "", 0, 0, 1]),
    ).toEqual([undefined, undefined, undefined, "A", "A", "B"]);
  });
});

describe("parseProbeJson", () => {
  const probe = JSON.stringify({
    format: { duration: "125.5" },
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, avg_frame_rate: "30/1" },
      { codec_type: "audio" },
    ],
  });

  it("membaca metadata dan menolak klaim menonton semua frame", () => {
    const meta = parseProbeJson(probe);
    expect(meta.durationSeconds).toBe(125.5);
    expect(meta.hasAudio).toBe(true);
    // Estimasi ada; berapa yang diperiksa ada di plan+coverage, bukan di sini.
    expect(meta.totalFramesEstimate).toBe(Math.round(30 * 125.5));
  });

  it("tanpa aliran video → UNSUPPORTED, bukan metadata karangan", async () => {
    await expect(
      (async () => parseProbeJson(JSON.stringify({ format: {}, streams: [{ codec_type: "audio" }] })))(),
    ).rejects.toMatchObject({ reason: "UNSUPPORTED" });
  });

  it("json rusak → ENGINE_FAILED", async () => {
    const { VideoUnavailable } = await import("./video");
    try {
      parseProbeJson("{bukan json");
      throw new Error("harusnya gagal");
    } catch (err) {
      expect(err).toBeInstanceOf(VideoUnavailable);
    }
  });
});

describe("planFrameTimestamps + coverage", () => {
  it("video 30 detik → 6 frame, 3 jam → dibatasi", () => {
    const short = { durationSeconds: 30, totalFramesEstimate: 900, truncatedDuration: false } as never;
    const stamps = planFrameTimestamps({ durationSeconds: 30 } as never);
    expect(stamps).toEqual([0, 5, 10, 15, 20, 25]);

    const long = planFrameTimestamps({ durationSeconds: 3 * 3600 } as never);
    expect(long.length).toBeLessThanOrEqual(VIDEO_LIMITS.maxFrames);
    expect(planFrameTimestamps(short)).toHaveLength(6);
    expect(long[long.length - 1] as number).toBeLessThan(VIDEO_LIMITS.maxDurationSeconds);
  });

  it("coverage selalu menyebut yang TIDAK diperiksa", () => {
    const text = coverageText(
      { durationSeconds: 65, totalFramesEstimate: 1950, truncatedDuration: false } as never,
      13,
      2,
    );
    expect(text).toMatch(/13 frame/);
    expect(text).toMatch(/TIDAK diperiksa/);
  });

  it("durasi nol/negatif → tidak ada frame", () => {
    expect(planFrameTimestamps({ durationSeconds: 0 } as never)).toEqual([]);
  });
});
