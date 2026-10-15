/**
 * Pemeriksaan fixture provider (WP-NT-P0-06, SDD-9.1).
 *
 * Satu uji per skenario wajib. Fixture mengikat loopback dan penjaga SSRF
 * `lib/api/http.ts` menolaknya, jadi uji ini memanggil `fetch` langsung.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CORRUPTED_BODY,
  SCENARIOS,
  TOOL_CALL_ID,
  TOOL_CALL_NAME,
  UNICODE_TEXT,
  modelFor,
  startProviderFixture,
  type ProviderFixture,
} from "./fixtures/provider-server";

let fixture: ProviderFixture;

beforeAll(async () => {
  fixture = await startProviderFixture();
});

afterAll(async () => {
  await fixture.close();
});

function post(scenario: (typeof SCENARIOS)[number], signal?: AbortSignal): Promise<Response> {
  return fetch(`${fixture.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: modelFor(scenario), messages: [] }),
    signal,
  });
}

/** Membaca stream SSE jadi potongan teks `data:` yang sudah di-parse. */
async function readSse(res: Response): Promise<{ events: unknown[]; raw: string }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const events: unknown[] = [];

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf("\n\n");
    while (index !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const line = frame.replace(/^data: /, "");
      if (line !== "[DONE]") events.push(JSON.parse(line));
      index = buffer.indexOf("\n\n");
    }
  }

  return { events, raw: decoder.decode() };
}

describe("fixture provider", () => {
  it("memilih skenario dari header x-kawan-scenario", async () => {
    const res = await fetch(`${fixture.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-kawan-scenario": "usage-absent" },
      body: JSON.stringify({ model: "apa-saja" }),
    });
    await res.text();

    expect(fixture.requests.at(-1)?.scenario).toBe("usage-absent");
  });

  it("unicode-split: potongan byte terbelah tetap utuh setelah decode streaming", async () => {
    const res = await post("unicode-split");
    const { events } = await readSse(res);

    const text = events
      .map((event) => (event as { choices: { delta: { content?: string } }[] }).choices[0].delta.content ?? "")
      .join("");

    expect(text).toBe(UNICODE_TEXT);
    expect(text).not.toContain("�");
  });

  it("tool-call: mengirim delta tool_calls lengkap dengan argumen", async () => {
    const res = await post("tool-call");
    const { events } = await readSse(res);

    const calls = events
      .flatMap((event) => (event as { choices: { delta: { tool_calls?: unknown[] } }[] }).choices[0].delta.tool_calls ?? [])
      .reduce<Record<string, string>>((acc, call) => {
        const entry = call as { id?: string; function?: { name?: string; arguments?: string } };
        if (entry.id) acc.id = entry.id;
        if (entry.function?.name) acc.name = entry.function.name;
        acc.args = (acc.args ?? "") + (entry.function?.arguments ?? "");
        return acc;
      }, {});

    expect(calls.id).toBe(TOOL_CALL_ID);
    expect(calls.name).toBe(TOOL_CALL_NAME);
    expect(JSON.parse(calls.args)).toEqual({ kota: "Jakarta" });
  });

  it("usage-present: chunk terakhir membawa usage", async () => {
    const res = await post("usage-present");
    const { events } = await readSse(res);

    const usage = events.at(-1) as { usage?: { total_tokens: number } };
    expect(usage.usage?.total_tokens).toBe(18);
  });

  it("usage-absent: tidak ada usage sama sekali", async () => {
    const res = await post("usage-absent");
    const { events } = await readSse(res);

    expect(events.some((event) => "usage" in (event as object))).toBe(false);
  });

  it("timeout: header terkirim lalu stream menggantung", async () => {
    const controller = new AbortController();
    const res = await post("timeout", controller.signal);
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);

    // Tidak ada data lagi: pembacaan berikutnya hanya selesai karena abort.
    const pending = reader.read();
    controller.abort();
    await expect(pending).rejects.toThrow();
  });

  it("unauthorized: 401 JSON", async () => {
    const res = await post("unauthorized");
    expect(res.status).toBe(401);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ error: { type: "invalid_request_error" } });
  });

  it("rate-limited: 429 dengan Retry-After", async () => {
    const res = await post("rate-limited");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("2");
    expect(await res.json()).toMatchObject({ error: { type: "rate_limit_error" } });
  });

  it("corrupted: 200 tapi body bukan JSON utuh", async () => {
    const res = await post("corrupted");
    expect(res.status).toBe(200);

    const body = await res.text();
    expect(body).toBe(CORRUPTED_BODY);
    expect(() => JSON.parse(body)).toThrow();
  });

  it("drop: koneksi putus di tengah stream", async () => {
    const res = await post("drop");
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    await expect(
      (async () => {
        for (;;) {
          const { done } = await reader.read();
          if (done) break;
        }
      })(),
    ).rejects.toThrow();
  });
});
