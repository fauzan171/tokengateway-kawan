import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

/** Permintaan dengan `Host` tetap; `origin` null berarti header tidak dikirim. */
function request(method: string, origin: string | null): NextRequest {
  const headers = new Headers({ host: "kawan.example.test" });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest("https://kawan.example.test/api/kawan/v1/chats", { method, headers });
}

describe("middleware origin guard", () => {
  it("menerima mutasi dari origin sendiri", () => {
    const response = middleware(request("POST", "https://kawan.example.test"));
    expect(response.status).toBe(200);
  });

  it("menolak mutasi dari origin lain", () => {
    const response = middleware(request("POST", "https://jahat.example"));
    expect(response.status).toBe(403);
  });

  it("menolak host yang mirip tetapi berbeda port atau subdomain", () => {
    expect(middleware(request("DELETE", "https://kawan.example.test:8443")).status).toBe(403);
    expect(middleware(request("PATCH", "https://lain.kawan.example.test")).status).toBe(403);
  });

  it("menolak origin berbentuk null", () => {
    expect(middleware(request("POST", "null")).status).toBe(403);
  });

  it("membiarkan GET dan permintaan tanpa Origin lewat", () => {
    expect(middleware(request("GET", "https://jahat.example")).status).toBe(200);
    expect(middleware(request("POST", null)).status).toBe(200);
  });
});