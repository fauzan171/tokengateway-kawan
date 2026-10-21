import { afterAll, beforeAll, expect, it } from "vitest";
import { startProviderFixture, type ProviderFixture } from "../../../tests/fixtures/provider-server";
import { fetchJson } from "./http";

let fixture: ProviderFixture;
beforeAll(async () => { fixture = await startProviderFixture(); });
afterAll(async () => { await fixture.close(); });

it("menolak redirect discovery tanpa menghubungi target redirect", async () => {
  await expect(fetchJson(`${fixture.baseUrl}/models`, {
    headers: { "x-kawan-scenario": "redirect", authorization: "Bearer canary-redirect" },
    outbound: { allowInsecureHttp: true, allowlist: [new URL(fixture.baseUrl).host] },
  })).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  expect(fixture.requests.map((request) => request.path)).toEqual(["/models"]);
});
