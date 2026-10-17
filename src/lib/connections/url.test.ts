/**
 * Unit test normalisasi base URL (REQ-NT-03, REQ-NT-02, SDD-3.2).
 *
 * Delapan kasus di bawah adalah acceptance criteria REQ-NT-03 yang diminta
 * verbatim; sisanya menutup tepi yang mudah salah: trailing slash berulang,
 * query/fragmen, kredensial tertanam, host cacat, dan masukan non-string.
 */

import { describe, expect, it } from "vitest";
import { buildModelsUrl, normalizeBaseUrl } from "./url";

const HTTPS = { allowInsecureHttp: false };
const HTTP_OK = { allowInsecureHttp: true };

/** Membantu membaca kasus sukses: mengembalikan URL atau melempar dengan sebab. */
function okUrl(raw: string | null | undefined, options = HTTPS): string {
  const result = normalizeBaseUrl(raw, options);
  if (!result.ok) {
    throw new Error(`diharapkan sukses, dapat ${result.reason}: ${result.message}`);
  }
  return result.url;
}

describe("normalizeBaseUrl — 8 kasus acceptance REQ-NT-03", () => {
  it("1. .../v1 dibiarkan tetap (v1 tidak digandakan)", () => {
    expect(okUrl("https://api.tokengateway.ai.id/v1")).toBe(
      "https://api.tokengateway.ai.id/v1",
    );
  });

  it("2. .../v1/ membuang trailing slash", () => {
    expect(okUrl("https://api.tokengateway.ai.id/v1/")).toBe(
      "https://api.tokengateway.ai.id/v1",
    );
  });

  it("3. tanpa v1 dibiarkan apa adanya (v1 tidak ditambahkan)", () => {
    expect(okUrl("https://api.tokengateway.ai.id")).toBe("https://api.tokengateway.ai.id");
  });

  it("4. dengan query ditolak (base URL bukan URL permintaan)", () => {
    const result = normalizeBaseUrl("https://api.tokengateway.ai.id/v1?x=1", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_URL");
    expect(result.message).not.toBe("");
  });

  it("5. skema ftp ditolak", () => {
    const result = normalizeBaseUrl("ftp://contoh.id", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_SCHEME");
  });

  it("6. 'bukan url' ditolak tanpa melempar", () => {
    const result = normalizeBaseUrl("bukan url", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_URL");
  });

  it("7. http://localhost:8080/v1 ditolak saat allowInsecureHttp false, diterima saat true", () => {
    const ditolak = normalizeBaseUrl("http://localhost:8080/v1", HTTP_OK);
    expect(ditolak.ok).toBe(true);

    const tanpaIzin = normalizeBaseUrl("http://localhost:8080/v1", HTTPS);
    expect(tanpaIzin.ok).toBe(false);
    if (tanpaIzin.ok) throw new Error("seharusnya ditolak");
    expect(tanpaIzin.reason).toBe("BAD_SCHEME");

    // Bawaan (opsi tidak diberikan) sama dengan menolak http.
    const bawaan = normalizeBaseUrl("http://localhost:8080/v1");
    expect(bawaan.ok).toBe(false);
  });

  it("8. host dan skema jadi huruf kecil, trailing slash dibuang", () => {
    expect(okUrl("https://API.Contoh.ID/V1/")).toBe("https://api.contoh.id/V1");
  });
});

describe("normalizeBaseUrl — tepi tambahan", () => {
  it("membuang trailing slash berulang, bukan hanya satu", () => {
    expect(okUrl("https://contoh.id/v1///")).toBe("https://contoh.id/v1");
    expect(okUrl("https://contoh.id//")).toBe("https://contoh.id");
  });

  it("memangkas spasi berlebih di ujung", () => {
    expect(okUrl("  https://contoh.id/v1  ")).toBe("https://contoh.id/v1");
  });

  it("menolak masukan kosong, null, dan undefined tanpa melempar", () => {
    for (const raw of ["", "   ", null, undefined]) {
      const result = normalizeBaseUrl(raw, HTTPS);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("seharusnya ditolak");
      expect(result.reason).toBe("BAD_URL");
    }
  });

  it("mempertahankan port eksplisit", () => {
    expect(okUrl("https://contoh.id:8443/v1")).toBe("https://contoh.id:8443/v1");
  });

  it("menerima literal IPv6", () => {
    expect(okUrl("https://[::1]:8080/v1", HTTP_OK)).toBe("https://[::1]:8080/v1");
  });

  it("menerima http hanya bila allowInsecureHttp true, skema tetap huruf kecil", () => {
    expect(okUrl("HTTP://Localhost:8080/V1/", HTTP_OK)).toBe("http://localhost:8080/V1");
  });

  it("menolak fragmen", () => {
    const result = normalizeBaseUrl("https://contoh.id/v1#bagian", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_URL");
  });

  it("menolak kredensial tertanam", () => {
    const result = normalizeBaseUrl("https://user:rahasia@contoh.id/v1", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_URL");
    expect(result.message).not.toContain("rahasia");
  });

  it("menolak host cacat", () => {
    for (const raw of ["https://.com", "https://-x.com", "https://contoh..id", "https://contoh.id."]) {
      const result = normalizeBaseUrl(raw, HTTPS);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error(`seharusnya ditolak: ${raw}`);
      expect(result.reason).toBe("BAD_HOST");
    }
  });

  it("tidak menormalkan huruf besar/kecil pada path (gateway bisa peka huruf)", () => {
    expect(okUrl("https://contoh.id/OpenAI/v1")).toBe("https://contoh.id/OpenAI/v1");
  });

  it("menolak skema javascript:", () => {
    const result = normalizeBaseUrl("javascript:alert(1)", HTTPS);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("seharusnya ditolak");
    expect(result.reason).toBe("BAD_SCHEME");
  });
});

describe("buildModelsUrl — tidak pernah /v1/v1/", () => {
  it("base .../v1 menghasilkan .../v1/models, bukan .../v1/v1/models", () => {
    const base = okUrl("https://api.tokengateway.ai.id/v1");
    const url = buildModelsUrl(base);
    expect(url).toBe("https://api.tokengateway.ai.id/v1/models");
    expect(url).not.toContain("/v1/v1/");
  });

  it("base https://contoh.id menghasilkan https://contoh.id/models", () => {
    const base = okUrl("https://contoh.id");
    expect(buildModelsUrl(base)).toBe("https://contoh.id/models");
  });

  it("tahan terhadap trailing slash yang lolos normalisasi", () => {
    expect(buildModelsUrl("https://contoh.id/v1/")).toBe("https://contoh.id/v1/models");
    expect(buildModelsUrl("https://contoh.id/v1///")).toBe("https://contoh.id/v1/models");
  });

  it("base kosong menghasilkan string kosong, bukan URL setengah jadi", () => {
    expect(buildModelsUrl("")).toBe("");
    expect(buildModelsUrl("   ")).toBe("");
  });

  it("REQ-NT-02: dengan/tanpa trailing slash menghasilkan URL yang sama", () => {
    const dengan = buildModelsUrl(okUrl("https://api.tokengateway.ai.id/v1/"));
    const tanpa = buildModelsUrl(okUrl("https://api.tokengateway.ai.id/v1"));
    expect(dengan).toBe(tanpa);
  });
});
