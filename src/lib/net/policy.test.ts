import { describe, expect, it } from "vitest";
import { ApiError, STATUS } from "@/lib/api/errors";
import {
  assertOutboundAllowed,
  assertRedirectAllowed,
  isBlockedAddress,
  OUTBOUND_LIMITS,
  type HostResolver,
  type OutboundPolicyOptions,
} from "./policy";

/** Opsi paling umum di tes: https, tanpa allowlist, resolver disuntik. */
function options(overrides: Partial<OutboundPolicyOptions> = {}): OutboundPolicyOptions {
  return { allowInsecureHttp: false, allowlist: [], ...overrides };
}

/** Resolver palsu: peta hostname → daftar alamat. Nama yang tidak ada → gagal. */
function resolver(map: Record<string, string[]>): HostResolver {
  return async (hostname) => {
    const found = map[hostname];
    if (!found) throw Object.assign(new Error(`ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return found.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
}

async function expectRejected(
  rawUrl: string,
  opts: OutboundPolicyOptions = options(),
): Promise<ApiError> {
  try {
    await assertOutboundAllowed(rawUrl, opts);
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: STATUS.UNPROCESSABLE, code: "BAD_URL" });
    return err as ApiError;
  }
  throw new Error(`seharusnya ditolak: ${rawUrl}`);
}

describe("isBlockedAddress", () => {
  it("menandai loopback, link-local, privat, dan metadata", () => {
    for (const address of [
      "127.0.0.1",
      "127.255.255.254",
      "10.1.2.3",
      "192.168.1.5",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fc00::1",
      "fd00:ec2::254",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
  });

  it("membiarkan alamat publik dan yang tak dikenal ditolak", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("172.32.0.1")).toBe(false);
    expect(isBlockedAddress("2606:4700:4700::1111")).toBe(false);
    // Bukan IP: gagal ke arah aman.
    expect(isBlockedAddress("bukan-ip")).toBe(true);
  });
});

describe("assertOutboundAllowed — literal", () => {
  it("menolak endpoint metadata cloud (SDD-5.3, bukti inti)", async () => {
    await expectRejected("https://169.254.169.254/latest/meta-data/");
    await expectRejected("http://169.254.169.254/latest/meta-data/", options({ allowInsecureHttp: true }));
    await expectRejected("https://[fd00:ec2::254]/latest/meta-data/");
  });

  it("menolak metadata.google.internal", async () => {
    await expectRejected("https://metadata.google.internal/computeMetadata/v1/");
  });

  it("menolak loopback, privat, dan IPv4-mapped IPv6 dalam segala penulisan", async () => {
    for (const url of [
      "https://127.0.0.1/v1",
      "https://[::1]/v1",
      "https://[0:0:0:0:0:0:0:1]/v1",
      "https://[::ffff:127.0.0.1]/v1",
      "https://10.1.2.3/v1",
      "https://192.168.1.5/v1",
      "https://172.16.0.1/v1",
      "https://172.31.255.255/v1",
      // Bentuk angka lain yang dinormalkan `URL` ke 127.0.0.1.
      "https://2130706433/v1",
      "https://0x7f000001/v1",
      "https://127.1/v1",
      "https://0/v1",
      "https://[::ffff:169.254.169.254]/v1",
    ]) {
      await expectRejected(url);
    }
  });

  it("menolak titik akar di ujung (`localhost.` sama dengan `localhost`)", async () => {
    await expectRejected("https://localhost./v1");
    await expectRejected("https://metadata.google.internal./v1");
  });

  it("menerima alamat publik", async () => {
    await expect(assertOutboundAllowed("https://8.8.8.8/v1", options())).resolves.toBeInstanceOf(URL);
  });
});

describe("assertOutboundAllowed — resolusi DNS", () => {
  it("menolak hostname yang di-resolve ke alamat privat", async () => {
    const resolve = resolver({ "gw.internal.example": ["10.0.0.5"], "meta.example": ["169.254.169.254"] });
    await expectRejected("https://gw.internal.example/v1", options({ resolve }));
    await expectRejected("https://meta.example/v1", options({ resolve }));
  });

  it("menolak bila SATU dari beberapa alamat publik ternyata privat", async () => {
    const resolve = resolver({ "campur.example": ["8.8.8.8", "127.0.0.1"] });
    await expectRejected("https://campur.example/v1", options({ resolve }));
  });

  it("menerima hostname yang seluruh alamatnya publik", async () => {
    const resolve = resolver({ "api.example.test": ["8.8.8.8", "2606:4700:4700::1111"] });
    await expect(
      assertOutboundAllowed("https://api.example.test/v1", options({ resolve })),
    ).resolves.toBeInstanceOf(URL);
  });

  it("membiarkan nama yang gagal di-resolve (galat transport, bukan kebijakan)", async () => {
    const resolve = resolver({});
    await expect(
      assertOutboundAllowed("https://tidak-ada.example/v1", options({ resolve })),
    ).resolves.toBeInstanceOf(URL);
  });
});

describe("assertOutboundAllowed — skema dan kredensial", () => {
  it("menolak http:// saat allowInsecureHttp false, menerima saat true", async () => {
    await expectRejected("http://8.8.8.8/v1", options({ allowInsecureHttp: false }));
    await expect(
      assertOutboundAllowed("http://8.8.8.8/v1", options({ allowInsecureHttp: true })),
    ).resolves.toBeInstanceOf(URL);
  });

  it("menolak skema selain http/https", async () => {
    await expectRejected("file:///etc/passwd");
    await expectRejected("ftp://8.8.8.8/x");
  });

  it("menolak URL dengan kredensial tertanam", async () => {
    await expectRejected("https://user:pass@8.8.8.8/v1");
    await expectRejected("https://user@8.8.8.8/v1");
  });
});

describe("assertOutboundAllowed — allowlist operator", () => {
  it("membuka HANYA host yang disebut, bukan seluruh rentang privat", async () => {
    const allowlist = ["10.0.0.5"];
    await expect(
      assertOutboundAllowed("https://10.0.0.5/v1", options({ allowlist })),
    ).resolves.toBeInstanceOf(URL);
    await expectRejected("https://10.0.0.6/v1", options({ allowlist }));
    await expectRejected("https://10.0.0.7/v1", options({ allowlist }));
  });

  it("allowlist 10.0.0.5:8080 tidak membuka 10.0.0.6 maupun port lain", async () => {
    const allowlist = ["10.0.0.5:8080"];
    await expect(
      assertOutboundAllowed("https://10.0.0.5:8080/v1", options({ allowlist })),
    ).resolves.toBeInstanceOf(URL);
    await expectRejected("https://10.0.0.6:8080/v1", options({ allowlist }));
    await expectRejected("https://10.0.0.5:9090/v1", options({ allowlist }));
  });

  it("allowlist tanpa port cocok untuk port apa pun di host itu", async () => {
    const allowlist = ["10.0.0.5"];
    await expect(
      assertOutboundAllowed("https://10.0.0.5:8080/v1", options({ allowlist })),
    ).resolves.toBeInstanceOf(URL);
  });

  it("membuka hostname privat yang menunjuk ke alamat yang diizinkan", async () => {
    const allowlist = ["gw.internal.example"];
    const resolve = resolver({ "gw.internal.example": ["10.0.0.5"] });
    await expect(
      assertOutboundAllowed("https://gw.internal.example/v1", options({ allowlist, resolve })),
    ).resolves.toBeInstanceOf(URL);
  });

  it("tanpa isi, seluruh rentang privat tetap ditolak", async () => {
    await expectRejected("https://10.0.0.5/v1", options({ allowlist: [] }));
  });
});

describe("assertRedirectAllowed", () => {
  it("menolak redirect lintas host", async () => {
    await expect(
      assertRedirectAllowed("https://api.example.test/v1", "https://lain.example/v1", options()),
    ).rejects.toMatchObject({ status: STATUS.UNPROCESSABLE, code: "BAD_URL" });
  });

  it("menerima redirect ke origin yang sama", async () => {
    await expect(
      assertRedirectAllowed("https://api.example.test/v1", "https://api.example.test/v2", options()),
    ).resolves.toBeInstanceOf(URL);
  });

  it("memvalidasi ulang target: host sama tetapi alamat privat tetap ditolak", async () => {
    const resolve = resolver({ "gw.example.test": ["10.0.0.5"] });
    await expect(
      assertRedirectAllowed("https://gw.example.test/v1", "https://gw.example.test/v2", options({ resolve })),
    ).rejects.toMatchObject({ status: STATUS.UNPROCESSABLE, code: "BAD_URL" });
  });
});

describe("OUTBOUND_LIMITS", () => {
  it("menetapkan batas yang wajar dan konsisten", () => {
    expect(OUTBOUND_LIMITS.connectTimeoutMs).toBeLessThan(OUTBOUND_LIMITS.totalTimeoutMs);
    expect(OUTBOUND_LIMITS.maxResponseBytes).toBeGreaterThan(0);
  });
});
