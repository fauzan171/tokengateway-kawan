/**
 * SDD-9.3 butir 2 — SSRF.
 *
 * Kebijakan sudah diuji satuan di `src/lib/net/policy.test.ts`; berkas ini
 * menguji HAL YANG BERBEDA: apakah kebijakan itu benar-benar dipakai di jalur
 * nyata, sebelum `fetch`. Bukti terkuat bukan "galat dilempar" tetapi
 * "`fetch` tidak pernah dipanggil".
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { fetchJson } from "@/lib/api/http";
import {
  assertOutboundAllowed,
  assertRedirectAllowed,
  DEFAULT_OUTBOUND_OPTIONS,
  type HostResolver,
} from "@/lib/net";

/** Resolver tanpa jaringan: hanya nama di peta, sisanya gagal seperti ENOTFOUND. */
const resolver: HostResolver = async (hostname) => {
  const map: Record<string, string> = {
    "internal.contoh.test": "10.1.2.3",
    "publik.contoh.test": "93.184.216.34",
  };
  const address = map[hostname];
  if (!address) throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
  return [{ address, family: 4 }];
};

const options = { ...DEFAULT_OUTBOUND_OPTIONS, resolve: resolver };

/** `fetch` palsu yang mencatat setiap panggilan; balasannya JSON kosong. */
function spyFetch() {
  return vi.fn(async () => new Response("{}", { status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("alamat yang selalu ditolak", () => {
  const blocked = [
    "http://169.254.169.254/latest/meta-data/",
    "http://[fd00:ec2::254]/",
    "http://127.0.0.1/",
    "http://localhost/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://0.0.0.0/",
    "http://metadata.google.internal/",
  ];

  it("ditolak walau http polos diizinkan (ALLOW_INSECURE_HTTP=1)", async () => {
    const insecure = { ...options, allowInsecureHttp: true };
    for (const url of blocked) {
      await expect(assertOutboundAllowed(url, insecure), url).rejects.toBeInstanceOf(ApiError);
    }
  });

  it("skema selain http/https ditolak", async () => {
    for (const url of ["file:///etc/passwd", "gopher://contoh.test/", "data:text/plain,halo"]) {
      await expect(assertOutboundAllowed(url, options), url).rejects.toBeInstanceOf(ApiError);
    }
  });
});

describe("ALLOW_INSECURE_HTTP", () => {
  it("tidak membuka alamat privat, hanya membuka http polos ke host publik", async () => {
    const insecure = { ...options, allowInsecureHttp: true };
    await expect(assertOutboundAllowed("http://publik.contoh.test/v1", insecure)).resolves.toBeInstanceOf(
      URL,
    );
    await expect(assertOutboundAllowed("http://internal.contoh.test/v1", insecure)).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("tanpa izin, http polos ditolak bahkan ke host publik", async () => {
    await expect(assertOutboundAllowed("http://publik.contoh.test/v1", options)).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("nama yang menunjuk alamat privat (DNS, bukan literal)", () => {
  it("hostname publik yang resolve ke 10/8 ditolak", async () => {
    await expect(assertOutboundAllowed("https://internal.contoh.test/v1", options)).rejects.toMatchObject({
      code: "BAD_URL",
    });
  });

  it("redirect lintas host ditolak", async () => {
    await expect(
      assertRedirectAllowed("https://publik.contoh.test/a", "https://internal.contoh.test/b", options),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("jalur nyata: fetchJson", () => {
  it("alamat metadata ditolak sebelum fetch — fetch tidak pernah dipanggil", async () => {
    const fetchMock = spyFetch();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alamat privat ditolak sebelum fetch walau https", async () => {
    const fetchMock = spyFetch();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://10.0.0.5/v1/models")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("302 ke alamat metadata ditolak sebelum target kedua dipanggil", async () => {
    const fetchMock = vi.fn(async (url: URL | string) => {
      const target = String(url);
      if (target.includes("169.254.169.254")) {
        throw new Error(`target privat terpanggil: ${target}`);
      }
      return new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://publik.contoh.test/v1", { outbound: options })).rejects.toMatchObject({
      code: "BAD_URL",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("302 lintas host publik juga ditolak", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: "https://lain.contoh.test/v2" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://publik.contoh.test/v1", { outbound: options })).rejects.toMatchObject({
      code: "BAD_URL",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST tidak mengikuti redirect sama sekali", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 307, headers: { location: "https://publik.contoh.test/v2" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJson("https://publik.contoh.test/v1", { method: "POST", body: { a: 1 }, outbound: options }),
    ).rejects.toMatchObject({ code: "BAD_URL" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redirect GET ke origin sama tetap diikuti", async () => {
    const fetchMock = vi.fn(async (url: URL | string) => {
      const target = String(url);
      if (target.endsWith("/v2")) return new Response("{}", { status: 200 });
      return new Response(null, { status: 302, headers: { location: "/v2" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://publik.contoh.test/v1", { outbound: options })).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("host publik tetap di-fetch: kebijakan tidak memblokir semua", async () => {
    const fetchMock = spyFetch();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJson("https://publik.contoh.test/v1", { outbound: options })).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
