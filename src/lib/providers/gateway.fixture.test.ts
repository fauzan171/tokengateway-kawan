/**
 * Uji integrasi klien gateway lewat socket nyata di loopback (WP-NT-P2-05).
 *
 * Beda dari `gateway.test.ts` yang mengganti `globalThis.fetch`: di sini
 * `fetchJson`, timeout `AbortSignal`, dan kebijakan keluar/SSRF berjalan
 * sungguhan, hanya saja tujuannya server lokal. Tidak ada jaringan luar.
 *
 * Allowlist presisi `127.0.0.1:<port>` dipakai apa adanya (SDD-5.3): inilah
 * satu-satunya cara loopback boleh dihubungi, dan itu membuktikan allowlist
 * operator benar-benar bekerja pada jalur klien gateway.
 *
 * Catatan jujur: fixture bersama `tests/fixtures/provider-server.ts` TIDAK
 * dipakai karena ia melayani skenario streaming chat dan mengabaikan path,
 * sedangkan yang dibutuhkan di sini adalah balasan `/models` berbentuk JSON.
 * Karena itu server kecil di bawah ini dibangun khusus.
 */

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listModels } from "./gateway";

type Handler = (path: string) => { status: number; body: string; contentType?: string };

let server: Server;
let baseUrl: string;
let port: string;
let handler: Handler;

beforeAll(async () => {
  server = createServer((req, res) => {
    const result = handler(req.url ?? "/");
    res.writeHead(result.status, {
      "content-type": result.contentType ?? "application/json",
    });
    res.end(result.body);
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const address = server.address() as AddressInfo;
  port = String(address.port);
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Hanya loopback ini yang diizinkan keluar; tanpa allowlist, SSRF menolaknya. */
function outbound() {
  return { allowInsecureHttp: true, allowlist: [`127.0.0.1:${port}`] };
}

describe("listModels lewat socket loopback nyata", () => {
  it("membaca {data:[...]} dan memakai base URL apa adanya (tanpa v1 ganda)", async () => {
    let seenPath = "";
    handler = (path) => {
      seenPath = path;
      return { status: 200, body: JSON.stringify({ data: [{ id: "a" }, { id: "b" }] }) };
    };

    const result = await listModels({ baseUrl, apiKey: "sk-uji", outbound: outbound() });

    expect(seenPath).toBe("/models");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("seharusnya sukses");
    expect(result.models.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("401 nyata → UNAUTHORIZED + \"Key ditolak oleh gateway.\"", async () => {
    handler = () => ({ status: 401, body: JSON.stringify({ error: { message: "nope" } }) });

    const result = await listModels({ baseUrl, apiKey: "sk-salah", outbound: outbound() });

    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UNAUTHORIZED");
    expect(result.message).toBe("Key ditolak oleh gateway.");
  });

  it("5xx nyata → UPSTREAM_ERROR", async () => {
    handler = () => ({ status: 500, body: JSON.stringify({ error: "boom" }) });

    const result = await listModels({ baseUrl, apiKey: "sk-uji", outbound: outbound() });

    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UPSTREAM_ERROR");
  });

  it("balasan bukan JSON → UPSTREAM_ERROR, tidak melempar", async () => {
    handler = () => ({ status: 200, body: "<html>bukan json</html>", contentType: "text/html" });

    const result = await listModels({ baseUrl, apiKey: "sk-uji", outbound: outbound() });

    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("UPSTREAM_ERROR");
  });

  it("server menggantung → TIMEOUT + \"Gateway tidak merespons.\"", async () => {
    handler = () => ({ status: 200, body: "" });
    // Server tidak menutup respons: `writeHead` saja tanpa `end`.
    server.removeAllListeners("request");
    server.on("request", (_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
    });

    const result = await listModels({
      baseUrl,
      apiKey: "sk-uji",
      outbound: outbound(),
      timeoutMs: 150,
    });

    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("TIMEOUT");
    expect(result.message).toBe("Gateway tidak merespons.");
  });

  it("loopback TANPA allowlist ditolak kebijakan keluar (SSRF)", async () => {
    handler = () => ({ status: 200, body: JSON.stringify({ data: [{ id: "a" }] }) });

    const result = await listModels({
      baseUrl,
      apiKey: "sk-uji",
      outbound: { allowInsecureHttp: true, allowlist: [] },
    });

    if (result.ok) throw new Error("seharusnya gagal");
    expect(result.reason).toBe("BAD_URL");
  });
});
