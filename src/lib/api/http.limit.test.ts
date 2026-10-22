import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http";

const outbound = { allowInsecureHttp: true, allowlist: ["127.0.0.1:1"] };
const url = "http://127.0.0.1:1/gateway";

// Response sintetis yang tidak menyentuh jaringan.
function fakeResponse(init: {
  status?: number;
  headers?: Record<string, string>;
  body?: ReadableStream<Uint8Array> | null;
}): Response {
  return new Response(init.body ?? null, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const jsonOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("batas byte respons keluar", () => {
  it("menolak lewat content-length besar tanpa membaca body", async () => {
    const body = streamOf([jsonOf({ ok: true })]);
    const readSpy = vi.spyOn(ReadableStream.prototype, "getReader");
    const fetchMock = vi.fn(async () =>
      fakeResponse({
        headers: { "content-length": String(50 * 1024 * 1024) },
        body,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson(url, { outbound })).rejects.toMatchObject({
      code: "UPSTREAM_TOO_LARGE",
      status: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Body tidak dibaca; stream langsung dibatalkan.
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("menolak body yang melampaui batas saat streaming (tanpa content-length)", async () => {
    // Batas 10 MiB: 11 potongan 1 MiB = 11 MiB di memori sebelum tertolak.
    const chunk = new Uint8Array(1024 * 1024);
    const fetchMock = vi.fn(async () =>
      fakeResponse({ body: streamOf(Array.from({ length: 11 }, () => chunk)) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson(url, { outbound })).rejects.toMatchObject({
      code: "UPSTREAM_TOO_LARGE",
      status: 502,
    });
  });

  it("body normal tetap diparse JSON seperti sebelumnya (regresi)", async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ body: streamOf([jsonOf({ models: ["a"] })]) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJson<{ models: string[] }>(url, { outbound });
    expect(result).toEqual({ status: 200, data: { models: ["a"] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
