/**
 * Uji klien gateway (WP-NT-P2-05, REQ-NT-02, REQ-NT-18, SDD-3.3).
 *
 * Semua jaringan dimatikan dengan mengganti `globalThis.fetch`. Pemeriksaan
 * kebijakan keluar (SSRF) tetap berjalan sungguhan: host uji dimasukkan
 * allowlist supaya tidak ada resolusi DNS nyata, lalu `fetch` yang dipalsukan
 * mengembalikan balasan fixture. Jadi rantai nyata `listModels → fetchJson →
 * kebijakan keluar` tetap diuji, bukan stub.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { listModels, type ListModelsInput } from "./gateway";

const BASE = "http://gateway.contoh.test/v1";
const KEY = "sk-uji-panjang-sekali-abc1";

/** Kebijakan keluar uji: host fixture ada di allowlist, jadi tanpa DNS nyata. */
const OUTBOUND = {
  allowInsecureHttp: true,
  allowlist: ["gateway.contoh.test"],
} as const;

function input(overrides: Partial<ListModelsInput> = {}): ListModelsInput {
  return { baseUrl: BASE, apiKey: KEY, outbound: OUTBOUND, ...overrides };
}

function mockFetch(response: Response | Error): ReturnType<typeof vi.spyOn> {
  const spy = vi.spyOn(globalThis, "fetch");
  if (response instanceof Error) spy.mockRejectedValue(response);
  else spy.mockResolvedValue(response);
  return spy;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listModels — bentuk balasan yang diterima", () => {
  it("membaca {data:[...]} dan menghitung model dengan benar", async () => {
    mockFetch(
      json({
        data: [
          { id: "gpt-4o-mini", label: "GPT-4o mini" },
          { id: "gpt-4o" },
          { id: "o3-mini" },
        ],
      }),
    );

    const result = await listModels(input());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models).toHaveLength(3);
    expect(result.models.map((m) => m.id)).toEqual(["gpt-4o-mini", "gpt-4o", "o3-mini"]);
    expect(result.models[0]?.label).toBe("GPT-4o mini");
  });

  it("membaca array langsung", async () => {
    mockFetch(json([{ id: "a" }, { id: "b" }]));
    const result = await listModels(input());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("membaca {models:[...]}", async () => {
    mockFetch(json({ models: [{ name: "model-x" }] }));
    const result = await listModels(input());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models[0]?.id).toBe("model-x");
  });

  it("memanggil {baseUrl}/models tanpa /v1/v1 dan mengirim Bearer key", async () => {
    const spy = mockFetch(json({ data: [{ id: "a" }] }));
    await listModels(input());

    expect(spy).toHaveBeenCalledTimes(1);
    // `fetchJson` meneruskan `URL` hasil pemeriksaan kebijakan keluar.
    const [calledUrl, init] = spy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(calledUrl)).toBe(`${BASE}/models`);
    expect(String(calledUrl)).not.toContain("/v1/v1");
    expect((init.headers as Record<string, string>)["authorization"]).toBe(`Bearer ${KEY}`);
  });

  it("tidak mengirim header Authorization bila key kosong", async () => {
    const spy = mockFetch(json({ data: [{ id: "a" }] }));
    await listModels(input({ apiKey: "" }));

    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["authorization"]).toBeUndefined();
  });
});

describe("listModels — kapabilitas tidak ditebak (SDD-3.3, REQ-NT-21/69)", () => {
  it("meneruskan kapabilitas yang diumumkan gateway (true saja)", async () => {
    mockFetch(
      json({
        data: [
          {
            id: "m",
            capabilities: { vision: true, tools: true, imageGen: false, audio: false },
          },
        ],
      }),
    );

    const result = await listModels(input());
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models[0]?.capabilities).toEqual({ vision: true, tools: true });
  });

  it("OMIT capabilities bila gateway tidak mengumumkan apa pun", async () => {
    mockFetch(json({ data: [{ id: "gpt-4o-mini" }] }));

    const result = await listModels(input());
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models[0]).not.toHaveProperty("capabilities");
  });

  it("tidak menebak visi dari nama model (tanpa metadata → tanpa capabilities)", async () => {
    mockFetch(json({ data: [{ id: "gpt-4o-vision-preview" }, { id: "llava" }] }));

    const result = await listModels(input());
    if (!result.ok) throw new Error("seharusnya sukses");
    for (const model of result.models) {
      expect(model).not.toHaveProperty("capabilities");
    }
  });

  it("field kapabilitas tak dikenal diabaikan, bukan diteruskan", async () => {
    mockFetch(json({ data: [{ id: "m", capabilities: { vision: true, pikiran: true } }] }));

    const result = await listModels(input());
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models[0]?.capabilities).toEqual({ vision: true });
  });
});

describe("listModels — kegagalan dikembalikan, bukan dilempar", () => {
  it("daftar kosong → EMPTY_MODELS, bukan sukses", async () => {
    mockFetch(json({ data: [] }));

    const result = await listModels(input());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("EMPTY_MODELS");
    expect(result.models).toEqual([]);
  });

  it("401 → UNAUTHORIZED + \"Key ditolak oleh gateway.\"", async () => {
    mockFetch(json({ error: { message: "nope" } }, 401));

    const result = await listModels(input());
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UNAUTHORIZED");
    expect(result.message).toBe("Key ditolak oleh gateway.");
  });

  it("timeout → TIMEOUT + \"Gateway tidak merespons.\"", async () => {
    mockFetch(Object.assign(new Error("timeout"), { name: "TimeoutError" }));

    const result = await listModels(input());
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("TIMEOUT");
    expect(result.message).toBe("Gateway tidak merespons.");
  });

  it("5xx → UPSTREAM_ERROR", async () => {
    mockFetch(json({ error: "boom" }, 503));

    const result = await listModels(input());
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UPSTREAM_ERROR");
  });

  it("balasan bukan JSON → UPSTREAM_ERROR, tidak melempar", async () => {
    mockFetch(new Response("<html>bukan json</html>", { status: 200 }));

    const result = await listModels(input());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UPSTREAM_ERROR");
    expect(result.message).not.toBe("");
  });

  it("bentuk JSON tak dikenal → UPSTREAM_ERROR, tidak melempar", async () => {
    mockFetch(json({ hasil: "tak terduga" }));

    const result = await listModels(input());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UPSTREAM_ERROR");
  });

  it("baseUrl kosong → melempar ApiError BAD_URL (galat programmer)", async () => {
    await expect(listModels(input({ baseUrl: "  " }))).rejects.toMatchObject({ code: "BAD_URL" });
  });
});
