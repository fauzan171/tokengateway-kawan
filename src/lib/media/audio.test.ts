/**
 * Uji STT/TTS (WP-NT-P8-03/04).
 *
 * `@/lib/net` di-mock; `fetch` diganti stub. Tidak ada permintaan keluar.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  // Tanpa ini modul yang memakai fetchOutbound akan gagal sebelum stub dipanggil.
  fetchOutbound: (url: string, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { synthesizeSpeech, transcribeAudio } = await import("./audio");

const ENV_KEYS = ["MEDIA_STT_MODEL", "MEDIA_TTS_MODEL", "MEDIA_TTS_VOICE"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

const audio = () => new Blob(["abc"], { type: "audio/webm" });

describe("transcribeAudio", () => {
  it("mengembalikan teks dari gateway", async () => {
    process.env["MEDIA_STT_MODEL"] = "whisper-1";
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: "halo" }));

    await expect(
      transcribeAudio({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        file: audio(),
        filename: "rekaman.webm",
      }),
    ).resolves.toEqual({ text: "halo" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gw.test/v1/audio/transcriptions");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect((form.get("file") as File).name).toBe("rekaman.webm");
  });

  it("teks kosong → 502 TRANSCRIBE_EMPTY", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: "" }));
    await expect(
      transcribeAudio({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        model: "whisper-1",
        file: audio(),
        filename: "a.webm",
      }),
    ).rejects.toMatchObject({ status: 502, code: "TRANSCRIBE_EMPTY" });
  });

  it("tanpa konfigurasi → 409 MEDIA_NOT_CONFIGURED", async () => {
    await expect(
      transcribeAudio({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        file: audio(),
        filename: "a.webm",
      }),
    ).rejects.toMatchObject({ status: 409, code: "MEDIA_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("berkas > 25 MB → 413 AUDIO_TOO_LARGE", async () => {
    const big = new Blob([new Uint8Array(25 * 1024 * 1024 + 1)], { type: "audio/wav" });
    await expect(
      transcribeAudio({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        model: "whisper-1",
        file: big,
        filename: "besar.wav",
      }),
    ).rejects.toMatchObject({ status: 413, code: "AUDIO_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("synthesizeSpeech", () => {
  it("memotong input di 4000 karakter", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    const long = "a".repeat(5000);
    const result = await synthesizeSpeech({
      baseUrl: "https://gw.test/v1",
      apiKey: "kunci",
      model: "tts-1",
      text: long,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { input: string; voice: string };
    expect(body.input).toHaveLength(4000);
    expect(body.voice).toBe("alloy");
    expect(result.mime).toBe("audio/mpeg");
    expect(result.bytes.length).toBe(2);
  });

  it("mime diambil dari content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([9]), {
        status: 200,
        headers: { "content-type": "audio/wav; charset=binary" },
      }),
    );
    const result = await synthesizeSpeech({
      baseUrl: "https://gw.test/v1",
      apiKey: "kunci",
      model: "tts-1",
      text: "halo",
    });
    expect(result.mime).toBe("audio/wav");
  });

  it("tanpa konfigurasi → 409 MEDIA_NOT_CONFIGURED", async () => {
    await expect(
      synthesizeSpeech({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        text: "halo",
      }),
    ).rejects.toMatchObject({ status: 409, code: "MEDIA_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("galat jaringan → 502 MEDIA_UPSTREAM", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(
      synthesizeSpeech({
        baseUrl: "https://gw.test/v1",
        apiKey: "kunci",
        model: "tts-1",
        text: "halo",
      }),
    ).rejects.toMatchObject({ status: 502, code: "MEDIA_UPSTREAM" });
  });
});
