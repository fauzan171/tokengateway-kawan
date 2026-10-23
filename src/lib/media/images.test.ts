/**
 * Uji pembuatan gambar (WP-NT-P8-01, FIX-16).
 *
 * `@/lib/net` di-mock agar tidak ada resolusi DNS, `fetch` diganti stub.
 * FIX-16: hasil adalah BYTE + mime dari magic bytes, bukan data URL.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net", () => ({
  assertOutboundAllowed: async (url: string) => url,
  fetchOutbound: (url: string, init: RequestInit) => fetch(url, init),
  DEFAULT_OUTBOUND_OPTIONS: { allowInsecureHttp: false, allowlist: [] },
}));

const { generateImage, imageMimeFromBytes } = await import("./images");

const ENV_KEYS = ["MEDIA_IMAGE_MODEL"];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]);

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

const base = { baseUrl: "https://gw.test/v1", apiKey: "rahasia-123", prompt: "kucing" };

describe("imageMimeFromBytes", () => {
  it("mengenali PNG, JPEG, dan menolak yang tak dikenal", () => {
    expect(imageMimeFromBytes(PNG)).toBe("image/png");
    expect(imageMimeFromBytes(JPEG)).toBe("image/jpeg");
    expect(imageMimeFromBytes(new Uint8Array([1, 2, 3]))).toBe("application/octet-stream");
  });
});

describe("generateImage", () => {
  it("tanpa MEDIA_IMAGE_MODEL → 409 MEDIA_NOT_CONFIGURED, tanpa fetch", async () => {
    await expect(generateImage(base)).rejects.toMatchObject({
      status: 409,
      code: "MEDIA_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prompt kosong → 400 INVALID_PROMPT", async () => {
    process.env["MEDIA_IMAGE_MODEL"] = "gpt-image-1";
    await expect(generateImage({ ...base, prompt: "   " })).rejects.toMatchObject({
      status: 400,
      code: "INVALID_PROMPT",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("b64_json → byte PNG, bukan data URL", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ b64_json: Buffer.from(PNG).toString("base64") }] }),
    );
    const image = await generateImage({ ...base, model: "gpt-image-1" });
    expect(image.mime).toBe("image/png");
    expect(Buffer.from(image.bytes)).toEqual(Buffer.from(PNG));
    expect(image).not.toHaveProperty("dataUrl");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://gw.test/v1/images/generations");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-image-1",
      prompt: "kucing",
      size: "1024x1024",
      response_format: "b64_json",
      n: 1,
    });
  });

  it("500 → 502 IMAGE_FAILED, pesan tidak memuat apiKey/baseUrl", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "model tidak dikenal" } }, 500),
    );
    try {
      await generateImage({ ...base, model: "gpt-image-1" });
      throw new Error("seharusnya gagal");
    } catch (err) {
      const error = err as { status: number; code: string; message: string };
      expect(error.status).toBe(502);
      expect(error.code).toBe("IMAGE_FAILED");
      expect(error.message).toBe("model tidak dikenal");
      expect(error.message).not.toContain("rahasia-123");
      expect(error.message).not.toContain("gw.test");
    }
  });

  it("hanya url → diunduh, mime dari magic bytes bukan header", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [{ url: "https://cdn.test/a.png" }] }))
      .mockResolvedValueOnce(
        // Header berbohong: mengaku webp, isinya PNG.
        new Response(PNG, { status: 200, headers: { "content-type": "image/webp" } }),
      );
    const image = await generateImage({ ...base, model: "gpt-image-1" });
    expect(image.mime).toBe("image/png");
    expect(Buffer.from(image.bytes)).toEqual(Buffer.from(PNG));
  });

  it("byte bukan gambar → 502 IMAGE_FORMAT_UNSUPPORTED", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ b64_json: Buffer.from([1, 2, 3, 4]).toString("base64") }] }),
    );
    await expect(generateImage({ ...base, model: "gpt-image-1" })).rejects.toMatchObject({
      status: 502,
      code: "IMAGE_FORMAT_UNSUPPORTED",
    });
  });

  it("b64_json kosong → 502 IMAGE_FAILED", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ b64_json: "" }] }));
    await expect(generateImage({ ...base, model: "gpt-image-1" })).rejects.toMatchObject({
      status: 502,
      code: "IMAGE_FAILED",
    });
  });
});
